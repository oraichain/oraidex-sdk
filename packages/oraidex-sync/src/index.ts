import "dotenv/config";
import { parseAssetInfo, parseTxs } from "./tx-parsing";
import { DuckDb } from "./db";
import { WriteData, SyncData, Txs } from "@oraichain/cosmos-rpc-sync";
import "dotenv/config";
import { pairs } from "./pairs";
import { CosmWasmClient, OraiswapFactoryQueryClient, PairInfo } from "@oraichain/oraidex-contracts-sdk";
import {
  PairInfoData,
  ProvideLiquidityOperationData,
  SwapOperationData,
  TxAnlysisResult,
  WithdrawLiquidityOperationData
} from "./types";

class WriteOrders extends WriteData {
  constructor(private duckDb: DuckDb) {
    super();
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
  constructor(private duckDb: DuckDb, private rpcUrl: string) {}

  private async getAllPairInfos(wantedHeight?: number) {
    const cosmwasmClient = await CosmWasmClient.connect(this.rpcUrl);
    cosmwasmClient.setQueryClientWithHeight(wantedHeight);
    const firstFactoryClient = new OraiswapFactoryQueryClient(
      cosmwasmClient,
      process.env.FACTORY_CONTACT_ADDRESS_V1 || "orai1hemdkz4xx9kukgrunxu3yw0nvpyxf34v82d2c8"
    );
    const secondFactoryClient = new OraiswapFactoryQueryClient(
      cosmwasmClient,
      process.env.FACTORY_CONTACT_ADDRESS_V2 || "orai167r4ut7avvgpp3rlzksz6vw5spmykluzagvmj3ht845fjschwugqjsqhst"
    );
    const liquidityResults: PairInfo[] = (
      await Promise.allSettled([
        ...pairs.map((pair) => firstFactoryClient.pair({ assetInfos: pair.asset_infos })),
        ...pairs.map((pair) => secondFactoryClient.pair({ assetInfos: pair.asset_infos }))
      ])
    )
      .filter((res) => {
        if (res.status === "fulfilled") return true;
        return false;
      })
      .map((data) => (data as any).value as PairInfo);
    return liquidityResults;
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
      console.log("current ind: ", currentInd);
      // if its' the first time, then we use the height 12388825 since its the safe height for the rpc nodes to include timestamp & new indexing logic
      if (currentInd <= 12388825) {
        currentInd = 12388825;
      }
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
      // console.dir(pairInfos, { depth: null });
      new SyncData({
        offset: currentInd,
        rpcUrl: this.rpcUrl,
        queryTags: [],
        limit: 1,
        maxThreadLevel: 1,
        interval: 1000
      }).pipe(new WriteOrders(this.duckDb));
    } catch (error) {
      console.log("error in start: ", error);
    }
  }
}

const start = async () => {
  const duckDb = await DuckDb.create("oraidex-sync-data");
  new OraiDexSync(duckDb, process.env.RPC_URL || "https://rpc.orai.io").sync();
};

start();

export { OraiDexSync };
