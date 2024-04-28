import { StargateClient } from "@cosmjs/stargate";
import { QueryTag } from "@cosmjs/tendermint-rpc";
import { buildQuery } from "@cosmjs/tendermint-rpc/build/tendermint34/requests";
import { generateError } from "@oraichain/oraidex-common";
import { config } from "../../config";
import { convertIndexedTxToTxEvent } from "../../helpers";
import { parseRpcEvents } from "../../utils/events";
import { handleOnRecvPacketOnOraiBridge } from "./common.handler";

export const handleOraiBridgeForEvmTimeout = async (ctx, event) => {
  const packetSequence = ctx.oraiSendPacketSequence;
  const queryTags: QueryTag[] = [
    {
      key: `recv_packet.packet_sequence`,
      value: `${packetSequence}`
    },
    {
      key: `recv_packet.packet_src_channel`,
      value: ctx.oraichainSrcChannel
    },
    {
      key: `recv_packet.packet_dst_channel`,
      value: ctx.oraichainDstChannel
    }
  ];
  const query = buildQuery({
    tags: queryTags
  });
  const stargateClient = await StargateClient.connect(config.ORAIBRIDGE_RPC_URL);
  const txs = await stargateClient.searchTx(query);
  if (txs.length == 0) {
    throw generateError("[COSMOS INTEPRETER] Can not find orai bridge data on oraiBridgeForEvmTimeout");
  }
  const txEvent = convertIndexedTxToTxEvent(txs[0]);
  const events = parseRpcEvents(txEvent.result.events);
  const recvPacketEvents = events.filter((ev) => ev.type === "recv_packet");
  const eventItem = recvPacketEvents.find(
    (item) => item.attributes.find((item) => item.key === "packet_sequence")?.value === packetSequence
  );

  return handleOnRecvPacketOnOraiBridge(ctx, {
    ...event,
    data: {
      txEvent,
      eventItem,
      packetSequence
    }
  });
};
