/* Non-SSL is simply App() */

import uws from "uWebSockets.js";
import "dotenv/config";
import { DuckDbNode, DuckDbWasm } from "./db";

uws
  .App({
    /* There are more SSL options, cut for brevity */
  })
  // .ws("/*", {
  //   /* There are many common helper features */
  //   idleTimeout: 32,
  //   maxBackpressure: 1024,
  //   maxPayloadLength: 512,

  //   /* For brevity we skip the other events (upgrade, open, ping, pong, close) */
  //   message: (ws, message, isBinary) => {
  //     /* You can do app.publish('sensors/home/temperature', '22C') kind of pub/sub as well */

  //     /* Here we echo the message back, using compression if available */
  //     let ok = ws.send(message, isBinary, true);
  //     console.log("ok: ", ok);
  //   }
  // })
  .get("/*", (res, req) => {
    /* It does Http as well */
    res.writeStatus("200 OK").writeHeader("IsExample", "Yes").end("Hello there!");
  })
  .listen(9001, async (listenSocket) => {
    if (listenSocket) {
      console.log("Listening to port 9001");
    }
    let duckDb: DuckDbNode | DuckDbWasm;
    if (process.env.NODE_ENV !== "production") {
      duckDb = await DuckDbWasm.create();
    } else {
      duckDb = await DuckDbNode.create(process.env.DUCKDB_FILE_NAME);
    }
    await duckDb.createTable();
  });

export * from "./tendermint-event-listener";
