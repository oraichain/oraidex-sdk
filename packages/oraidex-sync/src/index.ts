import { SyncData, Txs, WriteData } from "@oraichain/cosmos-rpc-sync";
import "dotenv/config";
import { DuckDb } from "./db";
import { concatAprHistoryToUniqueKey, concatLpHistoryToUniqueKey, getAllFees, getSymbolFromAsset } from "./helper";
import { parseAssetInfo, parsePoolAmount } from "./parse";
import {
  calculateBoostApr,
  fetchAprResult,
  getAllPairInfos,
  getAvgPoolLiquidities,
  getPairByAssetInfos,
  getPoolInfos,
  getPoolLiquidities,
  handleEventApr
} from "./pool-helper";
import { parseTxs } from "./tx-parsing";
import { Env, Ohlcv, PairInfoData, PoolAmountHistory, PoolApr, SwapOperationData, TxAnlysisResult } from "./types";
import WebSocket from "ws";
import { IncomingMessage } from "http";

class WriteOrders extends WriteData {
  wss: WebSocket.Server<typeof WebSocket, typeof IncomingMessage>;
  constructor(wss: WebSocket.Server<typeof WebSocket, typeof IncomingMessage>, public duckDb: DuckDb) {
    super();
    this.wss = wss;
  }

  private async insertParsedTxs(txs: TxAnlysisResult) {
    const handleEmitEventTicker = () => {
      this.handleBroadcastOhlcv({ ticks: txs.ohlcv });
    };

    await Promise.all([
      this.duckDb.insertSwapOps(txs.swapOpsData),
      this.duckDb.insertLpOps([...txs.provideLiquidityOpsData, ...txs.withdrawLiquidityOpsData]),
      this.duckDb.insertOhlcv(txs.ohlcv, handleEmitEventTicker),
      this.duckDb.insertEarningHistories(txs.claimOpsData),
      this.duckDb.insertPoolAmountHistory(txs.poolAmountHistories)
    ]);
  }

  async handleBroadcastOhlcv({ ticks }) {
    this.wss.clients.forEach((ws) => {
      ws.send(
        JSON.stringify({
          event: "ohlcv",
          data: ticks.map((tick) => {
            return { ...tick, volume: Number(tick.volume) };
          })
        })
      );
    });
  }

  async process(chunk: any): Promise<boolean> {
    try {
      const { txs, offset: newOffset } = chunk as Txs;
      const currentOffset = await this.duckDb.loadHeightSnapshot();
      // edge case. If no new block has been found, then we skip processing to prevent duplication handling
      if (currentOffset === newOffset) return true;
      const result = await parseTxs(txs);

      // trigger update info relate apr such as: total bond, total supply, reward per sec, etc.
      const lpOpsData = [...result.provideLiquidityOpsData, ...result.withdrawLiquidityOpsData];
      await handleEventApr(txs, lpOpsData, newOffset);

      // hash to be promise all because if inserting height pass and txs fail then we will have duplications
      await this.duckDb.insertHeightSnapshot(newOffset);
      await this.insertParsedTxs(result);
      console.log("new offset: ", newOffset);

      const lpOps = await this.duckDb.queryLpOps();
      const swapOpsCount = await this.duckDb.querySwapOps();
      console.log("lp ops: ", lpOps.length);
      console.log("swap ops: ", swapOpsCount);
    } catch (error) {
      console.trace("error processing data: ", error);
      return false;
    }
    return true;
  }
}

class OraiDexSync {
  protected constructor(
    private readonly duckDb: DuckDb,
    private readonly wss: WebSocket.Server<typeof WebSocket, typeof IncomingMessage>,
    private readonly rpcUrl: string,
    private readonly env: Env
  ) {}

  public static async create(
    duckDb: DuckDb,
    wss: WebSocket.Server<typeof WebSocket, typeof IncomingMessage>,
    rpcUrl: string,
    env: Env
  ): Promise<OraiDexSync> {
    return new OraiDexSync(duckDb, wss, rpcUrl, env);
  }

  private async updateLatestPairInfos() {
    try {
      console.time("timer-updateLatestPairInfos");
      const pairInfos = await getAllPairInfos();
      const allPools = await this.duckDb.getPools();

      if (allPools.length > 0 && pairInfos.length === allPools.length) return false;
      await this.duckDb.insertPairInfos(
        pairInfos.map((pair) => {
          const symbols = getSymbolFromAsset(pair.asset_infos);
          const pairMapping = getPairByAssetInfos(pair.asset_infos);
          return {
            firstAssetInfo: parseAssetInfo(pairMapping.asset_infos[0]),
            secondAssetInfo: parseAssetInfo(pairMapping.asset_infos[1]),
            commissionRate: pair.commission_rate,
            pairAddr: pair.contract_addr,
            liquidityAddr: pair.liquidity_token,
            oracleAddr: pair.oracle_addr,
            symbols,
            fromIconUrl: "url1",
            toIconUrl: "url2"
          } as PairInfoData;
        })
      );
      console.timeEnd("timer-updateLatestPairInfos");
      return true;
    } catch (error) {
      console.log("error in updateLatestPairInfos: ", error);
    }
  }

