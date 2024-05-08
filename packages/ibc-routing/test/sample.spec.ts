import { Gravity, Gravity__factory } from "@oraichain/oraidex-common";
import { ethers } from "ethers";
import { setTimeout } from "timers/promises";
import { autoForwardTag, onRecvPacketTag } from "../src/constants";
import { DuckDbNode } from "../src/db";
import { OraiBridgeEvent, OraichainEvent } from "../src/event";
import { OraiBridgeHandler } from "../src/event-handlers/oraibridge.handler";
import { OraichainHandler } from "../src/event-handlers/oraichain.handler";
import IntepreterManager from "../src/managers/intepreter.manager";

describe.skip("Test sync ether", () => {
  it("Listen to event", async () => {
    const provider = new ethers.providers.JsonRpcProvider("https://bsc-pokt.nodies.app");
    const gravity = Gravity__factory.connect(
      ethers.utils.getAddress("0xb40C364e70bbD98E8aaab707A41a52A2eAF5733f"),
      provider
    );
    const eventFilter = gravity.filters["SendToCosmosEvent(address,address,string,uint256,uint256)"](
      "0x55d398326f99059fF775485246999027B3197955",
      "0x9a0A02B296240D2620E339cCDE386Ff612f07Be5"
    );
    // const eventFilter = gravity.filters["TransactionBatchExecutedEvent(uint256,address,uint256)"](
    //   32408,
    //   "0x55d398326f99059fF775485246999027B3197955"
    // );
    const data = await gravity.queryFilter(eventFilter, 38421000, 38421649);
    console.log(data);
  });
});

describe.skip("Test sync ether", () => {
  it("Listen to event", async () => {
    const provider = new ethers.providers.JsonRpcProvider("https://go.getblock.io/0efb9bd03a704cc8ad6cad84999bed4f");
    const gravity: Gravity = Gravity__factory.connect(
      ethers.utils.getAddress("0x09Beeedf51AA45718F46837C94712d89B157a9D3"),
      provider
    );
    const eventFilter = gravity.filters["TransactionBatchExecutedEvent(uint256,address,uint256)"](
      "4127",
      "0xdAC17F958D2ee523a2206206994597C13D831ec7"
    );
    const data = await gravity.queryFilter(eventFilter, 19574735, 19574737);
    console.log(data, data[0].args);
  });
});

describe.skip("Test listen on cosmos event", () => {
  it("Test", async () => {
    let duckDb: DuckDbNode;
    duckDb = await DuckDbNode.create();
    await duckDb.createTable();
    let im = new IntepreterManager(true);
    const oraichainEventHandler = new OraichainHandler(duckDb, im);
    const oraibridgeEventHandler = new OraiBridgeHandler(duckDb, im);
    const oraiBridgeEvent = new OraiBridgeEvent(oraibridgeEventHandler, "wss://bridge-v2.rpc.orai.io");
    const oraichainEvent = new OraichainEvent(oraichainEventHandler, "wss://rpc.orai.io");

    await oraiBridgeEvent.connectCosmosSocket([autoForwardTag]);
    await oraichainEvent.connectCosmosSocket([onRecvPacketTag]);
    await setTimeout(100000);
  });
});
