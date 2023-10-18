import { CwIcs20LatestClient, CwIcs20LatestReadOnlyInterface } from "@oraichain/common-contracts-sdk";
import { CosmosWallet, EvmWallet, TokenItemType } from "@oraichain/oraidex-common";
import { OraiswapRouterInterface, OraiswapRouterReadOnlyInterface, Uint128 } from "@oraichain/oraidex-contracts-sdk";

export type UniversalSwapType =
  | "other-networks-to-oraichain"
  | "oraichain-to-oraichain"
  | "oraichain-to-evm"
  | "oraichain-to-cosmos"
  | "cosmos-to-cosmos";

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

export interface Sender {
  cosmos: string;
  evm?: string;
  tron?: string;
}

export interface UniversalSwapData {
  readonly sender: Sender;
  readonly originalFromToken: TokenItemType;
  readonly originalToToken: TokenItemType;
  readonly fromAmount: number;
  readonly simulateAmount?: string; // toAmount given fromAmount. TODO: auto simulate if not passed
  readonly userSlippage?: number;
  readonly simulatePrice?: string; // price of the token calculated with the quote. Eg: swapping ORAI to USDT => 1 ORAI = 2 USDT, then simulate price = 2. TODO: Auto simulate price if not passed
}

export interface UniversalSwapConfig {
  readonly cosmosWallet?: CosmosWallet;
  readonly evmWallet?: EvmWallet;
}

export interface SwapRoute {
  swapRoute: string;
  universalSwapType: UniversalSwapType;
}
