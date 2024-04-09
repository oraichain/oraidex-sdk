import { Event, TxEvent } from "@cosmjs/tendermint-rpc/build/tendermint37";
import { EvmChainPrefix, generateError } from "@oraichain/oraidex-common";
import { OraiBridgeRouteData } from "@oraichain/oraidex-universal-swap";
import { AnyEventObject } from "xstate";
import {
  batchSendToEthClaimEventType,
  ContextIntepreter,
  eventBatchCreatedEventType,
  FinalTag,
  ForwardTagOnOraichain,
  oraiBridgeAutoForwardEventType,
  outGoingTxIdEventType,
  StateDBStatus
} from "../constants";
import { convertTxHashToHex } from "../helpers";
import { parseRpcEvents } from "../utils/events";
import { unmarshalOraiBridgeRoute } from "../utils/marshal";
import { decodeIbcMemo } from "../utils/protobuf";

// EVM
export const handleSendToCosmosEvm = async (ctx: ContextIntepreter, event: AnyEventObject): Promise<number> => {
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
    fromAmount: eventData[3].toString(),
    oraiBridgeChannelId: routeData.oraiBridgeChannel,
    oraiReceiver: routeData.oraiReceiver,
    destinationDenom: routeData.tokenIdentifier,
    destinationChannelId: routeData.finalDestinationChannel,
    destinationReceiver: routeData.finalReceiver,
    eventNonce: parseInt(eventData[4].toString()),
    evmChainPrefix,
    status: StateDBStatus.PENDING
  };

  // this context data will be used for querying in the next state
  ctx.evmChainPrefixOnLeftTraverseOrder = evmChainPrefix;
  ctx.evmEventNonce = sendToCosmosData.eventNonce;
  console.log("sendToCosmosEvm", sendToCosmosData);
  await ctx.db.insertData(sendToCosmosData, "EvmState");
  return new Promise((resolve) => resolve(sendToCosmosData.eventNonce));
};

// ORAI-BRIDGE
export const handleCheckAutoForward = async (
  ctx: ContextIntepreter,
  event: AnyEventObject
): Promise<{ txEvent: any; eventNonce: number; evmChainPrefix: string }> => {
  if (!event.payload) throw generateError("There should be payload for this auto forward state event");
  const txEvent: TxEvent = event.payload;
  const events = parseRpcEvents(txEvent.result.events);
  const autoForwardEvent = events.find((event) => event.type === oraiBridgeAutoForwardEventType);
  if (!autoForwardEvent) {
    console.log("not autoforward event");
    return;
  }
  const nonceAttr = autoForwardEvent.attributes.find((attr) => attr.key === "nonce");
  if (!nonceAttr) {
    console.log("There is no event nonce attribute.");
    return;
  }
  const eventNonce = parseInt(JSON.parse(nonceAttr.value));
  const sendPacketEvent = events.find((e) => e.type === "send_packet");
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
  return new Promise((resolve) => resolve({ txEvent, eventNonce, evmChainPrefix }));
};

