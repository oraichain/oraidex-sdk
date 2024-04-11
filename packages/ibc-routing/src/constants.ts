import { DuckDB } from "./db";

export const autoForwardTag = { key: "message.action", value: "/gravity.v1.MsgExecuteIbcAutoForwards" };
export const requestBatchTag = { key: "message.action", value: "/gravity.v1.MsgRequestBatch" };
export const batchSendToEthClaimTag = { key: "message.action", value: "/gravity.v1.MsgBatchSendToEthClaim" };
export const onRecvPacketTag = { key: "message.action", value: "/ibc.core.channel.v1.MsgRecvPacket" };
export const onAcknowledgementTag = { key: "message.action", value: "/ibc.core.channel.v1.MsgAcknowledgement" };
export const onExecuteContractTag = { key: "message.action", value: "/cosmwasm.wasm.v1.MsgExecuteContract" };

export const sendToCosmosEvent = "SendToCosmosEvent(address,address,string,uint256,uint256)";
export const oraiBridgeAutoForwardEvent = {
  type: "message",
  attribute: { key: "action", value: "/gravity.v1.MsgExecuteIbcAutoForwards" }
};
export const executedIbcAutoForwardType = "gravity.v1.EventSendToCosmosExecutedIbcAutoForward";
export const oraiBridgeAutoForwardEventType = "gravity.v1.EventSendToCosmosExecutedIbcAutoForward";
export const outGoingTxIdEventType = "gravity.v1.EventOutgoingTxId";
export const eventBatchCreatedEventType = "gravity.v1.EventBatchCreated";
export const batchSendToEthClaimEventType = "gravity.v1.MsgBatchSendToEthClaim";
export const ibcRecvPacketEventType = "recv_packet";
export const evmGravityEvents = [sendToCosmosEvent];

export enum DatabaseEnum {
  Evm = "EvmState",
  OraiBridge = "OraiBridgeState",
  Oraichain = "OraichainState"
}

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
  STORE_ON_BATCH_SEND_TO_ETH_CLAIM: "STORE_ON_BATCH_SEND_TO_ETH_CLAIM",
  STORE_ON_TRANSFER_BACK_TO_REMOTE_CHAIN: "STORE_ON_TRANSFER_BACK_TO_REMOTE_CHAIN"
};

export enum StateDBStatus {
  PENDING = "PENDING",
  FINISHED = "FINISHED"
}

export enum ForwardTagOnOraichain {
  COSMOS = "Cosmos",
  EVM = "Evm"
}

export const FinalTag = "Final";

// Total time to wait for one state to be transition to another state
export const TimeOut = 3000;

// INTERFACES
export interface EvmState {
  txHash: string;
  height: number;
  prevState: string;
  prevTxHash: string;
  nextState: string;
  destination: string;
  fromAmount: string;
  oraiBridgeChannelId: string;
  oraiReceiver: string;
  destinationDenom: string;
  destinationChannelId: string;
  destinationReceiver: string;
  eventNonce: number;
  evmChainPrefix: string;
  status: StateDBStatus;
}

export interface OraiBridgeState {
  txHash: string;
  height: number;
  prevState: string;
  prevTxHash: string;
  nextState: string;
  eventNonce: number;
  batchNonce: number;
  txId: number;
  evmChainPrefix: string;
  packetSequence: number; // primary key
  amount: string;
  denom: string;
  memo: string;
  receiver: string;
  sender: string;
  srcPort: string;
  srcChannel: string;
  dstPort: string;
  dstChannel: string;
  status: StateDBStatus;
}

export interface OraichainState {
  txHash: string;
  height: number;
  prevState: string;
  prevTxHash: string;
  nextState: string;
  packetSequence: number; // primary key
  packetAck: string;
  sender: string;
  localReceiver: string;
  nextPacketSequence: number;
  nextMemo: string;
  nextAmount: string;
  nextReceiver: string;
  nextDestinationDenom: string;
  status: StateDBStatus;
}

export type GeneralDBState = EvmState | OraiBridgeState | OraichainState;

export interface ContextIntepreter {
  db: DuckDB;
  evmEventNonce?: number;
  oraiBridgeEventNonce?: number;
  oraiBridgePacketSequence?: number;
  oraiSendPacketSequence: number;
  oraiBridgePendingTxId: number;
  oraiBridgeBatchNonce: number;
  evmChainPrefixOnLeftTraverseOrder?: string;
  evmChainPrefixOnRightTraverseOrder: string;
  oraiBridgeSrcChannel?: string;
  oraiBridgeDstChannel?: string;
  oraichainSrcChannel?: string;
  oraichainDstChannel?: string;
  oraiSrcForCosmosChannel?: string;
}
