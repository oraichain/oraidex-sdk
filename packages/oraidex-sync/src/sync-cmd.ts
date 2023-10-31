import { OraiDexSync } from "./index";
import { DuckDb } from "./db";

async function initSync() {
  const duckDb = await DuckDb.create("oraidex-sync-data-only-v2");
  const oraidexSync = await OraiDexSync.create(duckDb, process.env.RPC_URL, process.env as any);
  oraidexSync.sync();
}

initSync();