export const handleStoreAutoForward = async (ctx: ContextIntepreter, event: AnyEventObject): Promise<any> => {
  const txEvent: TxEvent = event.data.txEvent; // should have { txEvent, eventNonce } sent from checkAutoForward
  const events = parseRpcEvents(txEvent.result.events);
  const prevEvmState = await ctx.db.queryInitialEvmStateByEventNonceAndEvmChainPrefix(
    event.data.eventNonce,
    ctx.evmChainPrefixOnLeftTraverseOrder
  );
  if (prevEvmState.length == 0) throw generateError("Cannot find the previous evm state data");
  // collect packet sequence
  const sendPacketEvent = events.find((e) => e.type === "send_packet");
  if (!sendPacketEvent) throw generateError("Cannot find the send packet event in auto forward message");
  const packetSequenceAttr = sendPacketEvent.attributes.find((attr) => attr.key === "packet_sequence");
  if (!packetSequenceAttr) throw generateError("Cannot find the packet sequence in send_packet of auto forward");
  const packetDataAttr = sendPacketEvent.attributes.find((attr) => attr.key === "packet_data");
  if (!packetDataAttr) {
    throw generateError("Cannot find the packet data in send_packet of auto forward");
  }
  let packetData = JSON.parse(packetDataAttr.value);
  packetData.memo = decodeIbcMemo(packetData.memo, false).destinationDenom;

  await ctx.db.updateStatusByTxHash("EvmState", StateDBStatus.FINISHED, prevEvmState.txHash);

  // double down that given packet sequence & packet data, the event is surely send_packet of ibc => no need to guard check other attrs
  const srcPort = sendPacketEvent.attributes.find((attr) => attr.key === "packet_src_port").value;
  const srcChannel = sendPacketEvent.attributes.find((attr) => attr.key === "packet_src_channel").value;
  const dstPort = sendPacketEvent.attributes.find((attr) => attr.key === "packet_dst_port").value;
  const dstChannel = sendPacketEvent.attributes.find((attr) => attr.key === "packet_dst_channel").value;
  const packetSequence = parseInt(packetSequenceAttr.value);
  const autoForwardData = {
    txHash: convertTxHashToHex(txEvent.hash),
    height: txEvent.height,
    prevState: "EvmState",
    prevTxHash: prevEvmState.txHash,
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
  await ctx.db.insertData(autoForwardData, "OraiBridgeState");
  ctx.oraiBridgeEventNonce = event.data.eventNonce;
  ctx.oraiBridgePacketSequence = packetSequence;
};

export const handleCheckOnRequestBatch = async (
  ctx: ContextIntepreter,
  event: AnyEventObject
): Promise<{ batchNonce: number; txIds: number[]; events: Event[] }> => {
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
  return new Promise((resolve) => resolve({ batchNonce: batchNonceValue, txIds, events }));
};

export const handleCheckOnRecvPacketOnOraiBridge = async (
  ctx: ContextIntepreter,
  event: AnyEventObject
): Promise<{ packetSequence: number; txEvent: TxEvent }> => {
  const txEvent = event.payload as TxEvent;
  const events = parseRpcEvents(txEvent.result.events);
  const recvPacket = events.find((attr) => attr.type == "recv_packet");
  if (!recvPacket) {
    throw generateError("Could not find the recv packet event from the payload at checkOnRecvPacketOraichain");
  }
  const packetSequenceAttr = recvPacket.attributes.find((attr) => attr.key === "packet_sequence");
  const packetSequence = parseInt(packetSequenceAttr.value);

  // Forward next event data
  return new Promise((resolve) => resolve({ packetSequence, txEvent: txEvent }));
};

export const handleOnRecvPacketOnOraiBridge = async (ctx: ContextIntepreter, event: AnyEventObject): Promise<void> => {
  const txEvent = event.data.txEvent as TxEvent;
  const events = parseRpcEvents(txEvent.result.events);
  const outGoingEvent = events.find((attr) => attr.type == outGoingTxIdEventType);
  if (!outGoingEvent) {
    throw generateError("Could not find the recv packet event from the payload at checkOnRecvPacketOraichain");
  }
  const txId = outGoingEvent.attributes.find((attr) => attr.key === "tx_id").value;
  ctx.oraiBridgePendingTxId = parseInt(JSON.parse(txId));

  // Store on Recv Packet
  const recvPacketEvent = events.find((e) => e.type === "recv_packet");
  const packetSequenceAttr = recvPacketEvent.attributes.find((attr) => attr.key === "packet_sequence");
  if (!packetSequenceAttr) throw generateError("Cannot find the packet sequence in send_packet of auto forward");
  const packetDataAttr = recvPacketEvent.attributes.find((attr) => attr.key === "packet_data");
  if (!packetDataAttr) {
    throw generateError("Cannot find the packet data in send_packet of auto forward");
  }
  const srcPort = recvPacketEvent.attributes.find((attr) => attr.key === "packet_src_port").value;
  const srcChannel = recvPacketEvent.attributes.find((attr) => attr.key === "packet_src_channel").value;
  const dstPort = recvPacketEvent.attributes.find((attr) => attr.key === "packet_dst_port").value;
  const dstChannel = recvPacketEvent.attributes.find((attr) => attr.key === "packet_dst_channel").value;
  const packetSequence = parseInt(packetSequenceAttr.value);
  const prevOraichainState = await ctx.db.queryOraichainStateByNextPacketSequence(packetSequence);
  if (prevOraichainState.length == 0) {
    throw generateError("Can not find previous oraichain state db.");
  }
  await ctx.db.updateOraichainStatusByNextPacketSequence(packetSequence, StateDBStatus.FINISHED);
  const packetData = JSON.parse(packetDataAttr.value);
  const memo = packetData.memo;
  const evmChainPrefix = Object.values(EvmChainPrefix).find((prefix) => memo.includes(prefix)) || "";
  ctx.evmChainPrefixOnRightTraverseOrder = evmChainPrefix;
  const oraiBridgeData = {
    txHash: convertTxHashToHex(txEvent.hash),
    height: txEvent.height,
    prevState: "OraichainState",
    prevTxHash: prevOraichainState.txHash,
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
    dstPort,
    dstChannel,
    status: StateDBStatus.PENDING
  };
  console.log("onRecvPacketOnOraiBridge: ", oraiBridgeData);
  await ctx.db.insertData(oraiBridgeData, "OraiBridgeState");
};

export const handleStoreOnRequestBatchOraiBridge = async (
  ctx: ContextIntepreter,
  event: AnyEventObject
): Promise<void> => {
  const oraiBridgeData = await ctx.db.queryOraiBridgeByTxIdAndEvmChainPrefix(
    ctx.oraiBridgePendingTxId,
    ctx.evmChainPrefixOnRightTraverseOrder,
    1
  );
  if (oraiBridgeData.length == 0) {
    throw generateError("Error on saving data on onRecvPacketOnOraiBridge");
  }
  await ctx.db.updateOraiBridgeBatchNonceByTxIdAndEvmChainPrefix(
    event.data.batchNonce,
    ctx.oraiBridgePendingTxId,
    ctx.evmChainPrefixOnRightTraverseOrder
  );
  console.log(
    "storeOnRequestBatch: ",
    await ctx.db.queryOraiBridgeByTxIdAndEvmChainPrefix(
      ctx.oraiBridgePendingTxId,
      ctx.evmChainPrefixOnRightTraverseOrder,
      1
    )
  );
  ctx.oraiBridgeBatchNonce = event.data.batchNonce;
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
  return new Promise((resolve) =>
    resolve({
      batchNonce: batchNonceValue,
      evmChainPrefix: JSON.parse(evmChainPrefix),
      eventNonce: parseInt(JSON.parse(eventNonce))
    })
  );
};

export const handleStoreOnBatchSendToEthClaim = async (
  ctx: ContextIntepreter,
  event: AnyEventObject
): Promise<void> => {
  const oraiBridgeData = await ctx.db.queryOraiBridgeByTxIdAndEvmChainPrefix(
    ctx.oraiBridgePendingTxId,
    ctx.evmChainPrefixOnRightTraverseOrder,
    1
  );
  if (oraiBridgeData.length == 0) {
    throw generateError("error on saving batch nonce to eventNonce in OraiBridgeState");
  }
  await ctx.db.updateOraiBridgeStatusAndEventNonceByTxIdAndEvmChainPrefix(
    StateDBStatus.FINISHED,
    event.data.eventNonce,
    ctx.oraiBridgePendingTxId,
    ctx.evmChainPrefixOnRightTraverseOrder
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
  await ctx.db.insertData(evmStateData, "EvmState");
};

// ORAICHAIN
export const handleStoreOnRecvPacketOraichain = async (
  ctx: ContextIntepreter,
  event: AnyEventObject
): Promise<string> => {
  const txEvent: TxEvent = event.data.txEvent;
  const events: Event[] = event.data.events;
  // events.forEach((item) => {
  //   console.log("===", item.type, "===");
  //   item.attributes.forEach((attr) => {
  //     console.log(attr.key, "-", attr.value);
  //   });
  // });
  const writeAckEvent = events.find((e) => e.type === "write_acknowledgement");
  if (!writeAckEvent)
    throw generateError("Could not find the write acknowledgement event in checkOnRecvPacketOraichain");
  const packetAckAttr = writeAckEvent.attributes.find((attr) => attr.key === "packet_ack");
  if (!packetAckAttr) throw generateError("Could not find packet ack attr in checkOnRecvPacketOraichain");
  // packet ack format: {"result":"MQ=="} or {"result":"<something-else-in-base-64"}
  const packetAck = Buffer.from(JSON.parse(packetAckAttr.value).result, "base64").toString("ascii");
  // if equals 1 it means the ack is successful. Otherwise, this packet has some errors
  if (packetAck != "1") {
    throw generateError(`The packet ack is not successful: ${packetAck}`);
  }
  // try finding the previous state and collect its tx hash and compare with our received packet sequence
  // gotta switch case to see if the packet is from oraibridge or other cosmos based networks so that we know which table to query the packet sequence
  // collect packet sequence
  // now we try finding send_packet, if not found then we finalize the state
  let nextState = "";
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
    nextPacketData = {
      ...nextPacketData,
      nextPacketSequence: parseInt(sendPacketEvent.attributes.find((attr) => attr.key == "packet_sequence").value),
      nextMemo: nextPacketJson?.memo || "",
      nextAmount: nextPacketJson.amount,
      nextDestinationDenom: nextPacketJson.denom,
      nextReceiver: nextPacketJson.receiver
    };
    ctx.oraiSendPacketSequence = nextPacketData.nextPacketSequence;
  }

  const wasmData = events.find((e) => e.type === "wasm");
  if (!wasmData) {
    throw generateError("there is no wasm data in storeOnRecvPacket");
  }
  const localReceiver = wasmData.attributes.find((attr) => attr.key == "receiver").value;

  const existEvmPath = Object.values(EvmChainPrefix).find((prefix) =>
    nextPacketData.nextDestinationDenom.includes(prefix)
  );
  nextState = existEvmPath ? "OraiBridgeState" : "";

  const { tableName, state } = await ctx.db.findStateByPacketSequence(event.data.packetSequence);
  if (!tableName)
    throw generateError(`Could not find the row with packet sequence ${event.data.packetSequence} in any table`);
  await ctx.db.updateStatusByTxHash(tableName, StateDBStatus.FINISHED, state.txHash);
  let onRecvPacketData = {
    txHash: convertTxHashToHex(txEvent.hash),
    height: txEvent.height,
    prevState: tableName,
    prevTxHash: state.txHash,
    nextState,
    packetSequence: event.data.packetSequence,
    packetAck,
    sender: nextPacketData.nextPacketSequence != 0 ? localReceiver : "",
    localReceiver,
    // the below fields are reserved for cases if we send packet to another chain
    ...nextPacketData,
    status: nextPacketData.nextPacketSequence != 0 ? StateDBStatus.PENDING : StateDBStatus.FINISHED
  };
  console.log("storeOnRecvPacketOraichain:", onRecvPacketData);
  await ctx.db.insertData(onRecvPacketData, "OraichainState");
  // now we have verified everything, lets store the result into the db
  // TODO: if there's a next state, prepare to return a valid result here
  if (nextState || nextPacketData.nextPacketSequence != 0) {
    if (nextState == "OraiBridgeState") {
      return new Promise((resolve) => resolve(ForwardTagOnOraichain.EVM));
    }
    return new Promise((resolve) => resolve(ForwardTagOnOraichain.COSMOS));
  }
  // no next state, we move to final state of the machine
  return new Promise((resolve) => resolve(FinalTag));
};

export const handleStoreOnRecvPacketOraichainReverse = async (
  ctx: ContextIntepreter,
  event: AnyEventObject
): Promise<string> => {
  const txEvent: TxEvent = event.payload;
  const events = parseRpcEvents(txEvent.result.events);
  // events.forEach((event) => {
  //   console.log("=====", event.type, "=====");
  //   event.attributes.forEach((attr) => {
  //     console.log(attr.key, "-", attr.value);
  //   });
  // });
  const writeAckEvent = events.find((e) => e.type === "write_acknowledgement");
  if (!writeAckEvent)
    throw generateError("Could not find the write acknowledgement event in checkOnRecvPacketOraichain");
  const packetDataAttrStr = writeAckEvent.attributes.find((attr) => attr.key === "packet_data").value;
  const localReceiver = JSON.parse(packetDataAttrStr).receiver;
  const sender = JSON.parse(packetDataAttrStr).sender;

  let nextState = "";
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
    nextPacketData = {
      ...nextPacketData,
      nextPacketSequence: parseInt(sendPacketEvent.attributes.find((attr) => attr.key == "packet_sequence").value),
      nextMemo: nextPacketJson?.memo || "",
      nextAmount: nextPacketJson.amount,
      nextDestinationDenom: nextPacketJson.denom,
      nextReceiver: nextPacketJson.receiver
    };
    ctx.oraiSendPacketSequence = nextPacketData.nextPacketSequence;
  }

  // const wasmData = events.find((e) => e.type === "wasm");
  // if (!wasmData) {
  //   throw generateError("there is no wasm data in storeOnRecvPacket");
  // }
  // const localReceiver = wasmData.attributes.find((attr) => attr.key == "from").value;

  const existEvmPath = Object.values(EvmChainPrefix).find((prefix) =>
    nextPacketData.nextDestinationDenom.includes(prefix)
  );
  nextState = existEvmPath ? "OraiBridgeState" : "";

  // we don't have previous packetSequence, so we save it as nextPacketSequence
  let onRecvPacketData = {
    txHash: convertTxHashToHex(txEvent.hash),
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
    status: StateDBStatus.PENDING
  };
  console.log("onRecvPacketData", onRecvPacketData);
  await ctx.db.insertData(onRecvPacketData, "OraichainState");

  // no next state, we move to final state of the machine
  return new Promise((resolve) => resolve(""));
};