  private async updateLatestLpAmountHistory(currentHeight: number, isNewPool: boolean) {
    try {
      console.time("timer-updateLatestLpAmountHistory");
      const countLpAmounts = await this.duckDb.getLpAmountHistory();
      if (countLpAmounts > 0 && !isNewPool && !process.env.IS_MIGRATE_POOL) return;
      const pairInfos = await this.duckDb.getPools(); // 13 pools
      const poolInfos = await getPoolInfos(
        pairInfos.map((pair) => pair.pairAddr),
        currentHeight
      );
      const INITIAL_TIMESTAMP = 1;
      await this.duckDb.insertPoolAmountHistory(
        // we check if poolInfos[index] is available because in currentHeight we query, maybe it has some pools are not created yet
        // e.g currentHeight = 13,000,000. but pool ORAI/INJECTIVE is created in height 13,100,000, so the length of pairInfos !== poolInfos
        pairInfos.map((pair, index) => {
          return {
            offerPoolAmount: poolInfos[index] ? parsePoolAmount(poolInfos[index], JSON.parse(pair.firstAssetInfo)) : 0n,
            askPoolAmount: poolInfos[index] ? parsePoolAmount(poolInfos[index], JSON.parse(pair.secondAssetInfo)) : 0n,
            height: currentHeight,
            timestamp: INITIAL_TIMESTAMP,
            totalShare: poolInfos[index]?.total_share ?? "0",
            pairAddr: pair.pairAddr,
            uniqueKey: concatLpHistoryToUniqueKey({
              timestamp: INITIAL_TIMESTAMP,
              pairAddr: pair.pairAddr
            })
          } as PoolAmountHistory;
        })
      );
      console.timeEnd("timer-updateLatestLpAmountHistory");
    } catch (error) {
      console.log("error in updateLatestLpAmountHistory: ", error);
    }
  }

  private async updateLatestPoolApr(height: number) {
    try {
      const pools = await this.duckDb.getPools();
      const allLiquidities = await getPoolLiquidities(pools);
      const avgLiquidities = await getAvgPoolLiquidities(pools);
      const allFee7Days = await getAllFees();
      const { allAprs, allTotalSupplies, allBondAmounts, allRewardPerSec } = await fetchAprResult(
        pools,
        allLiquidities
      );

      const boostAPR = calculateBoostApr(avgLiquidities, allFee7Days);
      // console.log("boostAor", boostAPR);

      const poolAprs = allAprs.map((apr, index) => {
        const newApr = apr + (boostAPR[pools[index]?.liquidityAddr] || 0);
        return {
          uniqueKey: concatAprHistoryToUniqueKey({
            timestamp: Date.now(),
            supply: allTotalSupplies[index],
            bond: allBondAmounts[index],
            reward: JSON.stringify(allRewardPerSec[index]),
            apr: newApr,
            pairAddr: pools[index].pairAddr
          }),
          pairAddr: pools[index].pairAddr,
          height,
          totalSupply: allTotalSupplies[index],
          totalBondAmount: allBondAmounts[index],
          rewardPerSec: JSON.stringify(allRewardPerSec[index]),
          apr: newApr,
          timestamp: Date.now(),
          aprBoost: boostAPR[pools[index]?.liquidityAddr] || 0
        } as PoolApr;
      });
      await this.duckDb.insertPoolAprs(poolAprs);
    } catch (error) {
      console.log("error in updateLatestPoolApr: ", error);
    }
  }

  public async sync() {
    try {
      // create tables
      await this.duckDb.createHeightSnapshot();
      await this.duckDb.createLiquidityOpsTable();
      await this.duckDb.createSwapOpsTable();
      await this.duckDb.createPairInfosTable();
      await this.duckDb.createSwapOhlcv();
      await this.duckDb.createLpAmountHistoryTable();
      await this.duckDb.createPoolAprTable();
      await this.duckDb.createEarningHistoryTable();
      await this.duckDb.addTimestampColToPoolAprTable();
      await this.duckDb.addAprBoostColToPoolAprTable();
      let currentInd = await this.duckDb.loadHeightSnapshot();
      const initialSyncHeight = parseInt(process.env.INITIAL_SYNC_HEIGHT) || 12388825;
      // if its' the first time, then we use the height 12388825 since its the safe height for the rpc nodes to include timestamp & new indexing logic
      if (currentInd <= initialSyncHeight) {
        currentInd = initialSyncHeight;
      }
      console.log("current ind: ", currentInd);

      const isNewPool = await this.updateLatestPairInfos();

      // update offer & ask, total share of pool history in the first time
      await this.updateLatestLpAmountHistory(currentInd, isNewPool);

      // NOTE: need to updateLatestLpAmountHistory before update apr in the first time
      // to get the offerAmount, askAmount from lp amount history table.
      await this.updateLatestPoolApr(currentInd);

      const syncStream = new SyncData({
        offset: currentInd,
        rpcUrl: this.rpcUrl,
        queryTags: [],
        limit: parseInt(process.env.LIMIT) || 1000,
        maxThreadLevel: parseInt(process.env.MAX_THREAD_LEVEL) || 3,
        interval: 10000
      });

      const writeOrders = new WriteOrders(this.wss, this.duckDb);
      for await (const orders of syncStream) {
        await writeOrders.process(orders);
      }
    } catch (error) {
      console.log("error in start: ", error);
      process.exit(1);
    }
  }
}

export { OraiDexSync };

export * from "./constants";
export * from "./db";
export * from "./helper";
export * from "./pairs";
export * from "./parse";
export * from "./pool-helper";
export * from "./query";
export * from "./types";
