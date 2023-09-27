import { Bech32Config, ChainInfo, Currency, FeeCurrency } from "@keplr-wallet/types";

export type NetworkName =
  | "Oraichain"
  | "Cosmos Hub"
  | "Osmosis"
  | "OraiBridge"
  | "BNB Chain"
  | "Ethereum"
  | "Kawaiiverse"
  | "Kawaiiverse EVM"
  | "Tron Network"
  | "Injective";

export type CosmosChainId =
  | "Oraichain" // oraichain
  | "oraibridge-subnet-2" // oraibridge
  | "osmosis-1" // osmosis
  | "cosmoshub-4" // cosmos hub
  | "injective-1" // injective network
  | "kawaii_6886-1"; // kawaii subnetwork

export type EvmChainId =
  | "0x38" // bsc
  | "0x01" // ethereum
  | "0x1ae6" // kawaii
  | "0x2b6653dc"; // tron

export type NetworkChainId = CosmosChainId | EvmChainId;

export type CoinGeckoId =
  | "oraichain-token"
  | "osmosis"
  | "cosmos"
  | "ethereum"
  | "binancecoin"
  | "airight"
  | "oraidex"
  | "tether"
  | "kawaii-islands"
  | "milky-token"
  | "scorai"
  | "oraidex"
  | "usd-coin"
  | "tron"
  | "weth"
  | "wbnb"
  | "scatom"
  | "injective-protocol";

export type NetworkType = "cosmos" | "evm";
export type CoinIcon = any;
export type BridgeAppCurrency = FeeCurrency & {
  readonly bridgeTo?: NetworkChainId[];
  readonly coinGeckoId?: CoinGeckoId;
  readonly Icon?: CoinIcon;
  readonly IconLight?: CoinIcon;
  readonly bridgeNetworkIdentifier?: EvmChainId;
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
  extends Omit<ChainInfo, "feeCurrencies" | "stakeCurrency" | "currencies" | "rest" | "bech32Config"> {
  readonly chainId: NetworkChainId;
  readonly chainName: NetworkName;
  readonly Icon?: CoinIcon;
  readonly IconLight?: CoinIcon;
  readonly networkType: NetworkType;
  readonly bip44: {
    coinType: CoinType;
  };
  readonly bech32Config?: Bech32Config;
  readonly rest?: string; // optional, rest api tron and lcd for cosmos
  readonly txExplorer?: {
    readonly coinDenom: string;
    readonly txUrl: string;
    readonly accountUrl?: string;
  };
  readonly stakeCurrency?: Currency;
  readonly feeCurrencies?: FeeCurrency[];
  readonly currencies: BridgeAppCurrency[];
}

export const defaultBech32Config = (
  mainPrefix: string,
  validatorPrefix = "val",
  consensusPrefix = "cons",
  publicPrefix = "pub",
  operatorPrefix = "oper"
) => {
  return {
    bech32PrefixAccAddr: mainPrefix,
    bech32PrefixAccPub: mainPrefix + publicPrefix,
    bech32PrefixValAddr: mainPrefix + validatorPrefix + operatorPrefix,
    bech32PrefixValPub: mainPrefix + validatorPrefix + operatorPrefix + publicPrefix,
    bech32PrefixConsAddr: mainPrefix + validatorPrefix + consensusPrefix,
    bech32PrefixConsPub: mainPrefix + validatorPrefix + consensusPrefix + publicPrefix
  };
};
