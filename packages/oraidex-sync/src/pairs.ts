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
    symbols: ["AIRI", "ORAI"],
    factoryV1: true
  },
  {
    asset_infos: [{ token: { contract_addr: oraixCw20Address } }, { native_token: { denom: ORAI } }],
    symbols: ["ORAIX", "ORAI"],
    factoryV1: true
  },
  {
    asset_infos: [{ token: { contract_addr: scOraiCw20Address } }, { native_token: { denom: ORAI } }],
    symbols: ["scORAI", "ORAI"]
  },
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { native_token: { denom: atomIbcDenom } }],
    symbols: ["ORAI", "ATOM"],
    factoryV1: true
  },
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: usdtCw20Address } }],
    symbols: ["ORAI", "USDT"],
    factoryV1: true
  },
  {
    asset_infos: [{ token: { contract_addr: kwtCw20Address } }, { native_token: { denom: ORAI } }],
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
    symbols: ["ORAI", "OSMO"],
    factoryV1: true
  },
  {
    asset_infos: [{ token: { contract_addr: milkyCw20Address } }, { token: { contract_addr: usdtCw20Address } }],
    symbols: ["MILKY", "USDT"],
    factoryV1: true
  },
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: usdcCw20Address } }],
    symbols: ["ORAI", "USDC"]
  },
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: tronCw20Address } }],
    symbols: ["ORAI", "WTRX"]
  },
  {
    asset_infos: [{ token: { contract_addr: scAtomCw20Address } }, { native_token: { denom: atomIbcDenom } }],
    symbols: ["scATOM", "ATOM"]
  },
  {
    asset_infos: [{ token: { contract_addr: injAddress } }, { native_token: { denom: ORAI } }],
    symbols: ["INJ", "ORAI"]
  }
];

export function extractUniqueAndFlatten(data: PairMapping[]): AssetInfo[] {
  const uniqueItems = new Set();

  data.forEach((item) => {
    item.asset_infos.forEach((info) => {
      const stringValue = JSON.stringify(info);

      if (!uniqueItems.has(stringValue)) {
        uniqueItems.add(stringValue);
      }
    });
  });

  const uniqueFlattenedArray = Array.from(uniqueItems).map((item) => JSON.parse(item as string));

  return uniqueFlattenedArray;
}

export const pairsOnlyDenom = pairs.map((pair) => ({
  ...pair,
  asset_infos: pair.asset_infos.map((info) => {
    if ("native_token" in info) return info.native_token.denom;
    return info.token.contract_addr;
  })
}));

export const uniqueInfos = extractUniqueAndFlatten(pairs);

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
