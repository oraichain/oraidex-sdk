/* Non-SSL is simply App() */

import uws from "uWebSockets.js";
import "dotenv/config";
import { DuckDbNode, DuckDbWasm } from "./db";
// import { createMachines } from "./machine";
import { sendTo } from "xstate/lib/actions";
import { ContextHandler, EthEvent } from "./event";
import { ethers } from "ethers";

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
    console.log("dirname: ", __dirname);
    if (listenSocket) {
      console.log("Listening to port 9001");
    }
    let duckDb: DuckDbNode | DuckDbWasm;
    if (process.env.NODE_ENV !== "production") {
      duckDb = await DuckDbWasm.create(__dirname);
    } else {
      duckDb = await DuckDbNode.create(process.env.DUCKDB_FILE_NAME);
    }
    await duckDb.createTable();

    const eventHandler = new ContextHandler(duckDb);
    const ethEvent = new EthEvent(eventHandler);
    // TODO: here, we create multiple listeners to listen to multiple evms and cosmos networks
    ethEvent.listenToEthEvent(
      new ethers.providers.JsonRpcProvider("https://1rpc.io/bnb"),
      "0xb40C364e70bbD98E8aaab707A41a52A2eAF5733f"
    );

    // const { evmToOraichainMachine } = createMachines(duckDb);
  });
