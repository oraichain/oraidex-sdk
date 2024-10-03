import {
  generateError,
  ORAI_BRIDGE_EVM_DENOM_PREFIX,
  ORAI_BRIDGE_EVM_TRON_DENOM_PREFIX
} from "@oraichain/oraidex-common";
import { Path, Route } from "../types";
import { CosmosMsg, OraichainMsg, OsmosisMsg } from "./chains";
import { MiddleWareResponse } from "./types";
import { EncodeObject } from "@cosmjs/proto-signing";

const getDestPrefixForBridgeToEvmOnOrai = (chainId: string): string => {
  const prefixMap: { [key: string]: string } = {
    "0x01": ORAI_BRIDGE_EVM_DENOM_PREFIX,
    "0x38": ORAI_BRIDGE_EVM_DENOM_PREFIX,
    "0x2b6653dc": ORAI_BRIDGE_EVM_TRON_DENOM_PREFIX
  };

  const prefix = prefixMap[chainId];
  if (prefix) {
    return prefix;
  } else if (chainId.startsWith("0x")) {
    throw generateError(`Don't support bridge from Oraichain to ${chainId}`);
  }
  return "";
};

//FIXME: calc minimum receive
const buildMemoSwap = (
  path: Path,
  receiver: string,
  memo: string,
  addresses: { [chainId: string]: string }
): MiddleWareResponse => {
  let currentChain = path.chainId;
  let currentAddress = addresses[currentChain];
  switch (currentChain) {
    case "Oraichain": {
      let prefix = getDestPrefixForBridgeToEvmOnOrai(path.tokenOutChainId);
      let oBridgeAddress = addresses["OraiBridge"];
      let oraichainMsg = new OraichainMsg(path, "1", receiver, currentAddress, memo, prefix, oBridgeAddress);
      let previousChain = path.chainId;
      // we have 2 cases:
      // - Previous chain use IBC bridge to Oraichain (noble)
      // -  Previous chain use IBC Wasm bridge to Oraichain
      let msgInfo = previousChain == "noble-1" ? oraichainMsg.genMemoForIbcWasm() : oraichainMsg.genMemoAsMiddleware();
      return msgInfo;
    }
    case "osmosis-1": {
      let cosmosMsg = new OsmosisMsg(path, "1", receiver, currentAddress, memo);
      let msgInfo = cosmosMsg.genMemoAsMiddleware();
      return msgInfo;
    }

    default: {
      // currently, we don't support universal swap on EVM
      // default cosmos case
      if (currentChain.startsWith("0x")) {
        throw generateError("Don't support universal swap in EVM");
      }
      let cosmosMsg = new CosmosMsg(path, "1", receiver, currentAddress, memo);
      let msgInfo = cosmosMsg.genMemoAsMiddleware();
      return msgInfo;
    }
  }
};

//FIXME: calc minimum receive
const buildExecuteMsg = (
  path: Path,
  receiver: string,
  memo: string,
  addresses: { [chainId: string]: string }
): EncodeObject => {
  let currentChain = path.chainId;
  let currentAddress = addresses[currentChain];
  switch (currentChain) {
    case "Oraichain": {
      let prefix = getDestPrefixForBridgeToEvmOnOrai(path.tokenOutChainId);
      let oBridgeAddress = addresses["OraiBridge"];
      let oraichainMsg = new OraichainMsg(path, "1", receiver, currentAddress, memo, prefix, oBridgeAddress);
      return oraichainMsg.genExecuteMsg();
    }
    case "osmosis-1": {
      let cosmosMsg = new OsmosisMsg(path, "1", receiver, currentAddress, memo);
      return cosmosMsg.genExecuteMsg();
    }

    default: {
      // currently, we don't support universal swap on EVM
      // default cosmos case
      if (currentChain.startsWith("0x")) {
        throw generateError("Don't support universal swap in EVM");
      }
      let cosmosMsg = new CosmosMsg(path, "1", receiver, currentAddress, memo);
      return cosmosMsg.genExecuteMsg();
    }
  }
};

export const generateMsgSwap = (route: Route, slippage: number = 0.01, addresses: { [chainId: string]: string }) => {
  if (route.paths.length == 0) {
    throw generateError("Require at least 1 action");
  }
  let memo: string = "";
  let receiver = addresses[route.paths.at(-1)?.tokenOutChainId];

  // generate memo for univeral swap
  for (let i = route.paths.length - 1; i > 0; i--) {
    let swapInfo = buildMemoSwap(route.paths[i], receiver, memo, addresses);
    memo = swapInfo.memo;
    receiver = swapInfo.receiver;
  }

  return buildExecuteMsg(route.paths[0], receiver, memo, addresses);

  // generate execute msg
};
