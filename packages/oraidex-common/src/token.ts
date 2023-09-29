import { PairInfo } from "@oraichain/oraidex-contracts-sdk";
import {
  CoinGeckoId,
  CoinIcon,
  CustomChainInfo,
  NetworkChainId,
  NetworkName,
  chainInfos,
  oraichainNetwork
} from "./network";
import { flatten, uniqBy } from "lodash";
import { KWTBSC_ORAICHAIN_DENOM, MILKYBSC_ORAICHAIN_DENOM } from "./constant";

export type EvmDenom = "bep20_orai" | "bep20_airi" | "erc20_orai" | "kawaii_orai";
export type AmountDetails = { [denom: string]: string };

export type UniversalSwapType =
  | "other-networks-to-oraichain"
  | "oraichain-to-oraichain"
  | "oraichain-to-other-networks";

export type TokenItemType = {
  name: string;
  org: NetworkName;
  denom: string;
  prefix?: string;
  contractAddress?: string;
  evmDenoms?: string[];
  bridgeNetworkIdentifier?: NetworkChainId;
  bridgeTo?: NetworkChainId[];
  Icon: CoinIcon;
  IconLight?: CoinIcon;
  chainId: NetworkChainId;
  coinType?: number;
  rpc: string;
  decimals: number;
  maxGas?: number;
  coinGeckoId: CoinGeckoId;
  cosmosBased: Boolean;
  minAmountSwap?: number;
};

export type TokenInfo = TokenItemType & {
  symbol?: string;
  total_supply?: string;
  icon?: string;
  verified?: boolean;
};

export type PairInfoExtend = PairInfo & {
  asset_infos_raw: [string, string];
};

export interface FormatNumberDecimal {
  price: number;
  maxDecimal?: number;
  unit?: string;
  minDecimal?: number;
  minPrice?: number;
  unitPosition?: "prefix" | "suffix";
}

const evmDenomsMap = {
  kwt: [KWTBSC_ORAICHAIN_DENOM],
  milky: [MILKYBSC_ORAICHAIN_DENOM]
};
const minAmountSwapMap = {
  trx: 10
};

export const getTokensFromNetwork = (network: CustomChainInfo): TokenItemType[] => {
  return network.currencies.map((currency) => ({
    name: currency.coinDenom,
    org: network.chainName,
    coinType: network.bip44.coinType,
    contractAddress: currency.contractAddress,
    prefix: currency?.prefixToken ?? network.bech32Config?.bech32PrefixAccAddr,
    coinGeckoId: currency.coinGeckoId,
    denom: currency.coinMinimalDenom,
    bridgeNetworkIdentifier: currency.bridgeNetworkIdentifier,
    decimals: currency.coinDecimals,
    bridgeTo: currency.bridgeTo,
    chainId: network.chainId,
    rpc: network.rpc,
    lcd: network.rest,
    cosmosBased: network.networkType === "cosmos",
    maxGas: (network.feeCurrencies?.[0].gasPriceStep?.high ?? 0) * 20000,
    minAmountSwap: minAmountSwapMap[currency.coinMinimalDenom],
    evmDenoms: evmDenomsMap[currency.coinMinimalDenom],
    Icon: currency.Icon,
    IconLight: currency?.IconLight
  }));
};

// other chains, oraichain
const otherChainTokens = flatten(
  chainInfos.filter((chainInfo) => chainInfo.chainId !== "Oraichain").map(getTokensFromNetwork)
);
export const oraichainTokens: TokenItemType[] = getTokensFromNetwork(oraichainNetwork);

export const tokens = [otherChainTokens, oraichainTokens];
export const flattenTokens = flatten(tokens);
export const tokenMap = Object.fromEntries(flattenTokens.map((c) => [c.denom, c]));
export const assetInfoMap = Object.fromEntries(flattenTokens.map((c) => [c.contractAddress || c.denom, c]));
export const cosmosTokens = uniqBy(
  flattenTokens.filter(
    (token) =>
      // !token.contractAddress &&
      token.denom && token.cosmosBased && token.coinGeckoId
  ),
  (c) => c.denom
);
