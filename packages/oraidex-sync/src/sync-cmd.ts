import { WebSocket } from "ws";
import { DuckDb } from "./db";
import { OraiDexSync } from "./index";

async function initSync() {
  const duckDb = await DuckDb.create("oraidex-sync-data-only-v2");
  const { RPC_URL, WS_PORT } = process.env || {};

  // init websocket server
  const wss = new WebSocket.Server({ port: Number(WS_PORT) });
  wss.on("error", (error) => {
    console.error("error wss: ", error);
    process.exit(1);
  });

  wss.on("close", () => {
    console.log("ws close");
  });

  const oraidexSync = await OraiDexSync.create(duckDb, wss, RPC_URL, process.env as any);
  oraidexSync.sync();
}

initSync();
