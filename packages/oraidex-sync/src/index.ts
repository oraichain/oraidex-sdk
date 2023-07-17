import "dotenv/config";
import { parseAssetInfo, parseTxs } from "./tx-parsing";
import { DuckDb } from "./db";
import { WriteData, SyncData, Txs } from "@oraichain/cosmos-rpc-sync";
import "dotenv/config";
import { pairs } from "./pairs";
import {
  Asset,
  AssetInfo,
  CosmWasmClient,
  OraiswapFactoryQueryClient,
  OraiswapRouterQueryClient,
  PairInfo,
  SwapOperation
} from "@oraichain/oraidex-contracts-sdk";
import {
  PairInfoData,
  ProvideLiquidityOperationData,
  SwapOperationData,
  TxAnlysisResult,
  WithdrawLiquidityOperationData,
  InitialData,
  PriceInfo
} from "./types";
import { MulticallQueryClient } from "@oraichain/common-contracts-sdk";
import { fromBinary, toBinary } from "@cosmjs/cosmwasm-stargate";
import { PoolResponse } from "@oraichain/oraidex-contracts-sdk/build/OraiswapPair.types";
import { extractUniqueAndFlatten, findAssetInfoPathToUsdt, generateSwapOperations } from "./helper";
import { tenAmountInDecimalSix } from "./constants";
import { getAllPairInfos, getPoolInfos, simulateSwapPrice } from "./query";

class WriteOrders extends WriteData {
  private firstWrite: boolean;
  constructor(private duckDb: DuckDb, private initialData: InitialData) {
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
      this.insertLiquidityOps(txs.withdrawLiquidityOpsData)
    ]);
  }

  private async querySwapOps(): Promise<SwapOperationData[]> {
    return this.duckDb.querySwapOps() as Promise<SwapOperationData[]>;
  }

  private async queryLpOps(): Promise<ProvideLiquidityOperationData[] | WithdrawLiquidityOperationData[]> {
    return this.duckDb.queryLpOps() as Promise<ProvideLiquidityOperationData[] | WithdrawLiquidityOperationData[]>;
  }

  async process(chunk: any): Promise<boolean> {
    try {
      // first time calling of the application then we query past data and be ready to store them into the db for prefix sum
      // this helps the flow go smoothly and remove dependency between different streams
      if (this.firstWrite) {
        console.log("initial data: ", this.initialData);
        const { height, time } = this.initialData.blockHeader;
        await this.duckDb.insertPriceInfos(
          this.initialData.tokenPrices.map(
            (tokenPrice) =>
              ({
                txheight: height,
                timestamp: time,
                assetInfo: parseAssetInfo(tokenPrice.info),
                price: parseInt(tokenPrice.amount)
              } as PriceInfo)
          )
        );
        this.firstWrite = false;
      }
      const { txs, offset: newOffset, queryTags } = chunk as Txs;
      console.log("new offset: ", newOffset);
      const result = parseTxs(txs);
      // insert txs
      await this.duckDb.insertHeightSnapshot(newOffset);
      await this.insertParsedTxs(result);

      const swapOps = await this.querySwapOps();
      const lpOps = await this.queryLpOps();

      console.log("swap ops: ", swapOps);
      console.log("lp ops: ", lpOps);
    } catch (error) {
      console.log("error processing data: ", error);
      return false;
    }
    return true;
  }
}

class OraiDexSync {
  protected constructor(private duckDb: DuckDb, private rpcUrl: string, private cosmwasmClient: CosmWasmClient) {}

  public static async create(duckDb: DuckDb, rpcUrl: string): Promise<OraiDexSync> {
    const cosmwasmClient = await CosmWasmClient.connect(rpcUrl);
    return new OraiDexSync(duckDb, rpcUrl, cosmwasmClient);
  }

  private async getPoolInfos(pairs: PairInfo[], wantedHeight?: number): Promise<PoolResponse[]> {
    // adjust the query height to get data from the past
    this.cosmwasmClient.setQueryClientWithHeight(wantedHeight);
    const multicall = new MulticallQueryClient(
      this.cosmwasmClient,
      process.env.MULTICALL_CONTRACT_ADDRES || "orai1q7x644gmf7h8u8y6y8t9z9nnwl8djkmspypr6mxavsk9ual7dj0sxpmgwd"
    );
    const res = await getPoolInfos(pairs, multicall);
    // reset query client to latest for other functions to call
    this.cosmwasmClient.setQueryClientWithHeight();
    return res;
  }

