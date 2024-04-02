import { BigNumber } from "ethers";
import { getSigners } from "hardhat";
import { autoForwardTag, onRecvPacketTag } from "../src/constants";
import { DuckDbNode } from "../src/db";
import { EthEvent, OraiBridgeEvent, OraichainEvent } from "../src/event";
import { EvmEventHandler } from "../src/event-handlers/evm.handler";
import { OraiBridgeHandler } from "../src/event-handlers/oraibridge.handler";
import { OraichainHandler } from "../src/event-handlers/oraichain.handler";
import IntepreterManager from "../src/managers/intepreter.manager";
import { onRecvPacketTx, oraiBridgeAutoForwardTx, unmarshalTxEvent } from "./common";

const testSendToCosmosData = [
  "0x55d398326f99059fF775485246999027B3197955",
  "0x9a0A02B296240D2620E339cCDE386Ff612f07Be5",
  "channel-1/orai1rqhjqpaqrv26wuq627gav3ka4994u39e84lncy:CitvcmFpMXJxaGpxcGFxcnYyNnd1cTYyN2dhdjNrYTQ5OTR1MzllODRsbmN5EgAaK29yYWkxMmh6anhmaDc3d2w1NzJnZHpjdDJmeHYyYXJ4Y3doNmd5a2M3cWg=",
  BigNumber.from("0x18c09c8d7a84d1ec"),
  BigNumber.from("0xf869"),
  {
    blockNumber: 37469703,
    blockHash: "0x8344ff6919f3e184790cc637c2a16c9677500ab735b6a7feec717c5092a3d520",
    transactionIndex: 193,
    removed: false,
    address: "0xb40C364e70bbD98E8aaab707A41a52A2eAF5733f",
    data: "0x000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000018c09c8d7a84d1ec000000000000000000000000000000000000000000000000000000000000f86900000000000000000000000000000000000000000000000000000000000000b26368616e6e656c2d312f6f726169317271686a7170617172763236777571363237676176336b61343939347533396538346c6e63793a43697476636d46704d584a786147707863474678636e59794e6e6431635459794e326468646a4e72595451354f5452314d7a6c6c4f445273626d4e35456741614b32397959576b784d6d6836616e686d61446333643277314e7a4a6e5a48706a64444a6d6548597959584a345933646f4e6d643561324d336357673d0000000000000000000000000000",
    topics: [
      "0x9e9794dbf94b0a0aa31a480f5b38550eda7f89115ac8fbf4953fa4dd219900c9",
      "0x00000000000000000000000055d398326f99059ff775485246999027b3197955",
      "0x0000000000000000000000009a0a02b296240d2620e339ccde386ff612f07be5"
    ],
    transactionHash: "0xf55ed0825f55f18bd6ae618127e8cc0d889cc3253442ebe88c9280d669ebafb4",
    logIndex: 598,
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
      "channel-1/orai1rqhjqpaqrv26wuq627gav3ka4994u39e84lncy:CitvcmFpMXJxaGpxcGFxcnYyNnd1cTYyN2dhdjNrYTQ5OTR1MzllODRsbmN5EgAaK29yYWkxMmh6anhmaDc3d2w1NzJnZHpjdDJmeHYyYXJ4Y3doNmd5a2M3cWg=",
      BigNumber.from("0x18c09c8d7a84d1ec"),
      BigNumber.from("0xf869")
    ]
  }
];

describe("test-integration", () => {
  let duckDb: DuckDbNode;
  let evmHandler: EvmEventHandler;
  let oraibridgeHandler: OraiBridgeHandler;
  let oraichainHandler: OraichainHandler;

  beforeEach(async () => {
    duckDb = await DuckDbNode.create();
    await duckDb.createTable();

    let im = new IntepreterManager();
    evmHandler = new EvmEventHandler(duckDb, im);
    oraibridgeHandler = new OraiBridgeHandler(duckDb, im);
    oraichainHandler = new OraichainHandler(duckDb, im);
  });

  const sleep = async (timeout: number) => new Promise((resolve) => setTimeout(resolve, timeout));

  const [owner] = getSigners(1);
  it("[EVM->Cosmos] full-flow happy test", async () => {
    const ethEvent = new EthEvent(evmHandler);
    const gravity = ethEvent.listenToEthEvent(owner.provider, "0xb40C364e70bbD98E8aaab707A41a52A2eAF5733f");
    gravity.emit("SendToCosmosEvent", ...testSendToCosmosData);
    // TODO: how to wait for emit event to finish then start the next
    await sleep(300);
    const oraiBridgeEvent = new OraiBridgeEvent(oraibridgeHandler, "localhost:26657");
    const stream = await oraiBridgeEvent.connectCosmosSocket([autoForwardTag]);
    const oraiEvent = new OraichainEvent(oraichainHandler, "localhost:26657");
    const oraiStream = await oraiEvent.connectCosmosSocket([onRecvPacketTag]);
    // has to convert back to bytes because javascript object is not friendly with Uint8Array
    stream.shamefullySendNext(unmarshalTxEvent(oraiBridgeAutoForwardTx));
    await sleep(300);
    oraiStream.shamefullySendNext(unmarshalTxEvent(onRecvPacketTx));
    await sleep(300);
  });
});
