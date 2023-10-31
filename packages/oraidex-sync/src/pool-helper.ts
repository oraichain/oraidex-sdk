import { MulticallQueryClient } from "@oraichain/common-contracts-sdk";
import { Tx } from "@oraichain/cosmos-rpc-sync";
import {
  Asset,
  AssetInfo,
  OraiswapFactoryQueryClient,
  OraiswapPairQueryClient,
  OraiswapStakingTypes,
  PairInfo
} from "@oraichain/oraidex-contracts-sdk";
import { PoolResponse } from "@oraichain/oraidex-contracts-sdk/build/OraiswapPair.types";
import { isEqual } from "lodash";
import { OCH_PRICE, ORAI, ORAIXOCH_INFO, SEC_PER_YEAR, atomic, network, oraiInfo, usdtInfo } from "./constants";
import { calculatePriceByPool, getCosmwasmClient, isAssetInfoPairReverse, validateNumber } from "./helper";
import {
  DuckDb,
  concatAprHistoryToUniqueKey,
  concatLpHistoryToUniqueKey,
  getPairLiquidity,
  recalculateTotalShare
} from "./index";
import { pairWithStakingAsset, pairs } from "./pairs";
import { parseAssetInfoOnlyDenom, parsePairDenomToAssetInfo } from "./parse";
import {
  fetchAllRewardPerSecInfos,
  fetchAllTokenAssetPools,
  fetchTokenInfos,
  queryAllPairInfos,
  queryPoolInfos
} from "./query";
import { processEventApr } from "./tx-parsing";
import {
  LpOpsData,
  PairInfoData,
  PairMapping,
  PoolAmountHistory,
  ProvideLiquidityOperationData,
  SwapOperationData,
  WithdrawLiquidityOperationData
} from "./types";
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

export const getPairByAssetInfos = ([baseAssetInfo, quoteAssetInfo]: [AssetInfo, AssetInfo]): PairMapping => {
  return pairs.find((pair) => {
    const [baseAsset, quoteAsset] = pair.asset_infos;
    const denoms = [parseAssetInfoOnlyDenom(baseAsset), parseAssetInfoOnlyDenom(quoteAsset)];
    return (
      denoms.some((denom) => denom === parseAssetInfoOnlyDenom(baseAssetInfo)) &&
      denoms.some((denom) => denom === parseAssetInfoOnlyDenom(quoteAssetInfo))
    );
  });
};

// get price ORAI in USDT base on ORAI/USDT pool.
export const getOraiPrice = async (timestamp?: number): Promise<number> => {
  const oraiUsdtPair = getPairByAssetInfos([oraiInfo, usdtInfo]);
  const ratioDirection: RatioDirection =
    parseAssetInfoOnlyDenom(oraiUsdtPair.asset_infos[0]) === ORAI ? "base_in_quote" : "quote_in_base";
  return getPriceByAsset([oraiInfo, usdtInfo], ratioDirection, timestamp);
};

/**
 * Get price of asset via askPoolAmount & offerPoolAmount in specific timestamp
 * @param assetInfos
 * @param ratioDirection
 * @param timestamp (optional) if it present, the price of asset will be calculated at this time.
 * @returns price of asset in specific time.
 */
