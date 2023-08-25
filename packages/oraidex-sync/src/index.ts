import { SyncData, Txs, WriteData } from "@oraichain/cosmos-rpc-sync";
import { AssetInfo, CosmWasmClient, OraiswapFactoryQueryClient, PairInfo } from "@oraichain/oraidex-contracts-sdk";
import "dotenv/config";
import { DuckDb } from "./db";
import {
  collectAccumulateLpData,
  convertDateToSecond,
  getPairLiquidity,
  getSpecificDateBeforeNow,
  getSymbolFromAsset,
  parseAssetInfoOnlyDenom
} from "./helper";
import { getPoolInfos, getPriceAssetByUsdt, getPriceByAsset } from "./poolHelper";
import { getAllPairInfos } from "./query";
import { parseAssetInfo, parseTxs } from "./tx-parsing";
import {
  Env,
  InitialData,
  PairInfoData,
  ProvideLiquidityOperationData,
  TxAnlysisResult,
  WithdrawLiquidityOperationData
} from "./types";
import { pairs } from "./pairs";

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

  async getFeePair(asset_infos: [AssetInfo, AssetInfo], startTime: Date, endTime: Date): Promise<bigint> {
    const [swapFee, liquidityFee] = await Promise.all([
      this.duckDb.getFeeSwap({
        offerDenom: parseAssetInfoOnlyDenom(asset_infos[0]),
        askDenom: parseAssetInfoOnlyDenom(asset_infos[1]),
        startTime: convertDateToSecond(startTime),
        endTime: convertDateToSecond(endTime)
      }),
      this.duckDb.getFeeLiquidity({
        offerDenom: parseAssetInfoOnlyDenom(asset_infos[0]),
        askDenom: parseAssetInfoOnlyDenom(asset_infos[1]),
        startTime: convertDateToSecond(startTime),
        endTime: convertDateToSecond(endTime)
      })
    ]);
    return swapFee + liquidityFee;
  }

  async getVolumeSwap(
    [baseAssetInfo, quoteAssetInfo]: [AssetInfo, AssetInfo],
    startTime: Date,
    endTime: Date
  ): Promise<bigint> {
    const pair = `${parseAssetInfoOnlyDenom(baseAssetInfo)}-${parseAssetInfoOnlyDenom(quoteAssetInfo)}`;
    const volumePairInBaseAsset = await this.duckDb.getVolumeSwap({
      pair,
      startTime: convertDateToSecond(startTime),
      endTime: convertDateToSecond(endTime)
    });
    let priceBaseAssetInUsdt = await getPriceAssetByUsdt(baseAssetInfo);

    // it means this asset not pair with ORAI
    // in our pairs, if base asset not pair with ORAI, surely quote asset will pair with ORAI
    if (priceBaseAssetInUsdt === 0) {
      const priceQuoteAssetInUsdt = await getPriceAssetByUsdt(quoteAssetInfo);
      const priceBaseInQuote = await getPriceByAsset([baseAssetInfo, quoteAssetInfo], "base_in_quote");
      priceBaseAssetInUsdt = priceBaseInQuote * priceQuoteAssetInUsdt;
    }
    const volumeInUsdt = priceBaseAssetInUsdt * Number(volumePairInBaseAsset);
    return BigInt(Math.round(volumeInUsdt));
  }

  async getVolumeLiquidity(
    [baseAssetInfo, quoteAssetInfo]: [AssetInfo, AssetInfo],
    startTime: Date,
    endTime: Date
  ): Promise<bigint> {
    const volumePairInBaseAsset = await this.duckDb.getVolumeLiquidity({
      offerDenom: parseAssetInfoOnlyDenom(baseAssetInfo),
      askDenom: parseAssetInfoOnlyDenom(quoteAssetInfo),
      startTime: convertDateToSecond(startTime),
      endTime: convertDateToSecond(endTime)
    });
    let priceBaseAssetInUsdt = await getPriceAssetByUsdt(baseAssetInfo);

    // it means this asset not pair with ORAI
    // in our pairs, if base asset not pair with ORAI, surely quote asset will pair with ORAI
    if (priceBaseAssetInUsdt === 0) {
      const priceQuoteAssetInUsdt = await getPriceAssetByUsdt(quoteAssetInfo);
      const priceBaseInQuote = await getPriceByAsset([baseAssetInfo, quoteAssetInfo], "base_in_quote");
      priceBaseAssetInUsdt = priceBaseInQuote * priceQuoteAssetInUsdt;
    }
    const volumeInUsdt = priceBaseAssetInUsdt * Number(volumePairInBaseAsset);
    console.log({
      volumeInUsdt,
      priceBaseAssetInUsdt,
      volumePairInBaseAsset,
      pair: `${parseAssetInfoOnlyDenom(baseAssetInfo)}-${parseAssetInfoOnlyDenom(quoteAssetInfo)}`
    });
    return BigInt(Math.round(volumeInUsdt));
  }

  async getVolumePair(
    [baseAssetInfo, quoteAssetInfo]: [AssetInfo, AssetInfo],
    startTime: Date,
    endTime: Date
  ): Promise<bigint> {
    const [volumeSwap, volumeLiquidity] = await Promise.all([
      this.getVolumeSwap([baseAssetInfo, quoteAssetInfo], startTime, endTime),
      this.getVolumeLiquidity([baseAssetInfo, quoteAssetInfo], startTime, endTime)
    ]);
    return volumeSwap + volumeLiquidity;
  }

  async getAllFees(): Promise<bigint[]> {
    const tf = 7 * 24 * 60 * 60; // second of 7 days
    const currentDate = new Date();
    const oneWeekBeforeNow = getSpecificDateBeforeNow(new Date(), tf);
    const allFees = await Promise.all(
      pairs.map((pair) => this.getFeePair(pair.asset_infos, oneWeekBeforeNow, currentDate))
    );
    return allFees;
  }

  async getAllVolume24h(): Promise<bigint[]> {
    const tf = 100 * 24 * 60 * 60; // second of 24h * 100
    const currentDate = new Date();
    const oneDayBeforeNow = getSpecificDateBeforeNow(new Date(), tf);
    const allVolumes = await Promise.all(
      pairs.map((pair) => this.getVolumePair(pair.asset_infos, oneDayBeforeNow, currentDate))
    );
    return allVolumes;
  }

  private async updateLatestPairInfos() {
    try {
      console.time("timer-updateLatestPairInfos");
      const pairInfos = await this.getAllPairInfos();
      const allLiquidities = await Promise.all(
        pairInfos.map((pair) => {
          return getPairLiquidity(pair.asset_infos, pair.contract_addr);
        })
      );
      const allFee7Days = await this.getAllFees();
      const allVolume24h = await this.getAllVolume24h();

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
            volume24Hour: allVolume24h[index],
            apr: 2,
            totalLiquidity: allLiquidities[index],
            fee7Days: allFee7Days[index]
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
export * from "./query";
export * from "./types";
export * from "./poolHelper";
