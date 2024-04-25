import { IndexedTx } from "@cosmjs/stargate";
import { TxEvent } from "@cosmjs/tendermint-rpc/build/tendermint37";
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
