import { Env, OraiDexSync } from "@oraichain/oraidex-sync";
import { DuckDb } from "@oraichain/oraidex-sync";
import "dotenv/config";

const start = async () => {
  const duckDb = await DuckDb.create(process.env.DUCKDB_FILENAME || ":memory:");
  const oraidexSync = await OraiDexSync.create(duckDb, process.env.RPC_URL || "https://rpc.orai.io", {
    ...(process.env as any)
  } as Env);
  await oraidexSync.sync();
};

start();
