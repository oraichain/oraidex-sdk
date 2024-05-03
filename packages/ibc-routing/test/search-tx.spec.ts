import { StargateClient } from "@cosmjs/stargate";
import { QueryTag } from "@cosmjs/tendermint-rpc/build/tendermint37";
import { buildQuery } from "@cosmjs/tendermint-rpc/build/tendermint37/requests";

describe("Testing searchTx using rpc", () => {
  it("Try testing stargate-client query", async () => {
    const queryTags: QueryTag[] = [
      { key: "batched_tx_ids.batched_tx_id", value: "34116" },
      {
        key: "gravity.v1.EventOutgoingBatch.bridge_contract",
        value: "0xb40C364e70bbD98E8aaab707A41a52A2eAF5733f"
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
