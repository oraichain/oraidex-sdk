// TODO: Need to somehow synchronize with the whitelist pairs on oraiDEX. Maybe it can be a smart contract containing all whitelisted pairs

import { AssetInfo } from "@oraichain/oraidex-contracts-sdk";
import {
  ORAI,
  airiCw20Adress,
  atomIbcDenom,
  neutaroDenom,
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
import { WETH_CONTRACT, BTC_CONTRACT } from "@oraichain/oraidex-common";
import { pairLpTokens } from "@oraichain/oraidex-common";

// the orders are important! Do not change the order of the asset_infos.
export const pairs: PairMapping[] = [
  {
    asset_infos: [{ token: { contract_addr: airiCw20Adress } }, { native_token: { denom: ORAI } }],
    lp_token: pairLpTokens.AIRI_ORAI,
    symbols: ["AIRI", "ORAI"],
    factoryV1: true
  },
  {
    asset_infos: [{ token: { contract_addr: oraixCw20Address } }, { native_token: { denom: ORAI } }],
    lp_token: pairLpTokens.ORAIX_ORAI,
    symbols: ["ORAIX", "ORAI"],
    factoryV1: true
  },
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { native_token: { denom: atomIbcDenom } }],
    lp_token: pairLpTokens.ATOM_ORAI,
    symbols: ["ORAI", "ATOM"],
    factoryV1: true
  },
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: usdtCw20Address } }],
    lp_token: pairLpTokens.USDT_ORAI,
    symbols: ["ORAI", "USDT"],
    factoryV1: true
  },
  {
    asset_infos: [{ token: { contract_addr: kwtCw20Address } }, { native_token: { denom: ORAI } }],
    lp_token: pairLpTokens.KWT_ORAI,
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
    lp_token: pairLpTokens.OSMO_ORAI,
    symbols: ["ORAI", "OSMO"],
    factoryV1: true
  },
  {
    asset_infos: [{ token: { contract_addr: milkyCw20Address } }, { token: { contract_addr: usdtCw20Address } }],
    lp_token: pairLpTokens.MILKY_USDT,
    symbols: ["MILKY", "USDT"],
    factoryV1: true
  },
  {
    asset_infos: [{ token: { contract_addr: scOraiCw20Address } }, { native_token: { denom: ORAI } }],
    lp_token: pairLpTokens.SCORAI_ORAI,
    symbols: ["scORAI", "ORAI"]
  },
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: usdcCw20Address } }],
    lp_token: pairLpTokens.USDC_ORAI,
    symbols: ["ORAI", "USDC"]
  },
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: tronCw20Address } }],
    lp_token: pairLpTokens.TRX_ORAI,
    symbols: ["ORAI", "wTRX"]
  },
  {
    asset_infos: [{ token: { contract_addr: scAtomCw20Address } }, { native_token: { denom: atomIbcDenom } }],
    lp_token: pairLpTokens.SCATOM_ATOM,
    symbols: ["scATOM", "ATOM"]
  },
  // we will reverse order for this pair in api /tickers for Coingecko
  {
    asset_infos: [{ token: { contract_addr: injAddress } }, { native_token: { denom: ORAI } }],
    lp_token: pairLpTokens.INJ_ORAI,
    symbols: ["INJ", "ORAI"]
  },
  {
    asset_infos: [{ token: { contract_addr: usdcCw20Address } }, { token: { contract_addr: oraixCw20Address } }],
    lp_token: pairLpTokens.USDC_ORAIX,
    symbols: ["USDC", "ORAIX"]
  },
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: WETH_CONTRACT } }],
    lp_token: pairLpTokens.ORAI_WETH,
    symbols: ["ORAI", "WETH"]
  },
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: BTC_CONTRACT } }],
    lp_token: pairLpTokens.ORAI_BTC,
    symbols: ["ORAI", "BTC"]
  },
  {
    asset_infos: [{ native_token: { denom: neutaroDenom } }, { token: { contract_addr: usdcCw20Address } }],
    // lp_token: pairLpTokens.NTMPI_USDC,
    lp_token: "orai1rmvjmwd940ztafxue7630g75px8tqma4jskjuu57fkj0eqahqfgqqwjm00",
    symbols: ["NTMPI", "USDC"]
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
