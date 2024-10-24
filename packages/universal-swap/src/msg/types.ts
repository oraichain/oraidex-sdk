import { Coin } from "@cosmjs/amino";
import { JsonObject } from "@cosmjs/cosmwasm-stargate";
import { EncodeObject } from "@cosmjs/proto-signing";
import { NetworkChainId } from "@oraichain/oraidex-common";

export interface BridgeMsgInfo {
  amount: string;
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

export interface MiddlewareResponse {
  memo: string;
  receiver: string;
}
