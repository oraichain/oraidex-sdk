import { Event, TxEvent } from "@cosmjs/tendermint-rpc/build/tendermint37";
import { EvmChainPrefix, generateError } from "@oraichain/oraidex-common";
import { OraiBridgeRouteData } from "@oraichain/oraidex-universal-swap";
import { BigNumber } from "ethers";
import { AnyEventObject } from "xstate";
import {
  COSMOS_DENOM,
  ContextIntepreter,
  DatabaseEnum,
  EvmState,
  FinalTag,
  ForwardTagOnOraichain,
  OraiBridgeState,
  OraichainState,
  StateDBStatus,
  batchSendToEthClaimEventType,
  eventBatchCreatedEventType,
  oraiBridgeAutoForwardEventType,
  outGoingTxIdEventType
} from "../../constants";
import { convertTxHashToHex } from "../../helpers";
import { isBase64, parseRpcEvents } from "../../utils/events";
import { unmarshalOraiBridgeRoute } from "../../utils/marshal";
import { decodeIbcMemo } from "../../utils/protobuf";

// EVM
export const handleQuerySendToCosmosEvm = async (ctx: ContextIntepreter, event: AnyEventObject) => {
  const sendToCosmosData = await ctx.db.select(DatabaseEnum.Evm, {
    where: {
      txHash: event.payload.txHash,
      evmChainPrefix: event.payload.evmChainPrefix
    }
  });
  if (sendToCosmosData.length == 0) {
    throw generateError("stopping on send to cosmos");
  }
  ctx.routingQueryData.push({
    type: DatabaseEnum.Evm,
    data: sendToCosmosData[0]
  });
  return sendToCosmosData[0].status === StateDBStatus.FINISHED ? Promise.resolve() : Promise.reject();
};

export const handleSendToCosmosEvm = async (ctx: ContextIntepreter, event: AnyEventObject): Promise<any> => {
  const eventData = event.payload;
  const { transactionHash: txHash, blockNumber: height } = eventData[5];
  const routeData: OraiBridgeRouteData = unmarshalOraiBridgeRoute(eventData[2]);
  const evmChainPrefix = eventData[6];
  const sendToCosmosData = {
    txHash,
    height,
    prevState: "",
    prevTxHash: "",
    nextState: "OraiBridgeState",
    destination: eventData[2],
    fromAmount: BigNumber.from(eventData[3]).toString(),
    oraiBridgeChannelId: routeData.oraiBridgeChannel,
    oraiReceiver: routeData.oraiReceiver,
    destinationDenom: routeData.tokenIdentifier,
    destinationChannelId: routeData.finalDestinationChannel,
    destinationReceiver: routeData.finalReceiver,
    eventNonce: parseInt(BigNumber.from(eventData[4]).toString()),
    evmChainPrefix,
    status: StateDBStatus.PENDING
  };
  console.log("Data", sendToCosmosData);

  // this context data will be used for querying in the next state
  ctx.evmChainPrefixOnLeftTraverseOrder = evmChainPrefix;
  ctx.evmEventNonce = sendToCosmosData.eventNonce;
  await ctx.db.insert(DatabaseEnum.Evm, sendToCosmosData);
  return Promise.resolve();
};

// ORAI-BRIDGE
export const handleQueryAutoForward = async (ctx: ContextIntepreter, _event: AnyEventObject) => {
  const allEvmData = ctx.routingQueryData.filter((item) => item.type === DatabaseEnum.Evm);
  const lastEvmItem = allEvmData[allEvmData.length - 1];
  const autoForwardState = await ctx.db.select(DatabaseEnum.OraiBridge, {
    where: {
      evmChainPrefix: (lastEvmItem.data as EvmState).evmChainPrefix,
      eventNonce: (lastEvmItem.data as EvmState).eventNonce,
      prevTxHash: (lastEvmItem.data as EvmState).txHash
    }
  });
  if (autoForwardState.length === 0) {
    throw generateError("stopping on querying auto forward");
  }
  ctx.routingQueryData.push({
    type: DatabaseEnum.OraiBridge,
    data: autoForwardState[0]
  });
  return autoForwardState[0].status == StateDBStatus.PENDING ? Promise.reject() : Promise.resolve(autoForwardState[0]);
};

export const handleCheckAutoForward = async (
  ctx: ContextIntepreter,
  event: AnyEventObject
): Promise<{
  txEvent: any;
  eventNonce: number;
  evmChainPrefix: string;
  autoForwardEvent: Event;
  sendPacketEvent: Event;
}> => {
  if (!event.payload) throw generateError("There should be payload for this auto forward state event");
  const { txEvent, eventItem }: { txEvent: TxEvent; eventItem: Event } = event.payload;
  const events = parseRpcEvents(txEvent.result.events);
  const autoForwardEvent = eventItem;
  const nonceAttr = autoForwardEvent.attributes.find((attr) => attr.key === "nonce");
  const eventNonce = parseInt(JSON.parse(nonceAttr.value));
  const eventItemIndex = events
    .filter((item) => item.type === oraiBridgeAutoForwardEventType)
    .findIndex((ev) => ev.attributes.find((item) => item.key === "nonce")?.value === nonceAttr.value);
  const sendPacketEvent = events.filter((e) => e.type === "send_packet")[eventItemIndex];
  if (!sendPacketEvent) throw generateError("Cannot find the send packet event in auto forward message");
  const packetSequenceAttr = sendPacketEvent.attributes.find((attr) => attr.key === "packet_sequence");
  if (!packetSequenceAttr) throw generateError("Cannot find the packet sequence in send_packet of auto forward");
  const packetDataAttr = sendPacketEvent.attributes.find((attr) => attr.key === "packet_data");
  if (!packetDataAttr) {
    throw generateError("Cannot find the packet data in send_packet of auto forward");
  }
  const packetData = JSON.parse(packetDataAttr.value);
  const denom: string = packetData.denom;
  const evmChainPrefix = Object.values(EvmChainPrefix).find((prefix) => denom.includes(prefix));
  if (!evmChainPrefix) throw generateError(`Cannot find the matched evm chain prefix given denom ${denom}`);
  console.log("event nonce: ", eventNonce, "evm chain prefix: ", evmChainPrefix);
  return Promise.resolve({ txEvent, eventNonce, evmChainPrefix, autoForwardEvent, sendPacketEvent });
};

