import { TxEvent } from "@cosmjs/tendermint-rpc/build/tendermint37";
import fs from "fs";
import path from "path";

export const oraiBridgeAutoForwardTx = JSON.parse(
  fs.readFileSync(path.join(__dirname, "./auto_forward.json")).toString("utf-8")
);
export const onRecvPacketTx = JSON.parse(
  fs.readFileSync(path.join(__dirname, "./on_recv_packet.json")).toString("utf-8")
);

export const unmarshalTxEvent = (txEvent: any): TxEvent => ({
  ...txEvent,
  tx: new Uint8Array(Buffer.from(txEvent.tx, "base64")),
  hash: new Uint8Array(Buffer.from(txEvent.hash, "hex")),
  result: {
    ...txEvent.result,
    data: new Uint8Array(Buffer.from(txEvent.result.data, "base64"))
  }
});
