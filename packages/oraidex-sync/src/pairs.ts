// TODO: Need to somehow synchronize with the whitelist pairs on oraiDEX. Maybe it can be a smart contract containing all whitelisted pairs

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

export const pairs: PairMapping[] = [
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: airiCw20Adress } }],
    symbols: ["ORAI", "AIRI"]
  },
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: oraixCw20Address } }],
    symbols: ["ORAI", "ORAIX"]
  },
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: scOraiCw20Address } }],
    symbols: ["ORAI", "scORAI"]
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
    asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: kwtCw20Address } }],
    symbols: ["ORAI", "KWT"]
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
    asset_infos: [{ native_token: { denom: atomIbcDenom } }, { token: { contract_addr: scAtomCw20Address } }],
    symbols: ["ATOM", "scATOM"]
  }
];