export const handleStoreAutoForward = async (ctx: ContextIntepreter, event: AnyEventObject): Promise<any> => {
  const {
    txEvent,
    eventNonce,
    evmChainPrefix,
    sendPacketEvent
  }: { txEvent: TxEvent; eventNonce: number; evmChainPrefix: EvmChainPrefix; sendPacketEvent: Event } = event.data; // should have { txEvent, eventNonce } sent from checkAutoForward
  const prevEvmState = await ctx.db.select(DatabaseEnum.Evm, {
    where: {
      eventNonce,
      evmChainPrefix
    }
  });
  if (prevEvmState.length == 0) throw generateError("Cannot find the previous evm state data");
  // collect packet sequence
  if (!sendPacketEvent) throw generateError("Cannot find the send packet event in auto forward message");
  const packetSequenceAttr = sendPacketEvent.attributes.find((attr) => attr.key === "packet_sequence");
  if (!packetSequenceAttr) throw generateError("Cannot find the packet sequence in send_packet of auto forward");
  const packetDataAttr = sendPacketEvent.attributes.find((attr) => attr.key === "packet_data");
  if (!packetDataAttr) {
    throw generateError("Cannot find the packet data in send_packet of auto forward");
  }
  let packetData = JSON.parse(packetDataAttr.value);
  packetData.memo = isBase64(packetData.memo)
    ? decodeIbcMemo(packetData.memo, false).destinationDenom
    : packetData.memo;

  await ctx.db.update(
    DatabaseEnum.Evm,
    { status: StateDBStatus.FINISHED },
    { where: { txHash: prevEvmState[0].txHash } }
  );

  // double down that given packet sequence & packet data, the event is surely send_packet of ibc => no need to guard check other attrs
  const srcPort = sendPacketEvent.attributes.find((attr) => attr.key === "packet_src_port").value;
  const srcChannel = sendPacketEvent.attributes.find((attr) => attr.key === "packet_src_channel").value;
  const dstPort = sendPacketEvent.attributes.find((attr) => attr.key === "packet_dst_port").value;
  const dstChannel = sendPacketEvent.attributes.find((attr) => attr.key === "packet_dst_channel").value;
  const packetSequence = parseInt(packetSequenceAttr.value);
  const autoForwardData = {
    txHash: convertTxHashToHex(Uint8Array.from(Object.values(txEvent.hash))),
    height: txEvent.height,
    prevState: "EvmState",
    prevTxHash: prevEvmState[0].txHash,
    nextState: "OraichainState",
    eventNonce: event.data.eventNonce,
    batchNonce: 0,
    txId: 0,
    evmChainPrefix: ctx.evmChainPrefixOnLeftTraverseOrder,
    packetSequence: packetSequence,
    amount: packetData.amount,
    denom: packetData.denom,
    memo: packetData.memo,
    receiver: packetData.receiver,
    sender: packetData.sender,
    srcPort,
    srcChannel,
    dstPort,
    dstChannel,
    status: StateDBStatus.PENDING
  };
  console.log("storeAutoForward:", autoForwardData);
  await ctx.db.insert(DatabaseEnum.OraiBridge, autoForwardData);
  ctx.oraiBridgeSrcChannel = autoForwardData.srcChannel;
  ctx.oraiBridgeDstChannel = autoForwardData.dstChannel;
  ctx.oraiBridgeEventNonce = event.data.eventNonce;
  ctx.oraiBridgePacketSequence = packetSequence;
};

export const handleCheckOnRequestBatch = async (
  ctx: ContextIntepreter,
  event: AnyEventObject
): Promise<{ batchNonce: number; txIds: number[] }> => {
  const txEvent: TxEvent = event.payload;
  const events = parseRpcEvents(txEvent.result.events);

  const batchTxIds = events.find((attr) => attr.type == "batched_tx_ids");
  if (!batchTxIds) {
    throw generateError("Batched tx ids not found on request batch event");
  }
  const batchNonceData = events
    .find((attr) => attr.type == eventBatchCreatedEventType)
    .attributes.find((item) => item.key == "batch_nonce");
  if (!batchNonceData) {
    throw generateError("Batch nonce is not found on request batch event");
  }
  const batchNonceValue = parseInt(JSON.parse(batchNonceData.value));
  const txIds = batchTxIds.attributes.map((item) => parseInt(item.value));
  return Promise.resolve({ batchNonce: batchNonceValue, txIds });
};

export const handleCheckOnRecvPacketOnOraiBridge = async (
  _: ContextIntepreter,
  event: AnyEventObject
): Promise<{
  packetSequence: number;
  txEvent: TxEvent;
  recvSrcChannel: string;
  recvDstChannel: string;
  eventItem: Event;
}> => {
  const { txEvent, eventItem }: { txEvent: TxEvent; eventItem: Event } = event.payload;
  const recvSrcChannel = eventItem.attributes.find((attr) => attr.key == "packet_src_channel")?.value;
  if (!recvSrcChannel) {
    throw generateError("Could not find recv packet src channel attr in checkOnRecvPacketOraichain");
  }
  const recvDstChannel = eventItem.attributes.find((attr) => attr.key == "packet_dst_channel")?.value;
  if (!recvDstChannel) {
    throw generateError("Could not find recv packet dst channel attr in checkOnRecvPacketOraichain");
  }
  const packetSequenceAttr = eventItem.attributes.find((attr) => attr.key === "packet_sequence");
  const packetSequence = parseInt(packetSequenceAttr.value);

  // Forward next event data
  return Promise.resolve({ packetSequence, txEvent: txEvent, eventItem, recvSrcChannel, recvDstChannel });
};

