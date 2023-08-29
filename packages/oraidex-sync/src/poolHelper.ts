import { MulticallQueryClient } from "@oraichain/common-contracts-sdk";
import {
  Asset,
  AssetInfo,
  OraiswapFactoryQueryClient,
  OraiswapPairQueryClient,
  OraiswapStakingTypes,
  PairInfo
} from "@oraichain/oraidex-contracts-sdk";
import { PoolResponse } from "@oraichain/oraidex-contracts-sdk/build/OraiswapPair.types";
import { TokenInfoResponse } from "@oraichain/oraidex-contracts-sdk/build/OraiswapToken.types";
import { isEqual } from "lodash";
import { ORAI, ORAIXOCH_INFO, SEC_PER_YEAR, atomic, network, oraiInfo, usdtInfo } from "./constants";
import {
  calculatePriceByPool,
  fetchPoolInfoAmount,
  getCosmwasmClient,
  isAssetInfoPairReverse,
  parseAssetInfoOnlyDenom,
  validateNumber
} from "./helper";
import { pairs } from "./pairs";
import {
  fetchAllRewardPerSecInfos,
  fetchAllTokenAssetPools,
  fetchTokenInfos,
  queryAllPairInfos,
  queryPoolInfos
} from "./query";
import { PairInfoData, PairMapping } from "./types";
import { OraiDexSync, DuckDb } from "./index";

// use this type to determine the ratio of price of base to the quote or vice versa
export type RatioDirection = "base_in_quote" | "quote_in_base";

/**
 * Check pool if has native token is not ORAI -> has fee
 * @returns boolean
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

async function getPoolInfos(pairAddrs: string[], wantedHeight?: number): Promise<PoolResponse[]> {
  // adjust the query height to get data from the past
  const cosmwasmClient = await getCosmwasmClient();
  cosmwasmClient.setQueryClientWithHeight(wantedHeight);
  const multicall = new MulticallQueryClient(cosmwasmClient, network.multicall);
  const res = await queryPoolInfos(pairAddrs, multicall);
  return res;
}

function getPairByAssetInfos(assetInfos: [AssetInfo, AssetInfo]): PairMapping {
  return pairs.find((pair) => {
    const [baseAsset, quoteAsset] = pair.asset_infos;
    const denoms = [parseAssetInfoOnlyDenom(baseAsset), parseAssetInfoOnlyDenom(quoteAsset)];
    return (
      denoms.includes(parseAssetInfoOnlyDenom(assetInfos[0])) && denoms.includes(parseAssetInfoOnlyDenom(assetInfos[1]))
    );
  });
}

// get price ORAI in USDT base on ORAI/USDT pool.
async function getOraiPrice(): Promise<number> {
  const oraiUsdtPair = getPairByAssetInfos([oraiInfo, usdtInfo]);
  const ratioDirection: RatioDirection =
    parseAssetInfoOnlyDenom(oraiUsdtPair.asset_infos[0]) === ORAI ? "base_in_quote" : "quote_in_base";
  return getPriceByAsset([oraiInfo, usdtInfo], ratioDirection);
}

async function getPriceByAsset(assetInfos: [AssetInfo, AssetInfo], ratioDirection: RatioDirection): Promise<number> {
  const duckDb: DuckDb = OraiDexSync.getDuckDbInstance();
  const poolInfo = await duckDb.getPoolByAssetInfos(assetInfos);
  if (!poolInfo) throw new Error(`Cannot found pool info: ${JSON.stringify(assetInfos)}`);

  // get info of last tx in lp_ops_data, if not have data => get info from contract
  let poolAmounts =
    (await duckDb.getPoolAmountFromAssetInfos(assetInfos)) ??
    (await fetchPoolInfoAmount(...assetInfos, poolInfo.pairAddr));
  if (!poolAmounts) throw new Error(` Cannot found pool amount: ${JSON.stringify(assetInfos)}`);

  // offer: orai, ask: usdt -> price offer in ask = calculatePriceByPool([ask, offer])
  // offer: orai, ask: atom -> price ask in offer  = calculatePriceByPool([offer, ask])
  const basePrice = calculatePriceByPool(
    BigInt(poolAmounts.askPoolAmount),
    BigInt(poolAmounts.offerPoolAmount),
    +poolInfo.commissionRate
  );
  return ratioDirection === "base_in_quote" ? basePrice : 1 / basePrice;
}

// find pool match this asset with orai => calculate price this asset token in ORAI.
// then, calculate price of this asset token in USDT based on price ORAI in USDT.
async function getPriceAssetByUsdt(asset: AssetInfo): Promise<number> {
  if (parseAssetInfoOnlyDenom(asset) === parseAssetInfoOnlyDenom(usdtInfo)) return 1;
  if (parseAssetInfoOnlyDenom(asset) === parseAssetInfoOnlyDenom(oraiInfo)) return await getOraiPrice();

  const foundPair = getPairByAssetInfos([asset, oraiInfo]);
  if (!foundPair) return 0;

  const ratioDirection: RatioDirection =
    parseAssetInfoOnlyDenom(foundPair.asset_infos[0]) === ORAI ? "quote_in_base" : "base_in_quote";
  const priceInOrai = await getPriceByAsset(foundPair.asset_infos, ratioDirection);
  const priceOraiInUsdt = await getOraiPrice();
  return priceInOrai * priceOraiInUsdt;
}

async function calculateFeeByUsdt(fee: Asset): Promise<number> {
  if (!fee) return 0;
  const priceInUsdt = await getPriceAssetByUsdt(fee.info);
  return priceInUsdt * +fee.amount;
}

function calculateFeeByAsset(asset: Asset, shareRatio: number): Asset {
  const TAX_CAP = 10 ** 6;
  const TAX_RATE = 0.3;
  // just native_token not ORAI has fee
  if (!("native_token" in asset.info)) return null;
  const amount = +asset.amount;
  const refundAmount = amount * shareRatio;
  const fee = Math.min(refundAmount - (refundAmount * 1) / (TAX_RATE + 1), TAX_CAP);
  return {
    amount: fee.toString(),
    info: asset.info
  };
}

/**
 * First, calculate fee by offer asset & askAsset
 * then, calculate fee of those asset to ORAI
 * finally, convert this fee in ORAI to USDT.
 * @param pair
 * @param txHeight
 * @param withdrawnShare
 * @returns fee in USDT
 */
