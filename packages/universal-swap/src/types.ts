import { CwIcs20LatestClient, CwIcs20LatestReadOnlyInterface } from "@oraichain/common-contracts-sdk";
import { CosmosWallet, EvmWallet, TokenItemType } from "@oraichain/oraidex-common";
import { OraiswapRouterInterface, OraiswapRouterReadOnlyInterface, Uint128 } from "@oraichain/oraidex-contracts-sdk";

export type UniversalSwapType =
  | "other-networks-to-oraichain"
  | "oraichain-to-oraichain"
  | "oraichain-to-other-networks";

export enum SwapDirection {
  From,
  To
}

export interface SimulateResponse {
  amount: Uint128;
  displayAmount: number;
}

export interface SwapData {
  metamaskAddress?: string;
  tronAddress?: string;
}

export interface UniversalSwapData {
  readonly cosmosSender: string;
  readonly originalFromToken: TokenItemType;
  readonly originalToToken: TokenItemType;
  readonly fromAmount: number;
  readonly simulateAmount: string;
  readonly userSlippage: number;
  readonly simulateAverage: string;
}

export interface UniversalSwapConfig {
  readonly cosmosWallet: CosmosWallet;
  readonly evmWallet: EvmWallet;
  readonly cwIcs20LatestClient?: CwIcs20LatestClient | CwIcs20LatestReadOnlyInterface;
  readonly routerClient?: OraiswapRouterInterface | OraiswapRouterReadOnlyInterface;
}