// TODO: add query logic here
export const handleQueryOnRecvOraiBridgePacket = async (ctx: ContextIntepreter, event: AnyEventObject) => {
  const allOraichainData = ctx.routingQueryData.filter((item) => item.type === DatabaseEnum.Oraichain);
  const lastOraichainItem = allOraichainData[allOraichainData.length - 1];
  const recvOraiBridgeData = await ctx.db.select(DatabaseEnum.OraiBridge, {
    where: {
      prevTxHash: (lastOraichainItem.data as OraichainState).txHash,
      packetSequence: (lastOraichainItem.data as OraichainState).nextPacketSequence
    }
  });
  if (recvOraiBridgeData.length === 0) {
    throw generateError("stopping on recv orai bridge");
  }
  ctx.routingQueryData.push({
    type: DatabaseEnum.OraiBridge,
    data: recvOraiBridgeData[0]
  });
  return Promise.resolve();
};

export const handleOnRecvPacketOnOraiBridge = async (ctx: ContextIntepreter, event: AnyEventObject): Promise<void> => {
  const { txEvent, eventItem, packetSequence }: { txEvent: TxEvent; eventItem: Event; packetSequence: number } =
    event.data;
  const events = parseRpcEvents(txEvent.result.events);
  const eventItemIndex = events
    .filter((item) => item.type === eventItem.type)
    .findIndex((e) => e.attributes.find((item) => item.key == "packet_sequence").value === packetSequence.toString());
  if (eventItemIndex === -1) {
    throw generateError("something went wrong on handleOnRecvPacketOnOraiBridge");
  }

  const outGoingEvent = events.filter((attr) => attr.type == outGoingTxIdEventType)[eventItemIndex];
  if (!outGoingEvent) {
    throw generateError("Could not find the recv packet event from the payload at checkOnRecvPacketOraichain");
  }
  const txId = outGoingEvent.attributes.find((attr) => attr.key === "tx_id").value;
  ctx.oraiBridgePendingTxId = parseInt(JSON.parse(txId));

  // Store on Recv Packet
  const recvPacketEvent = eventItem;
  const packetSequenceAttr = recvPacketEvent.attributes.find((attr) => attr.key === "packet_sequence");
  if (!packetSequenceAttr) throw generateError("Cannot find the packet sequence in send_packet of auto forward");
  const packetDataAttr = recvPacketEvent.attributes.find((attr) => attr.key === "packet_data");
  if (!packetDataAttr) {
    throw generateError("Cannot find the packet data in send_packet of auto forward");
  }
  // destionation on recv packet will be source on main chain
  const srcPort = recvPacketEvent.attributes.find((attr) => attr.key === "packet_dst_port").value;
  const srcChannel = recvPacketEvent.attributes.find((attr) => attr.key === "packet_dst_channel").value;
  ctx.oraiBridgeSrcChannel = srcChannel;
  ctx.oraiBridgeDstChannel = "";

  const prevOraichainState = await ctx.db.select(DatabaseEnum.Oraichain, {
    where: {
      nextPacketSequence: packetSequence,
      srcChannel: ctx.oraichainSrcChannel,
      dstChannel: ctx.oraiBridgeSrcChannel
    }
  });
  if (prevOraichainState.length == 0) {
    throw generateError("Can not find previous oraichain state db.");
  }
  await ctx.db.update(
    DatabaseEnum.Oraichain,
    {
      status: StateDBStatus.FINISHED
    },
    {
      where: {
        nextPacketSequence: packetSequence,
        srcChannel: ctx.oraichainSrcChannel,
        dstChannel: ctx.oraiBridgeSrcChannel
      }
    }
  );
  const packetData = JSON.parse(packetDataAttr.value);
  const memo = packetData.memo;
  const evmChainPrefix = Object.values(EvmChainPrefix).find((prefix) => memo.includes(prefix)) || "";
  ctx.evmChainPrefixOnRightTraverseOrder = evmChainPrefix;
  const oraiBridgeData = {
    txHash: convertTxHashToHex(Uint8Array.from(Object.values(txEvent.hash))),
    height: txEvent.height,
    prevState: "OraichainState",
    prevTxHash: prevOraichainState[0].txHash,
    nextState: "EvmState",
    eventNonce: 0,
    batchNonce: 0,
    txId: ctx.oraiBridgePendingTxId,
    evmChainPrefix,
    packetSequence: packetSequence,
    amount: packetData.amount,
    denom: packetData.denom,
    memo: packetData.memo,
    receiver: packetData.receiver,
    sender: packetData.sender,
    srcPort,
    srcChannel,
    dstPort: "",
    dstChannel: "",
    status: StateDBStatus.PENDING
  };
  console.log("onRecvPacketOnOraiBridge: ", oraiBridgeData);
  await ctx.db.insert(DatabaseEnum.OraiBridge, oraiBridgeData);
};

// TODO: add query logic here
export const handleQueryOnRequestBatch = async (ctx: ContextIntepreter, event: AnyEventObject) => {
  const allOraichainData = ctx.routingQueryData.filter((item) => item.type === DatabaseEnum.Oraichain);
  const lastOraichainItem = allOraichainData[allOraichainData.length - 1];
  const recvOraiBridgeData = await ctx.db.select(DatabaseEnum.OraiBridge, {
    where: {
      prevTxHash: (lastOraichainItem.data as OraichainState).txHash,
      packetSequence: (lastOraichainItem.data as OraichainState).nextPacketSequence
    }
  });
  if (recvOraiBridgeData.length === 0) {
    throw generateError("stopping on recv orai bridge");
  }
  const filteredOraiBridgeData = ctx.routingQueryData.filter(
    (item) =>
      item.type === DatabaseEnum.OraiBridge &&
      item.data.prevTxHash === recvOraiBridgeData[0].prevTxHash &&
      item.data.packetSequence === recvOraiBridgeData[0].packetSequence
  );
  if (filteredOraiBridgeData.length !== 1) {
    throw generateError("something went wrong on handleRecvOnOraiBridge");
  }
  filteredOraiBridgeData[0] = {
    type: DatabaseEnum.OraiBridge,
    data: recvOraiBridgeData[0]
  };
  return recvOraiBridgeData[0].status === StateDBStatus.FINISHED ? Promise.resolve() : Promise.reject();
};

