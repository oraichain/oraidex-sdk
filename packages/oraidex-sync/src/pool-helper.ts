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
import { DuckDb } from "./index";

// use this type to determine the ratio of price of base to the quote or vice versa
export type RatioDirection = "base_in_quote" | "quote_in_base";

/**
 * Check pool if has native token is not ORAI -> has fee
 * @returns boolean
 */
export const isPoolHasFee = (assetInfos: [AssetInfo, AssetInfo]): boolean => {
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
};

export const getPoolInfos = async (pairAddrs: string[], wantedHeight?: number): Promise<PoolResponse[]> => {
  // adjust the query height to get data from the past
  const cosmwasmClient = await getCosmwasmClient();
  cosmwasmClient.setQueryClientWithHeight(wantedHeight);
  const multicall = new MulticallQueryClient(cosmwasmClient, network.multicall);
  const res = await queryPoolInfos(pairAddrs, multicall);
  return res;
};

export const getPairByAssetInfos = (assetInfos: [AssetInfo, AssetInfo]): PairMapping => {
  return pairs.find((pair) => {
    const [baseAsset, quoteAsset] = pair.asset_infos;
    const denoms = [parseAssetInfoOnlyDenom(baseAsset), parseAssetInfoOnlyDenom(quoteAsset)];
    return (
      denoms.includes(parseAssetInfoOnlyDenom(assetInfos[0])) && denoms.includes(parseAssetInfoOnlyDenom(assetInfos[1]))
    );
  });
};

// get price ORAI in USDT base on ORAI/USDT pool.
// async function getOraiPrice(): Promise<number> {
export const getOraiPrice = async (): Promise<number> => {
  const oraiUsdtPair = getPairByAssetInfos([oraiInfo, usdtInfo]);
  const ratioDirection: RatioDirection =
    parseAssetInfoOnlyDenom(oraiUsdtPair.asset_infos[0]) === ORAI ? "base_in_quote" : "quote_in_base";
  return getPriceByAsset([oraiInfo, usdtInfo], ratioDirection);
};

export const getPriceByAsset = async (
  assetInfos: [AssetInfo, AssetInfo],
  ratioDirection: RatioDirection
): Promise<number> => {
  const duckDb = DuckDb.instances;
  const poolInfo = await duckDb.getPoolByAssetInfos(assetInfos);
  if (!poolInfo) throw new Error(`Cannot found pool info: ${JSON.stringify(assetInfos)}`);

  // get info of latest tx in lp_ops_data table, if lp_ops_data not have data yet => get info from contract
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
};

/**
 * @param asset
 * asset is:
 * 1, usdt=1,
 * 2, orai=getOraiPrice,
 * 3, pair with usdt: getPriceByAsset,
 * 4, pair with orai: get price in orai * price orai in usdt,
 * 5, otherwise, pair with orai || usdt: find pair of input asset vs other asset that mapped with:
 *    5.1, orai (ex: scAtom -> scAtom/Atom -> Atom/orai -> step 4)
 *    5.2, usdt: this case does not occurs.
 * @returns price asset by USDT
 */
