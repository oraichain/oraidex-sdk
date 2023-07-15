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
    asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: airiCw20Adress } }]
  },
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: oraixCw20Address } }]
  },
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: scOraiCw20Address } }]
  },
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { native_token: { denom: atomIbcDenom } }]
  },
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: usdtCw20Address } }]
  },
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: kwtCw20Address } }]
  },
  {
    asset_infos: [
      { native_token: { denom: ORAI } },
      {
        native_token: { denom: osmosisIbcDenom }
      }
    ]
  },
  {
    asset_infos: [{ token: { contract_addr: milkyCw20Address } }, { token: { contract_addr: usdtCw20Address } }]
  },
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: usdcCw20Address } }]
  },
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: tronCw20Address } }]
  },
  {
    asset_infos: [{ native_token: { denom: atomIbcDenom } }, { token: { contract_addr: scAtomCw20Address } }]
  }
];
