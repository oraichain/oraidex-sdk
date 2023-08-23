/**
 *  Functions that help parse from this type to other type.
 */

import { AssetInfo } from "@oraichain/oraidex-contracts-sdk";
import { parseAssetInfoOnlyDenom } from "./helper";
import { pairs } from "./pairs";
import { ORAI } from "./constants";

function parseDenomToAssetLiquidity([fromDenom, toDenom]: [string, string]): [AssetInfo, AssetInfo] {
  const findedPair = pairs.find((pair) => {
    const denoms = [parseAssetInfoOnlyDenom(pair.asset_infos[0]), parseAssetInfoOnlyDenom(pair.asset_infos[1])];
    return denoms.includes(fromDenom) && denoms.includes(toDenom);
  });
  if (!findedPair) return null;

  return findedPair.asset_infos;
}

/**
 * Check pool:
 * if pool has native_token ORAI -> dont has fee
 * else if pool has native_token not ORAI -> has fee
 * otherwise it has 2 cw20 token -> dont has fee
 * @param [fromDenom, toDenom]: denom in a pool
 * @returns is pool has fee: boolean
 */
function isPoolHasFee(assetInfos: [AssetInfo, AssetInfo]): boolean {
  let hasNative = false;
  for (const asset of assetInfos) {
    if ("native_token" in asset) {
      hasNative = true;
      if (asset.native_token.denom === "orai") {
        return false;
      }
    }
  }
  if (hasNative) return true;
  return false;
}

export { parseDenomToAssetLiquidity, isPoolHasFee };
