import { CwIcs20LatestClient, CwIcs20LatestReadOnlyInterface } from "@oraichain/common-contracts-sdk";
import { CosmosWallet, EvmWallet, TokenItemType, BitcoinWallet } from "@oraichain/oraidex-common";
import { OraiswapRouterInterface, OraiswapRouterReadOnlyInterface, Uint128 } from "@oraichain/oraidex-contracts-sdk";

export type UniversalSwapType =
  | "other-networks-to-oraichain"
  | "oraichain-to-oraichain"
  | "oraichain-to-evm"
  | "oraichain-to-cosmos"
  | "oraichain-to-bitcoin"
  | "bitcoin-to-oraichain"
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
  bitcoin?: string;
  bitcoinDeposit?: string;
}

export interface RelayerFeeData {
  relayerAmount: string;
  relayerDecimals: number;
}

export interface UtxosInterface {
  txid: string;
  vout: number;
  status: {
    confirmed: boolean;
    block_height: number;
    block_hash: string;
    block_time: number;
  };
  value: number;
}

export interface BitcoinInfo {
  utxos: UtxosInterface[];
  feeRate: number;
}

/**
 * @property simulatePrice - price of the token calculated with the quote. Eg: swapping ORAI to USDT => 1 ORAI = 2 USDT, then simulate price = 2. TODO: Auto simulate price if not passed
 */
export interface UniversalSwapData {
  readonly sender: Sender;
  readonly originalFromToken: TokenItemType;
  readonly originalToToken: TokenItemType;
  readonly fromAmount: number;
  readonly simulateAmount: string; // toAmount given fromAmount. TODO: auto simulate if not passed
  readonly userSlippage?: number;
  readonly simulatePrice?: string;
  readonly relayerFee?: RelayerFeeData;
  readonly bitcoinInfo?: BitcoinInfo;
}

/**
 * @property cosmosWallet - wallet used for cosmos based networks.
 * @property evmWallet - wallet used for evm based networks. Note that if you want to sign Tron transactions, you need to pass in tronWeb when initializing the EvmWallet object
 * @property ibcInfoTestMode - true if you want to use the IBC Wasm test contract and channel instead of the production version (default is undefined / false)
 */
export interface UniversalSwapConfig {
  readonly cosmosWallet?: CosmosWallet;
  readonly bitcoinWallet?: BitcoinWallet;
  readonly evmWallet?: EvmWallet;
  readonly ibcInfoTestMode?: boolean; // this argument if true allows the object to get test ibc info instead of the production one for testing purposes
}

export interface MultiAddresses {
  metamaskAddress: string;
  tronAddress: string;
  bitcoinAddress?: string;
}

export interface SwapRoute {
  swapRoute: string;
  universalSwapType: UniversalSwapType;
}

export interface OraiBridgeRouteData {
  oraiBridgeChannel: string;
  oraiReceiver: string;
  finalDestinationChannel: string;
  finalReceiver: string;
  tokenIdentifier: string;
}
