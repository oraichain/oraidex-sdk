import { AssetInfo, SwapOperation } from "@oraichain/oraidex-contracts-sdk";
import { pairs } from "./pairs";
import { ORAI, atomic, tenAmountInDecimalSix, truncDecimals, usdtCw20Address } from "./constants";
import {
  OraiDexType,
  PairInfoData,
  PrefixSumHandlingData,
  ProvideLiquidityOperationData,
  SwapOperationData,
  WithdrawLiquidityOperationData
} from "./types";
import { PoolResponse } from "@oraichain/oraidex-contracts-sdk/build/OraiswapPair.types";

export function toObject(data: any[]) {
  return JSON.parse(
    JSON.stringify(
      data,
      (key, value) => (typeof value === "bigint" ? value.toString() : value) // return everything else unchanged
    )
  );
}

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

export function concatDataToUniqueKey(data: {
  firstDenom: string;
  secondDenom: string;
  firstAmount: number;
  secondAmount: number;
  timestamp: number;
}): string {
  return `${data.timestamp}-${data.firstDenom}-${data.firstAmount}-${data.secondDenom}-${data.secondAmount}`;
}

export function isoToTimestampNumber(time: string) {
  return Math.floor(new Date(time).getTime() / 1000);
}

export function renameKey(object: Object, oldKey: string, newKey: string): any {
  if (oldKey === newKey) return object;
  // Check if the old key exists in the object
  if (object.hasOwnProperty(oldKey)) {
    // Create the new key and assign the value from the old key
    object[newKey] = object[oldKey];
    // Delete the old key
    delete object[oldKey];
  }
  return object;
}

export function replaceAllNonAlphaBetChar(columnName: string): string {
  return columnName.replace(/[^a-zA-Z]/g, "a");
}

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

export function groupByTime(data: any[], timeframe?: number): any[] {
  let ops: { [k: number]: any[] } = {};
  for (const op of data) {
    const roundedTime = roundTime(op.timestamp * 1000, timeframe || 60);
    if (!ops[roundedTime]) {
      ops[roundedTime] = [];
    }
    const newData: OraiDexType = {
      ...op,
      timestamp: roundedTime
    };
    ops[roundedTime].push(newData);
  }

  return Object.values(ops).flat();
}

/**
 * round time when dividing & getting the integral part of the value
 * @param timeIn time to be divided in ms
 * @param timeframe the timeframe to split the time chunk. in seconds
 * @returns new time in seconds
 */
export function roundTime(timeIn: number, timeframe: number): number {
  const roundTo = timeframe * 1000;

  const dateOut = (Math.floor(timeIn / roundTo) * roundTo) / 1000; // getTime() returns data in ms
  return dateOut;
}

export function isAssetInfoPairReverse(assetInfos: AssetInfo[]): boolean {
  if (pairs.find((pair) => JSON.stringify(pair.asset_infos) === JSON.stringify(assetInfos.reverse()))) return true;
  return false;
}

/**
 * This function will accumulate the lp amount and modify the parameter
 * @param data - lp ops. This param will be mutated.
 * @param poolInfos - pool info data for initial lp accumulation
 */
export function collectAccumulateLpData(
  data: ProvideLiquidityOperationData[] | WithdrawLiquidityOperationData[],
  poolInfos: PoolResponse[]
) {
  let accumulateData = {};
  for (let op of data) {
    const pool = poolInfos.find(
      (info) =>
        info.assets.some((assetInfo) => parseAssetInfoOnlyDenom(assetInfo.info) === op.firstTokenDenom) &&
        info.assets.some((assetInfo) => parseAssetInfoOnlyDenom(assetInfo.info) === op.secondTokenDenom)
    );
    if (!pool) continue;
    if (op.opType === "withdraw") {
      op.firstTokenLp = BigInt(op.firstTokenLp) - BigInt(op.firstTokenLp) * 2n;
      op.secondTokenLp = BigInt(op.secondTokenLp) - BigInt(op.secondTokenLp) * 2n;
    }
    const denom = `${op.firstTokenDenom} - ${op.secondTokenDenom}`;
    if (!accumulateData[denom]) {
      const initialFirstTokenAmount = parseInt(
        pool.assets.find((info) => parseAssetInfoOnlyDenom(info.info) === op.firstTokenDenom).amount
      );
      const initialSecondTokenAmount = parseInt(
        pool.assets.find((info) => parseAssetInfoOnlyDenom(info.info) === op.secondTokenDenom).amount
      );
      accumulateData[denom] = {
        firstTokenAmount: BigInt(initialFirstTokenAmount) + BigInt(op.firstTokenLp),
        secondTokenAmount: BigInt(initialSecondTokenAmount) + BigInt(op.secondTokenLp)
      };
      op.firstTokenLp = accumulateData[denom].firstTokenAmount;
      op.secondTokenLp = accumulateData[denom].secondTokenAmount;
      continue;
    }
    accumulateData[denom].firstTokenAmount += BigInt(op.firstTokenLp);
    accumulateData[denom].secondTokenAmount += BigInt(op.secondTokenLp);
    op.firstTokenLp = accumulateData[denom].firstTokenAmount;
    op.secondTokenLp = accumulateData[denom].secondTokenAmount;
  }

  // convert bigint to number so we can store them into the db without error
}

export function removeOpsDuplication(ops: OraiDexType[]): OraiDexType[] {
  let newOps: OraiDexType[] = [];
  for (let op of ops) {
    if (!newOps.some((newOp) => newOp.uniqueKey === op.uniqueKey)) newOps.push(op);
  }
  return newOps;
}

// /**
//  *
//  * @param infos
//  * @returns
//  */
// function findUsdOraiInPair(infos: [AssetInfo, AssetInfo]): {
//   baseIndex: number;
//   targetIndex: number;
//   target: AssetInfo;
// } {
//   const firstInfo = parseAssetInfoOnlyDenom(infos[0]);
//   const secondInfo = parseAssetInfoOnlyDenom(infos[1]);
//   if (firstInfo === usdtCw20Address || firstInfo === usdcCw20Address)
//     return { baseIndex: 0, targetIndex: 1, target: infos[1] };
//   if (secondInfo === usdtCw20Address || secondInfo === usdcCw20Address)
//     return { baseIndex: 1, targetIndex: 0, target: infos[0] };
//   if (firstInfo === ORAI) return { baseIndex: 0, targetIndex: 1, target: infos[1] };
//   if (secondInfo === ORAI) return { baseIndex: 1, targetIndex: 0, target: infos[0] };
//   return { baseIndex: 1, targetIndex: 0, target: infos[0] }; // default we calculate the first info in the asset info list
// }

export {
  calculatePrefixSum,
  findMappedTargetedAssetInfo,
  findAssetInfoPathToUsdt,
  generateSwapOperations,
  parseAssetInfo,
  parseAssetInfoOnlyDenom,
  delay,
  findPairAddress,
  calculatePriceByPool
};
