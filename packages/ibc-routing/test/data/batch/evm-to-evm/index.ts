import { BigNumber } from "ethers";
import fs from "fs";
import path from "path";

export const SendToCosmosData1 = [
  "0x55d398326f99059fF775485246999027B3197955",
  "0x9a0A02B296240D2620E339cCDE386Ff612f07Be5",
  "channel-1/orai1rchnkdpsxzhquu63y6r4j4t57pnc9w8ehdhedx:CjVldGgtbWFpbm5ldDB4YjFBREU4NDU2NmRCMTE3QjRCMjQxZkM0NDZjZWIxYzQ2NjE2ZTE3MhIKY2hhbm5lbC0yORo1ZXRoLW1haW5uZXQweGRBQzE3Rjk1OEQyZWU1MjNhMjIwNjIwNjk5NDU5N0MxM0Q4MzFlYzc=",
  BigNumber.from("0xb469471f80140000"),
  BigNumber.from("0x010009"),
  {
    blockNumber: 38318558,
    blockHash: "0xbe3e54393d6079ab629e7c28cbe7fc63cec58547642097eb612cefc2d873ab40",
    transactionIndex: 25,
    removed: false,
    address: "0xb40C364e70bbD98E8aaab707A41a52A2eAF5733f",
    data: "0x0000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000b469471f80140000000000000000000000000000000000000000000000000000000000000001000900000000000000000000000000000000000000000000000000000000000000da6368616e6e656c2d312f6f726169317263686e6b647073787a687175753633793672346a34743537706e63397738656864686564783a436a566c6447677462574670626d356c64444234596a4642524555344e4455324e6d52434d544533516a52434d6a51785a6b4d304e445a6a5a574978597a51324e6a45325a5445334d68494b59326868626d356c624330794f526f315a58526f4c573168615735755a58517765475242517a4533526a6b314f4551795a5755314d6a4e684d6a49774e6a49774e6a6b354e4455354e304d784d3051344d7a466c597a633d000000000000",
    topics: [
      "0x9e9794dbf94b0a0aa31a480f5b38550eda7f89115ac8fbf4953fa4dd219900c9",
      "0x00000000000000000000000055d398326f99059ff775485246999027b3197955",
      "0x0000000000000000000000009a0a02b296240d2620e339ccde386ff612f07be5"
    ],
    transactionHash: "0x5b9be0596126de413c41bf6793fae3de8cfbea14a385932667a10eea3d4c1512",
    logIndex: 50,
    removeListener: "[Function (anonymous)]",
    getBlock: "[Function (anonymous)]",
    getTransaction: "[Function (anonymous)]",
    getTransactionReceipt: "[Function (anonymous)]",
    event: "SendToCosmosEvent",
    eventSignature: "SendToCosmosEvent(address,address,string,uint256,uint256)",
    decode: "[Function (anonymous)]",
    args: [
      "0x55d398326f99059fF775485246999027B3197955",
      "0x9a0A02B296240D2620E339cCDE386Ff612f07Be5",
      "channel-1/orai1rchnkdpsxzhquu63y6r4j4t57pnc9w8ehdhedx:CjVldGgtbWFpbm5ldDB4YjFBREU4NDU2NmRCMTE3QjRCMjQxZkM0NDZjZWIxYzQ2NjE2ZTE3MhIKY2hhbm5lbC0yORo1ZXRoLW1haW5uZXQweGRBQzE3Rjk1OEQyZWU1MjNhMjIwNjIwNjk5NDU5N0MxM0Q4MzFlYzc=",
      BigNumber.from("0xb469471f80140000"),
      BigNumber.from("0x010009")
    ]
  }
];

export const SendToCosmosData2 = [
  "0x55d398326f99059fF775485246999027B3197955",
  "0x9a0A02B296240D2620E339cCDE386Ff612f07Be5",
  "channel-1/orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd:CjVldGgtbWFpbm5ldDB4MGRlQjUyNDk5QzJlOUYzOTIxYzYzMWNiNkFkMzUyMkM1NzZkNTQ4NBIKY2hhbm5lbC0yORo1ZXRoLW1haW5uZXQweGRBQzE3Rjk1OEQyZWU1MjNhMjIwNjIwNjk5NDU5N0MxM0Q4MzFlYzc=",
  BigNumber.from("0xd02ab486cedc0000"),
  BigNumber.from("0x01000a"),
  {
    blockNumber: 38318558,
    blockHash: "0xbe3e54393d6079ab629e7c28cbe7fc63cec58547642097eb612cefc2d873ab40",
    transactionIndex: 29,
    removed: false,
    address: "0xb40C364e70bbD98E8aaab707A41a52A2eAF5733f",
    data: "0x0000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000d02ab486cedc0000000000000000000000000000000000000000000000000000000000000001000a00000000000000000000000000000000000000000000000000000000000000da6368616e6e656c2d312f6f7261693165686d6871636e38657266336467617672636136397a6770347274786a356b716774636e79643a436a566c6447677462574670626d356c644442344d47526c516a55794e446b35517a4a6c4f55597a4f544978597a597a4d574e694e6b466b4d7a55794d6b4d314e7a5a6b4e5451344e42494b59326868626d356c624330794f526f315a58526f4c573168615735755a58517765475242517a4533526a6b314f4551795a5755314d6a4e684d6a49774e6a49774e6a6b354e4455354e304d784d3051344d7a466c597a633d000000000000",
    topics: [
      "0x9e9794dbf94b0a0aa31a480f5b38550eda7f89115ac8fbf4953fa4dd219900c9",
      "0x00000000000000000000000055d398326f99059ff775485246999027b3197955",
      "0x0000000000000000000000009a0a02b296240d2620e339ccde386ff612f07be5"
    ],
    transactionHash: "0x1d41acf070f7a6c164857f5971ddd344a4a734a33ae09c411e3c80a9e2b8628a",
    logIndex: 58,
    removeListener: "[Function (anonymous)]",
    getBlock: "[Function (anonymous)]",
    getTransaction: "[Function (anonymous)]",
    getTransactionReceipt: "[Function (anonymous)]",
    event: "SendToCosmosEvent",
    eventSignature: "SendToCosmosEvent(address,address,string,uint256,uint256)",
    decode: "[Function (anonymous)]",
    args: [
      "0x55d398326f99059fF775485246999027B3197955",
      "0x9a0A02B296240D2620E339cCDE386Ff612f07Be5",
      "channel-1/orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd:CjVldGgtbWFpbm5ldDB4MGRlQjUyNDk5QzJlOUYzOTIxYzYzMWNiNkFkMzUyMkM1NzZkNTQ4NBIKY2hhbm5lbC0yORo1ZXRoLW1haW5uZXQweGRBQzE3Rjk1OEQyZWU1MjNhMjIwNjIwNjk5NDU5N0MxM0Q4MzFlYzc=",
      BigNumber.from("0xd02ab486cedc0000"),
      BigNumber.from("0x01000a")
    ]
  }
];

export const OraiBridgeAutoForwardTxData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "./auto_forward.json")).toString("utf-8")
);

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
