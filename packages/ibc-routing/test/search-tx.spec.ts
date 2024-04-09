import { StargateClient } from "@cosmjs/stargate";
import { QueryTag } from "@cosmjs/tendermint-rpc/build/tendermint37";
import { buildQuery } from "@cosmjs/tendermint-rpc/build/tendermint37/requests";
import { autoForwardTag } from "../src/constants";

describe("Testing searchTx using rpc", () => {
  it("Try testing stargate-client query", async () => {
    const queryTags: QueryTag[] = [
      autoForwardTag,
      {
        key: "nonce",
        value: "63759"
      }
    ];
    encodeURI;
    const query = buildQuery({
      tags: queryTags
    });
    console.log(`${encodeURIComponent("gravity.v1.EventSendToCosmosExecutedIbcAutoForward")}.nonce='63759'`);
    const stargateClient = await StargateClient.connect("https://bridge-v2.rpc.orai.io");
    const txs = await stargateClient.searchTx(query);
    console.log(txs);
  }, 300000);
});
