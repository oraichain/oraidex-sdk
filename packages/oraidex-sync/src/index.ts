import { SyncData, Txs, WriteData } from "@oraichain/cosmos-rpc-sync";
import { CosmWasmClient } from "@oraichain/oraidex-contracts-sdk";
import "dotenv/config";
import { DuckDb } from "./db";
import { collectAccumulateLpData, getSymbolFromAsset } from "./helper";
import { getAllPairInfos, getPoolInfos } from "./poolHelper";
import { parseAssetInfo, parseTxs } from "./tx-parsing";
import {
  Env,
  InitialData,
  PairInfoData,
  ProvideLiquidityOperationData,
  TxAnlysisResult,
  WithdrawLiquidityOperationData
} from "./types";

class WriteOrders extends WriteData {
  private firstWrite: boolean;
  constructor(private duckDb: DuckDb, private rpcUrl: string, private env: Env, private initialData: InitialData) {
    super();
    this.firstWrite = true;
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

  private async accumulatePoolAmount(data: ProvideLiquidityOperationData[] | WithdrawLiquidityOperationData[]) {
    if (data.length === 0) return; // guard. If theres no data then we wont process anything
    const pairInfos = await this.duckDb.queryPairInfos();
    const poolInfos = await getPoolInfos(
      pairInfos.map((pair) => pair.pairAddr),
      data[0].txheight // assume data is sorted by height and timestamp
    );
    collectAccumulateLpData(data, poolInfos);
  }

  async process(chunk: any): Promise<boolean> {
    try {
      const { txs, offset: newOffset } = chunk as Txs;
      const currentOffset = await this.duckDb.loadHeightSnapshot();
      // edge case. If no new block has been found, then we skip processing to prevent duplication handling
      if (currentOffset === newOffset) return true;
      let result = await parseTxs(txs, this.duckDb);

      // accumulate liquidity pool amount
      await this.accumulatePoolAmount([...result.provideLiquidityOpsData, ...result.withdrawLiquidityOpsData]);

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
  public static duckDbInstance: DuckDb | null = null;
  protected constructor(
    private readonly duckDb: DuckDb,
    private readonly rpcUrl: string,
    private cosmwasmClient: CosmWasmClient,
    private readonly env: Env
  ) {}

  public static async create(duckDb: DuckDb, rpcUrl: string, env: Env): Promise<OraiDexSync> {
    const cosmwasmClient = await CosmWasmClient.connect(rpcUrl);
    OraiDexSync.duckDbInstance = duckDb; // Store the provided duckDb instance
    return new OraiDexSync(duckDb, rpcUrl, cosmwasmClient, env);
  }

  public static getDuckDbInstance() {
    return OraiDexSync.duckDbInstance;
  }

  private async updateLatestPairInfos() {
    try {
      console.time("timer-updateLatestPairInfos");
      const pairInfos = await getAllPairInfos();

      await this.duckDb.insertPairInfos(
        pairInfos.map((pair, index) => {
          const symbols = getSymbolFromAsset(pair.asset_infos);
          return {
            firstAssetInfo: parseAssetInfo(pair.asset_infos[0]),
            secondAssetInfo: parseAssetInfo(pair.asset_infos[1]),
            commissionRate: pair.commission_rate,
            pairAddr: pair.contract_addr,
            liquidityAddr: pair.liquidity_token,
            oracleAddr: pair.oracle_addr,
            symbols,
            fromIconUrl: "url1",
            toIconUrl: "url2",
            volume24Hour: 0n,
            apr: 0,
            totalLiquidity: 0,
            fee7Days: 0n
          } as PairInfoData;
        })
      );
      console.timeEnd("timer-updateLatestPairInfos");
    } catch (error) {
      console.log("error in updateLatestPairInfos: ", error);
    }
  }

  public async sync() {
    try {
      await Promise.all([
        this.duckDb.createHeightSnapshot(),
        this.duckDb.createLiquidityOpsTable(),
        this.duckDb.createSwapOpsTable(),
        this.duckDb.createPairInfosTable(),
        this.duckDb.createSwapOhlcv()
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
      new SyncData({
        offset: currentInd,
        rpcUrl: this.rpcUrl,
        queryTags: [],
        limit: parseInt(process.env.LIMIT) || 100,
        maxThreadLevel: parseInt(process.env.MAX_THREAD_LEVEL) || 3,
        interval: 5000
      }).pipe(new WriteOrders(this.duckDb, this.rpcUrl, this.env, initialData));
    } catch (error) {
      console.log("error in start: ", error);
    }
  }
}

async function initSync() {
  const duckDb = await DuckDb.create("oraidex-only-sync-data");
  const oraidexSync = await OraiDexSync.create(duckDb, "http://35.237.59.125:26657", process.env as any);
  oraidexSync.sync();
}

initSync();

export { OraiDexSync };

export * from "./constants";
export * from "./db";
export * from "./helper";
export * from "./pairs";
export * from "./poolHelper";
export * from "./query";
export * from "./types";
