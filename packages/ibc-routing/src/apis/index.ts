import { EvmChainPrefix } from "@oraichain/oraidex-common";
import { HttpRequest, HttpResponse } from "uWebSockets.js";
import { waitFor } from "xstate/lib/waitFor";
import { invokableMachineStateKeys } from "../constants";
import { DuckDbNode } from "../db";
import { createCosmosIntepreter } from "../intepreters/cosmos.intepreter";
import { createEvmIntepreter } from "../intepreters/evm.intepreter";
import { createOraichainIntepreter } from "../intepreters/oraichain.intepreter";

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

  if (qObject.get("evmChainPrefix")) {
    const interpreter = createEvmIntepreter(duckDb);
    const actor = interpreter._inner.start();
    interpreter._inner.send({
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
  }

  if (!qObject.get("evmChainPrefix") && !qObject.get("chainId")) {
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
  }

  if (!res.aborted) {
    res.cork(() => {
      res.writeStatus("200 OK").writeHeader("Content-Type", "application/json").end(JSON.stringify(responseData));
    });
  }
};
