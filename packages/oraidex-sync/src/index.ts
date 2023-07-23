import "dotenv/config";
import { parseAssetInfo, parseTxs } from "./tx-parsing";
import { DuckDb } from "./db";
import { WriteData, SyncData, Txs } from "@oraichain/cosmos-rpc-sync";
import { pairs } from "./pairs";
import {
  Asset,
  AssetInfo,
  CosmWasmClient,
  OraiswapFactoryQueryClient,
  OraiswapRouterQueryClient,
  PairInfo
} from "@oraichain/oraidex-contracts-sdk";
import {
  ProvideLiquidityOperationData,
  SwapOperationData,
  TxAnlysisResult,
  WithdrawLiquidityOperationData,
  InitialData,
  PairInfoData,
  Env,
  VolumeInfo,
  PrefixSumHandlingData
} from "./types";
import { MulticallQueryClient } from "@oraichain/common-contracts-sdk";
import { PoolResponse } from "@oraichain/oraidex-contracts-sdk/build/OraiswapPair.types";
import { getAllPairInfos, getPoolInfos, simulateSwapPriceWithUsdt } from "./query";
import { calculatePrefixSum, collectAccumulateLpData, parseAssetInfoOnlyDenom } from "./helper";

class WriteOrders extends WriteData {
  private firstWrite: boolean;
  constructor(private duckDb: DuckDb, private rpcUrl: string, private env: Env, private initialData: InitialData) {
    super();
    this.firstWrite = true;
  }

  private async insertSwapOps(ops: SwapOperationData[]) {
    await this.duckDb.insertSwapOps(ops);
  }

  private async insertLiquidityOps(ops: ProvideLiquidityOperationData[] | WithdrawLiquidityOperationData[]) {
    await this.duckDb.insertLpOps(ops);
  }

  private async insertParsedTxs(txs: TxAnlysisResult) {
    // insert swap ops
    await Promise.all([
      this.insertSwapOps(txs.swapOpsData),
      this.insertLiquidityOps(txs.provideLiquidityOpsData),
      this.duckDb.insertVolumeInfo(txs.volumeInfos)
    ]);
    // has to split this out because they are sharing the same table, will clash when inserting
    await this.insertLiquidityOps(txs.withdrawLiquidityOpsData);
  }

  private async queryLpOps(): Promise<ProvideLiquidityOperationData[] | WithdrawLiquidityOperationData[]> {
    return this.duckDb.queryLpOps() as Promise<ProvideLiquidityOperationData[] | WithdrawLiquidityOperationData[]>;
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
    const pairInfos = await this.duckDb.queryPairInfos();
    const poolInfos = await this.getPoolInfos(
      pairInfos.map((pair) => pair.pairAddr),
      data[0].txheight // assume data is sorted by height and timestamp
    );
    collectAccumulateLpData(data, poolInfos);
  }

  // private insertVolumeInfos(
  //   ...data: { denom: string; timestamp: number; txheight: number; amount: number }[]
  // ): VolumeInfo[] {
  //   let volumeInfos: VolumeInfo[] = [];
  //   data.forEach((op) => {
  //     volumeInfos.push({
  //       denom: op.denom,
  //       timestamp: op.timestamp,
  //       txheight: op.txheight,
  //       volume: op.amount,
  //       price: 1
  //     });
  //   });
  //   return volumeInfos;
  // }

  async process(chunk: any): Promise<boolean> {
    try {
      // // first time calling of the application then we query past data and be ready to store them into the db for prefix sum
      // // this helps the flow go smoothly and remove dependency between different streams
      // if (this.firstWrite) {
      //   console.log("initial data: ", this.initialData);
      //   const { height, time } = this.initialData.blockHeader;
      //   await this.duckDb.insertPriceInfos(
      //     this.initialData.tokenPrices.map(
      //       (tokenPrice) =>
      //         ({
      //           txheight: height,
      //           timestamp: time,
      //           assetInfo: parseAssetInfo(tokenPrice.info),
      //           price: parseInt(tokenPrice.amount)
      //         } as PriceInfo)
      //     )
      //   );
      //   this.firstWrite = false;
      // }
      const { txs, offset: newOffset } = chunk as Txs;
      let result = parseTxs(txs);

      // accumulate liquidity pool amount
      await this.accumulatePoolAmount([...result.provideLiquidityOpsData, ...result.withdrawLiquidityOpsData]);
      // process volume infos to insert price
      // result.volumeInfos = insertVolumeInfos(result.swapOpsData);

      // collect the latest offer & ask volume to accumulate the results
      // insert txs
      console.log("new offset: ", newOffset);
      await this.duckDb.insertHeightSnapshot(newOffset);
      await this.insertParsedTxs(result);

      const lpOps = await this.queryLpOps();
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

  private async simulateSwapPrice(info: AssetInfo, wantedHeight?: number): Promise<Asset> {
    // adjust the query height to get data from the past
    this.cosmwasmClient.setQueryClientWithHeight(wantedHeight);
    const routerContract = new OraiswapRouterQueryClient(
      this.cosmwasmClient,
      this.env.ROUTER_CONTRACT_ADDRESS || "orai1j0r67r9k8t34pnhy00x3ftuxuwg0r6r4p8p6rrc8az0ednzr8y9s3sj2sf"
    );
    const data = await simulateSwapPriceWithUsdt(info, routerContract);
    this.cosmwasmClient.setQueryClientWithHeight();
    return data;
  }

  private async updateLatestPairInfos() {
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
            oracleAddr: pair.oracle_addr
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
        this.duckDb.createPriceInfoTable(),
        this.duckDb.createVolumeInfo()
      ]);
      let currentInd = await this.duckDb.loadHeightSnapshot();
      let initialData: InitialData = { tokenPrices: [], blockHeader: undefined };
      const initialSyncHeight = parseInt(process.env.INITIAL_SYNC_HEIGHT) || 12388825;
      // // if its' the first time, then we use the height 12388825 since its the safe height for the rpc nodes to include timestamp & new indexing logic
      if (currentInd <= initialSyncHeight) {
        currentInd = initialSyncHeight;
      }
      console.log("current ind: ", currentInd);

      // const tokenPrices = await Promise.all(
      //   extractUniqueAndFlatten(pairs).map((info) => this.simulateSwapPrice(info, currentInd))
      // );
      // const initialBlockHeader = (await this.cosmwasmClient.getBlock(currentInd)).header;
      // initialData.tokenPrices = tokenPrices;
      // initialData.blockHeader = initialBlockHeader;
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

export { OraiDexSync };

export * from "./types";
export * from "./query";
export * from "./helper";
export * from "./db";
export * from "./pairs";
export * from "./constants";
