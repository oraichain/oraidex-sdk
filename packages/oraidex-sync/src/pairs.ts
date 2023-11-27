// TODO: Need to somehow synchronize with the whitelist pairs on oraiDEX. Maybe it can be a smart contract containing all whitelisted pairs

import { AssetInfo } from "@oraichain/oraidex-contracts-sdk";
import {
  ORAI,
  airiCw20Adress,
  atomIbcDenom,
  injAddress,
  kwtCw20Address,
  milkyCw20Address,
  oraixCw20Address,
  osmosisIbcDenom,
  scAtomCw20Address,
  scOraiCw20Address,
  tronCw20Address,
  usdcCw20Address,
  usdtCw20Address
} from "./constants";
import { PairMapping } from "./types";

// the orders are important! Do not change the order of the asset_infos.
export const pairs: PairMapping[] = [
  {
    asset_infos: [{ token: { contract_addr: airiCw20Adress } }, { native_token: { denom: ORAI } }],
    lp_token: "",
    symbols: ["AIRI", "ORAI"],
    factoryV1: true
  },
  {
    asset_infos: [{ token: { contract_addr: oraixCw20Address } }, { native_token: { denom: ORAI } }],
    lp_token: "",
    symbols: ["ORAIX", "ORAI"],
    factoryV1: true
  },
  {
    asset_infos: [{ token: { contract_addr: scOraiCw20Address } }, { native_token: { denom: ORAI } }],
    lp_token: "",
    symbols: ["scORAI", "ORAI"]
  },
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { native_token: { denom: atomIbcDenom } }],
    lp_token: "",
    symbols: ["ORAI", "ATOM"],
    factoryV1: true
  },
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: usdtCw20Address } }],
    lp_token: "",
    symbols: ["ORAI", "USDT"],
    factoryV1: true
  },
  {
    asset_infos: [{ token: { contract_addr: kwtCw20Address } }, { native_token: { denom: ORAI } }],
    lp_token: "",
    symbols: ["KWT", "ORAI"],
    factoryV1: true
  },
  {
    asset_infos: [
      { native_token: { denom: ORAI } },
      {
        native_token: { denom: osmosisIbcDenom }
      }
    ],
    lp_token: "",
    symbols: ["ORAI", "OSMO"],
    factoryV1: true
  },
  {
    asset_infos: [{ token: { contract_addr: milkyCw20Address } }, { token: { contract_addr: usdtCw20Address } }],
    lp_token: "",
    symbols: ["MILKY", "USDT"],
    factoryV1: true
  },
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: usdcCw20Address } }],
    lp_token: "",
    symbols: ["ORAI", "USDC"]
  },
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: tronCw20Address } }],
    lp_token: "",
    symbols: ["ORAI", "WTRX"]
  },
  {
    asset_infos: [{ token: { contract_addr: scAtomCw20Address } }, { native_token: { denom: atomIbcDenom } }],
    lp_token: "",
    symbols: ["scATOM", "ATOM"]
  },
  // we will reverse order for this pair in api /tickers for Coingecko
  {
    asset_infos: [{ token: { contract_addr: injAddress } }, { native_token: { denom: ORAI } }],
    lp_token: "",
    symbols: ["INJ", "ORAI"]
  }
];

export const pairsOnlyDenom = pairs.map((pair) => ({
  ...pair,
  asset_infos: pair.asset_infos.map((info) => parseAssetInfoOnlyDenom1(info))
}));

export const pairsWithDenom = pairs.map((pair) => ({
  ...pair,
  asset_denoms: pair.asset_infos.map((info) => parseAssetInfoOnlyDenom1(info))
}));

export const oraiUsdtPairOnlyDenom = pairsOnlyDenom.find(
  (pair) => JSON.stringify(pair.asset_infos) === JSON.stringify([ORAI, usdtCw20Address])
).asset_infos;

function parseAssetInfoOnlyDenom1(info: AssetInfo): string {
  if ("native_token" in info) return info.native_token.denom;
  return info.token.contract_addr;
}

const getStakingAssetInfo = (assetInfos: AssetInfo[]): AssetInfo => {
  return parseAssetInfoOnlyDenom1(assetInfos[0]) === ORAI ? assetInfos[1] : assetInfos[0];
};

export const pairWithStakingAsset = pairs.map((pair) => {
  return {
    ...pair,
    stakingAssetInfo: getStakingAssetInfo(pair.asset_infos)
  };
});