export const getPriceByAsset = async (
  assetInfos: [AssetInfo, AssetInfo],
  ratioDirection: RatioDirection,
  timestamp?: number
): Promise<number> => {
  const duckDb = DuckDb.instances;
  const poolInfo = await duckDb.getPoolByAssetInfos(assetInfos);
  if (!poolInfo) return 0;

  let poolAmount: PoolAmountHistory;
  if (timestamp) {
    poolAmount = await duckDb.getLpAmountWithTime(poolInfo.pairAddr, timestamp);
  } else {
    poolAmount = await duckDb.getLatestLpPoolAmount(poolInfo.pairAddr);
  }
  if (!poolAmount || !poolAmount.askPoolAmount || !poolAmount.offerPoolAmount) return 0;
  // offer: orai, ask: usdt -> price offer in ask = calculatePriceByPool([ask, offer])
  // offer: orai, ask: atom -> price ask in offer  = calculatePriceByPool([offer, ask])
  const basePrice = calculatePriceByPool(
    BigInt(poolAmount.askPoolAmount),
    BigInt(poolAmount.offerPoolAmount),
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

export const getPoolTotalShare = async (txHeight: number, pairAddr: string): Promise<PoolResponse> => {
  const cosmwasmClient = await getCosmwasmClient();
  cosmwasmClient.setQueryClientWithHeight(txHeight);

  const pairContract = new OraiswapPairQueryClient(cosmwasmClient, pairAddr);
  const poolInfo = await pairContract.pool();
  return poolInfo;
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
  const poolInfo = await getPoolTotalShare(txHeight, pair.pairAddr);
  const shareRatio = withdrawnShare / +poolInfo.total_share;

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
  allTotalSupplies: string[],
  allBondAmounts: string[],
  allRewardPerSec: OraiswapStakingTypes.RewardsPerSecResponse[]
): Promise<number[]> => {
  let aprResult = [];
  let ind = 0;
  for (const _pair of pairs) {
    const liquidityAmount = allLiquidities[ind] * Math.pow(10, -6);
    const totalBondAmount = allBondAmounts[ind];
    const tokenSupply = allTotalSupplies[ind];
    const rewardsPerSecData = allRewardPerSec[ind];
    if (!totalBondAmount || !tokenSupply || !rewardsPerSecData) continue;

    const bondValue = (validateNumber(totalBondAmount) * liquidityAmount) / validateNumber(tokenSupply);

    let rewardsPerYearValue = 0;
    for (const { amount, info } of rewardsPerSecData.assets) {
      // NOTE: current hardcode price token xOCH
      const priceAssetInUsdt = isEqual(info, ORAIXOCH_INFO) ? OCH_PRICE : await getPriceAssetByUsdt(info);
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

export const fetchAprResult = async (pairInfos: PairInfoData[], allLiquidities: number[]) => {
  const assetTokens = pairInfos.map((pair) =>
    getStakingAssetInfo([JSON.parse(pair.firstAssetInfo), JSON.parse(pair.secondAssetInfo)])
  );
  const liquidityAddrs = pairInfos.map((pair) => pair.liquidityAddr);
  try {
    const [allTokenInfo, allLpTokenAsset, allRewardPerSec] = await Promise.all([
      fetchTokenInfos(liquidityAddrs),
      fetchAllTokenAssetPools(assetTokens),
      fetchAllRewardPerSecInfos(assetTokens)
    ]);
    const allTotalSupplies = allTokenInfo.map((info) => info.total_supply);
    const allBondAmounts = allLpTokenAsset.map((info) => info.total_bond_amount);
    const allAprs = await calculateAprResult(allLiquidities, allTotalSupplies, allBondAmounts, allRewardPerSec);
    return {
      allTotalSupplies,
      allBondAmounts,
      allRewardPerSec,
      allAprs
    };
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

export const triggerCalculateApr = async (assetInfos: [AssetInfo, AssetInfo][], newOffset: number) => {
  // get all infos relate to apr in duckdb from apr table -> call to calculateAprResult
  if (assetInfos.length === 0) return;
  const duckDb = DuckDb.instances;
  const pools = await Promise.all(assetInfos.map((infos) => duckDb.getPoolByAssetInfos(infos)));

  const allLiquidities = (await Promise.allSettled(pools.map((pair) => getPairLiquidity(pair)))).map((result) => {
    if (result.status === "fulfilled") return result.value;
    else console.error("error get allLiquidities: ", result.reason);
  });

  const poolAprInfos = await Promise.all(pools.map((pool) => duckDb.getLatestPoolApr(pool.pairAddr)));
  const allTotalSupplies = poolAprInfos.map((item) => item.totalSupply);
  const allBondAmounts = poolAprInfos.map((info) => info.totalBondAmount);
  const allRewardPerSecs = poolAprInfos.map((info) => (info.rewardPerSec ? JSON.parse(info.rewardPerSec) : null));

  const APRs = await calculateAprResult(allLiquidities, allTotalSupplies, allBondAmounts, allRewardPerSecs);
  const newPoolAprs = poolAprInfos.map((poolApr, index) => {
    return {
      ...poolApr,
      height: newOffset,
      apr: APRs[index],
      uniqueKey: concatAprHistoryToUniqueKey({
        timestamp: Date.now(),
        supply: allTotalSupplies[index],
        bond: allBondAmounts[index],
        reward: allRewardPerSecs[index],
        apr: APRs[index],
        pairAddr: pools[index].pairAddr
      })
    };
  });
  await duckDb.insertPoolAprs(newPoolAprs);
};

export type TypeInfoRelatedApr = "totalSupply" | "totalBondAmount" | "rewardPerSec";
export const refetchInfoApr = async (
  type: TypeInfoRelatedApr,
  assetInfos: [AssetInfo, AssetInfo][],
  height: number
) => {
  if (assetInfos.length === 0) return;
  const duckDb = DuckDb.instances;
  const pools = await Promise.all(assetInfos.map((assetInfo) => duckDb.getPoolByAssetInfos(assetInfo)));
  const stakingAssetInfo = pools.map((pair) =>
    getStakingAssetInfo([JSON.parse(pair.firstAssetInfo), JSON.parse(pair.secondAssetInfo)])
  );
  let newInfos;
  switch (type) {
    case "totalSupply": {
      newInfos = await refetchTotalSupplies(pools);
      break;
    }
    case "totalBondAmount": {
      newInfos = await refetchTotalBond(stakingAssetInfo);
      break;
    }
    case "rewardPerSec": {
      newInfos = await refetchRewardPerSecInfos(stakingAssetInfo);
      break;
    }
    default:
      break;
  }

  const latestPoolAprs = await Promise.all(pools.map((pool) => duckDb.getLatestPoolApr(pool.pairAddr)));
  const newPoolAprs = latestPoolAprs.map((poolApr, index) => {
    return {
      ...poolApr,
      height,
      [type]: newInfos[index]
    };
  });
  await duckDb.insertPoolAprs(newPoolAprs);
};

export const refetchTotalSupplies = async (pools: PairInfoData[]): Promise<string[]> => {
  const liquidityAddrs = pools.map((pair) => pair.liquidityAddr);
  const tokenInfos = await fetchTokenInfos(liquidityAddrs);
  const totalSupplies = tokenInfos.map((info) => info.total_supply);
  return totalSupplies;
};

export const refetchTotalBond = async (stakingAssetInfo: AssetInfo[]): Promise<string[]> => {
  const tokenAssetPools = await fetchAllTokenAssetPools(stakingAssetInfo);
  const totalBondAmounts = tokenAssetPools.map((info) => info.total_bond_amount);
  return totalBondAmounts;
};

export const refetchRewardPerSecInfos = async (stakingAssetInfo: AssetInfo[]) => {
  const rewardPerSecInfos = await fetchAllRewardPerSecInfos(stakingAssetInfo);
  return rewardPerSecInfos.map((item) => JSON.stringify(item));
};

export const getListAssetInfoShouldRefetchApr = async (txs: Tx[], lpOps: ProvideLiquidityOperationData[]) => {
  let listAssetInfosPoolShouldRefetch = new Set<[AssetInfo, AssetInfo]>();
  // mint/burn trigger update total supply
  const assetInfosTriggerTotalSupplies = Array.from(
    lpOps
      .map((op) => [op.baseTokenDenom, op.quoteTokenDenom] as [string, string])
      .reduce((accumulator, tokenDenoms) => {
        const assetInfo = parsePairDenomToAssetInfo(tokenDenoms);
        if (assetInfo) accumulator.add(assetInfo);
        return accumulator;
      }, new Set<[AssetInfo, AssetInfo]>())
  );
  assetInfosTriggerTotalSupplies.forEach((item) => listAssetInfosPoolShouldRefetch.add(item));

  const { infoTokenAssetPools, isTriggerRewardPerSec } = processEventApr(txs);
  // bond/unbond trigger refetch info token asset pools
  const assetInfosTriggerTotalBond = Array.from(infoTokenAssetPools)
    .map((stakingDenom) => {
      return pairWithStakingAsset.find((pair) => parseAssetInfoOnlyDenom(pair.stakingAssetInfo) === stakingDenom)
        ?.asset_infos;
    })
    .filter(Boolean);

  if (isTriggerRewardPerSec) {
    // update_reward_per_sec trigger refetch all info
    listAssetInfosPoolShouldRefetch.clear();
    pairs.map((pair) => pair.asset_infos).forEach((assetInfos) => listAssetInfosPoolShouldRefetch.add(assetInfos));
  } else {
    assetInfosTriggerTotalBond.forEach((assetInfo) => listAssetInfosPoolShouldRefetch.add(assetInfo));
  }

  return {
    assetInfosTriggerTotalSupplies,
    listAssetInfosPoolShouldRefetch: Array.from(listAssetInfosPoolShouldRefetch),
    assetInfosTriggerTotalBond,
    assetInfosTriggerRewardPerSec: isTriggerRewardPerSec ? Array.from(listAssetInfosPoolShouldRefetch) : []
  };
};

export const handleEventApr = async (
  txs: Tx[],
  result: ProvideLiquidityOperationData[],
  newOffset: number
): Promise<void> => {
  const {
    assetInfosTriggerTotalSupplies,
    listAssetInfosPoolShouldRefetch,
    assetInfosTriggerTotalBond,
    assetInfosTriggerRewardPerSec
  } = await getListAssetInfoShouldRefetchApr(txs, result);

  await Promise.allSettled([
    refetchInfoApr("totalSupply", assetInfosTriggerTotalSupplies, newOffset),
    refetchInfoApr("rewardPerSec", assetInfosTriggerRewardPerSec, newOffset),
    refetchInfoApr("totalBondAmount", assetInfosTriggerTotalBond, newOffset)
  ]);

  await triggerCalculateApr(Array.from(listAssetInfosPoolShouldRefetch), newOffset);
};

/**
 * This function will accumulate the lp amount
 * @param data - lp ops & swap ops.
 * @param poolInfos - pool info data for initial lp accumulation
 * @param pairInfos - pool info data from db
 */
export const collectAccumulateLpAndSwapData = async (data: LpOpsData[], poolInfos: PoolResponse[]) => {
  let accumulateData: {
    [key: string]: Omit<PoolAmountHistory, "pairAddr" | "uniqueKey">;
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
    // with swap, when Buy, we add quoteAmount to pool, and remove baseAmount from pool, so we need to reverse sign
    // Example: Buy ORAI => offer is usdt, ask is orai
    if (op.opType === "withdraw" || op.direction === "Buy") {
      // reverse sign since withdraw means lp decreases
      baseAmount = -baseAmount;
      quoteAmount = -quoteAmount;
    }

    let assetInfos = pool.assets.map((asset) => asset.info) as [AssetInfo, AssetInfo];
    if (isAssetInfoPairReverse(assetInfos)) assetInfos.reverse();
    const pairInfo = await duckDb.getPoolByAssetInfos(assetInfos);
    if (!pairInfo) throw new Error("cannot find pair info when collectAccumulateLpAndSwapData");
    const { pairAddr } = pairInfo;

    if (!accumulateData[pairAddr]) {
      const initialFirstTokenAmount = parseInt(
        pool.assets.find((asset) => parseAssetInfoOnlyDenom(asset.info) === parseAssetInfoOnlyDenom(assetInfos[0]))
          .amount
      );
      const initialSecondTokenAmount = parseInt(
        pool.assets.find((asset) => parseAssetInfoOnlyDenom(asset.info) === parseAssetInfoOnlyDenom(assetInfos[1]))
          .amount
      );

      accumulateData[pairAddr] = {
        offerPoolAmount: BigInt(initialFirstTokenAmount) + baseAmount,
        askPoolAmount: BigInt(initialSecondTokenAmount) + quoteAmount,
        height: op.height,
        timestamp: op.timestamp,
        totalShare: "0"
      };
    } else {
      accumulateData[pairAddr].offerPoolAmount += baseAmount;
      accumulateData[pairAddr].askPoolAmount += quoteAmount;
      accumulateData[pairAddr].height = op.height;
      accumulateData[pairAddr].timestamp = op.timestamp;
    }
    // update total share
    let updatedTotalShare = pool.total_share;
    if (op.opType === "provide" || op.opType === "withdraw") {
      updatedTotalShare = recalculateTotalShare({
        totalShare: BigInt(pool.total_share),
        offerAmount: baseAmount,
        askAmount: quoteAmount,
        offerPooAmount: accumulateData[pairAddr].offerPoolAmount,
        askPooAmount: accumulateData[pairAddr].askPoolAmount,
        opType: op.opType
      }).toString();
    }
    accumulateData[pairAddr].totalShare = updatedTotalShare;
  }

  return accumulateData;
};

export const accumulatePoolAmount = async (
  lpData: ProvideLiquidityOperationData[] | WithdrawLiquidityOperationData[],
  swapData: SwapOperationData[]
): Promise<PoolAmountHistory[]> => {
  if (lpData.length === 0 && swapData.length === 0) return;

  const duckDb = DuckDb.instances;
  const pairInfos = await duckDb.queryPairInfos();
  const minSwapTxHeight = swapData[0]?.txheight;
  const minLpTxHeight = lpData[0]?.txheight;

  let minTxHeight: number;
  if (minSwapTxHeight && minLpTxHeight) {
    minTxHeight = Math.min(minSwapTxHeight, minLpTxHeight);
  } else minTxHeight = minSwapTxHeight ?? minLpTxHeight;

  const poolInfos = await getPoolInfos(
    pairInfos.map((pair) => pair.pairAddr),
    minTxHeight - 1 // assume data is sorted by height and timestamp
  );
  const lpOpsData = [
    ...lpData.map((item) => {
      return {
        baseTokenAmount: item.baseTokenAmount,
        baseTokenDenom: item.baseTokenDenom,
        quoteTokenAmount: item.quoteTokenAmount,
        quoteTokenDenom: item.quoteTokenDenom,
        opType: item.opType,
        timestamp: item.timestamp,
        height: item.txheight
      } as LpOpsData;
    }),
    ...swapData.map((item) => {
      const baseAmount = item.direction === "Sell" ? item.offerAmount : item.returnAmount;
      const baseDenom = item.direction === "Sell" ? item.offerDenom : item.askDenom;
      const quoteDenom = item.direction === "Sell" ? item.askDenom : item.offerDenom;
      const quoteAmount = -(item.direction === "Sell" ? item.returnAmount : item.offerAmount);
      return {
        // when sell, offer amount is base, quote amount is quote, so we need to add offerAmount and substract askAmount to pool
        // Example: ORAI/USDT, when sell ORAI, we offer ORAI and returned USDT
        baseTokenAmount: baseAmount,
        baseTokenDenom: baseDenom,
        quoteTokenAmount: -quoteAmount, // reverse sign because we assume first case is sell, check buy later.
        quoteTokenDenom: quoteDenom,
        direction: item.direction,
        height: item.txheight,
        timestamp: item.timestamp
      } as LpOpsData;
    })
  ];

  const accumulatedData = await collectAccumulateLpAndSwapData(lpOpsData, poolInfos);
  const poolAmountHitories = pairInfos.reduce((accumulator: PoolAmountHistory[], { pairAddr }) => {
    if (accumulatedData[pairAddr]) {
      accumulator.push({
        ...accumulatedData[pairAddr],
        pairAddr,
        uniqueKey: concatLpHistoryToUniqueKey({
          timestamp: accumulatedData[pairAddr].timestamp,
          pairAddr
        })
      } as PoolAmountHistory);
    }
    return accumulator;
  }, []);
  return poolAmountHitories;
};
