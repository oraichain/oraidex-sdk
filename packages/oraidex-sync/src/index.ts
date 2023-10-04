import { SyncData, Txs, WriteData } from "@oraichain/cosmos-rpc-sync";
import "dotenv/config";
import { DuckDb } from "./db";
import {
  collectAccumulateLpAndSwapData,
  concatLpHistoryToUniqueKey,
  getPairLiquidity,
  getSymbolFromAsset
} from "./helper";
import {
  calculateAprResult,
  fetchAprResult,
  getAllPairInfos,
  getPairByAssetInfos,
  getPoolInfos,
  handleEventApr
} from "./pool-helper";
import { parseAssetInfo, parseTxs } from "./tx-parsing";
import {
  Env,
  InitialData,
  LpOpsData,
  PairInfoData,
  PoolApr,
  ProvideLiquidityOperationData,
  SwapOperationData,
  TxAnlysisResult,
  WithdrawLiquidityOperationData
} from "./types";

class WriteOrders extends WriteData {
  constructor(private duckDb: DuckDb, private rpcUrl: string, private env: Env, private initialData: InitialData) {
    super();
  }

  private async insertParsedTxs(txs: TxAnlysisResult) {
    // insert swap ops
    await Promise.all([
      this.duckDb.insertSwapOps(txs.swapOpsData),
      this.duckDb.insertLpOps(txs.provideLiquidityOpsData),
      this.duckDb.insertOhlcv(txs.ohlcv)
    ]);
    await this.duckDb.insertLpOps(txs.withdrawLiquidityOpsData);
  }

  private async accumulatePoolAmount(
    lpData: ProvideLiquidityOperationData[] | WithdrawLiquidityOperationData[],
    swapData: SwapOperationData[]
  ) {
    if (lpData.length === 0 && swapData.length === 0) return;

    const pairInfos = await this.duckDb.queryPairInfos();
    const minSwapTxHeight = swapData[0]?.txheight;
    const minLpTxHeight = lpData[0]?.txheight;
    let minTxHeight;
    if (minSwapTxHeight && minLpTxHeight) {
      minTxHeight = Math.min(minSwapTxHeight, minLpTxHeight);
    } else minTxHeight = minSwapTxHeight ?? minLpTxHeight;

    const poolInfos = await getPoolInfos(
      pairInfos.map((pair) => pair.pairAddr),
      minTxHeight // assume data is sorted by height and timestamp
    );
    const lpOpsData: LpOpsData[] = [
      ...lpData.map((item) => {
        return {
          baseTokenAmount: item.baseTokenAmount,
          baseTokenDenom: item.baseTokenDenom,
          quoteTokenAmount: item.quoteTokenAmount,
          quoteTokenDenom: item.quoteTokenDenom,
          opType: item.opType,
          timestamp: item.timestamp,
          height: item.txheight
        } as LpOpsData;
      }),
      ...swapData.map((item) => {
        return {
          baseTokenAmount: item.offerAmount,
          baseTokenDenom: item.offerDenom,
          quoteTokenAmount: -item.returnAmount, // reverse sign because we assume first case is sell, check buy later.
          quoteTokenDenom: item.askDenom,
          direction: item.direction,
          height: item.txheight,
          timestamp: item.timestamp
        } as LpOpsData;
      })
    ];

    const accumulatedData = await collectAccumulateLpAndSwapData(lpOpsData, poolInfos);
    const poolAmountHitories = pairInfos.reduce((accumulator, { pairAddr }) => {
      if (accumulatedData[pairAddr]) {
        accumulator.push({
          ...accumulatedData[pairAddr],
          pairAddr,
          uniqueKey: concatLpHistoryToUniqueKey({
            timestamp: accumulatedData[pairAddr].timestamp,
            pairAddr
          })
        });
      }
      return accumulator;
    }, []);
    await this.duckDb.insertPoolAmountHistory(poolAmountHitories);
  }

