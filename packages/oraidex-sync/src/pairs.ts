// TODO: Need to somehow synchronize with the whitelist pairs on oraiDEX. Maybe it can be a smart contract containing all whitelisted pairs

import { AssetInfo } from "@oraichain/oraidex-contracts-sdk";
import {
  ORAI,
  airiCw20Adress,
  atomIbcDenom,
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
    symbols: ["AIRI", "ORAI"]
  },
  {
    asset_infos: [{ token: { contract_addr: oraixCw20Address } }, { native_token: { denom: ORAI } }],
    symbols: ["ORAIX", "ORAI"]
  },
  {
    asset_infos: [{ token: { contract_addr: scOraiCw20Address } }, { native_token: { denom: ORAI } }],
    symbols: ["scORAI", "ORAI"]
  },
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { native_token: { denom: atomIbcDenom } }],
    symbols: ["ORAI", "ATOM"]
  },
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: usdtCw20Address } }],
    symbols: ["ORAI", "USDT"]
  },
  {
    asset_infos: [{ token: { contract_addr: kwtCw20Address } }, { native_token: { denom: ORAI } }],
    symbols: ["KWT", "ORAI"]
  },
  {
    asset_infos: [
      { native_token: { denom: ORAI } },
      {
        native_token: { denom: osmosisIbcDenom }
      }
    ],
    symbols: ["ORAI", "OSMOSIS"]
  },
  {
    asset_infos: [{ token: { contract_addr: milkyCw20Address } }, { token: { contract_addr: usdtCw20Address } }],
    symbols: ["MILKY", "USDT"]
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

export const uniqueInfos = extractUniqueAndFlatten(pairs);
