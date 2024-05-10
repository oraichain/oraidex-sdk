import { IndexedTx } from "@cosmjs/stargate";
import { TxEvent } from "@cosmjs/tendermint-rpc/build/tendermint37";
import { EventAttribute } from "@cosmjs/tendermint-rpc/build/tendermint37/responses";
import { EvmChainPrefix } from "@oraichain/oraidex-common";
import { ethers } from "ethers";
import { encodeRpcEvents } from "./utils/events";

export const convertTxHashToHex = (txHash: Uint8Array): string => {
  return Buffer.from(txHash).toString("hex").toUpperCase();
};

export function convertStringToUint8Array(hexString) {
  const bytes = [];
  for (let i = 0; i < hexString.length; i += 2) {
    bytes.push(parseInt(hexString.substr(i, 2), 16));
  }
  return new Uint8Array(bytes);
}

export const keccak256HashString = (data: string): string => {
  return ethers.utils.keccak256(Buffer.from(data));
};

export const convertIndexedTxToTxEvent = (tx: IndexedTx): TxEvent => {
  return {
    height: tx.height,
    hash: convertStringToUint8Array(tx.hash),
    result: {
      code: tx.code,
      events: encodeRpcEvents(tx.events),
      gasUsed: tx.gasUsed,
      gasWanted: tx.gasWanted,
      codespace: "",
      data: [] as any,
      log: tx.rawLog
    },
    tx: tx.tx
  };
};

// denom here is denom from oraibridge to evm, this will have form like:
// Input: wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm/channel-29/oraib0x55d398326f99059fF775485246999027B3197955
// Output: 0x55d398326f99059fF775485246999027B3197955
export const decodeDenomToTokenAddress = (denom: string): string => {
  const splittedDenom = denom.split("/");
  const lastDenom = splittedDenom[splittedDenom.length - 1];
  const evmChainPrefix = Object.values(EvmChainPrefix).find((item) => lastDenom.includes(item)) || "";
  const splittedLastDenom = lastDenom.split(evmChainPrefix);
  return splittedLastDenom[splittedLastDenom.length - 1];
};

// denom here is denom from oraibridge to evm, this will have form like:
// Input: oraib0x55d398326f99059fF775485246999027B3197955
// Output: 0x55d398326f99059fF775485246999027B3197955
export const decodeMemoToTokenAddress = (denom: string): string => {
  const evmChainPrefix = Object.values(EvmChainPrefix).find((item) => denom.includes(item)) || "";
  const splittedLastDenom = denom.split(evmChainPrefix);
  return splittedLastDenom[splittedLastDenom.length - 1];
};

export const groupByContractAddress = (attributes: readonly EventAttribute[]): EventAttribute[][] => {
  const groupedAttributes = [];
  let group = [];

  for (const attribute of attributes) {
    const key = attribute.key;

    if (key === "_contract_address") {
      if (group.length > 0) {
        groupedAttributes.push(group);
        group = [];
      }
    }

    group.push(attribute);
  }

  // Push the last group if not empty
  if (group.length > 0) {
    groupedAttributes.push(group);
  }

  return groupedAttributes;
};
