export const convertTxHashToHex = (txHash: Uint8Array): string => {
  return Buffer.from(txHash).toString("hex").toUpperCase();
};