export const handleCheckOnRecvPacketOraichain = async (
  ctx: ContextIntepreter,
  event: AnyEventObject
): Promise<{ packetSequence: number; events: Event[]; txEvent: TxEvent }> => {
  const txEvent: TxEvent = event.payload;
  const events = parseRpcEvents(txEvent.result.events);
  const recvPacketEvent = events.find((e) => e.type === "recv_packet");
  if (!recvPacketEvent)
    throw generateError("Could not find the recv packet event from the payload at checkOnRecvPacketOraichain");
  const packetSequenceAttr = recvPacketEvent.attributes.find((attr) => attr.key === "packet_sequence");
  if (!packetSequenceAttr) throw generateError("Could not find packet sequence attr in checkOnRecvPacketOraichain");
  const packetSequence = parseInt(packetSequenceAttr.value);
  return new Promise((resolve) => resolve({ packetSequence, events, txEvent }));
};

export const handleCheckOnAcknowledgementOnCosmos = async (
  ctx: ContextIntepreter,
  event: AnyEventObject
): Promise<{ packetSequence: number }> => {
  const events = parseRpcEvents(event.payload.result.events);
  const ackPacket = events.find((attr) => attr.type === "acknowledge_packet");
  if (!ackPacket) {
    throw generateError("Acknowledgement packet not found on step checkOnAcknowledgementOnCosmos");
  }
  const value = ackPacket.attributes.find((attr: any) => attr.key === "packet_sequence").value;
  const data = parseInt(value);
  return new Promise((resolve) => resolve({ packetSequence: data }));
};

