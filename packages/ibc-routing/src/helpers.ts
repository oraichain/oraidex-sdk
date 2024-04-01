import { ethers } from "ethers";

export const convertTxHashToHex = (txHash: Uint8Array): string => {
  return Buffer.from(txHash).toString("hex").toUpperCase();
};

export const keccak256HashString = (data: string): string => {
  return ethers.utils.keccak256(Buffer.from(data));
};
