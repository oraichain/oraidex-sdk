import { ChainIdEnum } from "@oraichain/oraidex-common";
import { HttpRequest, HttpResponse } from "uWebSockets.js";
import { waitFor } from "xstate/lib/waitFor";
import { ChainIdToEvmChainPrefix, invokableMachineStateKeys } from "../constants";
import { DuckDbNode } from "../db";
import { CosmosHandler } from "../event-handlers/cosmos.handler";
import { EvmEventHandler } from "../event-handlers/evm.handler";
import { OraichainHandler } from "../event-handlers/oraichain.handler";
import { createCosmosIntepreter } from "../intepreters/cosmos.intepreter";
import { createEvmIntepreter } from "../intepreters/evm.intepreter";
import { createOraichainIntepreter } from "../intepreters/oraichain.intepreter";
import IntepreterManager from "../managers/intepreter.manager";
import { getCosmosTxEvent, getSendToCosmosEvent } from "../utils/events";

export const getQueryRouting = async (res: HttpResponse, req: HttpRequest) => {
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

  const chainId = qObject.get("chainId");
  const txHash = qObject.get("txHash");

  switch (chainId) {
    case ChainIdEnum.Ethereum:
    case ChainIdEnum.BNBChain:
    case ChainIdEnum.TRON:
      await (async () => {
        const interpreter = createEvmIntepreter(duckDb);
        const actor = interpreter._inner.start();
        interpreter._inner.send({
          type: invokableMachineStateKeys.QUERY_IBC_ROUTING_DATA,
          payload: {
            txHash: txHash,
            evmChainPrefix: ChainIdToEvmChainPrefix[chainId]
          }
        });
        const doneState = await waitFor(actor, (state) => state.done);
        responseData = {
          ...responseData,
          data: doneState.context.routingQueryData
        };
      })();
      break;

    case ChainIdEnum.Oraichain:
      await (async () => {
        const interpreter = createOraichainIntepreter(duckDb);
        const actor = interpreter._inner.start();
        interpreter._inner.send({
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
      })();
      break;

    default:
      await (async () => {
        const interpreter = createCosmosIntepreter(duckDb);
        const actor = interpreter._inner.start();
        interpreter._inner.send({
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
      })();
  }

  if (!res.aborted) {
    res.cork(() => {
      res.writeStatus("200 OK").writeHeader("Content-Type", "application/json").end(JSON.stringify(responseData));
    });
  }
};

export const submitRouting = async (res: HttpResponse, req: HttpRequest, im: IntepreterManager) => {
  try {
    readJson(
      res,
      async (obj: any) => {
        const txHash = obj.txHash;
        const chainId = obj.chainId;

        try {
          switch (chainId) {
            case ChainIdEnum.Ethereum:
            case ChainIdEnum.BNBChain:
            case ChainIdEnum.TRON:
              const evmData = await getSendToCosmosEvent(txHash, ChainIdToEvmChainPrefix[chainId]);
              for (const evmItem of evmData) {
                const evmHandler = new EvmEventHandler(DuckDbNode.instances, im);
                evmHandler.handleEvent([...evmItem, obj.evmChainPrefix]);
              }
              break;
            case ChainIdEnum.Oraichain:
              const oraiData = await getCosmosTxEvent(txHash, ChainIdEnum.Oraichain);
              let oraiHandler = new OraichainHandler(DuckDbNode.instances, im);
              oraiHandler.handleEvent([oraiData]);
              break;
            default:
              const cosmosData = await getCosmosTxEvent(txHash, obj.chainId);
              let cosmosHandler = new CosmosHandler(DuckDbNode.instances, im);
              cosmosHandler.handleEvent([
                {
                  txEvent: cosmosData,
                  chainId: obj.chainId
                }
              ]);
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
  } catch (err) {
    res.writeStatus("400 Bad Request").end(
      JSON.stringify({
        message: `${err?.message || "Something went wrong"}`,
        data: []
      })
    );
  }
};

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
