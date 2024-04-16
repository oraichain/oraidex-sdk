import { COSMOS_CHAIN_ID_COMMON, EvmChainPrefix } from "@oraichain/oraidex-common";
import dotenv from "dotenv";
import { DuckDB } from "./db";
dotenv.config();

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
  Oraichain = "OraichainState",
  Cosmos = "CosmosState"
}

export enum IntepreterType {
  EVM,
  ORAICHAIN,
  COSMOS
}

// this keys can be invoked to trigger events for our state machines
export const invokableMachineStateKeys = {
  STORE_SEND_TO_COSMOS: "STORE_SEND_TO_COSMOS",
  QUERY_IBC_ROUTING_DATA: "QUERY_IBC_ROUTING_DATA",
  STORE_AUTO_FORWARD: "STORE_AUTO_FORWARD",
  STORE_ON_RECV_PACKET_ORAICHAIN: "STORE_ON_RECV_PACKET_ORAICHAIN",
  STORE_ON_ACKNOWLEDGEMENT_ORAICHAIN: "STORE_ON_ACKNOWLEDGEMENT_ORAICHAIN",
  STORE_ON_RECV_PACKET_ORAIBRIDGE: "STORE_ON_RECV_PACKET_ORAIBRIDGE",
  STORE_ON_REQUEST_BATCH: "STORE_ON_REQUEST_BATCH",
  STORE_ON_BATCH_SEND_TO_ETH_CLAIM: "STORE_ON_BATCH_SEND_TO_ETH_CLAIM",
  STORE_ON_TRANSFER_BACK_TO_REMOTE_CHAIN: "STORE_ON_TRANSFER_BACK_TO_REMOTE_CHAIN",
  STORE_ON_IBC_TRANSFER_FROM_REMOTE: "STORE_ON_IBC_TRANSFER_FROM_REMOTE"
};

export const EvmRpcs = {
  [EvmChainPrefix.BSC_MAINNET]: "https://go.getblock.io/5364b225d0ea429e91f5f3f027c414a2",
  [EvmChainPrefix.ETH_MAINNET]: "https://go.getblock.io/0efb9bd03a704cc8ad6cad84999bed4f",
  [EvmChainPrefix.TRON_MAINNET]: "https://go.getblock.io/b7708ba91fd547a983d9cff2bac540e2"
};

export const GravityAddress = {
  [EvmChainPrefix.BSC_MAINNET]: "0xb40C364e70bbD98E8aaab707A41a52A2eAF5733f",
  [EvmChainPrefix.ETH_MAINNET]: "0x09Beeedf51AA45718F46837C94712d89B157a9D3",
  [EvmChainPrefix.TRON_MAINNET]: "0x73Ddc880916021EFC4754Cb42B53db6EAB1f9D64"
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
export const TimeOut = process.env.NODE_ENV == "development" ? 3000 : 60000;

export const IbcWasmContract = "orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm";

export const COSMOS_DENOM = {
  [COSMOS_CHAIN_ID_COMMON.COSMOSHUB_CHAIN_ID]: "uatom",
  [COSMOS_CHAIN_ID_COMMON.ORAIBRIDGE_CHAIN_ID]: "uoraib",
  [COSMOS_CHAIN_ID_COMMON.OSMOSIS_CHAIN_ID]: "uosmo",
  [COSMOS_CHAIN_ID_COMMON.INJECTVE_CHAIN_ID]: "inj",
  [COSMOS_CHAIN_ID_COMMON.KAWAII_COSMOS_CHAIN_ID]: "oraie"
};

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
  cosmosPacketSequence?: number;
  cosmosSrcChannel?: string;
  cosmosDstChannel?: string;
  routingQueryData?: { [dbState: string]: any };
}
