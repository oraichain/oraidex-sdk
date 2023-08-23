import { MulticallQueryClient } from "@oraichain/common-contracts-sdk";
import { PoolResponse } from "@oraichain/oraidex-contracts-sdk/build/OraiswapPair.types";
import { getAllPairInfos as queryAllPairInfos, getPoolInfos as queryPoolInfos } from "./query";
import {
  calculatePriceByPool,
  fetchPoolInfoAmount,
  findAssetInfoPathToUsdt,
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
  if (!("native_token" in asset.info)) return null;
  const amount = +asset.amount;
  const refundAmount = amount * shareRatio;
  const fee = Math.min(refundAmount - (refundAmount * 1) / (TAX_RATE + 1), TAX_CAP);
  return {
    amount: fee.toString(),
    info: asset.info
  };
}

// find pool match this asset with orai => calculate price this asset vs orai => calculate price this asset vs usdt.
async function getPriceAssetByUsdt(asset: AssetInfo): Promise<number> {
  const foundPair = pairs.find((pair) => {
    const denoms = [parseAssetInfoOnlyDenom(pair.asset_infos[0]), parseAssetInfoOnlyDenom(pair.asset_infos[1])];
    return denoms.includes(parseAssetInfoOnlyDenom(asset)) && denoms.includes(ORAI);
  });
  if (!foundPair) return 0;
  const priceByOrai = getPriceByAsset(foundPair.asset_infos);
  console.log({ priceByOrai });

  const usdtInfo = { token: { contract_addr: usdtCw20Address } };
  const oraiInfo = { native_token: { denom: ORAI } };
  const priceByUsdt = getPriceByAsset([oraiInfo, usdtInfo]);
  console.log({ priceByUsdt });
  return priceByUsdt;
}

async function calculateFeeByUsdt(fee: Asset): Promise<number> {
  if (!fee) return 0;
  const priceByUsdt = await getPriceAssetByUsdt(fee.info);
  return priceByUsdt * +fee.amount;
}

/**
 * TODO: explain this function
 *
 * @param txHeight
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

async function getOraiPrice() {
  const usdtInfo = { token: { contract_addr: usdtCw20Address } };
  const oraiInfo = { native_token: { denom: ORAI } };
  // TODO: currently we get all pairinfo then find orai/usdt pair, but it slow, so need to refactor this ops
  const allPairInfos = await getPairInfos();
  const oraiUsdtPool = allPairInfos.find(
    (pair) =>
      parseAssetInfo(pair.asset_infos[0]) === parseAssetInfo(oraiInfo) &&
      parseAssetInfo(pair.asset_infos[1]) === parseAssetInfo(usdtInfo)
  );
  const { offerPoolAmount, askPoolAmount } = await fetchPoolInfoAmount(oraiInfo, usdtInfo, oraiUsdtPool.contract_addr);
  const oraiPrice = calculatePriceByPool(askPoolAmount, offerPoolAmount, +oraiUsdtPool.commission_rate);
  return oraiPrice;
}

async function getPriceByAsset([baseAsset, quoteAsset]: [AssetInfo, AssetInfo]): Promise<number> {
  // TODO: currently we get all pairinfo then find orai/usdt pair, but it slow, so need to refactor this ops
  const allPairInfos = await getPairInfos();
  const pool = allPairInfos.find(
    (pair) =>
      parseAssetInfo(pair.asset_infos[0]) === parseAssetInfo(baseAsset) &&
      parseAssetInfo(pair.asset_infos[1]) === parseAssetInfo(quoteAsset)
  );
  if (pool) return 0;
  const { offerPoolAmount, askPoolAmount } = await fetchPoolInfoAmount(baseAsset, quoteAsset, pool.contract_addr);
  const assetPrice = calculatePriceByPool(askPoolAmount, offerPoolAmount, +pool.commission_rate);
  return assetPrice;
}

export { getPoolInfos, calculateLiquidityFee, getOraiPrice };