export const handleStoreOnRequestBatchOraiBridge = async (
  ctx: ContextIntepreter,
  event: AnyEventObject
): Promise<void> => {
  const oraiBridgeData = await ctx.db.select(DatabaseEnum.OraiBridge, {
    where: {
      txId: ctx.oraiBridgePendingTxId,
      evmChainPrefix: ctx.evmChainPrefixOnRightTraverseOrder
    }
  });
  if (oraiBridgeData.length == 0) {
    throw generateError("Error on saving data on onRecvPacketOnOraiBridge");
  }
  await ctx.db.update(
    DatabaseEnum.OraiBridge,
    {
      batchNonce: event.data.batchNonce
    },
    {
      where: {
        txId: ctx.oraiBridgePendingTxId,
        evmChainPrefix: ctx.evmChainPrefixOnRightTraverseOrder
      }
    }
  );
  console.log(
    "storeOnRequestBatch: ",
    await ctx.db.select(DatabaseEnum.OraiBridge, {
      where: {
        txId: ctx.oraiBridgePendingTxId,
        evmChainPrefix: ctx.evmChainPrefixOnRightTraverseOrder
      }
    })
  );
  ctx.oraiBridgeBatchNonce = event.data.batchNonce;
};

// TODO: add query logic here
export const handleQueryOnBatchSendToEthClaim = async (ctx: ContextIntepreter, event: AnyEventObject) => {
  const allOraiBridgeData = ctx.routingQueryData.filter((item) => item.type === DatabaseEnum.OraiBridge);
  const lastOraiBridgeItem = allOraiBridgeData[allOraiBridgeData.length - 1];

  const prevTxHash = (lastOraiBridgeItem.data as OraiBridgeState).txHash;
  const evmChainPrefix = (lastOraiBridgeItem.data as OraiBridgeState).evmChainPrefix;

  const evmData = await ctx.db.select(DatabaseEnum.Evm, {
    where: {
      prevTxHash,
      evmChainPrefix
    }
  });
  if (evmData.length == 0) {
    throw generateError("stopping on query on batch send to eth");
  }

  ctx.routingQueryData.push({
    type: DatabaseEnum.Evm,
    data: evmData[0]
  });

  return Promise.resolve();
};

export const handleCheckOnBatchSendToEthClaim = async (
  ctx: ContextIntepreter,
  event: AnyEventObject
): Promise<{ batchNonce: number; evmChainPrefix: string; eventNonce: number }> => {
  const txEvent: TxEvent = event.payload;
  const events = parseRpcEvents(txEvent.result.events);
  const batchSendToEthClaim = events.find((attr) => attr.type == batchSendToEthClaimEventType);
  const batchNonceObject = batchSendToEthClaim.attributes.find((item) => item.key == "batch_nonce");
  if (!batchNonceObject) {
    throw generateError("batch nonce does not exist on checkOnBatchSendToETHClaim");
  }
  const evmChainPrefix = batchSendToEthClaim.attributes.find((item) => item.key == "evm_chain_prefix").value;
  if (!evmChainPrefix) {
    throw generateError("evm chain prefix does not exist on checkOnBatchSendToETHClaim");
  }
  const eventNonce = batchSendToEthClaim.attributes.find((item) => item.key == "event_nonce").value;
  const batchNonceValue = parseInt(JSON.parse(batchNonceObject.value));
  return Promise.resolve({
    batchNonce: batchNonceValue,
    evmChainPrefix: JSON.parse(evmChainPrefix),
    eventNonce: parseInt(JSON.parse(eventNonce))
  });
};

export const handleStoreOnBatchSendToEthClaim = async (
  ctx: ContextIntepreter,
  event: AnyEventObject
): Promise<void> => {
  const oraiBridgeData = await ctx.db.select(DatabaseEnum.OraiBridge, {
    where: {
      txId: ctx.oraiBridgePendingTxId,
      evmChainPrefix: ctx.evmChainPrefixOnRightTraverseOrder
    }
  });
  if (oraiBridgeData.length == 0) {
    throw generateError("error on saving batch nonce to eventNonce in OraiBridgeState");
  }
  await ctx.db.update(
    DatabaseEnum.OraiBridge,
    {
      status: StateDBStatus.FINISHED,
      eventNonce: event.data.eventNonce
    },
    {
      where: {
        txId: ctx.oraiBridgePendingTxId,
        evmChainPrefix: ctx.evmChainPrefixOnRightTraverseOrder
      }
    }
  );
  // We don't care on everything without prevTxHash, eventNonce, evmChainPrefix
  const evmStateData = {
    txHash: "",
    height: 0,
    prevState: "OraiBridgeState",
    prevTxHash: oraiBridgeData[0].txHash,
    nextState: "",
    destination: "",
    fromAmount: 0,
    oraiBridgeChannelId: "",
    oraiReceiver: "",
    destinationDenom: "",
    destinationChannelId: "",
    destinationReceiver: `0x${oraiBridgeData[0].memo.split("0x")[1]}`,
    eventNonce: event.data.eventNonce,
    evmChainPrefix: ctx.evmChainPrefixOnRightTraverseOrder,
    status: StateDBStatus.FINISHED
  };
  console.log("storeOnBatchSendToETHClaim: ", evmStateData);
  await ctx.db.insert(DatabaseEnum.Evm, evmStateData);
};

// ORAICHAIN

export const onDoneOnRecvPacketOraichain = [
  {
    target: "cosmos",
    cond: (_ctx: ContextIntepreter, event: AnyEventObject) => event.data === ForwardTagOnOraichain.COSMOS
  },
  {
    target: "oraiBridgeForEvm",
    cond: (_ctx: ContextIntepreter, event: AnyEventObject) => event.data === ForwardTagOnOraichain.EVM
  },
  {
    target: "finalState",
    cond: (_ctx: ContextIntepreter, event: AnyEventObject) => event.data === FinalTag
  }
];

export const handleQueryOnTransferBackToRemoteChain = async (ctx: ContextIntepreter, event: AnyEventObject) => {
  const oraichainData = await ctx.db.select(DatabaseEnum.Oraichain, {
    where: {
      txHash: event.payload.txHash
    }
  });
  if (oraichainData.length === 0) {
    throw generateError("stopping on query on transfer back to remote chain");
  }
  ctx.routingQueryData.push({
    type: DatabaseEnum.Oraichain,
    data: oraichainData[0]
  });
  return Promise.resolve();
};

