import { StargateClient } from "@cosmjs/stargate";
import { QueryTag } from "@cosmjs/tendermint-rpc";
import { buildQuery } from "@cosmjs/tendermint-rpc/build/tendermint34/requests";
import { generateError } from "@oraichain/oraidex-common";
import { config } from "../../config";
import {
  executedIbcAutoForwardType,
  GravityAddress,
  oraiBridgeAutoForwardEventType,
  outgoingBatchEventType
} from "../../constants";
import { convertIndexedTxToTxEvent } from "../../helpers";
import { parseRpcEvents } from "../../utils/events";
import {
  handleCheckAutoForward,
  handleCheckOnAcknowledgementOnCosmos,
  handleCheckOnBatchSendToEthClaim,
  handleCheckOnRequestBatch,
  handleOnRecvPacketOnOraiBridge,
  handleStoreOnRecvPacketOraichain
} from "./common.handler";

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
  const eventItem = recvPacketEvents.find((item) => {
    return item.attributes.find((item) => item.key === "packet_sequence")?.value === packetSequence.toString();
  });

  return handleOnRecvPacketOnOraiBridge(ctx, {
    ...event,
    data: {
      txEvent,
      eventItem,
      packetSequence
    }
  });
};

export const handleOnRequestBatchTimeout = async (ctx, event) => {
  const evmChainPrefix = ctx.evmChainPrefixOnRightTraverseOrder;
  const queryTags: QueryTag[] = [
    {
      key: `batched_tx_ids.batched_tx_id`,
      value: `${ctx.oraiBridgePendingTxId}`
    },
    {
      key: `${outgoingBatchEventType}.bridge_contract`,
      value: `${GravityAddress[evmChainPrefix]}`
    }
  ];
  const query = buildQuery({
    tags: queryTags
  });
  const stargateClient = await StargateClient.connect(config.ORAIBRIDGE_RPC_URL);
  const txs = await stargateClient.searchTx(query);
  if (txs.length == 0) {
    throw generateError(evmChainPrefix + "- orai bridge data on onRequestBatchTimeout");
  }

  return handleCheckOnRequestBatch(ctx, {
    ...event,
    payload: convertIndexedTxToTxEvent(txs[0])
  });
};

export const handleOnBatchSendToETHClaimTimeout = async (ctx, event) => {
  const queryTags: QueryTag[] = [
    {
      key: `gravity.v1.MsgBatchSendToEthClaim.batch_nonce`,
      value: `${ctx.oraiBridgeBatchNonce}`
    },
    {
      key: `gravity.v1.MsgBatchSendToEthClaim.evm_chain_prefix`,
      value: ctx.evmChainPrefixOnRightTraverseOrder
    }
  ];
  const query = buildQuery({
    tags: queryTags
  });
  const stargateClient = await StargateClient.connect(config.ORAIBRIDGE_RPC_URL);
  const txs = await stargateClient.searchTx(query);
  if (txs.length == 0) {
    throw generateError("Can not find orai bridge data on onBatchSendToETHClaimTimeout");
  }
  return handleCheckOnBatchSendToEthClaim(ctx, {
    ...event,
    payload: convertIndexedTxToTxEvent(txs[0])
  });
};

export const handleOraiBridgeTimeOut = async (ctx, event) => {
  const queryTags: QueryTag[] = [
    {
      key: `${executedIbcAutoForwardType}.nonce`,
      value: `${ctx.evmEventNonce}`
    }
  ];
  const query = buildQuery({
    tags: queryTags
  });
  const stargateClient = await StargateClient.connect(config.ORAIBRIDGE_RPC_URL);
  const txs = await stargateClient.searchTx(query);
  if (txs.length == 0) {
    throw generateError("there is no auto forward existed on orai bridge timeout");
  }

  for (const tx of txs) {
    const txEvent = convertIndexedTxToTxEvent(tx);
    const events = parseRpcEvents(txEvent.result.events);
    const eventItems = events.filter((item) => item.type === oraiBridgeAutoForwardEventType);
    const eventItem = eventItems.find((item) => {
      const tokenAddress = item.attributes.find((ev) => ev.key === "token").value;
      const nonce = item.attributes.find((ev) => ev.key === "nonce").value;
      return (
        tokenAddress.includes(ctx.evmChainPrefixOnLeftTraverseOrder) &&
        parseInt(JSON.parse(nonce)) === ctx.evmEventNonce
      );
    });
    if (eventItem !== undefined) {
      return handleCheckAutoForward(ctx, {
        ...event,
        payload: {
          txEvent,
          eventItem
        }
      });
    }
  }
};

export const handleOraichainTimeout = async (ctx, event) => {
  const queryTags: QueryTag[] = [
    {
      key: "recv_packet.packet_sequence",
      value: ctx.oraiBridgePacketSequence.toString()
    },
    {
      key: "recv_packet.packet_dst_channel",
      value: ctx.oraiBridgeDstChannel
    },
    {
      key: "recv_packet.packet_src_channel",
      value: ctx.oraiBridgeSrcChannel
    }
  ];
  const query = buildQuery({
    tags: queryTags
  });
  const stargateClient = await StargateClient.connect(config.ORAICHAIN_RPC_URL);
  const txs = await stargateClient.searchTx(query);
  if (txs.length == 0) {
    throw generateError("tx does not exist on oraichain");
  }
  return handleStoreOnRecvPacketOraichain(ctx, {
    ...event,
    data: {
      txEvent: convertIndexedTxToTxEvent(txs[0]),
      packetSequence: ctx.oraiBridgePacketSequence
    }
  });
};

export const handleCosmosTimeout = async (ctx, event) => {
  const queryTags: QueryTag[] = [
    {
      key: `acknowledge_packet.packet_sequence`,
      value: `${ctx.oraiSendPacketSequence}`
    },
    {
      key: `acknowledge_packet.packet_dst_channel`,
      value: ctx.oraichainDstChannel
    },
    {
      key: `acknowledge_packet.packet_src_channel`,
      value: ctx.oraichainSrcChannel
    }
  ];
  const query = buildQuery({
    tags: queryTags
  });
  const stargateClient = await StargateClient.connect(config.ORAICHAIN_RPC_URL);
  const txs = await stargateClient.searchTx(query);
  if (txs.length == 0) {
    throw generateError("[EVM INTEPRETER] Can not find orai bridge data on oraiBridgeForEvmTimeout");
  }
  const txEvent = convertIndexedTxToTxEvent(txs[0]);
  const events = parseRpcEvents(txEvent.result.events);
  const eventItem = events
    .filter((item) => item.type === "acknowledge_packet")
    .find(
      (ev) =>
        ev.attributes.find((attr) => attr.key === "packet_sequence").value === ctx.oraiSendPacketSequence.toString()
    );
  if (!eventItem) {
    generateError("something went wrong on handleCosmosTimeout");
  }
  return handleCheckOnAcknowledgementOnCosmos(ctx, {
    ...event,
    payload: {
      txEvent,
      eventItem
    }
  });
};
