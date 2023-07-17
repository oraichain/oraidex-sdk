import { DuckDb } from "./db";
import { WriteData, SyncData, Txs } from "@oraichain/cosmos-rpc-sync";
import { pairs } from "./pairs";
import { Asset, AssetInfo, CosmWasmClient, OraiswapRouterQueryClient } from "@oraichain/oraidex-contracts-sdk";
import { PriceInfo } from "./types";
import { simulateSwapPricePair } from "./query";
import { parseAssetInfo } from "./tx-parsing";
import "dotenv/config";

class WritePrice extends WriteData {
  constructor(private duckDb: DuckDb, private rpcUrl: string) {
    super();
  }

  private async simulateSwapPrice(pair: [AssetInfo, AssetInfo], wantedHeight?: number): Promise<string> {
    // adjust the query height to get data from the past
    const cosmwasmClient = await CosmWasmClient.connect(this.rpcUrl);
    cosmwasmClient.setQueryClientWithHeight(wantedHeight);
    const routerContract = new OraiswapRouterQueryClient(
      cosmwasmClient,
      process.env.ROUTER_CONTRACT_ADDRESS || "orai1j0r67r9k8t34pnhy00x3ftuxuwg0r6r4p8p6rrc8az0ednzr8y9s3sj2sf"
    );
    const data = await simulateSwapPricePair(pair, routerContract);
    cosmwasmClient.setQueryClientWithHeight();
    return data;
  }

  private async getPrices(): Promise<PriceInfo[]> {
    let currentInd = await this.duckDb.loadHeightSnapshot();
    console.log("current ind: ", currentInd);
    const cosmwasmClient = await CosmWasmClient.connect(this.rpcUrl);
    const pairPrices = await Promise.all(pairs.map((pair) => this.simulateSwapPrice(pair.asset_infos, currentInd)));
    const blockHeader = (await cosmwasmClient.getBlock(currentInd)).header;
    return;
  }

  async process(chunk: any): Promise<boolean> {
    try {
      const { offset: newOffset } = chunk as Txs;
      //   console.log("txs: ", txs);
      console.log("new offset: ", newOffset);
      const queryPrices = await this.getPrices();
      console.table(queryPrices);
      // insert txs
      await this.duckDb.insertHeightSnapshot(newOffset);
    } catch (error) {
      console.log("error processing data: ", error);
      return false;
    }
    return true;
  }
}

class PriceSync {
  protected constructor(private duckDb: DuckDb, private rpcUrl: string) {}

  public static async create(duckDb: DuckDb, rpcUrl: string): Promise<PriceSync> {
    return new PriceSync(duckDb, rpcUrl);
  }

  public async sync() {
    try {
      await Promise.all([this.duckDb.createPriceInfoTable(), this.duckDb.createHeightSnapshot()]);
      let currentInd = await this.duckDb.loadHeightSnapshot();
      // if its' the first time, then we use the height 12388825 since its the safe height for the rpc nodes to include timestamp & new indexing logic
      if (currentInd <= 12388825) {
        currentInd = 12388825;
      }
      await this.duckDb.insertHeightSnapshot(currentInd);
      new SyncData({
        offset: currentInd,
        rpcUrl: this.rpcUrl,
        queryTags: [],
        limit: 1000,
        maxThreadLevel: 1,
        interval: 1000
      }).pipe(new WritePrice(this.duckDb, this.rpcUrl));
    } catch (error) {
      console.log("error in start: ", error);
    }
  }
}

const start = async () => {
  const duckDb = await DuckDb.create("oraidex-sync-data");
  console.log("rpc url: ", process.env.RPC_URL);
  const oraidexSync = await PriceSync.create(duckDb, process.env.RPC_URL || "https://rpc.orai.io");
  await oraidexSync.sync();
};

start();

export { PriceSync };