export const handleUpdateOnAcknowledgementOnCosmos = async (
  ctx: ContextIntepreter,
  event: AnyEventObject
): Promise<void> => {
  const packetSequence = event.data.packetSequence;
  let oraichainData = await ctx.db.queryOraichainStateByNextPacketSequence(packetSequence);
  if (oraichainData.length == 0) {
    throw generateError("error on finding oraichain state by next packet sequence in updateOnAcknowledgementOnCosmos");
  }
  await ctx.db.updateOraichainStatusByNextPacketSequence(parseInt(packetSequence), StateDBStatus.FINISHED);
  console.log(
    "updateOnAcknowledgementOnCosmos: ",
    await ctx.db.queryOraichainStateByNextPacketSequence(packetSequence)
  );
};

export const handleStoreOnTransferBackToRemoteChain = async (
  ctx: ContextIntepreter,
  event: AnyEventObject
): Promise<string> => {
  const txEvent: TxEvent = event.payload;
  const events = parseRpcEvents(txEvent.result.events);

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
  const sendPacketEvent = events.find((e) => e.type === "send_packet");
  if (sendPacketEvent) {
    let nextPacketJson = JSON.parse(sendPacketEvent.attributes.find((attr) => attr.key == "packet_data").value);
    nextPacketData = {
      ...nextPacketData,
      nextPacketSequence: parseInt(sendPacketEvent.attributes.find((attr) => attr.key == "packet_sequence").value),
      nextMemo: nextPacketJson?.memo || "",
      nextAmount: nextPacketJson.amount,
      nextDestinationDenom: nextPacketJson.denom,
      nextReceiver: nextPacketJson.receiver
    };
    ctx.oraiSendPacketSequence = nextPacketData.nextPacketSequence;
    sender = nextPacketJson.sender;
    localReceiver = nextPacketJson.sender;
  }

  const existEvmPath = Object.values(EvmChainPrefix).find((prefix) =>
    nextPacketData.nextDestinationDenom.includes(prefix)
  );
  nextState = existEvmPath ? "OraiBridgeState" : "";

  // we don't have previous packetSequence, so we save it as nextPacketSequence
  let onRecvPacketData = {
    txHash: convertTxHashToHex(txEvent.hash),
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
    status: StateDBStatus.PENDING
  };
  console.log("onRecvPacketData", onRecvPacketData);
  await ctx.db.insertData(onRecvPacketData, "OraichainState");

  // no next state, we move to final state of the machine
  return new Promise((resolve) => resolve(""));
};
