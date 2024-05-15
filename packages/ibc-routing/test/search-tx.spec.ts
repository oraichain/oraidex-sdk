import { StargateClient } from "@cosmjs/stargate";
import { QueryTag } from "@cosmjs/tendermint-rpc/build/tendermint37";
import { buildQuery } from "@cosmjs/tendermint-rpc/build/tendermint37/requests";

describe.skip("Testing searchTx using rpc", () => {
  it("Try testing stargate-client query", async () => {
    const queryTags: QueryTag[] = [
      {
        key: `recv_packet.packet_sequence`,
        value: `${"18501"}`
      },
      {
        key: `recv_packet.packet_src_channel`,
        value: "channel-1"
      },
      {
        key: `recv_packet.packet_dst_channel`,
        value: "channel-29"
      }
    ];
    const query = buildQuery({
      tags: queryTags
    });
    const stargateClient = await StargateClient.connect("https://rpc.orai.io");
    const txs = await stargateClient.searchTx(query);

    console.log(txs);
  });
});