  private async getAllPairInfos(): Promise<PairInfo[]> {
    const firstFactoryClient = new OraiswapFactoryQueryClient(
      this.cosmwasmClient,
      process.env.FACTORY_CONTACT_ADDRESS_V1 || "orai1hemdkz4xx9kukgrunxu3yw0nvpyxf34v82d2c8"
    );
    const secondFactoryClient = new OraiswapFactoryQueryClient(
      this.cosmwasmClient,
      process.env.FACTORY_CONTACT_ADDRESS_V2 || "orai167r4ut7avvgpp3rlzksz6vw5spmykluzagvmj3ht845fjschwugqjsqhst"
    );
    return getAllPairInfos(firstFactoryClient, secondFactoryClient);
  }

  private async simulateSwapPrice(info: AssetInfo, wantedHeight?: number): Promise<Asset> {
    // adjust the query height to get data from the past
    this.cosmwasmClient.setQueryClientWithHeight(wantedHeight);
    const routerContract = new OraiswapRouterQueryClient(
      this.cosmwasmClient,
      process.env.ROUTER_CONTRACT_ADDRESS || "orai1j0r67r9k8t34pnhy00x3ftuxuwg0r6r4p8p6rrc8az0ednzr8y9s3sj2sf"
    );
    const infoPath = findAssetInfoPathToUsdt(info);
    // usdt case, price is always 1
    if (infoPath.length === 1)
      return { info, amount: tenAmountInDecimalSix.substring(0, tenAmountInDecimalSix.length - 1) };
    const operations = generateSwapOperations(info);
    if (operations.length === 0) return { info, amount: "0" }; // error case. Will be handled by the caller function
    const data = await simulateSwapPrice(info, routerContract);
    this.cosmwasmClient.setQueryClientWithHeight();
    return data;
  }

  public async sync() {
    try {
      await Promise.all([
        this.duckDb.createHeightSnapshot(),
        this.duckDb.createLiquidityOpsTable(),
        this.duckDb.createSwapOpsTable(),
        this.duckDb.createPairInfosTable()
      ]);
      let currentInd = await this.duckDb.loadHeightSnapshot();
      let initialData: InitialData = { tokenPrices: [], blockHeader: undefined };
      console.log("current ind: ", currentInd);
      // if its' the first time, then we use the height 12388825 since its the safe height for the rpc nodes to include timestamp & new indexing logic
      if (currentInd <= 12388825) {
        currentInd = 12388825;
      }

      const tokenPrices = await Promise.all(
        extractUniqueAndFlatten(pairs).map((info) => this.simulateSwapPrice(info, currentInd))
      );
      const initialBlockHeader = (await this.cosmwasmClient.getBlock(currentInd)).header;
      initialData.tokenPrices = tokenPrices;
      initialData.blockHeader = initialBlockHeader;
      // const pairInfos = await this.getAllPairInfos();
      // // TODO: only get pool infos of selected pairs if that pair does not exist in the pair info database, meaning it is new. Otherwise, it would have been called before and stored the pool result given the wanted height.
      // const poolResultsAtOldHeight = await this.getPoolInfos(pairInfos, currentInd);
      // // Promise.all([insert pool info, and insert pair info. Promise all because pool info & updated pair info must go together])
      // await this.duckDb.insertPairInfos(
      //   pairInfos.map(
      //     (pair) =>
      //       ({
      //         firstAssetInfo: parseAssetInfo(pair.asset_infos[0]),
      //         secondAssetInfo: parseAssetInfo(pair.asset_infos[1]),
      //         commissionRate: pair.commission_rate,
      //         pairAddr: pair.contract_addr,
      //         liquidityAddr: pair.liquidity_token,
      //         oracleAddr: pair.oracle_addr
      //       } as PairInfoData)
      //   )
      // );
      // // console.dir(pairInfos, { depth: null });
      new SyncData({
        offset: currentInd,
        rpcUrl: this.rpcUrl,
        queryTags: [],
        limit: 1,
        maxThreadLevel: 1,
        interval: 1000
      }).pipe(new WriteOrders(this.duckDb, initialData));
    } catch (error) {
      console.log("error in start: ", error);
    }
  }
}

const start = async () => {
  const duckDb = await DuckDb.create("oraidex-sync-data");
  const oraidexSync = await OraiDexSync.create(duckDb, process.env.RPC_URL || "https://rpc.orai.io");
  await oraidexSync.sync();
};

start();

export { OraiDexSync };
