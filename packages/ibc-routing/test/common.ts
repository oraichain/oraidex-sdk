import { TxEvent } from "@cosmjs/tendermint-rpc/build/tendermint37";

export const unmarshalTxEvent = (txEvent: any): TxEvent => ({
  ...txEvent,
  tx: new Uint8Array(Buffer.from(txEvent.tx, "base64")),
  hash: new Uint8Array(Buffer.from(txEvent.hash, "hex")),
  result: {
    ...txEvent.result,
    data: new Uint8Array(Buffer.from(txEvent.result.data, "base64"))
  }
});
