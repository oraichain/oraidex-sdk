import { ChainIdEnum, generateError } from "@oraichain/oraidex-common";
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

export const getRouteDetail = async ({ chainId, txHash }: { chainId: string; txHash: string }) => {
  const duckDb = DuckDbNode.instances;
  let responseData = {
    message: "Success",
    data: {}
  };
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
            txHash
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
            txHash,
            chainId
          }
        });
        const doneState = await waitFor(actor, (state) => state.done);
        responseData = {
          ...responseData,
          data: doneState.context.routingQueryData
        };
      })();
  }

  return responseData;
};

export const getQueryRouting = async (res: HttpResponse, req: HttpRequest) => {
  res.onAborted(() => {
    res.aborted = true;
  });

  const qString = req.getQuery();
  const qObject = new URLSearchParams(qString);
  // const duckDb = DuckDbNode.instances;

  let responseData = {
    message: "Success",
    data: {}
  };

  const chainId = qObject.get("chainId");
  const txHash = qObject.get("txHash");

  try {
    responseData = await getRouteDetail({ chainId, txHash });
  } catch (err) {
    res.cork(() => {
      res
        .writeStatus("500 Internal Server Error")
        .writeHeader("Content-Type", "application/json")
        .end(JSON.stringify({ ...responseData, message: err?.message || "Something went wrong" }));
    });
  }

  if (!res.aborted) {
    res.cork(() => {
      res.writeStatus("200 OK").writeHeader("Content-Type", "application/json").end(JSON.stringify(responseData));
    });
  }
};

export const getQueryAllRouting = async (res: HttpResponse, req: HttpRequest) => {
  res.onAborted(() => {
    res.aborted = true;
  });

  const qString = req.getQuery();
  const qObject = new URLSearchParams(qString);
  const duckDb = DuckDbNode.instances;

  let responseData = {
    message: "Success",
    data: []
  };

  const params = qObject.getAll("data[]");
  const dataQueries = [];
  try {
    params.map((param) => dataQueries.push(JSON.parse(param)));
  } catch (error) {
    console.log("error", error);
    throw generateError("Query params Error");
  }

  try {
    const promiseAll = dataQueries.map((param) => getRouteDetail(param)) || [];

    const dataRes = await Promise.all(promiseAll);

    const fmtData = dataQueries.reduce((acc, cur, index) => {
      if (cur.txHash) {
        acc[cur.txHash] = dataRes[index]?.data || [];
      }

      return acc;
    }, {});

    responseData = {
      ...responseData,
      data: fmtData
    };
  } catch (err) {
    res.cork(() => {
      res
        .writeStatus("500 Internal Server Error")
        .writeHeader("Content-Type", "application/json")
        .end(JSON.stringify({ ...responseData, message: err?.message || "Something went wrong" }));
    });
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
        let message = "Success";
        let isError = false;
        try {
          switch (chainId) {
            case ChainIdEnum.Ethereum:
            case ChainIdEnum.BNBChain:
            case ChainIdEnum.TRON:
              const evmData = await getSendToCosmosEvent(txHash, ChainIdToEvmChainPrefix[chainId]);
              for (const evmItem of evmData) {
                const evmHandler = new EvmEventHandler(DuckDbNode.instances, im);
                evmHandler.handleEvent([...evmItem, ChainIdToEvmChainPrefix[chainId]]);
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
          isError = true;
          message = err?.message || "Something went wrong";
        }

        if (!res.aborted) {
          res.cork(() => {
            res
              .writeStatus(!isError ? "200 OK" : "500 Internal Server Error")
              .writeHeader("Content-Type", "application/json")
              .end(
                JSON.stringify({
                  message,
                  data: []
                })
              );
          });
        }
      },
      (err: any) => {
        res.aborted = true;
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
