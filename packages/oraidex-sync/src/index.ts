import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import "dotenv/config";
import { parseWasmEvents } from "./helper";
import { DuckDb } from "./db";
import { WriteData, SyncData, Txs } from "@oraichain/cosmos-rpc-sync";
import "dotenv/config";

const duckDb = new DuckDb();
class WriteOrders extends WriteData {
  constructor() {
    super();
  }

  async process(chunk: any): Promise<boolean> {
    try {
      const { txs, offset: newOffset, queryTags } = chunk as Txs;
    } catch (error) {
      console.log("error processing data: ", error);
      return false;
    }
    return true;
  }
}

const sync = async () => {
  try {
    await duckDb.initDuckDb();
    const rpcUrl = process.env.RPC_URL || "https://rpc.orai.io";
    const client = await CosmWasmClient.connect(rpcUrl);
  } catch (error) {
    console.log("error in start: ", error);
  }
};

export { duckDb, sync };