export const handleQueryOnRecvPacketOraichain = async (ctx: ContextIntepreter, event: AnyEventObject) => {
  if (!event.data.packetSequence || !event.data.srcChannel || !event.data.txHash)
    throw generateError("Could not get event data to query onRecvPacket on Oraichain");
  const oraichainData = await ctx.db.select(DatabaseEnum.Oraichain, {
    where: {
      packetSequence: event.data.packetSequence,
      prevTxHash: event.data.txHash
    }
  });
  if (oraichainData.length == 0) {
    throw generateError("stopping on handle query on recv packet oraichain");
  }
  ctx.routingQueryData.push({
    type: DatabaseEnum.Oraichain,
    data: oraichainData[0]
  });
  const existEvmPath = Object.values(EvmChainPrefix).find((prefix) =>
    oraichainData[0].nextDestinationDenom.includes(prefix)
  );

  const forwardTag = existEvmPath
    ? ForwardTagOnOraichain.EVM
    : oraichainData[0].nextPacketSequence !== 0
    ? ForwardTagOnOraichain.COSMOS
    : FinalTag;

  return oraichainData[0].status === StateDBStatus.FINISHED ? forwardTag : Promise.reject();
};

export const handleStoreOnRecvPacketOraichain = async (
  ctx: ContextIntepreter,
  event: AnyEventObject
): Promise<string> => {
  const { txEvent, packetSequence }: { txEvent: TxEvent; eventItem: Event; packetSequence: number } = event.data;
  const events: Event[] = parseRpcEvents(txEvent.result.events);
  const eventItemIndex = events
    .filter((item) => item.type === "recv_packet")
    .findIndex(
      (ev) => ev.attributes.find((item) => item.key === "packet_sequence")?.value === packetSequence.toString()
    );
  // recv_packet >< write_acknowledgement packet is mapping 1-to-1
  const writeAckEvent = events.filter((e) => e.type === "write_acknowledgement")[eventItemIndex];
  if (!writeAckEvent)
    throw generateError("Could not find the write acknowledgement event in storeOnRecvPacketOraichain");
  const packetAckAttr = writeAckEvent.attributes.find((attr) => attr.key === "packet_ack");
  if (!packetAckAttr) throw generateError("Could not find packet ack attr in storeOnRecvPacketOraichain");
  const packetDataAttr = JSON.parse(writeAckEvent.attributes.find((attr) => attr.key === "packet_data").value);
  console.log("Memo:", decodeIbcMemo(packetDataAttr.memo, false));

  // packet ack format: {"result":"MQ=="} or {"result":"<something-else-in-base-64"}
  const packetAck = JSON.parse(packetAckAttr.value).result;
  // if equals 1 it means the ack is successful. Otherwise, this packet has some errors
  if (packetAck != "MQ==" && packetAck != "AQ==") {
    throw generateError(`The packet ack is not successful: ${packetAck}`);
  }
  // try finding the previous state and collect its tx hash and compare with our received packet sequence
  // gotta switch case to see if the packet is from oraibridge or other cosmos based networks so that we know which table to query the packet sequence
  // collect packet sequence
  // now we try finding send_packet, if not found then we finalize the state
  let nextState = "";

  // Src channel will be dst channel of Oraibridge
  // Dst channel will be src channel of channel that Oraichain forwarding (maybe OraiBridge or Cosmos)
  let oraiChannels = {
    srcChannel: ctx.oraiBridgeDstChannel,
    dstChannel: ""
  };
  let nextPacketData = {
    nextPacketSequence: 0,
    nextMemo: "",
    nextAmount: "0",
    nextReceiver: "",
    nextDestinationDenom: ""
  };

  // send_packet >< write_acknowledgement packet is not mapping 1-to-1
  // o we need to find index again
  const sendPacketIndex = events
    .filter((item) => {
      if (item.type !== "recv_packet") return false;
      const packetData = item.attributes.find((item) => item.key === "packet_data").value;
      if (!packetData) {
        return false;
      }
      const packetDataAttr = JSON.parse(packetData);
      const memo = packetDataAttr?.memo;
      if (!memo) {
        return false;
      }
      const decodeMemo = decodeIbcMemo(memo);
      // which mean it does not have send packet
      if (decodeMemo.destinationReceiver.includes("orai1")) {
        return false;
      }
      return true;
    })
    .findIndex(
      (ev) => ev.attributes.find((item) => item.key === "packet_sequence")?.value === packetSequence.toString()
    );
  // filter sendPacketEvent with actual index.
  const sendPacketEvent = events.filter((e) => {
    return e.type === "send_packet";
  })[sendPacketIndex];
  if (sendPacketEvent) {
    let nextPacketJson = JSON.parse(sendPacketEvent.attributes.find((attr) => attr.key == "packet_data").value);
    let srcChannel = sendPacketEvent.attributes.find((attr) => attr.key == "packet_src_channel").value;
    let dstChannel = sendPacketEvent.attributes.find((attr) => attr.key == "packet_dst_channel").value;
    nextPacketData = {
      ...nextPacketData,
      nextPacketSequence: parseInt(sendPacketEvent.attributes.find((attr) => attr.key == "packet_sequence").value),
      nextMemo: nextPacketJson?.memo || "",
      nextAmount: nextPacketJson.amount,
      nextDestinationDenom: nextPacketJson.denom,
      nextReceiver: nextPacketJson.receiver
    };

    oraiChannels = {
      ...oraiChannels,
      srcChannel,
      dstChannel
    };
    ctx.oraiSendPacketSequence = nextPacketData.nextPacketSequence;
  }

  ctx.oraichainSrcChannel = oraiChannels.srcChannel;
  ctx.oraichainDstChannel = oraiChannels.dstChannel;

  const localReceiver = packetDataAttr.receiver;

  const existEvmPath = Object.values(EvmChainPrefix).find((prefix) =>
    nextPacketData.nextDestinationDenom.includes(prefix)
  );
  nextState = existEvmPath ? "OraiBridgeState" : "";

  const oraiBridgeData = await ctx.db.select(DatabaseEnum.OraiBridge, {
    where: {
      packetSequence: event.data.packetSequence,
      dstChannel: ctx.oraiBridgeDstChannel,
      srcChannel: ctx.oraiBridgeSrcChannel
    }
  });
  if (oraiBridgeData.length == 0)
    throw generateError(
      `Could not find the row with packet sequence ${event.data.packetSequence} in orai bridge table`
    );
  await ctx.db.update(
    DatabaseEnum.OraiBridge,
    { status: StateDBStatus.FINISHED },
    {
      where: {
        txHash: oraiBridgeData[0].txHash
      }
    }
  );
  let onRecvPacketData = {
    txHash: convertTxHashToHex(Uint8Array.from(Object.values(txEvent.hash))),
    height: txEvent.height,
    prevState: DatabaseEnum.OraiBridge,
    prevTxHash: oraiBridgeData[0].txHash,
    nextState,
    packetSequence: event.data.packetSequence,
    packetAck,
    sender: nextPacketData.nextPacketSequence != 0 ? localReceiver : "",
    localReceiver,
    // the below fields are reserved for cases if we send packet to another chain
    ...nextPacketData,
    ...oraiChannels,
    status: nextPacketData.nextPacketSequence != 0 ? StateDBStatus.PENDING : StateDBStatus.FINISHED
  };
  console.log("storeOnRecvPacketOraichain:", onRecvPacketData);
  await ctx.db.insert(DatabaseEnum.Oraichain, onRecvPacketData);
  // now we have verified everything, lets store the result into the db
  // TODO: if there's a next state, prepare to return a valid result here
  if (nextState || nextPacketData.nextPacketSequence != 0) {
    if (nextState == "OraiBridgeState") {
      return Promise.resolve(ForwardTagOnOraichain.EVM);
    }
    return Promise.resolve(ForwardTagOnOraichain.COSMOS);
  }
  // no next state, we move to final state of the machine
  return Promise.resolve(FinalTag);
};

