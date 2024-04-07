import { Tendermint37Client, WebsocketClient } from "@cosmjs/tendermint-rpc";
import { buildQuery } from "@cosmjs/tendermint-rpc/build/tendermint37/requests";
import { Gravity, Gravity__factory } from "@oraichain/oraidex-common";
import { ethers } from "ethers";
import { onRecvPacketTag } from "../src/constants";

describe.skip("Test sync ether", () => {
  it("Listen to event", async () => {
    const provider = new ethers.providers.JsonRpcProvider("https://go.getblock.io/5364b225d0ea429e91f5f3f027c414a2");
    const gravity: Gravity = Gravity__factory.connect(
      ethers.utils.getAddress("0xb40C364e70bbD98E8aaab707A41a52A2eAF5733f"),
      provider
    );
    const eventFilter = gravity.filters["SendToCosmosEvent(address,address,string,uint256,uint256)"](
      "0x55d398326f99059fF775485246999027B3197955",
      "0x9a0A02B296240D2620E339cCDE386Ff612f07Be5"
    );
    const data = await gravity.queryFilter(eventFilter, 37534323, 37534325);
    console.log(data, data[0].args);
  }, 30000);
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
  }, 30000);
});

describe.skip("Test listen on cosmos event", () => {
  it("Test", async () => {
    const client = await Tendermint37Client.create(new WebsocketClient("wss://rpc.orai.io"));
    const stream = client.subscribeTx(
      buildQuery({
        tags: [onRecvPacketTag]
      })
    );
    try {
      stream.subscribe({
        next: (txEvent) => {
          console.log(txEvent);
        },
        error: (err) => console.log("error while subscribing websocket: ", err),
        complete: () => console.log("completed")
      });
    } catch (error) {
      console.log("error listening: ", error);
    }
  }, 100000);
});
