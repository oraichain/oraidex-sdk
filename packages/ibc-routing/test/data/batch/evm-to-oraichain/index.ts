import { BigNumber } from "ethers";
import fs from "fs";
import path from "path";

export const SendToCosmosData1 = [
  "0x55d398326f99059fF775485246999027B3197955",
  "0x9a0A02B296240D2620E339cCDE386Ff612f07Be5",
  "channel-1/orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd:CitvcmFpMWVobWhxY244ZXJmM2RnYXZyY2E2OXpncDRydHhqNWtxZ3RjbnlkEgAaAA==",
  BigNumber.from("0x305c4405035ef000"),
  BigNumber.from("0xff4b"),
  {
    blockNumber: 38194529,
    blockHash: "0x3a231673a7a218faa897c280fc8929ade25a7348af4ff7fd1c5e3677e4f8f28c",
    transactionIndex: 46,
    removed: false,
    address: "0xb40C364e70bbD98E8aaab707A41a52A2eAF5733f",
    data: "0x0000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000305c4405035ef000000000000000000000000000000000000000000000000000000000000000ff4b000000000000000000000000000000000000000000000000000000000000007a6368616e6e656c2d312f6f7261693165686d6871636e38657266336467617672636136397a6770347274786a356b716774636e79643a43697476636d46704d57566f62576878593234345a584a6d4d32526e59585a79593245324f58706e63445279644868714e5774785a33526a626e6c6b4567416141413d3d000000000000",
    topics: [
      "0x9e9794dbf94b0a0aa31a480f5b38550eda7f89115ac8fbf4953fa4dd219900c9",
      "0x00000000000000000000000055d398326f99059ff775485246999027b3197955",
      "0x0000000000000000000000009a0a02b296240d2620e339ccde386ff612f07be5"
    ],
    transactionHash: "0x4f857ebe31d8e0e73757796052c7c2736495bda7f854824e1a8185139e31decc",
    logIndex: 140,
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
      "channel-1/orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd:CitvcmFpMWVobWhxY244ZXJmM2RnYXZyY2E2OXpncDRydHhqNWtxZ3RjbnlkEgAaAA==",
      BigNumber.from("0x305c4405035ef000"),
      BigNumber.from("0xff4b")
    ]
  }
];

export const SendToCosmosData2 = [
  "0x55d398326f99059fF775485246999027B3197955",
  "0x9a0A02B296240D2620E339cCDE386Ff612f07Be5",
  "channel-1/orai1rqhjqpaqrv26wuq627gav3ka4994u39e84lncy:CitvcmFpMXJxaGpxcGFxcnYyNnd1cTYyN2dhdjNrYTQ5OTR1MzllODRsbmN5EgAaAA==",
  BigNumber.from("0x1de5b2438f194000"),
  BigNumber.from("0xff4c"),
  {
    blockNumber: 38194529,
    blockHash: "0x3a231673a7a218faa897c280fc8929ade25a7348af4ff7fd1c5e3677e4f8f28c",
    transactionIndex: 101,
    removed: false,
    address: "0xb40C364e70bbD98E8aaab707A41a52A2eAF5733f",
    data: "0x00000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000001de5b2438f194000000000000000000000000000000000000000000000000000000000000000ff4c000000000000000000000000000000000000000000000000000000000000007a6368616e6e656c2d312f6f726169317271686a7170617172763236777571363237676176336b61343939347533396538346c6e63793a43697476636d46704d584a786147707863474678636e59794e6e6431635459794e326468646a4e72595451354f5452314d7a6c6c4f445273626d4e354567416141413d3d000000000000",
    topics: [
      "0x9e9794dbf94b0a0aa31a480f5b38550eda7f89115ac8fbf4953fa4dd219900c9",
      "0x00000000000000000000000055d398326f99059ff775485246999027b3197955",
      "0x0000000000000000000000009a0a02b296240d2620e339ccde386ff612f07be5"
    ],
    transactionHash: "0xf80b880b1f302fd4e94be7d4c98e2f331cfe3744b4b02e55e606a79a7c400d18",
    logIndex: 347,
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
      "channel-1/orai1rqhjqpaqrv26wuq627gav3ka4994u39e84lncy:CitvcmFpMXJxaGpxcGFxcnYyNnd1cTYyN2dhdjNrYTQ5OTR1MzllODRsbmN5EgAaAA==",
      BigNumber.from("0x1de5b2438f194000"),
      BigNumber.from("0xff4c")
    ]
  }
];

export const OraiBridgeAutoForwardTxData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "./auto_forward.json")).toString("utf-8")
);
export const OnRecvPacketTxData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "./on_recv_packet.json")).toString("utf-8")
);
