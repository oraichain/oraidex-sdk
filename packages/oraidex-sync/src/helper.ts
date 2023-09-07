import {
  AssetInfo,
  CosmWasmClient,
  OraiswapPairQueryClient,
  OraiswapPairTypes,
  SwapOperation
} from "@oraichain/oraidex-contracts-sdk";
import { PoolResponse } from "@oraichain/oraidex-contracts-sdk/build/OraiswapPair.types";
import { isEqual, maxBy, minBy } from "lodash";
import { ORAI, atomic, tenAmountInDecimalSix, truncDecimals, usdtCw20Address } from "./constants";
import { DuckDb } from "./db";
import { pairs, pairsOnlyDenom } from "./pairs";
import { getPriceAssetByUsdt } from "./pool-helper";
import {
  Ohlcv,
  OraiDexType,
  PairInfoData,
  PoolInfo,
  ProvideLiquidityOperationData,
  SwapDirection,
  SwapOperationData,
  WithdrawLiquidityOperationData
} from "./types";

export function toObject(data: any) {
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
  txheight: number;
}): string {
  return `${data.txheight}-${data.firstDenom}-${data.firstAmount}-${data.secondDenom}-${data.secondAmount}`;
}

export function concatOhlcvToUniqueKey(data: { timestamp: number; pair: string; volume: bigint }): string {
  return `${data.timestamp}-${data.pair}-${data.volume.toString()}`;
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

function calculatePriceByPool(
  offerPool: bigint,
  askPool: bigint,
  commissionRate?: number,
  offerAmount?: number
): number {
  const finalOfferAmount = offerAmount || tenAmountInDecimalSix;
  let bigIntAmount =
    Number(offerPool - (askPool * offerPool) / (askPool + BigInt(finalOfferAmount))) * (1 - commissionRate || 0);

  return bigIntAmount / finalOfferAmount;
}

export function groupDataByTime(data: any[], timeframe?: number): { [key: string]: any[] } {
  let ops: { [k: number]: any[] } = {};
  for (const op of data) {
    const roundedTime = roundTime(op.timestamp * 1000, timeframe || 60); // op timestamp is sec
    if (!ops[roundedTime]) {
      ops[roundedTime] = [];
    }
    const newData: OraiDexType = {
      ...op,
      timestamp: roundedTime
    };
    ops[roundedTime].push(newData);
  }

  return ops;
}

export function groupByTime(data: any[], timeframe?: number): any[] {
  return Object.values(groupDataByTime(data, timeframe)).flat();
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
  if (pairs.find((pair) => JSON.stringify(pair.asset_infos) === JSON.stringify(assetInfos))) return false;
  return true;
}

/**
 * This function will accumulate the lp amount and modify the parameter
 * @param data - lp ops. This param will be mutated.
 * @param poolInfos - pool info data for initial lp accumulation
 */
// TODO: write test cases for this function
export async function collectAccumulateLpData(
  data: ProvideLiquidityOperationData[] | WithdrawLiquidityOperationData[],
  poolInfos: PoolResponse[],
  pairInfos: PairInfoData[]
) {
  let accumulateData: {
    [key: string]: {
      baseTokenAmount: bigint;
      quoteTokenAmount: bigint;
    };
  } = {};
  const duckDb = DuckDb.instances;
  for (let op of data) {
    const pool = poolInfos.find(
      (info) =>
        info.assets.some((assetInfo) => parseAssetInfoOnlyDenom(assetInfo.info) === op.baseTokenDenom) &&
        info.assets.some((assetInfo) => parseAssetInfoOnlyDenom(assetInfo.info) === op.quoteTokenDenom)
    );
    if (!pool) continue;

    let baseAmount = BigInt(op.baseTokenAmount);
    let quoteAmount = BigInt(op.quoteTokenAmount);
    if (op.opType === "withdraw") {
      // reverse sign since withdraw means lp decreases
      baseAmount = -BigInt(op.baseTokenAmount);
      quoteAmount = -BigInt(op.quoteTokenAmount);
    }

    let assetInfos = pool.assets.map((asset) => asset.info) as [AssetInfo, AssetInfo];
    if (isAssetInfoPairReverse(assetInfos)) assetInfos.reverse();
    const pairInfo = await duckDb.getPoolByAssetInfos(assetInfos);
    const { pairAddr } = pairInfo;
    if (!accumulateData[pairAddr]) {
      const initialFirstTokenAmount = parseInt(
        pool.assets.find((asset) => parseAssetInfoOnlyDenom(asset.info) === op.baseTokenDenom).amount
      );
      const initialSecondTokenAmount = parseInt(
        pool.assets.find((asset) => parseAssetInfoOnlyDenom(asset.info) === op.quoteTokenDenom).amount
      );
      accumulateData[pairAddr] = {
        baseTokenAmount: BigInt(initialFirstTokenAmount) + baseAmount,
        quoteTokenAmount: BigInt(initialSecondTokenAmount) + quoteAmount
      };
      op.baseTokenReserve = accumulateData[pairAddr].baseTokenAmount;
      op.quoteTokenReserve = accumulateData[pairAddr].quoteTokenAmount;
    } else {
      accumulateData[pairAddr].baseTokenAmount += baseAmount;
      accumulateData[pairAddr].quoteTokenAmount += quoteAmount;
      op.baseTokenReserve = accumulateData[pairAddr].baseTokenAmount;
      op.quoteTokenReserve = accumulateData[pairAddr].quoteTokenAmount;
    }
  }

  // update new offer, ask pool amount to pair_infos
  await Promise.all(
    pairInfos
      .map(({ pairAddr }) => {
        if (accumulateData[pairAddr]) {
          return duckDb.updatePairInfoAmount(
            accumulateData[pairAddr].baseTokenAmount,
            accumulateData[pairAddr].quoteTokenAmount,
            pairAddr
          );
        }
      })
      .filter(Boolean)
  );
}

/**
 * This function will accumulate the lp amount and modify the parameter
 * @param data - swap ops. This param will be mutated.
 * @param poolInfos - pool info data for initial lp accumulation
 */
export async function collectAccumulateSwapData(
  data: SwapOperationData[],
  poolInfos: PoolResponse[],
  pairInfos: PairInfoData[]
) {
  let accumulateData: {
    [key: string]: {
      baseTokenAmount: bigint;
      quoteTokenAmount: bigint;
    };
  } = {};
  const duckDb = DuckDb.instances;

  for (let op of data) {
    const pool = poolInfos.find(
      (info) =>
        info.assets.some((assetInfo) => parseAssetInfoOnlyDenom(assetInfo.info) === op.offerDenom) &&
        info.assets.some((assetInfo) => parseAssetInfoOnlyDenom(assetInfo.info) === op.askDenom)
    );
    if (!pool) continue;

    let baseAmount = BigInt(op.offerAmount);
    let quoteAmount = -BigInt(op.returnAmount);
    if (op.direction === "Sell") {
      // reverse sign since sell means lp base decrease, quote increase
      baseAmount = -BigInt(op.offerAmount);
      quoteAmount = BigInt(op.returnAmount);
    }

    let assetInfos = pool.assets.map((asset) => asset.info) as [AssetInfo, AssetInfo];
    if (isAssetInfoPairReverse(assetInfos)) assetInfos.reverse();
    const pairInfo = await duckDb.getPoolByAssetInfos(assetInfos);
    const { pairAddr } = pairInfo;
    if (!accumulateData[pairAddr]) {
      let initialFirstTokenAmount = parseInt(
        pool.assets.find((asset) => parseAssetInfoOnlyDenom(asset.info) === op.offerDenom).amount
      );
      let initialSecondTokenAmount = parseInt(
        pool.assets.find((asset) => parseAssetInfoOnlyDenom(asset.info) === op.askDenom).amount
      );
      if (op.direction === "Buy") {
        [initialFirstTokenAmount, initialSecondTokenAmount] = [initialSecondTokenAmount, initialFirstTokenAmount];
      }
      accumulateData[pairAddr] = {
        baseTokenAmount: BigInt(initialFirstTokenAmount) + baseAmount,
        quoteTokenAmount: BigInt(initialSecondTokenAmount) + quoteAmount
      };
    } else {
      accumulateData[pairAddr].baseTokenAmount += baseAmount;
      accumulateData[pairAddr].quoteTokenAmount += quoteAmount;
    }
  }
  // update new offer, ask pool amount to pair_infos
  await Promise.all(
    pairInfos
      .map(({ pairAddr }) => {
        if (accumulateData[pairAddr]) {
          return duckDb.updatePairInfoAmount(
            accumulateData[pairAddr].baseTokenAmount,
            accumulateData[pairAddr].quoteTokenAmount,
            pairAddr
          );
        }
      })
      .filter(Boolean)
  );
}

export function removeOpsDuplication(ops: OraiDexType[]): OraiDexType[] {
  let newOps: OraiDexType[] = [];
  for (let op of ops) {
    if (!newOps.some((newOp) => newOp.uniqueKey === op.uniqueKey)) newOps.push(op);
  }
  return newOps;
}

/**
 *  Group swapOps have same pair.
 * @param swapOps
 * @returns
 */
export function groupSwapOpsByPair(ops: SwapOperationData[]): { [key: string]: SwapOperationData[] } {
  let opsByPair = {};
  for (const op of ops) {
    const pairIndex = findPairIndexFromDenoms(op.offerDenom, op.askDenom);
    if (pairIndex === -1) continue;
    const assetInfos = pairsOnlyDenom[pairIndex].asset_infos;
    const pair = `${assetInfos[0]}-${assetInfos[1]}`;
    if (!opsByPair[pair]) {
      opsByPair[pair] = [];
    }
    opsByPair[pair].push(op);
  }
  return opsByPair;
}

export function calculateSwapOhlcv(ops: SwapOperationData[], pair: string): Ohlcv {
  const timestamp = ops[0].timestamp;
  const prices = ops.map((op) => calculateBasePriceFromSwapOp(op));
  const open = prices[0];
  const close = prices[ops.length - 1];
  const low = minBy(prices);
  const high = maxBy(prices);
  // base volume
  const volume = ops.reduce((acc, currentValue) => {
    const baseVolume =
      currentValue.direction === "Buy" ? BigInt(currentValue.returnAmount) : BigInt(currentValue.offerAmount);
    return acc + baseVolume;
  }, 0n);

  return {
    uniqueKey: concatOhlcvToUniqueKey({ timestamp, pair, volume }),
    timestamp,
    pair,
    volume,
    open,
    close,
    low,
    high
  };
}

export function buildOhlcv(ops: SwapOperationData[]): Ohlcv[] {
  let ohlcv: Ohlcv[] = [];
  for (const [pair, opsByPair] of Object.entries(groupSwapOpsByPair(ops))) {
    const opsByTime = groupDataByTime(opsByPair);
    const ticks = Object.values(opsByTime).map((value) => calculateSwapOhlcv(value, pair));
    ohlcv.push(...ticks);
  }
  return ohlcv;
}

export function calculateBasePriceFromSwapOp(op: SwapOperationData): number {
  if (!op || !op.offerAmount || !op.returnAmount) {
    return 0;
  }
  const offerAmount = op.offerAmount;
  const askAmount = op.returnAmount;
  return op.direction === "Buy" ? Number(offerAmount) / Number(askAmount) : Number(askAmount) / Number(offerAmount);
}

export function getSwapDirection(offerDenom: string, askDenom: string): SwapDirection {
  const pair = pairsOnlyDenom.find((pair) => {
    return pair.asset_infos.some((info) => info === offerDenom) && pair.asset_infos.some((info) => info === askDenom);
  });
  if (!pair) {
    console.error("Cannot find asset infos in list of pairs");
    return;
  }
  const assetInfos = pair.asset_infos;
  // use quote denom as offer then its buy. Quote denom in pairs is the 2nd index in the array
  if (assetInfos[0] === askDenom) return "Buy";
  return "Sell";
}

export function findPairIndexFromDenoms(offerDenom: string, askDenom: string): number {
  return pairsOnlyDenom.findIndex(
    (pair) => pair.asset_infos.some((info) => info === offerDenom) && pair.asset_infos.some((info) => info === askDenom)
  );
}

function getSymbolFromAsset(asset_infos: [AssetInfo, AssetInfo]): string {
  const findedPair = pairs.find(
    (p) =>
      JSON.stringify(p.asset_infos) === JSON.stringify(asset_infos) ||
      JSON.stringify(p.asset_infos) === JSON.stringify(asset_infos.reverse())
  );
  if (!findedPair) {
    throw new Error(`cannot found pair with asset_infos: ${JSON.stringify(asset_infos)}`);
  }
  return findedPair.symbols.join("/");
}

async function getCosmwasmClient(): Promise<CosmWasmClient> {
  const rpcUrl = process.env.RPC_URL || "http://35.237.59.125:26657";
  const client = await CosmWasmClient.connect(rpcUrl);
  return client;
}

function parsePoolAmount(poolInfo: OraiswapPairTypes.PoolResponse, trueAsset: AssetInfo): bigint {
  return BigInt(poolInfo.assets.find((asset) => isEqual(asset.info, trueAsset))?.amount || "0");
}

async function fetchPoolInfoAmount(fromInfo: AssetInfo, toInfo: AssetInfo, pairAddr: string): Promise<PoolInfo> {
  const client = await getCosmwasmClient();
  const pairContract = new OraiswapPairQueryClient(client, pairAddr);
  const poolInfo = await pairContract.pool();
  const offerPoolAmount = parsePoolAmount(poolInfo, fromInfo);
  const askPoolAmount = parsePoolAmount(poolInfo, toInfo);
  return { offerPoolAmount, askPoolAmount };
}

// get liquidity of pair from assetInfos
async function getPairLiquidity(assetInfos: [AssetInfo, AssetInfo]): Promise<number> {
  const duckDb = DuckDb.instances;
  // get info of pool in pair_infos, ask & offer are accumulated in sync process (via swap ops and lp ops).
  const poolInfo = await duckDb.getPoolByAssetInfos(assetInfos);
  if (!poolInfo.askPoolAmount || !poolInfo.offerPoolAmount) return 0;
  const baseAssetInfo = assetInfos[0];
  const priceBaseAssetInUsdt = await getPriceAssetByUsdt(baseAssetInfo);
  return priceBaseAssetInUsdt * Number(poolInfo.offerPoolAmount) * 2;
}

/**
 *
 * @param time
 * @param tf in seconds
 * @returns
 */
function getSpecificDateBeforeNow(time: Date, tf: number) {
  const timeInMs = tf * 1000;
  const dateBeforeNow = new Date(time.getTime() - timeInMs);
  return dateBeforeNow;
}

function convertDateToSecond(date: Date): number {
  return Math.round(date.valueOf() / 1000);
}

// <===== start get volume pairs =====
async function getVolumePairByAsset(
  [baseDenom, quoteDenom]: [string, string],
  startTime: Date,
  endTime: Date
): Promise<bigint> {
  const duckDb = DuckDb.instances;
  const pair = `${baseDenom}-${quoteDenom}`;
  const [volumeSwapPairInBaseAsset, volumeLiquidityPairInBaseAsset] = await Promise.all([
    duckDb.getVolumeSwap({
      pair,
      startTime: convertDateToSecond(startTime),
      endTime: convertDateToSecond(endTime)
    }),
    duckDb.getVolumeLiquidity({
      offerDenom: baseDenom,
      askDenom: quoteDenom,
      startTime: convertDateToSecond(startTime),
      endTime: convertDateToSecond(endTime)
    })
  ]);
  return volumeSwapPairInBaseAsset + volumeLiquidityPairInBaseAsset;
}

async function getVolumePairByUsdt(
  [baseAssetInfo, quoteAssetInfo]: [AssetInfo, AssetInfo],
  startTime: Date,
  endTime: Date
): Promise<bigint> {
  const [baseDenom, quoteDenom] = [parseAssetInfoOnlyDenom(baseAssetInfo), parseAssetInfoOnlyDenom(quoteAssetInfo)];
  const volumePairInBaseAsset = await getVolumePairByAsset([baseDenom, quoteDenom], startTime, endTime);
  const priceBaseAssetInUsdt = await getPriceAssetByUsdt(baseAssetInfo);
  const volumeInUsdt = priceBaseAssetInUsdt * Number(volumePairInBaseAsset);
  return BigInt(Math.round(volumeInUsdt));
}

async function getAllVolume24h(): Promise<bigint[]> {
  const tf = 24 * 60 * 60; // second of 24h
  const currentDate = new Date();
  const oneDayBeforeNow = getSpecificDateBeforeNow(new Date(), tf);
  const allVolumes = await Promise.all(
    pairs.map((pair) => getVolumePairByUsdt(pair.asset_infos, oneDayBeforeNow, currentDate))
  );
  return allVolumes;
}
// ===== end get volume pairs =====>

//  <==== start get fee pair ====
async function getFeePair(asset_infos: [AssetInfo, AssetInfo], startTime: Date, endTime: Date): Promise<bigint> {
  const duckDb = DuckDb.instances;
  const [swapFee, liquidityFee] = await Promise.all([
    duckDb.getFeeSwap({
      offerDenom: parseAssetInfoOnlyDenom(asset_infos[0]),
      askDenom: parseAssetInfoOnlyDenom(asset_infos[1]),
      startTime: convertDateToSecond(startTime),
      endTime: convertDateToSecond(endTime)
    }),
    duckDb.getFeeLiquidity({
      offerDenom: parseAssetInfoOnlyDenom(asset_infos[0]),
      askDenom: parseAssetInfoOnlyDenom(asset_infos[1]),
      startTime: convertDateToSecond(startTime),
      endTime: convertDateToSecond(endTime)
    })
  ]);
  return swapFee + liquidityFee;
}

async function getAllFees(): Promise<bigint[]> {
  const tf = 7 * 24 * 60 * 60; // second of 7 days
  const currentDate = new Date();
  const oneWeekBeforeNow = getSpecificDateBeforeNow(new Date(), tf);
  const allFees = await Promise.all(pairs.map((pair) => getFeePair(pair.asset_infos, oneWeekBeforeNow, currentDate)));
  return allFees;
}
//  ==== end get fee pair ====>

export {
  calculatePriceByPool,
  convertDateToSecond,
  delay,
  fetchPoolInfoAmount,
  findAssetInfoPathToUsdt,
  findMappedTargetedAssetInfo,
  findPairAddress,
  generateSwapOperations,
  getAllFees,
  getAllVolume24h,
  getCosmwasmClient,
  getFeePair,
  getPairLiquidity,
  getSpecificDateBeforeNow,
  getSymbolFromAsset,
  getVolumePairByAsset,
  getVolumePairByUsdt,
  parseAssetInfo,
  parseAssetInfoOnlyDenom
};
