import "dotenv/config";
import { parseAssetInfo, parseTxs } from "./tx-parsing";
import { DuckDb } from "./db";
import { WriteData, SyncData, Txs } from "@oraichain/cosmos-rpc-sync";
import { AssetInfo, CosmWasmClient, OraiswapFactoryQueryClient, PairInfo } from "@oraichain/oraidex-contracts-sdk";
import {
  ProvideLiquidityOperationData,
  TxAnlysisResult,
  WithdrawLiquidityOperationData,
  InitialData,
  PairInfoData,
  Env
} from "./types";
import { MulticallQueryClient } from "@oraichain/common-contracts-sdk";
import { PoolResponse } from "@oraichain/oraidex-contracts-sdk/build/OraiswapPair.types";
import { getAllPairInfos, getPoolInfos } from "./query";
import { collectAccumulateLpData, getSymbolFromAsset } from "./helper";

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

  private async getPoolInfos(pairAddrs: string[], wantedHeight?: number): Promise<PoolResponse[]> {
    // adjust the query height to get data from the past
    const cosmwasmClient = await CosmWasmClient.connect(this.rpcUrl);
    cosmwasmClient.setQueryClientWithHeight(wantedHeight);
    const multicall = new MulticallQueryClient(
      cosmwasmClient,
      this.env.MULTICALL_CONTRACT_ADDRESS || "orai1q7x644gmf7h8u8y6y8t9z9nnwl8djkmspypr6mxavsk9ual7dj0sxpmgwd"
    );
    const res = await getPoolInfos(pairAddrs, multicall);
    // reset query client to latest for other functions to call
    return res;
  }

  private async accumulatePoolAmount(data: ProvideLiquidityOperationData[] | WithdrawLiquidityOperationData[]) {
    if (data.length === 0) return; // guard. If theres no data then we wont process anything
    const pairInfos = await this.duckDb.queryPairInfos();
    const poolInfos = await this.getPoolInfos(
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
      let result = parseTxs(txs);

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

// we need to create a new table with name PoolInfo, whenever order table
class OraiDexSync {
  protected constructor(
    private readonly duckDb: DuckDb,
    private readonly rpcUrl: string,
    private cosmwasmClient: CosmWasmClient,
    private readonly env: Env
  ) {}

  public static async create(duckDb: DuckDb, rpcUrl: string, env: Env): Promise<OraiDexSync> {
    const cosmwasmClient = await CosmWasmClient.connect(rpcUrl);
    return new OraiDexSync(duckDb, rpcUrl, cosmwasmClient, env);
  }

  private async getAllPairInfos(): Promise<PairInfo[]> {
    const firstFactoryClient = new OraiswapFactoryQueryClient(
      this.cosmwasmClient,
      this.env.FACTORY_CONTACT_ADDRESS_V1 || "orai1hemdkz4xx9kukgrunxu3yw0nvpyxf34v82d2c8"
    );
    const secondFactoryClient = new OraiswapFactoryQueryClient(
      this.cosmwasmClient,
      this.env.FACTORY_CONTACT_ADDRESS_V2 || "orai167r4ut7avvgpp3rlzksz6vw5spmykluzagvmj3ht845fjschwugqjsqhst"
    );
    return getAllPairInfos(firstFactoryClient, secondFactoryClient);
  }

  private async updateLatestPairInfos() {
    const pairInfos = await this.getAllPairInfos();
    await this.duckDb.insertPairInfos(
      pairInfos.map((pair) => {
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
          volume24Hour: 1n,
          apr: 2,
          totalLiquidity: 1n,
          fee7Days: 1n
        } as PairInfoData;
      })
    );
  }

  private async initPairInfos() {
    const pairInfos = await this.getAllPairInfos();
    await this.duckDb.insertPairInfos(
      pairInfos.map(
        (pair) =>
          ({
            firstAssetInfo: parseAssetInfo(pair.asset_infos[0]),
            secondAssetInfo: parseAssetInfo(pair.asset_infos[1]),
            commissionRate: pair.commission_rate,
            pairAddr: pair.contract_addr,
            liquidityAddr: pair.liquidity_token,
            oracleAddr: pair.oracle_addr,
            symbols: "orai",
            fromIconUrl: "url1",
            toIconUrl: "url2",
            volume24Hour: 1n,
            apr: 2,
            totalLiquidity: 1n,
            fee7Days: 1n
          } as PairInfoData)
      )
    );
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

export * from "./types";
export * from "./query";
export * from "./helper";
export * from "./db";
export * from "./pairs";
export * from "./constants";
