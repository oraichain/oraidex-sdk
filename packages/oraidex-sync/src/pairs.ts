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

export enum pairLpTokens {
  AIRI_ORAI = "orai1hxm433hnwthrxneyjysvhny539s9kh6s2g2n8y",
  ORAIX_ORAI = "orai1qmy3uuxktflvreanaqph6yua7stjn6j65rur62",
  SCORAI_ORAI = "orai1ay689ltr57jt2snujarvakxrmtuq8fhuat5rnvq6rct89vjer9gqm2vde6",
  ATOM_ORAI = "orai1g2prqry343kx566cp7uws9w7v78n5tejylvaz6",
  USDT_ORAI = "orai1mav52eqhd07c3lwevcnqdykdzhh4733zf32jcn",
  KWT_ORAI = "orai17rcfcrwltujfvx7w4l2ggyku8qrncy0hdvrzvc",
  OSMO_ORAI = "orai19ltj97jmdqnz5mrd2amethetvcwsp0220kww3e",
  MILKY_USDT = "orai18ywllw03hvy720l06rme0apwyyq9plk64h9ccf",
  USDC_ORAI = "orai1e0x87w9ezwq2sdmvv5dq5ngzy98lt47tqfaf2m7zpkg49g5dj6fqred5d7",
  TRX_ORAI = "orai1wgywgvumt5dxhm7vjpwx5es9ecrtl85qaqdspjqwx2lugy7vmw5qlwrn88",
  SCATOM_ATOM = "orai1hcjne0hmdj6pjrc3xuksucr0yplsa9ny7v047c34y8k8hfflq6yqyjapnn",
  INJ_ORAI = "orai1slqw6gfvs6l2jgvh5ryjayf4g77d7sgfv6fumtyzcr06a6g9gnrq6c4rgg"
}
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
    asset_infos: [{ token: { contract_addr: scOraiCw20Address } }, { native_token: { denom: ORAI } }],
    lp_token: pairLpTokens.SCORAI_ORAI,
    symbols: ["scORAI", "ORAI"]
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
    asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: usdcCw20Address } }],
    lp_token: pairLpTokens.USDC_ORAI,
    symbols: ["ORAI", "USDC"]
  },
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: tronCw20Address } }],
    lp_token: pairLpTokens.TRX_ORAI,
    symbols: ["ORAI", "WTRX"]
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
