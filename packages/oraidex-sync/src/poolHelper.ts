import { MulticallQueryClient } from "@oraichain/common-contracts-sdk";
import { PoolResponse } from "@oraichain/oraidex-contracts-sdk/build/OraiswapPair.types";
import { getAllPairInfos as queryAllPairInfos, getPoolInfos as queryPoolInfos } from "./query";
import {
  calculatePriceByPool,
  fetchPoolInfoAmount,
  getCosmwasmClient,
  parseAssetInfo,
  parseAssetInfoOnlyDenom
} from "./helper";
import {
  Asset,
  AssetInfo,
  OraiswapFactoryQueryClient,
  OraiswapPairQueryClient,
  PairInfo
} from "@oraichain/oraidex-contracts-sdk";
import { ORAI, usdtCw20Address } from "./constants";
import { PairInfoData, PairMapping } from "./types";
import { pairs } from "./pairs";

// use this type to determine the ratio of price of base to the quote or vice versa
export type RatioDirection = "base_in_quote" | "quote_in_base";
async function getPoolInfos(pairAddrs: string[], wantedHeight?: number): Promise<PoolResponse[]> {
  // adjust the query height to get data from the past
  const cosmwasmClient = await getCosmwasmClient();
  cosmwasmClient.setQueryClientWithHeight(wantedHeight);
  const multicall = new MulticallQueryClient(
    cosmwasmClient,
    process.env.MULTICALL_CONTRACT_ADDRESS || "orai1q7x644gmf7h8u8y6y8t9z9nnwl8djkmspypr6mxavsk9ual7dj0sxpmgwd"
  );
  const res = await queryPoolInfos(pairAddrs, multicall);
  // reset query client to latest for other functions to call
  return res;
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

// find pool match this asset with orai => calculate price this asset token in ORAI.
// then, calculate price of this asset token in USDT based on price ORAI in USDT.
async function getPriceAssetByUsdt(asset: AssetInfo): Promise<number> {
  const foundPair = pairs.find((pair) => {
    const denoms = [parseAssetInfoOnlyDenom(pair.asset_infos[0]), parseAssetInfoOnlyDenom(pair.asset_infos[1])];
    return denoms.includes(parseAssetInfoOnlyDenom(asset)) && denoms.includes(ORAI);
  });
  if (!foundPair) return 0;

  const ratioDirection: RatioDirection =
    parseAssetInfoOnlyDenom(foundPair.asset_infos[0]) === ORAI ? "quote_in_base" : "base_in_quote";
  const priceInOrai = await getPriceByAsset(foundPair.asset_infos, ratioDirection);
  const priceOraiInUsdt = await getOraiPrice();
  console.log({ asset, priceInOrai, priceOraiInUsdt });
  return priceInOrai * priceOraiInUsdt;
}

async function calculateFeeByUsdt(fee: Asset): Promise<number> {
  if (!fee) return 0;
  const priceInUsdt = await getPriceAssetByUsdt(fee.info);
  return priceInUsdt * +fee.amount;
}

async function getPairInfos(): Promise<PairInfo[]> {
  const cosmwasmClient = await getCosmwasmClient();
  const firstFactoryClient = new OraiswapFactoryQueryClient(
    cosmwasmClient,
    "orai1hemdkz4xx9kukgrunxu3yw0nvpyxf34v82d2c8"
  );
  const secondFactoryClient = new OraiswapFactoryQueryClient(
    cosmwasmClient,
    "orai167r4ut7avvgpp3rlzksz6vw5spmykluzagvmj3ht845fjschwugqjsqhst"
  );
  return queryAllPairInfos(firstFactoryClient, secondFactoryClient);
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
  const usdtInfo = { token: { contract_addr: usdtCw20Address } };
  const oraiInfo = { native_token: { denom: ORAI } };
  const oraiUsdtPair = getPairByAssetInfos([oraiInfo, usdtInfo]);
  const ratioDirection: RatioDirection =
    parseAssetInfoOnlyDenom(oraiUsdtPair.asset_infos[0]) === ORAI ? "base_in_quote" : "quote_in_base";
  return getPriceByAsset([oraiInfo, usdtInfo], ratioDirection);
}

async function getPriceByAsset(
  [baseAsset, quoteAsset]: [AssetInfo, AssetInfo],
  ratioDirection: RatioDirection
): Promise<number> {
  // TODO: currently we get all pairinfo then find orai/usdt pair, but it slow, so need to refactor this ops
  const allPairInfos = await getPairInfos();
  const pool = allPairInfos.find(
    (pair) =>
      parseAssetInfo(pair.asset_infos[0]) === parseAssetInfo(baseAsset) &&
      parseAssetInfo(pair.asset_infos[1]) === parseAssetInfo(quoteAsset)
  );
  if (!pool) return 0;
  // offer: orai, ask: usdt -> price offer in ask = calculatePriceByPool([ask, offer])
  // offer: orai, ask: atom -> price ask in offer  = calculatePriceByPool([offer, ask])
  const { offerPoolAmount, askPoolAmount } = await fetchPoolInfoAmount(baseAsset, quoteAsset, pool.contract_addr);
  const assetPrice = calculatePriceByPool(askPoolAmount, offerPoolAmount, +pool.commission_rate);

  return ratioDirection === "base_in_quote" ? assetPrice : 1 / assetPrice;
}

/**
 * First, calculate fee by offer asset & askAsset
 * then, calculate fee by those asset to ORAI
 * finally, convert this fee in ORAI to USDT.
 * @param pair
 * @param txHeight
 * @param withdrawnShare
 * @returns
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

export { getPoolInfos, calculateLiquidityFee, getOraiPrice };
