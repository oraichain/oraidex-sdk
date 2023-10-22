import { DuckDbNode } from "../src/db";
import { EventHandler, EthEvent, OraiBridgeEvent } from "../src/event";
import { ethers, getSigners } from "hardhat";
import { BigNumber } from "ethers";
import { oraiBridgeAutoForwardTx } from "./mock-tendermint-ws.spec";

const testSendToCosmosData = [
  "0x55d398326f99059fF775485246999027B3197955",
  "0x758191e89ff9E898D884ca3426e486e5d8476A44",
  "channel-1/orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g:orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g",
  BigNumber.from("0x5af3107a4000"),
  BigNumber.from("0xaccb"),
  {
    blockNumber: 32784728,
    blockHash: "0x2b1a15a4860e1a41f8e45ac848a95770221accd55e5883456bb6450da1bceefa",
    transactionIndex: 60,
    removed: false,
    address: "0xb40C364e70bbD98E8aaab707A41a52A2eAF5733f",
    data: "0x000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000005af3107a4000000000000000000000000000000000000000000000000000000000000000accb00000000000000000000000000000000000000000000000000000000000000616368616e6e656c2d312f6f726169316734683634796a743066767a763576326a387479666e7065356b6d6e6574656a7666677337673a6f726169316734683634796a743066767a763576326a387479666e7065356b6d6e6574656a76666773376700000000000000000000000000000000000000000000000000000000000000",
    topics: [
      "0x9e9794dbf94b0a0aa31a480f5b38550eda7f89115ac8fbf4953fa4dd219900c9",
      "0x00000000000000000000000055d398326f99059ff775485246999027b3197955",
      "0x000000000000000000000000758191e89ff9e898d884ca3426e486e5d8476a44"
    ],
    transactionHash: "0x47c7dd83f247c0d01f1b0cd0992097f8381cbc03098cea8f64b95edf1b6d0593",
    logIndex: 191,
    removeListener: "[Function (anonymous)]",
    getBlock: "[Function (anonymous)]",
    getTransaction: "[Function (anonymous)]",
    getTransactionReceipt: "[Function (anonymous)]",
    event: "SendToCosmosEvent",
    eventSignature: "SendToCosmosEvent(address,address,string,uint256,uint256)",
    decode: "[Function (anonymous)]",
    args: [
      "0x55d398326f99059fF775485246999027B3197955",
      "0x758191e89ff9E898D884ca3426e486e5d8476A44",
      "channel-1/orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g:orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g",
      BigNumber.from("0x5af3107a4000"),
      BigNumber.from("0xaccb")
    ]
  }
];

describe("test-eth-ws", () => {
  let duckDb: DuckDbNode;
  let eventHandler: EventHandler;

  beforeEach(async () => {
    duckDb = await DuckDbNode.create();
    await duckDb.createTable();

    eventHandler = new EventHandler(duckDb);
  });

  const [owner] = getSigners(1);
  it("test-eth-ws", async () => {
    const ethEvent = new EthEvent(eventHandler);
    const gravity = ethEvent.listenToEthEvent(owner.provider, "0xb40C364e70bbD98E8aaab707A41a52A2eAF5733f");
    gravity.emit("SendToCosmosEvent", ...testSendToCosmosData);
    // TODO: how to wait for emit event to finish then start the next
    await new Promise((resolve) => setTimeout(resolve, 100));
    const oraiBridgeEvent = new OraiBridgeEvent(duckDb, eventHandler, "localhost:26657");
    const stream = await oraiBridgeEvent.connectCosmosSocket([
      { key: "message.action", value: "/gravity.v1.MsgExecuteIbcAutoForwards" }
    ]);
    // has to convert back to bytes because javascript object is not friendly with Uint8Array
    stream.shamefullySendNext({
      ...oraiBridgeAutoForwardTx,
      tx: new Uint8Array(Buffer.from(oraiBridgeAutoForwardTx.tx, "base64")),
      hash: new Uint8Array(Buffer.from(oraiBridgeAutoForwardTx.hash, "hex")),
      result: {
        ...oraiBridgeAutoForwardTx.result,
        data: new Uint8Array(Buffer.from(oraiBridgeAutoForwardTx.result.data, "base64"))
      }
    });
  });
});
