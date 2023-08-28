import {
  AssetInfo,
  CosmWasmClient,
  OraiswapFactoryQueryClient,
  OraiswapPairQueryClient,
  OraiswapPairTypes,
  PairInfo,
  SwapOperation
} from "@oraichain/oraidex-contracts-sdk";
import { PoolResponse } from "@oraichain/oraidex-contracts-sdk/build/OraiswapPair.types";
import { isEqual, maxBy, minBy } from "lodash";
import { ORAI, atomic, network, tenAmountInDecimalSix, truncDecimals, usdtCw20Address } from "./constants";
import { DuckDb } from "./db";
import { pairs, pairsOnlyDenom } from "./pairs";
import { getPairByAssetInfos, getPriceAssetByUsdt, getPriceByAsset } from "./poolHelper";
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
export function collectAccumulateLpData(
  data: ProvideLiquidityOperationData[] | WithdrawLiquidityOperationData[],
  poolInfos: PoolResponse[]
) {
  let accumulateData: {
    [key: string]: {
      baseTokenAmount: bigint;
      quoteTokenAmount: bigint;
    };
  } = {};
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
    const denom = `${op.baseTokenDenom}-${op.quoteTokenDenom}`;
    if (!accumulateData[denom]) {
      const initialFirstTokenAmount = parseInt(
        pool.assets.find((asset) => parseAssetInfoOnlyDenom(asset.info) === op.baseTokenDenom).amount
      );
      const initialSecondTokenAmount = parseInt(
        pool.assets.find((asset) => parseAssetInfoOnlyDenom(asset.info) === op.quoteTokenDenom).amount
      );
      accumulateData[denom] = {
        baseTokenAmount: BigInt(initialFirstTokenAmount) + baseAmount,
        quoteTokenAmount: BigInt(initialSecondTokenAmount) + quoteAmount
      };
      op.baseTokenReserve = accumulateData[denom].baseTokenAmount;
      op.quoteTokenReserve = accumulateData[denom].quoteTokenAmount;
      continue;
    }
    accumulateData[denom].baseTokenAmount += baseAmount;
    accumulateData[denom].quoteTokenAmount += quoteAmount;
    op.baseTokenReserve = accumulateData[denom].baseTokenAmount;
    op.quoteTokenReserve = accumulateData[denom].quoteTokenAmount;
  }
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
    // throw new Error("Cannot find asset infos in list of pairs");
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

async function getPairLiquidity(rawAssetInfos: [AssetInfo, AssetInfo], duckDb: DuckDb): Promise<number> {
  let assetInfos: [AssetInfo, AssetInfo] = JSON.parse(JSON.stringify(rawAssetInfos));
  if (isAssetInfoPairReverse(assetInfos)) {
    assetInfos = assetInfos.reverse() as [AssetInfo, AssetInfo];
  }
  const poolInfo = await duckDb.getPoolByAssetInfos(assetInfos);
  if (!poolInfo) throw new Error(`Cannot found pool info when get pair liquidity: ${JSON.stringify(assetInfos)}`);

  // get info of last tx in lp_ops_data, if not have data => get info from contract
  let poolAmounts =
    (await duckDb.getPoolAmountFromAssetInfos(assetInfos)) ??
    (await fetchPoolInfoAmount(...assetInfos, poolInfo.pairAddr));
  if (!poolAmounts) throw new Error(` Cannot found pool amount: ${JSON.stringify(assetInfos)}`);

  const priceBaseAssetInUsdt = await getPriceAssetByUsdt(assetInfos[0]);
  return priceBaseAssetInUsdt * Number(poolAmounts.offerPoolAmount) * 2;
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

async function getPairInfoFromAssets(
  assetInfos: [AssetInfo, AssetInfo]
): Promise<Pick<PairInfo, "contract_addr" | "commission_rate">> {
  const pair = getPairByAssetInfos(assetInfos);
  const factoryClient = new OraiswapFactoryQueryClient(
    await getCosmwasmClient(),
    pair.factoryV1 ? network.factory : network.factory_v2
  );
  const pairInfo = await factoryClient.pair({ assetInfos });
  return {
    contract_addr: pairInfo.contract_addr,
    commission_rate: pairInfo.commission_rate
  };
}

// ====== get volume pairs ======
async function getVolumePair(
  [baseAssetInfo, quoteAssetInfo]: [AssetInfo, AssetInfo],
  startTime: Date,
  endTime: Date,
  duckDb: DuckDb
): Promise<bigint> {
  const pair = `${parseAssetInfoOnlyDenom(baseAssetInfo)}-${parseAssetInfoOnlyDenom(quoteAssetInfo)}`;
  const [volumeSwapPairInBaseAsset, volumeLiquidityPairInBaseAsset] = await Promise.all([
    duckDb.getVolumeSwap({
      pair,
      startTime: convertDateToSecond(startTime),
      endTime: convertDateToSecond(endTime)
    }),
    duckDb.getVolumeLiquidity({
      offerDenom: parseAssetInfoOnlyDenom(baseAssetInfo),
      askDenom: parseAssetInfoOnlyDenom(quoteAssetInfo),
      startTime: convertDateToSecond(startTime),
      endTime: convertDateToSecond(endTime)
    })
  ]);
  let priceBaseAssetInUsdt = await getPriceAssetByUsdt(baseAssetInfo);

  // it means this asset not pair with ORAI
  // in our pairs, if base asset not pair with ORAI, surely quote asset will pair with ORAI
  if (priceBaseAssetInUsdt === 0) {
    const priceQuoteAssetInUsdt = await getPriceAssetByUsdt(quoteAssetInfo);
    const priceBaseInQuote = await getPriceByAsset([baseAssetInfo, quoteAssetInfo], "base_in_quote");
    priceBaseAssetInUsdt = priceBaseInQuote * priceQuoteAssetInUsdt;
  }
  const volumeInUsdt =
    priceBaseAssetInUsdt * (Number(volumeSwapPairInBaseAsset) + Number(volumeLiquidityPairInBaseAsset));
  return BigInt(Math.round(volumeInUsdt));
}

async function getAllVolume24h(duckDb: DuckDb): Promise<bigint[]> {
  console.time("getAllVolume24h");
  const tf = 24 * 60 * 60; // second of 24h
  const currentDate = new Date();
  const oneDayBeforeNow = getSpecificDateBeforeNow(new Date(), tf);
  const allVolumes = await Promise.all(
    pairs.map((pair) => getVolumePair(pair.asset_infos, oneDayBeforeNow, currentDate, duckDb))
  );
  console.timeEnd("getAllVolume24h");
  return allVolumes;
}

//  ==== get fee pair ====
async function getFeePair(
  asset_infos: [AssetInfo, AssetInfo],
  startTime: Date,
  endTime: Date,
  duckDb: DuckDb
): Promise<bigint> {
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

async function getAllFees(duckDb: DuckDb): Promise<bigint[]> {
  console.time("getAllFee");
  const tf = 7 * 24 * 60 * 60; // second of 7 days
  const currentDate = new Date();
  const oneWeekBeforeNow = getSpecificDateBeforeNow(new Date(), tf);
  const allFees = await Promise.all(
    pairs.map((pair) => getFeePair(pair.asset_infos, oneWeekBeforeNow, currentDate, duckDb))
  );
  console.timeEnd("getAllFee");
  return allFees;
}

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
  getPairInfoFromAssets,
  getPairLiquidity,
  getSpecificDateBeforeNow,
  getSymbolFromAsset,
  getVolumePair,
  parseAssetInfo,
  parseAssetInfoOnlyDenom
};
