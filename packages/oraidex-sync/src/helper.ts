import { Asset, AssetInfo, OraiswapRouterReadOnlyInterface, SwapOperation } from "@oraichain/oraidex-contracts-sdk";
import { pairs } from "./pairs";
import { ORAI, atomic, tenAmountInDecimalSix, truncDecimals, usdcCw20Address, usdtCw20Address } from "./constants";
import { PairInfoData, PairMapping, PrefixSumHandlingData } from "./types";

export const validateNumber = (amount: number | string): number => {
  if (typeof amount === "string") return validateNumber(Number(amount));
  if (Number.isNaN(amount) || !Number.isFinite(amount)) return 0;
  return amount;
};

// decimals always >= 6
export const toAmount = (amount: number | string, decimals = 6): bigint => {
  const validatedAmount = validateNumber(amount);
  return BigInt(Math.trunc(validatedAmount * atomic)) * BigInt(10 ** (decimals - truncDecimals));
};

/**
 * Converts a fraction to its equivalent decimal value as a number.
 *
 * @param {bigint} numerator - The numerator of the fraction
 * @param {bigint} denominator - The denominator of the fraction
 * @return {number} - The decimal value equivalent to the input fraction, returned as a number.
 */
export const toDecimal = (numerator: bigint, denominator: bigint): number => {
  if (denominator === BigInt(0)) return 0;
  return toDisplay((numerator * BigInt(10 ** 6)) / denominator, 6);
};

/**
 * Convert the amount to be displayed on the user interface.
 *
 * @param {string|bigint} amount - The amount to be converted.
 * @param {number} sourceDecimals - The number of decimal places in the original `amount`.
 * @param {number} desDecimals - The number of decimal places in the `amount` after conversion.
 * @return {number} The value of `amount` after conversion.
 */
export const toDisplay = (amount: string | bigint, sourceDecimals = 6, desDecimals = 6): number => {
  if (!amount) return 0;
  // guarding conditions to prevent crashing
  const validatedAmount = typeof amount === "string" ? BigInt(amount || "0") : amount;
  const displayDecimals = Math.min(truncDecimals, desDecimals);
  const returnAmount = validatedAmount / BigInt(10 ** (sourceDecimals - displayDecimals));
  // save calculation by using cached atomic
  return Number(returnAmount) / (displayDecimals === truncDecimals ? atomic : 10 ** displayDecimals);
};

function parseAssetInfo(info: AssetInfo): string {
  // if ("native_token" in info) return info.native_token.denom;
  // return info.token.contract_addr;
  return JSON.stringify(info);
}

function parseAssetInfoOnlyDenom(info: AssetInfo): string {
  if ("native_token" in info) return info.native_token.denom;
  return info.token.contract_addr;
}

async function delay(timeout: number) {
  return new Promise((resolve) => setTimeout(resolve, timeout));
}

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

function generateSwapOperations(infoPath: AssetInfo[]): SwapOperation[] {
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
function findPairAddress(pairInfos: PairInfoData[], infos: [AssetInfo, AssetInfo]) {
  return pairInfos.find(
    (pairInfo) =>
      infos.some((info) => parseAssetInfo(info) === pairInfo.firstAssetInfo) &&
      infos.some((info) => parseAssetInfo(info) === pairInfo.secondAssetInfo)
  )?.pairAddr;
}

function calculatePriceByPool(offerPool: bigint, askPool: bigint, commissionRate: number): bigint {
  return (askPool - (offerPool * askPool) / (offerPool + BigInt(tenAmountInDecimalSix))) * BigInt(1 - commissionRate);
}

function findUsdOraiInPair(infos: [AssetInfo, AssetInfo]): { base: string; target: AssetInfo } {
  const firstInfo = parseAssetInfoOnlyDenom(infos[0]);
  const secondInfo = parseAssetInfoOnlyDenom(infos[1]);
  if (firstInfo === usdtCw20Address || firstInfo === usdcCw20Address) return { base: firstInfo, target: infos[1] };
  if (secondInfo === usdtCw20Address || secondInfo === usdcCw20Address) return { base: secondInfo, target: infos[0] };
  if (firstInfo === ORAI) return { base: firstInfo.toUpperCase(), target: infos[1] };
  if (secondInfo === ORAI) return { base: secondInfo.toUpperCase(), target: infos[0] };
  return { base: secondInfo, target: infos[0] }; // default we calculate the first info in the asset info list
}

export {
  calculatePrefixSum,
  findMappedTargetedAssetInfo,
  findAssetInfoPathToUsdt,
  generateSwapOperations,
  extractUniqueAndFlatten,
  parseAssetInfo,
  parseAssetInfoOnlyDenom,
  delay,
  findPairAddress,
  calculatePriceByPool,
  findUsdOraiInPair
};
