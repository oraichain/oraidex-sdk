import { OraiDexSync } from "./index";
import { DuckDb } from "./db";
import "dotenv/config";

const start = async () => {
  const duckDb = await DuckDb.create(process.env.DUCKDB_FILENAME || ":memory:");
  const oraidexSync = await OraiDexSync.create(duckDb, process.env.RPC_URL || "https://rpc.orai.io");
  await oraidexSync.sync();
};

start();
