import { FeeCurrency, ChainInfo, Bech32Config, Currency } from "@keplr-wallet/types";

export type NetworkType = "cosmos" | "evm" | "bsc" | "tron";
export interface NetworkConfig {
  coinType?: number;
  explorer: string;
  /** Fixed fee */
  fee: { gasPrice: string; amount: string; gas: string };
  factory: string;
  factory_v2: string;
  oracle: string;
  staking: string;
  router: string;
  denom: string;
  prefix: string;
  rewarder: string;
  converter: string;
  oraidex_listing: string;
  bid_pool: string;
  multicall: string;
}

export type CoinIcon = any;
export type BridgeAppCurrency = FeeCurrency & {
  readonly bridgeTo?: string[];
  readonly coinGeckoId?: string;
  readonly Icon?: CoinIcon;
  readonly IconLight?: CoinIcon;
  readonly bridgeNetworkIdentifier?: string;
  readonly coinDecimals: 6 | 18;
  readonly contractAddress?: string;
  readonly prefixToken?: string;
};

export type CoinType = 118 | 60 | 195;

/**
 * A list of Cosmos chain infos. If we need to add / remove any chains, just directly update this variable.
 * some chain is already in wallet so we override some attributes as optional
 */
export interface CustomChainInfo
  extends Omit<
    ChainInfo,
    "rpcConfig" | "restConfig" | "feeCurrencies" | "stakeCurrency" | "currencies" | "rest" | "bech32Config"
  > {
  readonly chainId: string;
  readonly chainName: string;
  readonly Icon?: CoinIcon;
  readonly IconLight?: CoinIcon;
  readonly networkType: NetworkType;
  readonly bip44: {
    coinType: CoinType;
  };
  readonly bech32Config?: Bech32Config;
  readonly rest?: string; // optional, rest api tron and lcd for cosmos
  readonly stakeCurrency?: Currency;
  readonly feeCurrencies?: FeeCurrency[];
  readonly currencies: BridgeAppCurrency[];
  readonly hideInUI?: boolean;
  readonly txExplorer?: {
    readonly name: string;
    readonly txUrl: string;
    readonly accountUrl?: string;
  };
}