export const handleStoreOnRecvPacketOraichainReverse = async (
  ctx: ContextIntepreter,
  event: AnyEventObject
): Promise<string> => {
  const txEvent: TxEvent = event.data.txEvent;
  const events = parseRpcEvents(txEvent.result.events);
  const writeAckEvent = events.find((e) => e.type === "write_acknowledgement");
  if (!writeAckEvent)
    throw generateError("Could not find the write acknowledgement event in storeOnRecvPacketOraichain");
  const packetDataAttrStr = writeAckEvent.attributes.find((attr) => attr.key === "packet_data").value;
  const localReceiver = JSON.parse(packetDataAttrStr).receiver;
  const sender = JSON.parse(packetDataAttrStr).sender;

  let nextState = "";
  let oraiChannels = {
    srcChannel: "",
    dstChannel: ""
  };
  let nextPacketData = {
    nextPacketSequence: 0,
    nextMemo: "",
    nextAmount: "0",
    nextReceiver: "",
    nextDestinationDenom: ""
  };
  const sendPacketEvent = events.find((e) => e.type === "send_packet");
  if (sendPacketEvent) {
    let nextPacketJson = JSON.parse(sendPacketEvent.attributes.find((attr) => attr.key == "packet_data").value);
    let srcChannel = sendPacketEvent.attributes.find((attr) => attr.key == "packet_src_channel").value;
    let dstChannel = sendPacketEvent.attributes.find((attr) => attr.key == "packet_dst_channel").value;
    nextPacketData = {
      ...nextPacketData,
      nextPacketSequence: parseInt(sendPacketEvent.attributes.find((attr) => attr.key == "packet_sequence").value),
      nextMemo: nextPacketJson?.memo || "",
      nextAmount: nextPacketJson.amount,
      nextDestinationDenom: nextPacketJson.denom,
      nextReceiver: nextPacketJson.receiver
    };
    oraiChannels = {
      ...oraiChannels,
      srcChannel,
      dstChannel
    };
    ctx.oraiSendPacketSequence = nextPacketData.nextPacketSequence;
  }

  ctx.oraichainSrcChannel = oraiChannels.srcChannel;
  ctx.oraichainDstChannel = oraiChannels.dstChannel;

  const existEvmPath = Object.values(EvmChainPrefix).find((prefix) =>
    nextPacketData.nextDestinationDenom.includes(prefix)
  );
  nextState = existEvmPath ? "OraiBridgeState" : "";

  const cosmosData = await ctx.db.select(DatabaseEnum.Cosmos, {
    where: {
      packetSequence: ctx.cosmosPacketSequence,
      srcChannel: ctx.cosmosSrcChannel,
      dstChannel: ctx.cosmosDstChannel
    }
  });
  if (cosmosData.length == 0) {
    throw generateError("cosmos data does not exist on handleStoreOnRecvPacketOraichainReverse");
  }
  await ctx.db.update(
    DatabaseEnum.Cosmos,
    {
      status: StateDBStatus.FINISHED
    },
    {
      where: {
        packetSequence: ctx.cosmosPacketSequence,
        srcChannel: ctx.cosmosSrcChannel,
        dstChannel: ctx.cosmosDstChannel
      }
    }
  );

  // we don't have previous packetSequence, so we save it as nextPacketSequence
  let onRecvPacketData = {
    txHash: convertTxHashToHex(Uint8Array.from(Object.values(txEvent.hash))),
    height: txEvent.height,
    prevState: "CosmosState",
    prevTxHash: cosmosData[0].txHash,
    nextState,
    packetSequence: ctx.cosmosPacketSequence,
    packetAck: "",
    sender,
    localReceiver,
    // the below fields are reserved for cases if we send packet to another chain
    ...nextPacketData,
    ...oraiChannels,
    status: StateDBStatus.PENDING
  };
  console.log("onRecvPacketData", onRecvPacketData);
  await ctx.db.insert(DatabaseEnum.Oraichain, onRecvPacketData);

  // no next state, we move to final state of the machine
  return Promise.resolve("");
};

