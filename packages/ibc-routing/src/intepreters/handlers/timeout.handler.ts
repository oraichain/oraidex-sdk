import { StargateClient } from "@cosmjs/stargate";
import { QueryTag } from "@cosmjs/tendermint-rpc";
import { buildQuery } from "@cosmjs/tendermint-rpc/build/tendermint34/requests";
import { generateError } from "@oraichain/oraidex-common";
import { config } from "../../config";
import { executedIbcAutoForwardType, GravityAddress, outgoingBatchEventType } from "../../constants";
import { convertIndexedTxToTxEvent } from "../../helpers";
import { parseRpcEvents } from "../../utils/events";
import {
  handleCheckOnBatchSendToEthClaim,
  handleCheckOnRequestBatch,
  handleOnRecvPacketOnOraiBridge,
  handleStoreAutoForward
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
  recvPacketEvents.forEach((item) => {
    console.log(JSON.stringify(item));
  });
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
    try {
      await handleStoreAutoForward(ctx, {
        ...event,
        data: {
          txEvent: convertIndexedTxToTxEvent(tx),
          eventNonce: ctx.evmEventNonce
        }
      });
    } catch (err) {
      throw generateError(err?.message);
    }
  }
};
