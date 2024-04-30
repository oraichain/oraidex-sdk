import { BigNumber } from "ethers";
import fs from "fs";
import path from "path";

export const SendToCosmosData = [
  "0x55d398326f99059fF775485246999027B3197955",
  "0x9a0A02B296240D2620E339cCDE386Ff612f07Be5",
  "channel-1/orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd:Ci1jb3Ntb3MxZWhtaHFjbjhlcmYzZGdhdnJjYTY5emdwNHJ0eGo1a3FtY3dzOTcSCmNoYW5uZWwtMTUaBXVhdG9t",
  BigNumber.from("0x29a2241af62c0000"),
  BigNumber.from("0xf90f"),
  {
    blockNumber: 37505362,
    blockHash: "0xb0b2a00c477c179978d980b024fb0e200745b818643986858e4106d8ee9e4bae",
    transactionIndex: 256,
    removed: false,
    address: "0xb40C364e70bbD98E8aaab707A41a52A2eAF5733f",
    data: "0x000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000029a2241af62c0000000000000000000000000000000000000000000000000000000000000000f90f000000000000000000000000000000000000000000000000000000000000008e6368616e6e656c2d312f6f7261693165686d6871636e38657266336467617672636136397a6770347274786a356b716774636e79643a4369316a62334e7462334d785a5768746148466a626a686c636d597a5a476468646e4a6a59545935656d64774e484a3065476f31613346745933647a4f546353436d4e6f595735755a5777744d5455614258566864473974000000000000000000000000000000000000",
    topics: [
      "0x9e9794dbf94b0a0aa31a480f5b38550eda7f89115ac8fbf4953fa4dd219900c9",
      "0x00000000000000000000000055d398326f99059ff775485246999027b3197955",
      "0x0000000000000000000000009a0a02b296240d2620e339ccde386ff612f07be5"
    ],
    transactionHash: "0xe551efd736461673ee952881c49923d2bb4fba538aa1771775d4d5bc02f97c8f",
    logIndex: 496,
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
      "channel-1/orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd:Ci1jb3Ntb3MxZWhtaHFjbjhlcmYzZGdhdnJjYTY5emdwNHJ0eGo1a3FtY3dzOTcSCmNoYW5uZWwtMTUaBXVhdG9t",
      BigNumber.from("0x29a2241af62c0000"),
      BigNumber.from("0xf90f")
    ]
  }
];

export const OraiBridgeAutoForwardTxData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "./auto_forward.json")).toString("utf-8")
);

export const OnRecvPacketTxData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "./on_recv_packet.json")).toString("utf-8")
);

export const OnAcknowledgement = JSON.parse(
  fs.readFileSync(path.join(__dirname, "./on_acknowledgement.json")).toString("utf-8")
);
