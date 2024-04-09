import { IndexedTx } from "@cosmjs/stargate";
import { TxEvent } from "@cosmjs/tendermint-rpc/build/tendermint37";
import { ethers } from "ethers";

export const convertTxHashToHex = (txHash: Uint8Array): string => {
  return Buffer.from(txHash).toString("hex").toUpperCase();
};

export const keccak256HashString = (data: string): string => {
  return ethers.utils.keccak256(Buffer.from(data));
};

export const convertIndexedTxToTxEvent = (tx: IndexedTx): TxEvent => {
  return {
    height: tx.height,
    hash: Buffer.from(tx.hash),
    result: {
      code: tx.code,
      events: tx.events,
      gasUsed: tx.gasUsed,
      gasWanted: tx.gasWanted,
      codespace: "",
      data: [] as any,
      log: tx.rawLog
    },
    tx: tx.tx
  };
};