export const handleCheckOnRecvPacketOraichain = async (
  ctx: ContextIntepreter,
  event: AnyEventObject
): Promise<{
  packetSequence: number;
  txEvent: TxEvent;
  recvSrcChannel: string;
  recvDstChannel: string;
  eventItem: Event;
}> => {
  const { txEvent, eventItem }: { txEvent: TxEvent; eventItem: Event } = event.payload;
  const recvPacketEvent = eventItem;
  if (!recvPacketEvent)
    throw generateError("Could not find the recv packet event from the payload at checkOnRecvPacketOraichain");
  const recvSrcChannel = recvPacketEvent.attributes.find((attr) => attr.key == "packet_src_channel")?.value;
  if (!recvSrcChannel) {
    throw generateError("Could not find recv packet src channel attr in checkOnRecvPacketOraichain");
  }
  const recvDstChannel = recvPacketEvent.attributes.find((attr) => attr.key == "packet_dst_channel")?.value;
  if (!recvDstChannel) {
    throw generateError("Could not find recv packet dst channel attr in checkOnRecvPacketOraichain");
  }
  const packetSequenceAttr = recvPacketEvent.attributes.find((attr) => attr.key === "packet_sequence");
  if (!packetSequenceAttr) throw generateError("Could not find packet sequence attr in checkOnRecvPacketOraichain");
  const packetSequence = parseInt(packetSequenceAttr.value);
  return Promise.resolve({ packetSequence, txEvent, recvSrcChannel, recvDstChannel, eventItem });
};

// COSMOS
export const handleQueryIbcTransferFromRemote = async (ctx: ContextIntepreter, event: AnyEventObject) => {
  const cosmosData = await ctx.db.select(DatabaseEnum.Cosmos, {
    where: {
      txHash: event.payload.txHash,
      chainId: event.payload.chainId
    }
  });
  if (cosmosData.length === 0) {
    throw generateError("stopping on query ibc transfer from remote");
  }
  ctx.routingQueryData.push({
    type: DatabaseEnum.Cosmos,
    data: cosmosData[0]
  });
  return cosmosData[0].status === StateDBStatus.FINISHED ? Promise.resolve({ ...cosmosData[0] }) : Promise.reject();
};

export const handleQueryOnRecvCosmosPacket = async (ctx: ContextIntepreter, event: AnyEventObject) => {
  const allOraichainData = ctx.routingQueryData.filter((item) => item.type === DatabaseEnum.Oraichain);
  const lastOraichainItem = allOraichainData[allOraichainData.length - 1];
  const cosmosData = await ctx.db.select(DatabaseEnum.Cosmos, {
    where: {
      prevTxHash: (lastOraichainItem.data as OraichainState).txHash,
      packetSequence: (lastOraichainItem.data as OraichainState).nextPacketSequence
    }
  });
  if (cosmosData.length == 0) {
    throw generateError("stopping on query on recv cosmos packet");
  }
  ctx.routingQueryData.push({
    type: DatabaseEnum.Cosmos,
    data: cosmosData[0]
  });
  return Promise.resolve();
};

export const handleCheckOnAcknowledgementOnCosmos = async (
  ctx: ContextIntepreter,
  event: AnyEventObject
): Promise<{ packetSequence: number }> => {
  const { txEvent, eventItem }: { txEvent: TxEvent; eventItem: Event } = event.payload;
  const ackPacket = eventItem;
  const value = ackPacket.attributes.find((attr: any) => attr.key === "packet_sequence").value;
  const data = parseInt(value);
  const srcChannel = ackPacket.attributes.find((attr: any) => attr.key === "packet_src_channel").value;
  const dstChannel = ackPacket.attributes.find((attr: any) => attr.key === "packet_dst_channel").value;

  return Promise.resolve({
    packetSequence: data,
    ackSrcChannel: srcChannel,
    ackDstChannel: dstChannel,
    eventItem,
    txEvent
  });
};

export const handleUpdateOnAcknowledgementOnCosmos = async (
  ctx: ContextIntepreter,
  event: AnyEventObject
): Promise<void> => {
  const { txEvent, eventItem }: { txEvent: TxEvent; eventItem: Event } = event.data;
  const packetSequence = ctx.oraiSendPacketSequence;
  let oraichainData = await ctx.db.select(DatabaseEnum.Oraichain, {
    where: {
      nextPacketSequence: packetSequence,
      srcChannel: ctx.oraichainSrcChannel,
      dstChannel: ctx.oraichainDstChannel
    }
  });
  if (oraichainData.length == 0) {
    throw generateError("error on finding oraichain state by next packet sequence in updateOnAcknowledgementOnCosmos");
  }
  await ctx.db.update(
    DatabaseEnum.Oraichain,
    { status: StateDBStatus.FINISHED },
    {
      where: {
        nextPacketSequence: packetSequence,
        srcChannel: ctx.oraichainSrcChannel,
        dstChannel: ctx.oraichainDstChannel
      }
    }
  );

  // Insert data on cosmos
  const events: Event[] = parseRpcEvents(txEvent.result.events);
  const eventItemIndex = events
    .filter((item) => item.type === "acknowledge_packet")
    .findIndex(
      (ev) => ev.attributes.find((item) => item.key === "packet_sequence").value === packetSequence.toString()
    );
  if (eventItemIndex === -1) {
    throw generateError("can not find acknowledgement packet on handleUpdateOnAcknowledgementOnCosmos");
  }
  const fungibleTokenPacket = events.filter(
    (item) =>
      item.type === "fungible_token_packet" &&
      item.attributes.find((item) => item.key === "module" && item.value === "transfer")
  )[eventItemIndex];
  const ackPacket = eventItem;
  let cosmosData = {
    txHash: "",
    height: 0,
    prevState: "OraichainState",
    prevTxHash: oraichainData[0].txHash,
    packetSequence,
    nextState: "",
    srcPort: ackPacket.attributes.find((item) => item.key === "packet_dst_port").value,
    srcChannel: ackPacket.attributes.find((item) => item.key === "packet_dst_channel").value,
    dstPort: "",
    dstChannel: "",
    status: StateDBStatus.FINISHED
  } as Object;
  if (fungibleTokenPacket) {
    const sender = fungibleTokenPacket.attributes.find((item) => item.key === "sender").value;
    const receiver = fungibleTokenPacket.attributes.find((item) => item.key === "receiver").value;
    const denom = fungibleTokenPacket.attributes.find((item) => item.key === "denom").value;
    const amount = fungibleTokenPacket.attributes.find((item) => item.key === "amount").value;
    const memo = fungibleTokenPacket.attributes.find((item) => item.key === "memo").value;
    const chainId = Object.keys(COSMOS_DENOM).find((item) => denom.includes(COSMOS_DENOM[item]));
    cosmosData = {
      ...cosmosData,
      sender,
      receiver,
      denom,
      amount,
      memo: memo || "",
      chainId
    };
  }

  console.log("Cosmos data:", cosmosData);
  await ctx.db.insert(DatabaseEnum.Cosmos, cosmosData);
};

