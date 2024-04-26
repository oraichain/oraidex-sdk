import { ChainIdEnum, COSMOS_CHAIN_ID_COMMON, EvmChainPrefix } from "@oraichain/oraidex-common";
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
  [EvmChainPrefix.BSC_MAINNET]: "https://1rpc.io/bnb",
  [EvmChainPrefix.ETH_MAINNET]: "https://eth-pokt.nodies.app",
  [EvmChainPrefix.TRON_MAINNET]: "https://api.trongrid.io/jsonrpc"
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

export const ChainIdToEvmChainPrefix = {
  [ChainIdEnum.BNBChain]: EvmChainPrefix.BSC_MAINNET,
  [ChainIdEnum.Ethereum]: EvmChainPrefix.ETH_MAINNET,
  [ChainIdEnum.TRON]: EvmChainPrefix.TRON_MAINNET
};

export const FinalTag = "Final";

// Total time to wait for one state to be transition to another state
export const TimeOut = process.env.NODE_ENV == "development" ? 3000 : 20000;

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
  status: string;
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
  packetSequence: number;
  amount: string;
  denom: string;
  memo: string;
  receiver: string;
  sender: string;
  srcPort: string;
  srcChannel: string;
  dstPort: string;
  dstChannel: string;
  status: string;
}

export interface OraichainState {
  txHash: string;
  height: number;
  prevState: string;
  prevTxHash: string;
  nextState: string;
  packetSequence: number;
  packetAck: string;
  sender: string;
  localReceiver: string;
  nextPacketSequence: number;
  nextMemo: string;
  nextAmount: string;
  nextReceiver: string;
  nextDestinationDenom: string;
  srcChannel: string;
  dstChannel: string;
  status: string;
}

export interface CosmosState {
  txHash: string;
  height: number;
  chainId: string;
  prevState: string;
  prevTxHash: string;
  nextState: string;
  packetSequence: number;
  amount: string;
  denom: string;
  memo: string;
  receiver: string;
  sender: string;
  srcPort: string;
  srcChannel: string;
  dstPort: string;
  dstChannel: string;
  status: string;
}

export type DBStateType = EvmState | OraiBridgeState | OraichainState | CosmosState;

export type RoutingQueryItem =
  | {
      type: DatabaseEnum.Evm;
      data: EvmState;
    }
  | {
      type: DatabaseEnum.Cosmos;
      data: CosmosState;
    }
  | {
      type: DatabaseEnum.OraiBridge;
      data: OraiBridgeState;
    }
  | {
      type: DatabaseEnum.Oraichain;
      data: OraichainState;
    };

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
  routingQueryData?: RoutingQueryItem[];
}
