/* Non-SSL is simply App() */

import { EvmChainPrefix } from "@oraichain/oraidex-common";
import "dotenv/config";
import { ethers } from "ethers";
import { resolve } from "path";
import { URLSearchParams } from "url";
import uws from "uWebSockets.js";
import { waitFor } from "xstate/lib/waitFor";
import {
  autoForwardTag,
  batchSendToEthClaimTag,
  invokableMachineStateKeys,
  onExecuteContractTag,
  onRecvPacketTag,
  requestBatchTag
} from "./constants";
import { DuckDbNode } from "./db";
import { EthEvent, OraiBridgeEvent, OraichainEvent } from "./event";
import { EvmEventHandler } from "./event-handlers/evm.handler";
import { OraiBridgeHandler } from "./event-handlers/oraibridge.handler";
import { OraichainHandler } from "./event-handlers/oraichain.handler";
import { createCosmosIntepreter } from "./intepreters/cosmos.intepreter";
import { createEvmIntepreter } from "./intepreters/evm.intepreter";
import { createOraichainIntepreter } from "./intepreters/oraichain.intepreter";
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
    /* Can't return or yield from here without responding or attaching an abort handler */
    res.onAborted(() => {
      res.aborted = true;
    });

    const qString = req.getQuery();
    const qObject = new URLSearchParams(qString);
    const duckDb = DuckDbNode.instances;

    let responseData = {
      message: "Success",
      data: {}
    };

    if (qObject.get("evmChainPrefix")) {
      const interpreter = createEvmIntepreter(duckDb);
      const actor = interpreter.start();
      interpreter.send({
        type: invokableMachineStateKeys.QUERY_IBC_ROUTING_DATA,
        payload: {
          txHash: qObject.get("txHash"),
          evmChainPrefix: EvmChainPrefix.BSC_MAINNET
        }
      });
      const doneState = await waitFor(actor, (state) => state.done);
      responseData = {
        ...responseData,
        data: doneState.context.routingQueryData
      };
    }

    if (qObject.get("chainId")) {
      const interpreter = createCosmosIntepreter(duckDb);
      const actor = interpreter.start();
      interpreter.send({
        type: invokableMachineStateKeys.QUERY_IBC_ROUTING_DATA,
        payload: {
          txHash: qObject.get("txHash"),
          chainId: qObject.get("chainId")
        }
      });
      const doneState = await waitFor(actor, (state) => state.done);
      responseData = {
        ...responseData,
        data: doneState.context.routingQueryData
      };
    }

    if (!qObject.get("evmChainPrefix") && !qObject.get("chainId")) {
      const interpreter = createOraichainIntepreter(duckDb);
      const actor = interpreter.start();
      interpreter.send({
        type: invokableMachineStateKeys.QUERY_IBC_ROUTING_DATA,
        payload: {
          txHash: qObject.get("txHash")
        }
      });
      const doneState = await waitFor(actor, (state) => state.done);
      responseData = {
        ...responseData,
        data: doneState.context.routingQueryData
      };
    }

    if (!res.aborted) {
      res.cork(() => {
        res.writeStatus("200 OK").writeHeader("Content-Type", "application/json").end(JSON.stringify(responseData));
      });
    }
  })
  .listen(9001, async (listenSocket) => {
    console.log("dirname: ", __dirname);
    if (listenSocket) {
      console.log("Listening to port 9001");
    }
    let duckDb: DuckDbNode;
    duckDb = await DuckDbNode.create(resolve(__dirname, "data/db.duckdb"));
    await duckDb.createTable();

    let im = new IntepreterManager(true, resolve(__dirname, "../src/data"));
    im.recoverInterpreters();

    const evmEventHandler = new EvmEventHandler(duckDb, im);
    const oraichainEventHandler = new OraichainHandler(duckDb, im);
    const oraibridgeEventHandler = new OraiBridgeHandler(duckDb, im);

    const ethEvent = new EthEvent(evmEventHandler);
    const oraiBridgeEvent = new OraiBridgeEvent(oraibridgeEventHandler, "https://bridge-v2.rpc.orai.io");
    const oraichainEvent = new OraichainEvent(oraichainEventHandler, "https://rpc.orai.io");

    // // TODO: here, we create multiple listeners to listen to multiple evms and cosmos networks
    ethEvent.listenToEthEvent(
      new ethers.providers.JsonRpcProvider("https://1rpc.io/bnb"),
      "0xb40C364e70bbD98E8aaab707A41a52A2eAF5733f",
      "oraib"
    );
    await oraiBridgeEvent.connectCosmosSocket([autoForwardTag, requestBatchTag, batchSendToEthClaimTag]);
    await oraichainEvent.connectCosmosSocket([onRecvPacketTag, onExecuteContractTag]);
  });