export const handleStoreOnTransferBackToRemoteChain = async (
  ctx: ContextIntepreter,
  event: AnyEventObject
): Promise<string> => {
  const { txEvent, eventItem }: { txEvent: TxEvent; eventItem: Event } = event.payload;

  let nextState = "";
  let nextPacketData = {
    nextPacketSequence: 0,
    nextMemo: "",
    nextAmount: "0",
    nextReceiver: "",
    nextDestinationDenom: ""
  };
  let sender;
  let localReceiver;
  let oraiChannels = {
    srcChannel: "",
    dstChannel: ""
  };
  const sendPacketEvent = eventItem;
  if (!sendPacketEvent) {
    throw generateError("send packet does not exist on tx on store on transfer back to remote chain");
  }
  let nextPacketJson = JSON.parse(sendPacketEvent.attributes.find((attr) => attr.key == "packet_data").value);
  let srcChannel = sendPacketEvent.attributes.find((attr) => attr.key == "packet_src_channel").value;
  let dstChannel = sendPacketEvent.attributes.find((attr) => attr.key == "packet_dst_channel").value;
  nextPacketData = {
    ...nextPacketData,
    nextPacketSequence: parseInt(sendPacketEvent.attributes.find((attr) => attr.key == "packet_sequence").value),
    nextMemo: nextPacketJson?.memo || "",
    nextAmount: nextPacketJson.amount,
    nextDestinationDenom: nextPacketJson.denom,
    nextReceiver: nextPacketJson.receiver
  };

  oraiChannels = {
    ...oraiChannels,
    srcChannel,
    dstChannel
  };
  ctx.oraiSendPacketSequence = nextPacketData.nextPacketSequence;
  sender = nextPacketJson.sender;
  localReceiver = nextPacketJson.sender;

  ctx.oraichainSrcChannel = oraiChannels.srcChannel;
  ctx.oraichainDstChannel = oraiChannels.dstChannel;

  const existEvmPath = Object.values(EvmChainPrefix).find((prefix) =>
    nextPacketData.nextDestinationDenom.includes(prefix)
  );
  nextState = existEvmPath ? "OraiBridgeState" : "";

  // we don't have previous packetSequence, so we save it as nextPacketSequence
  let transferBackToRemoteChainData = {
    txHash: convertTxHashToHex(Uint8Array.from(Object.values(txEvent.hash))),
    height: txEvent.height,
    prevState: "",
    prevTxHash: "",
    nextState,
    packetSequence: ctx.oraiSendPacketSequence,
    packetAck: "",
    sender,
    localReceiver,
    // the below fields are reserved for cases if we send packet to another chain
    ...nextPacketData,
    ...oraiChannels,
    status: StateDBStatus.PENDING
  };
  console.log("storeOnTransferBackToRemoteChain", transferBackToRemoteChainData);
  await ctx.db.insert(DatabaseEnum.Oraichain, transferBackToRemoteChainData);

  // no next state, we move to final state of the machine
  return Promise.resolve("");
};

export const handleStoreOnIbcTransferFromRemote = async (ctx: ContextIntepreter, event: AnyEventObject) => {
  const txEvent: TxEvent = event.payload.txEvent;
  const eventData: Event = event.payload.event;
  const sendPacket = eventData.attributes.find((attr) => attr.key == "packet_data");
  if (!sendPacket) {
    throw generateError("sendPacketData does not exist on handleStoreOnIbcTransferFromRemote");
  }
  const sendPacketData = JSON.parse(sendPacket.value);
  const packetSequence = eventData.attributes.find((attr) => attr.key == "packet_sequence");
  if (!packetSequence) {
    throw generateError("packetSequence does not exist on handleStoreOnIbcTransferFromRemote");
  }
  // double down that given packet sequence & packet data, the event is surely send_packet of ibc => no need to guard check other attrs
  const srcPort = eventData.attributes.find((attr) => attr.key === "packet_src_port").value;
  const srcChannel = eventData.attributes.find((attr) => attr.key === "packet_src_channel").value;
  const dstPort = eventData.attributes.find((attr) => attr.key === "packet_dst_port").value;
  const dstChannel = eventData.attributes.find((attr) => attr.key === "packet_dst_channel").value;

  const cosmosData = {
    txHash:
      typeof txEvent.hash == "string" ? txEvent.hash : convertTxHashToHex(Uint8Array.from(Object.values(txEvent.hash))),
    height: txEvent.height,
    chainId: event.payload.chainId,
    prevState: "",
    prevTxHash: "",
    nextState: "OraichainState",
    packetSequence: packetSequence.value,
    ...sendPacketData,
    srcPort,
    srcChannel,
    dstPort,
    dstChannel,
    status: StateDBStatus.PENDING
  };
  await ctx.db.insert(DatabaseEnum.Cosmos, cosmosData);

  ctx.cosmosPacketSequence = parseInt(packetSequence.value);
  ctx.cosmosSrcChannel = cosmosData.srcChannel;
  ctx.cosmosDstChannel = cosmosData.dstChannel;

  return new Promise((resolve) =>
    resolve({
      packetSequence,
      srcChannel,
      dstChannel
    })
  );
};
