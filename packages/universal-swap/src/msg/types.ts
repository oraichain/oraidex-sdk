import { Coin } from "@cosmjs/amino";
import { JsonObject } from "@cosmjs/cosmwasm-stargate";
import { EncodeObject } from "@cosmjs/proto-signing";
import { NetworkChainId } from "@oraichain/oraidex-common";

export interface SwapMsgInfo {
  contract: string;
  msg: JsonObject;
  funds: Coin[];
}

export interface BridgeMsgInfo {
  sourceChannel: string;
  sourcePort: string;
  receiver: string;
  timeout: number;
  memo?: string;
  prefix?: string; // use for bridge to evm
  fromToken: string;
  fromChain: NetworkChainId;
  toToken: string;
  toChain: NetworkChainId;
}

export enum PostActionType {
  None,
  Transfer,
  ContractCall,
  IbcTransfer,
  IbcWasmTransfer
}
