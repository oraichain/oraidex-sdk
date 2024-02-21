// TODO: Need to somehow synchronize with the whitelist PAIRS on oraiDEX. Maybe it can be a smart contract containing all whitelisted pairs

import { PAIRS } from "@oraichain/oraidex-common";
import { AssetInfo } from "@oraichain/oraidex-contracts-sdk";
import { ORAI, usdtCw20Address } from "./constants";

export const pairsOnlyDenom = PAIRS.map((pair) => ({
  ...pair,
  asset_infos: pair.asset_infos.map((info) => parseAssetInfoOnlyDenom1(info))
}));

export const pairsWithDenom = PAIRS.map((pair) => ({
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
