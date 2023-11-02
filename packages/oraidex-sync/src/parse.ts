import { AssetInfo } from "@oraichain/common-contracts-sdk";
import { pairWithStakingAsset, pairs } from "./pairs";
import { OraiswapPairTypes } from "@oraichain/oraidex-contracts-sdk";
import { isEqual } from "lodash";

export function replaceAllNonAlphaBetChar(columnName: string): string {
  return columnName.replace(/[^a-zA-Z]/g, "a");
}

export function parseAssetInfo(info: AssetInfo): string {
  return JSON.stringify(info);
}

export function parseAssetInfoOnlyDenom(info: AssetInfo): string {
  if ("native_token" in info) return info.native_token.denom;
  return info.token.contract_addr;
}

export function convertDateToSecond(date: Date): number {
  return Math.round(date.valueOf() / 1000);
}

export function toObject(data: any) {
  return JSON.parse(
    JSON.stringify(
      data,
      (key, value) => (typeof value === "bigint" ? value.toString() : value) // return everything else unchanged
    )
  );
}

export const parsePairDenomToAssetInfo = ([baseDenom, quoteDenom]: [string, string]): [AssetInfo, AssetInfo] => {
  const pair = pairs.find(
    (pair) =>
      parseAssetInfoOnlyDenom(pair.asset_infos[0]) === baseDenom &&
      parseAssetInfoOnlyDenom(pair.asset_infos[1]) === quoteDenom
  );
  if (!pair) {
    console.trace(`parsePairDenomToAssetInfo: cannot find pair for ${baseDenom}-${quoteDenom}`);
    return null;
  }
  return pair.asset_infos;
};

export const parsePoolAmount = (poolInfo: OraiswapPairTypes.PoolResponse, trueAsset: AssetInfo): bigint => {
  return BigInt(poolInfo.assets.find((asset) => isEqual(asset.info, trueAsset))?.amount || "0");
};

export const parseStakingDenomToAssetInfo = (stakingAssetDenom: string): AssetInfo => {
  const pair = pairWithStakingAsset.find(
    (pair) => parseAssetInfoOnlyDenom(pair.stakingAssetInfo) === stakingAssetDenom
  );
  if (!pair) throw new Error(`Cannot find pair with staking asset denom: ${stakingAssetDenom}`);
  return pair.stakingAssetInfo;
};

export const parseCw20DenomToAssetInfo = (assetDenom: string): AssetInfo => {
  return {
    token: {
      contract_addr: assetDenom
    }
  };
};
