import { StargateClient } from "@cosmjs/stargate";
import { QueryTag } from "@cosmjs/tendermint-rpc/build/tendermint37";
import { buildQuery } from "@cosmjs/tendermint-rpc/build/tendermint37/requests";

describe("Testing searchTx using rpc", () => {
  it("Try testing stargate-client query", async () => {
    const queryTags: QueryTag[] = [
      {
        key: "gravity.v1.EventSendToCosmosExecutedIbcAutoForward.nonce",
        value: "63870"
      }
    ];
    const query = buildQuery({
      tags: queryTags
    });
    const stargateClient = await StargateClient.connect("https://bridge-v2.rpc.orai.io");
    const txs = await stargateClient.searchTx(query);

    console.log(txs);
  });
});
