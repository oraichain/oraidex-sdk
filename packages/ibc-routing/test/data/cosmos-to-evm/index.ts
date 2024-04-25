import fs from "fs";
import path from "path";

export const OnRecvPacketOraiBridgeTxData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "./on_recv_packet_ob.json")).toString("utf-8")
);

export const OnRecvPacketOraichainTxData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "./on_recv_packet_orai.json")).toString("utf-8")
);

export const OnRequestBatchTxData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "./request_batch.json")).toString("utf-8")
);

export const BatchSendToEthClaimTxData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "./batch_send_to_eth_claim.json")).toString("utf-8")
);

export const IbcTransferTxData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "./ibc_transfer.json")).toString("utf-8")
);