export const getPriceAssetByUsdt = async (asset: AssetInfo): Promise<number> => {
  if (parseAssetInfoOnlyDenom(asset) === parseAssetInfoOnlyDenom(usdtInfo)) return 1;
  if (parseAssetInfoOnlyDenom(asset) === parseAssetInfoOnlyDenom(oraiInfo)) return await getOraiPrice();
  let foundPair: PairMapping;

  // find pair map with usdt
  foundPair = getPairByAssetInfos([asset, usdtInfo]);
  if (foundPair) {
    // assume asset mapped with usdt should be base asset
    return await getPriceByAsset(foundPair.asset_infos, "base_in_quote");
  }

  // find pair map with orai
  let priceInOrai = 0;
  foundPair = getPairByAssetInfos([asset, oraiInfo]);
  if (foundPair) {
    const ratioDirection: RatioDirection =
      parseAssetInfoOnlyDenom(foundPair.asset_infos[0]) === ORAI ? "quote_in_base" : "base_in_quote";
    priceInOrai = await getPriceByAsset(foundPair.asset_infos, ratioDirection);
  } else {
    // case 5.1
    const pairWithAsset = pairs.find((pair) =>
      pair.asset_infos.some((info) => parseAssetInfoOnlyDenom(info) === parseAssetInfoOnlyDenom(asset))
    );
    const otherAssetIndex = pairWithAsset.asset_infos.findIndex(
      (item) => parseAssetInfoOnlyDenom(item) !== parseAssetInfoOnlyDenom(asset)
    );
    const priceAssetVsOtherAsset = await getPriceByAsset(
      pairWithAsset.asset_infos,
      otherAssetIndex === 1 ? "base_in_quote" : "quote_in_base"
    );
    const pairOtherAssetVsOrai = getPairByAssetInfos([pairWithAsset.asset_infos[otherAssetIndex], oraiInfo]);
    const ratioDirection: RatioDirection =
      parseAssetInfoOnlyDenom(pairOtherAssetVsOrai.asset_infos[0]) === ORAI ? "quote_in_base" : "base_in_quote";
    priceInOrai = priceAssetVsOtherAsset * (await getPriceByAsset(pairOtherAssetVsOrai.asset_infos, ratioDirection));
  }

  const priceOraiInUsdt = await getOraiPrice();
  return priceInOrai * priceOraiInUsdt;
};

export const convertFeeAssetToUsdt = async (fee: Asset | null): Promise<number> => {
  if (!fee) return 0;
  const priceInUsdt = await getPriceAssetByUsdt(fee.info);
  return priceInUsdt * +fee.amount;
};

export const calculateFeeByAsset = (asset: Asset, shareRatio: number): Asset => {
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
};

/**
 * First, calculate fee by offer asset & ask asset
 * then, calculate fee of those asset to ORAI
 * finally, convert this fee in ORAI to USDT.
 * @param pair
 * @param txHeight
 * @param withdrawnShare
 * @returns fee in USDT
 */
export const calculateLiquidityFee = async (
  pair: PairInfoData,
  txHeight: number,
  withdrawnShare: number
): Promise<bigint> => {
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

  const feeByUsdt = (await convertFeeAssetToUsdt(feeByAssetFrom)) + (await convertFeeAssetToUsdt(feeByAssetTo));
  return BigInt(Math.round(feeByUsdt));
};

//  <==== calculate APR ====
export const calculateAprResult = async (
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

export const getStakingAssetInfo = (assetInfos: AssetInfo[]): AssetInfo => {
  if (isAssetInfoPairReverse(assetInfos)) assetInfos.reverse();
  return parseAssetInfoOnlyDenom(assetInfos[0]) === ORAI ? assetInfos[1] : assetInfos[0];
};

export const fetchAprResult = async (pairInfos: PairInfoData[], allLiquidities: number[]): Promise<number[]> => {
  const assetTokens = pairInfos.map((pair) =>
    getStakingAssetInfo([JSON.parse(pair.firstAssetInfo), JSON.parse(pair.secondAssetInfo)])
  );
  try {
    const [allTokenInfo, allLpTokenAsset, allRewardPerSec] = await Promise.all([
      fetchTokenInfos(pairInfos),
      fetchAllTokenAssetPools(assetTokens),
      fetchAllRewardPerSecInfos(assetTokens)
    ]);
    return calculateAprResult(allLiquidities, allTokenInfo, allLpTokenAsset, allRewardPerSec);
  } catch (error) {
    console.log({ errorFetchAprResult: error });
  }
};
//  ==== end of calculate APR ====>

export const getAllPairInfos = async (): Promise<PairInfo[]> => {
  const cosmwasmClient = await getCosmwasmClient();
  const firstFactoryClient = new OraiswapFactoryQueryClient(cosmwasmClient, network.factory);
  const secondFactoryClient = new OraiswapFactoryQueryClient(cosmwasmClient, network.factory_v2);
  return queryAllPairInfos(firstFactoryClient, secondFactoryClient);
};
