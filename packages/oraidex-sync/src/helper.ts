import { Asset, AssetInfo, OraiswapRouterReadOnlyInterface, SwapOperation } from "@oraichain/oraidex-contracts-sdk";
import { parseAssetInfo, parseAssetInfoOnlyDenom } from "./tx-parsing";
import { pairs } from "./pairs";
import { ORAI, usdtCw20Address } from "./constants";
import { PairMapping, PrefixSumHandlingData } from "./types";

function calculatePrefixSum(initialAmount: number, handlingData: PrefixSumHandlingData[]): PrefixSumHandlingData[] {
  let prefixSumObj = {};
  for (let data of handlingData) {
    if (!(`temp-${data.denom}` in prefixSumObj)) {
      prefixSumObj[`temp-${data.denom}`] = initialAmount + data.amount;
      data.amount = prefixSumObj[`temp-${data.denom}`];
      continue;
    }
    prefixSumObj[`temp-${data.denom}`] += data.amount;
    data.amount = prefixSumObj[`temp-${data.denom}`];
  }
  console.log("new results: ", handlingData);
  return handlingData;
}

function findMappedTargetedAssetInfo(targetedAssetInfo: AssetInfo): AssetInfo[] {
  const mappedAssetInfos = [];

  for (const pair of pairs) {
    const infos = pair.asset_infos;
    if (parseAssetInfo(infos[0]) === parseAssetInfo(targetedAssetInfo)) mappedAssetInfos.push(infos[1]);
    else if (parseAssetInfo(infos[1]) === parseAssetInfo(targetedAssetInfo)) mappedAssetInfos.push(infos[0]);
    else continue;
  }

  return mappedAssetInfos;
}

function findAssetInfoPathToUsdt(info: AssetInfo): AssetInfo[] {
  // first, check usdt mapped target infos because if we the info pairs with usdt directly then we can easily calculate its price
  // otherwise, we find orai mapped target infos, which can lead to usdt.
  // finally, if not paired with orai, then we find recusirvely to find a path leading to usdt token
  const usdtInfo = { token: { contract_addr: usdtCw20Address } };
  const oraiInfo = { native_token: { denom: ORAI } };
  if (parseAssetInfo(info) === parseAssetInfo(usdtInfo)) return [info]; // means there's no path, the price should be 1
  const mappedUsdtInfoList = findMappedTargetedAssetInfo(usdtInfo);
  if (mappedUsdtInfoList.find((assetInfo) => parseAssetInfo(assetInfo) === parseAssetInfo(info)))
    return [info, usdtInfo];
  const mappedOraiInfoList = findMappedTargetedAssetInfo(oraiInfo);
  if (mappedOraiInfoList.find((assetInfo) => parseAssetInfo(assetInfo) === parseAssetInfo(info)))
    return [info, oraiInfo, usdtInfo];
  const pairedInfo = findMappedTargetedAssetInfo(info);
  if (pairedInfo.length === 0) return []; // cannot find any mapped target pair
  return [info, ...findAssetInfoPathToUsdt(pairedInfo[0])]; // only need the first found paired token with the one we are matching
}

function generateSwapOperations(info: AssetInfo): SwapOperation[] {
  const infoPath = findAssetInfoPathToUsdt(info);
  let swapOps: SwapOperation[] = [];
  for (let i = 0; i < infoPath.length - 1; i++) {
    swapOps.push({ orai_swap: { offer_asset_info: infoPath[i], ask_asset_info: infoPath[i + 1] } } as SwapOperation);
  }
  return swapOps;
}

function extractUniqueAndFlatten(data: PairMapping[]): AssetInfo[] {
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

export {
  calculatePrefixSum,
  findMappedTargetedAssetInfo,
  findAssetInfoPathToUsdt,
  generateSwapOperations,
  extractUniqueAndFlatten
};
