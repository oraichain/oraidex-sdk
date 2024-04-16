/* Non-SSL is simply App() */

import "dotenv/config";
import { ethers } from "ethers";
import { resolve } from "path";
import uws from "uWebSockets.js";
import { getQueryRouting } from "./apis";
import { config } from "./config";
import {
  autoForwardTag,
  batchSendToEthClaimTag,
  EvmRpcs,
  GravityAddress,
  onExecuteContractTag,
  onRecvPacketTag,
  requestBatchTag
} from "./constants";
import { DuckDbNode } from "./db";
import { EthEvent, OraiBridgeEvent, OraichainEvent } from "./event";
import { EvmEventHandler } from "./event-handlers/evm.handler";
import { OraiBridgeHandler } from "./event-handlers/oraibridge.handler";
import { OraichainHandler } from "./event-handlers/oraichain.handler";
import IntepreterManager from "./managers/intepreter.manager";

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
  .get("/api/routing", async (res, req) => {
    return getQueryRouting(res, req);
  })
  .listen(9001, async (listenSocket) => {
    console.log("dirname: ", __dirname);
    if (listenSocket) {
      console.log("Listening to port 9001");
    }
    let duckDb: DuckDbNode;
    duckDb = await DuckDbNode.create(resolve(__dirname, "data/db.duckdb"));
    await duckDb.createTable();

    let im = new IntepreterManager(false, resolve(__dirname, "../src/data"));
    im.recoverInterpreters();

    const evmEventHandler = new EvmEventHandler(duckDb, im);
    const oraichainEventHandler = new OraichainHandler(duckDb, im);
    const oraibridgeEventHandler = new OraiBridgeHandler(duckDb, im);

    const ethEvent = new EthEvent(evmEventHandler);
    const oraiBridgeEvent = new OraiBridgeEvent(oraibridgeEventHandler, config.ORAIBRIDGE_RPC_URL);
    const oraichainEvent = new OraichainEvent(oraichainEventHandler, config.ORAICHAIN_RPC_URL);

    // // TODO: here, we create multiple listeners to listen to multiple evms and cosmos networks
    for (const evmChainPrefix of Object.keys(EvmRpcs)) {
      console.log("connecting socket to", evmChainPrefix);
      ethEvent.listenToEthEvent(
        new ethers.providers.JsonRpcProvider(EvmRpcs[evmChainPrefix]),
        GravityAddress[evmChainPrefix],
        evmChainPrefix
      );
    }

    [autoForwardTag, requestBatchTag, batchSendToEthClaimTag].forEach((item) => {
      oraiBridgeEvent.connectCosmosSocket([item]);
    });

    [onRecvPacketTag, onExecuteContractTag].forEach((item) => {
      oraichainEvent.connectCosmosSocket([item]);
    });
    await oraiBridgeEvent.connectCosmosSocket([autoForwardTag, requestBatchTag, batchSendToEthClaimTag]);
  });
