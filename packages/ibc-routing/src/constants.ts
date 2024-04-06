export const autoForwardTag = { key: "message.action", value: "/gravity.v1.MsgExecuteIbcAutoForwards" };
export const requestBatchTag = { key: "message.action", value: "/gravity.v1.MsgRequestBatch" };
export const batchSendToEthClaimTag = { key: "message.action", value: "/gravity.v1.MsgBatchSendToEthClaim" };
export const onRecvPacketTag = { key: "message.action", value: "/ibc.core.channel.v1.MsgRecvPacket" };
export const onAcknowledgementTag = { key: "message.action", value: "/ibc.core.channel.v1.MsgAcknowledgement" };

export const sendToCosmosEvent = "SendToCosmosEvent(address,address,string,uint256,uint256)";
export const oraiBridgeAutoForwardEvent = {
  type: "message",
  attribute: { key: "action", value: "/gravity.v1.MsgExecuteIbcAutoForwards" }
};
export const oraiBridgeAutoForwardEventType = "gravity.v1.EventSendToCosmosExecutedIbcAutoForward";
export const outGoingTxIdEventType = "gravity.v1.EventOutgoingTxId";
export const eventBatchCreatedEventType = "gravity.v1.EventBatchCreated";
export const batchSendToEthClaimEventType = "gravity.v1.MsgBatchSendToEthClaim";
export const evmGravityEvents = [sendToCosmosEvent];
export enum NetworkEventType {
  EVM,
  ORAIBRIDGE,
  ORAICHAIN,
  COSMOS
}

// this keys can be invoked to trigger events for our state machines
export const invokableMachineStateKeys = {
  STORE_SEND_TO_COSMOS: "STORE_SEND_TO_COSMOS",
  STORE_AUTO_FORWARD: "STORE_AUTO_FORWARD",
  STORE_ON_RECV_PACKET_ORAICHAIN: "STORE_ON_RECV_PACKET_ORAICHAIN",
  STORE_ON_ACKNOWLEDGEMENT_ORAICHAIN: "STORE_ON_ACKNOWLEDGEMENT_ORAICHAIN",
  STORE_ON_RECV_PACKET_ORAIBRIDGE: "STORE_ON_RECV_PACKET_ORAIBRIDGE",
  STORE_ON_REQUEST_BATCH: "STORE_ON_REQUEST_BATCH",
  STORE_ON_BATCH_SEND_TO_ETH_CLAIM: "STORE_ON_BATCH_SEND_TO_ETH_CLAIM"
};

export const PathsToEvm = ["eth-mainnet", "oraib", "tronx-mainnet"];

export const FinalTag = "Final";
