/* Non-SSL is simply App() */

import uws from "uWebSockets.js";
import "dotenv/config";
import { DuckDbNode, DuckDbWasm } from "./db";
import { EventHandler, EthEvent, OraiBridgeEvent, OraichainEvent } from "./event";
import { ethers } from "ethers";
import { autoForwardTag, onRecvPacketTag } from "./constants";

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
    // let duckDb: DuckDbNode | DuckDbWasm;
    // if (process.env.NODE_ENV !== "production") {
    //   duckDb = await DuckDbWasm.create(__dirname);
    // } else {
    //   duckDb = await DuckDbNode.create(process.env.DUCKDB_FILE_NAME);
    // }
    const duckDb = await DuckDbNode.create(process.env.DUCKDB_FILE_NAME || ":memory:");
    await duckDb.createTable();

    const eventHandler = new EventHandler(duckDb);
    // recover all previous intepreters so that we can be at the current states for all contexts
    await eventHandler.recoverIntepreters();
    const ethEvent = new EthEvent(eventHandler);
    const oraiBridgeEvent = new OraiBridgeEvent(duckDb, eventHandler, "bridge-v2.rpc.orai.io");
    const oraichainEvent = new OraichainEvent(duckDb, eventHandler, "rpc.orai.io");
    // TODO: here, we create multiple listeners to listen to multiple evms and cosmos networks
    ethEvent.listenToEthEvent(
      new ethers.providers.JsonRpcProvider("https://1rpc.io/bnb"),
      "0xb40C364e70bbD98E8aaab707A41a52A2eAF5733f"
    );
    await oraiBridgeEvent.connectCosmosSocket([autoForwardTag]);
    await oraichainEvent.connectCosmosSocket([onRecvPacketTag]);

    // const { evmToOraichainMachine } = createMachines(duckDb);
  });