  async process(chunk: any): Promise<boolean> {
    try {
      const { txs, offset: newOffset } = chunk as Txs;
      const currentOffset = await this.duckDb.loadHeightSnapshot();
      // edge case. If no new block has been found, then we skip processing to prevent duplication handling
      if (currentOffset === newOffset) return true;
      let result = await parseTxs(txs);

      const lpOpsData = [...result.provideLiquidityOpsData, ...result.withdrawLiquidityOpsData];
      // accumulate liquidity pool amount via provide/withdraw liquidity and swap ops
      await this.accumulatePoolAmount(lpOpsData, [...result.swapOpsData]);

      await handleEventApr(txs, lpOpsData, newOffset);

      // collect the latest offer & ask volume to accumulate the results
      // insert txs
      console.log("new offset: ", newOffset);
      // hash to be promise all because if inserting height pass and txs fail then we will have duplications
      await Promise.all([this.duckDb.insertHeightSnapshot(newOffset), this.insertParsedTxs(result)]);

      const lpOps = await this.duckDb.queryLpOps();
      const swapOpsCount = await this.duckDb.querySwapOps();
      console.log("lp ops: ", lpOps.length);
      console.log("swap ops: ", swapOpsCount);
    } catch (error) {
      console.log("error processing data: ", error);
      return false;
    }
    return true;
  }
}

class OraiDexSync {
  protected constructor(private readonly duckDb: DuckDb, private readonly rpcUrl: string, private readonly env: Env) {}

  public static async create(duckDb: DuckDb, rpcUrl: string, env: Env): Promise<OraiDexSync> {
    return new OraiDexSync(duckDb, rpcUrl, env);
  }

  private async updateLatestPairInfos() {
    try {
      console.time("timer-updateLatestPairInfos");
      const pairInfos = await getAllPairInfos();
      const allPools = await this.duckDb.getPools();
      if (allPools.length > 0 && pairInfos.length === allPools.length) return;
      await this.duckDb.insertPairInfos(
        pairInfos.map((pair, index) => {
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
    } catch (error) {
      console.log("error in updateLatestPairInfos: ", error);
    }
  }

  private async updateLatestPoolApr(height: number) {
    const pools = await this.duckDb.getPools();
    const allLiquidities = (await Promise.allSettled(pools.map((pair) => getPairLiquidity(pair)))).map((result) => {
      if (result.status === "fulfilled") return result.value;
      else console.error("error get allLiquidities: ", result.reason);
    });
    const { allAprs, allTotalSupplies, allBondAmounts, allRewardPerSec } = await fetchAprResult(pools, allLiquidities);

    const poolAprs = allAprs.map((apr, index) => {
      return {
        uniqueKey: concatLpHistoryToUniqueKey({ timestamp: height, pairAddr: pools[index].pairAddr }),
        pairAddr: pools[index].pairAddr,
        height,
        totalSupply: allTotalSupplies[index],
        totalBondAmount: allBondAmounts[index],
        rewardPerSec: JSON.stringify(allRewardPerSec[index]),
        apr
      } as PoolApr;
    });
    await this.duckDb.insertPoolAprs(poolAprs);
  }

  public async sync() {
    try {
      await Promise.all([
        this.duckDb.createHeightSnapshot(),
        this.duckDb.createLiquidityOpsTable(),
        this.duckDb.createSwapOpsTable(),
        this.duckDb.createPairInfosTable(),
        this.duckDb.createSwapOhlcv(),
        this.duckDb.createLpAmountHistoryTable(),
        this.duckDb.createAprInfoPair()
      ]);
      let currentInd = await this.duckDb.loadHeightSnapshot();
      let initialData: InitialData = { tokenPrices: [], blockHeader: undefined };
      const initialSyncHeight = parseInt(process.env.INITIAL_SYNC_HEIGHT) || 12388825;
      // if its' the first time, then we use the height 12388825 since its the safe height for the rpc nodes to include timestamp & new indexing logic
      if (currentInd <= initialSyncHeight) {
        currentInd = initialSyncHeight;
      }
      console.log("current ind: ", currentInd);
      await this.updateLatestPairInfos();

      // update apr in the first time
      await this.updateLatestPoolApr(currentInd);

      new SyncData({
        offset: currentInd,
        rpcUrl: this.rpcUrl,
        queryTags: [],
        limit: 1000,
        maxThreadLevel: parseInt(process.env.MAX_THREAD_LEVEL) || 3,
        interval: 5000
      }).pipe(new WriteOrders(this.duckDb, this.rpcUrl, this.env, initialData));
    } catch (error) {
      console.log("error in start: ", error);
    }
  }
}

// async function initSync() {
//   const duckDb = await DuckDb.create("oraidex-only-sync-data");
//   const oraidexSync = await OraiDexSync.create(duckDb, "http://35.237.59.125:26657", process.env as any);
//   oraidexSync.sync();
// }

// initSync();

export { OraiDexSync };

export * from "./constants";
export * from "./db";
export * from "./helper";
export * from "./pairs";
export * from "./pool-helper";
export * from "./query";
export * from "./types";
