export const autoForwardTag = { key: "message.action", value: "/gravity.v1.MsgExecuteIbcAutoForwards" };
export const onRecvPacketTag = { key: "message.action", value: "/ibc.core.channel.v1.MsgRecvPacket" };

export const sendToCosmosEvent = "SendToCosmosEvent(address,address,string,uint256,uint256)";
export const oraiBridgeAutoForwardEvent = {
  type: "message",
  attribute: { key: "action", value: "/gravity.v1.MsgExecuteIbcAutoForwards" }
};
export const oraiBridgeAutoForwardEventType = "gravity.v1.EventSendToCosmosExecutedIbcAutoForward";
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
  STORE_ON_RECV_PACKET: "STORE_ON_RECV_PACKET"
};
