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
import { CosmosHandler } from "./event-handlers/cosmos.handler";
import { EvmEventHandler } from "./event-handlers/evm.handler";
import { OraiBridgeHandler } from "./event-handlers/oraibridge.handler";
import { OraichainHandler } from "./event-handlers/oraichain.handler";
import IntepreterManager from "./managers/intepreter.manager";
import { getCosmosTxEvent, getSendToCosmosEvent } from "./utils/events";

let im = new IntepreterManager(false, resolve(__dirname, "../src/data"));

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

  /**
   * @devs
   * @notice about query params
   * - { txHash, evmChainPrefix } => handleEvmIntepreter
   * - { txHash, chainId } => handleCosmosIntepreter
   * - { txHash } => handleOraichainIntepreter
   */
  .get("/api/routing", async (res, req) => {
    return getQueryRouting(res, req);
  })
  .post("/api/routing", (res, req) => {
    readJson(
      res,
      async (obj: any) => {
        const txHash = obj.txHash;
        try {
          if (obj.evmChainPrefix) {
            const evmData = await getSendToCosmosEvent(txHash, obj.evmChainPrefix);
            const evmHandler = new EvmEventHandler(DuckDbNode.instances, im);
            evmHandler.handleEvent([...evmData, obj.evmChainPrefix]);
          }

          if (obj.chainId) {
            const cosmosData = await getCosmosTxEvent(txHash, obj.chainId);
            let cosmosHandler = new CosmosHandler(DuckDbNode.instances, im);
            cosmosHandler.handleEvent([
              {
                txEvent: cosmosData,
                chainId: obj.chainId
              }
            ]);
          }

          if (!obj.chainId && !obj.evmChainPrefix) {
            const oraiData = await getCosmosTxEvent(txHash, "Oraichain");
            let oraiHandler = new OraichainHandler(DuckDbNode.instances, im);
            oraiHandler.handleEvent([oraiData]);
          }
        } catch (err) {
          console.log(err);
        }

        res.writeStatus("200 Ok").end(
          JSON.stringify({
            message: "Success",
            data: []
          })
        );
      },
      (err: any) => {
        /* Request was prematurely aborted or invalid or missing, stop reading */
        res.writeStatus("400 Bad Request").end(
          JSON.stringify({
            message: `${err?.message || "Something went wrong"}`,
            data: []
          })
        );
      }
    );
  })
  .listen(9001, async (listenSocket) => {
    console.log("dirname: ", __dirname);
    if (listenSocket) {
      console.log("Listening to port 9001");
    }
    let duckDb: DuckDbNode;
    duckDb = await DuckDbNode.create(resolve(__dirname, "data/db.duckdb"));
    await duckDb.createTable();

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

// COPIED FROM EXAMPLES ON UWS
/* Helper function for reading a posted JSON body */
function readJson(res: any, cb: any, err: any) {
  let buffer;
  /* Register data cb */
  res.onData((ab, isLast) => {
    let chunk = Buffer.from(ab);
    if (isLast) {
      let json;
      if (buffer) {
        try {
          json = JSON.parse(Buffer.concat([buffer, chunk]).toString());
        } catch (e) {
          /* res.close calls onAborted */
          res.close();
          return;
        }
        cb(json);
      } else {
        try {
          json = JSON.parse(chunk.toString());
        } catch (e) {
          /* res.close calls onAborted */
          res.close();
          return;
        }
        cb(json);
      }
    } else {
      if (buffer) {
        buffer = Buffer.concat([buffer, chunk]);
      } else {
        buffer = Buffer.concat([chunk]);
      }
    }
  });

  /* Register error cb */
  res.onAborted(err);
}