async function calculateLiquidityFee(pair: PairInfoData, txHeight: number, withdrawnShare: number): Promise<bigint> {
  const cosmwasmClient = await getCosmwasmClient();
  cosmwasmClient.setQueryClientWithHeight(txHeight);

  const pairContract = new OraiswapPairQueryClient(cosmwasmClient, pair.pairAddr);
  const poolInfo = await pairContract.pool();
  const totalShare = +poolInfo.total_share;
  const shareRatio = withdrawnShare / totalShare;

  const [feeByAssetFrom, feeByAssetTo] = [
    calculateFeeByAsset(poolInfo.assets[0], shareRatio),
    calculateFeeByAsset(poolInfo.assets[1], shareRatio)
  ];

  const feeByUsdt = (await calculateFeeByUsdt(feeByAssetFrom)) + (await calculateFeeByUsdt(feeByAssetTo));
  return BigInt(Math.round(feeByUsdt));
}

//  ==== calculate APR ====
export const calculateAprResult = async (
  pairs: PairMapping[],
  allLiquidities: number[],
  allTokenInfo: TokenInfoResponse[],
  allLpTokenAsset: OraiswapStakingTypes.PoolInfoResponse[],
  allRewardPerSec: OraiswapStakingTypes.RewardsPerSecResponse[]
): Promise<number[]> => {
  let aprResult = [];
  let ind = 0;
  for (const _pair of pairs) {
    const liquidityAmount = allLiquidities[ind] * Math.pow(10, -6);
    const lpToken = allLpTokenAsset[ind];
    const tokenSupply = allTokenInfo[ind];
    const rewardsPerSecData = allRewardPerSec[ind];
    if (!lpToken || !tokenSupply || !rewardsPerSecData) continue;

    const bondValue =
      (validateNumber(lpToken.total_bond_amount) * liquidityAmount) / validateNumber(tokenSupply.total_supply);

    let rewardsPerYearValue = 0;
    for (const { amount, info } of rewardsPerSecData.assets) {
      // NOTE: current hardcode price token xOCH: $0.4
      const priceAssetInUsdt = isEqual(info, ORAIXOCH_INFO) ? 0.4 : await getPriceAssetByUsdt(info);
      rewardsPerYearValue += (SEC_PER_YEAR * validateNumber(amount) * priceAssetInUsdt) / atomic;
    }
    aprResult[ind] = (100 * rewardsPerYearValue) / bondValue || 0;
    ind += 1;
  }
  return aprResult;
};

function getStakingAssetInfo(assetInfos: AssetInfo[]): AssetInfo {
  if (isAssetInfoPairReverse(assetInfos)) assetInfos.reverse();
  return parseAssetInfoOnlyDenom(assetInfos[0]) === ORAI ? assetInfos[1] : assetInfos[0];
}

// Fetch APR
const fetchAprResult = async (pairInfos: PairInfoData[], allLiquidities: number[]): Promise<number[]> => {
  const assetTokens = pairInfos.map((pair) =>
    getStakingAssetInfo([JSON.parse(pair.firstAssetInfo), JSON.parse(pair.secondAssetInfo)])
  );
  try {
    const [allTokenInfo, allLpTokenAsset, allRewardPerSec] = await Promise.all([
      fetchTokenInfos(pairInfos),
      fetchAllTokenAssetPools(assetTokens),
      fetchAllRewardPerSecInfos(assetTokens)
    ]);
    return calculateAprResult(pairs, allLiquidities, allTokenInfo, allLpTokenAsset, allRewardPerSec);
  } catch (error) {
    console.log({ errorFetchAprResult: error });
  }
};

async function getAllPairInfos(): Promise<PairInfo[]> {
  const cosmwasmClient = await getCosmwasmClient();
  const firstFactoryClient = new OraiswapFactoryQueryClient(cosmwasmClient, network.factory);
  const secondFactoryClient = new OraiswapFactoryQueryClient(cosmwasmClient, network.factory_v2);
  return queryAllPairInfos(firstFactoryClient, secondFactoryClient);
}

export {
  calculateFeeByAsset,
  calculateLiquidityFee,
  fetchAprResult,
  getAllPairInfos,
  getOraiPrice,
  getPairByAssetInfos,
  getPoolInfos,
  getPriceAssetByUsdt,
  getPriceByAsset,
  isPoolHasFee,
  getStakingAssetInfo
};
