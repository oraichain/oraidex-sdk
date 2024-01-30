import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { ROUTER_V2_CONTRACT } from "@oraichain/oraidex-common/build/constant";
import { fetchRetry } from "@oraichain/oraidex-common/build/helper";
import { AssetInfo, OraiswapRouterQueryClient } from "@oraichain/oraidex-contracts-sdk";
import {
  injAddress,
  ORAI,
  oraiInfo,
  oraixCw20Address,
  PairMapping,
  pairs,
  parseAssetInfoOnlyDenom,
  simulateSwapPrice,
  usdcCw20Address,
  getAllFees,
  getAllVolume24h,
  getPoolAmounts,
  getPoolLiquidities,
  PairInfoDataResponse,
  getPoolsFromDuckDb,
  getPoolAprsFromDuckDb,
  pairsWithDenom,
  DuckDb,
  PoolAmountHistory,
  calculatePriceByPool,
  PairInfoData,
  findPairAddress,
  getAvgPoolLiquidities
} from "@oraichain/oraidex-sync";
import bech32 from "bech32";
import "dotenv/config";
import { DbQuery, LowHighPriceOfPairType } from "./db-query";

const rpcUrl = process.env.RPC_URL || "https://rpc.orai.io";
const ORAI_INJ = "ORAI_INJ";
const ORAIX_USDC = "ORAIX_USDC";

export function parseSymbolsToTickerId([base, quote]: [string, string]) {
  return `${base}_${quote}`;
}

export function getDate24hBeforeNow(time: Date) {
  const twentyFourHoursInMilliseconds = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  const date24hBeforeNow = new Date(time.getTime() - twentyFourHoursInMilliseconds);
  return date24hBeforeNow;
}

/**
 *
 * @param time
 * @param tf in seconds
 * @returns
 */
export function getSpecificDateBeforeNow(time: Date, tf: number) {
  const timeInMs = tf * 1000; //time in milliseconds
  const dateBeforeNow = new Date(time.getTime() - timeInMs);
  return dateBeforeNow;
}

export function calculateBasePriceFromTickerVolume(baseVolume: string, targetVolume: string): number {
  return parseFloat(targetVolume) / parseFloat(baseVolume);
}

export function pairToString([base, quote]: string[]): string {
  return `${base}-${quote}`;
}

export const validateOraiAddress = (contractAddress: string) => {
  try {
    const { prefix } = bech32.decode(contractAddress);
    if (prefix === ORAI) return true;
    return false;
  } catch (error) {
    console.log("error: ", error);
    return false;
  }
};

export const getOrderbookTicker = async () => {
  try {
    // get ticker from orderbook
    const ORDERBOOK_TICKER_API_ENDPOINT = `${
      process.env.ORDERBOOK_API_ENDPOINT || "https://server.oraidex.io"
    }/v2/tickers`;
    const response = await fetchRetry(ORDERBOOK_TICKER_API_ENDPOINT);
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    const tickerOrderbook = await response.json();
    return tickerOrderbook;
  } catch (error) {
    console.error("Error get orderbook ticker: ", error);
    return [];
  }
};

export const getOrderbookSummary = async () => {
  try {
    // get ticker from orderbook
    const ORDERBOOK_TICKER_API_ENDPOINT = `${
      process.env.ORDERBOOK_API_ENDPOINT || "https://server.oraidex.io"
    }/v1/cmc/tickers`;
    const response = await fetchRetry(ORDERBOOK_TICKER_API_ENDPOINT);
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    const tickerOrderbook = await response.json();
    return tickerOrderbook;
  } catch (error) {
    console.error("Error get orderbook ticker: ", error);
    return [];
  }
};

// fetch the simulate prices
export const fetchSimulatePrices = async () => {
  try {
    const cosmwasmClient = await CosmWasmClient.connect(rpcUrl);
    const routerContract = new OraiswapRouterQueryClient(cosmwasmClient, ROUTER_V2_CONTRACT);

    const arrangedPairs = pairs.map((pair) => {
      const pairDenoms = pair.asset_infos.map((assetInfo) => parseAssetInfoOnlyDenom(assetInfo));
      if (pairDenoms.some((denom) => denom === ORAI) && pairDenoms.some((denom) => denom === injAddress))
        return {
          ...pair,
          asset_infos: [
            oraiInfo,
            {
              token: {
                contract_addr: injAddress
              }
            } as AssetInfo
          ],
          symbols: ["ORAI", "INJ"]
        } as PairMapping;

      if (
        pairDenoms.some((denom) => denom === oraixCw20Address) &&
        pairDenoms.some((denom) => denom === usdcCw20Address)
      )
        return {
          ...pair,
          asset_infos: [
            {
              token: {
                contract_addr: oraixCw20Address
              }
            } as AssetInfo,
            {
              token: {
                contract_addr: usdcCw20Address
              }
            } as AssetInfo
          ],
          symbols: ["ORAIX", "USDC"]
        } as PairMapping;
      return pair;
    });

    const prices = await simulateSwapPrice(
      arrangedPairs.map((pair) => pair.asset_infos),
      routerContract
    );

    return prices;
  } catch (error) {
    throw new Error("fetchSimulatePrices Error::" + error.message);
  }
};

export const getAllPoolsInfo = async () => {
  try {
    const volumes = await getAllVolume24h();
    const allFee7Days = await getAllFees();
    const pools = await getPoolsFromDuckDb();
    const allPoolApr = await getPoolAprsFromDuckDb();
    const allLiquidities = await getPoolLiquidities(pools);
    const avgLiqIn7Days = await getAvgPoolLiquidities(pools);
    const allPoolAmounts = await getPoolAmounts(pools);

    const allPoolsInfo: PairInfoDataResponse[] = pools.map((pool, index) => {
      const poolApr = allPoolApr.find((item) => item.pairAddr === pool.pairAddr);
      if (!poolApr) return null;

      const poolFee = allFee7Days.find((item) => {
        const [baseAssetInfo, quoteAssetInfo] = item.assetInfos;
        return (
          JSON.stringify(baseAssetInfo) === pool.firstAssetInfo &&
          JSON.stringify(quoteAssetInfo) === pool.secondAssetInfo
        );
      });

      const poolVolume = volumes.find((item) => {
        const [baseAssetInfo, quoteAssetInfo] = item.assetInfos;
        return (
          JSON.stringify(baseAssetInfo) === pool.firstAssetInfo &&
          JSON.stringify(quoteAssetInfo) === pool.secondAssetInfo
        );
      });
      if (!poolVolume) return null;

      return {
        ...pool,
        volume24Hour: poolVolume.volume.toString(),
        fee7Days: poolFee.fee.toString(),
        apr: poolApr.apr,
        totalLiquidity: allLiquidities[pool.liquidityAddr],
        avgLiquidity: avgLiqIn7Days[pool.liquidityAddr],
        rewardPerSec: poolApr.rewardPerSec,
        offerPoolAmount: allPoolAmounts[index]?.offerPoolAmount,
        askPoolAmount: allPoolAmounts[index]?.askPoolAmount,
        totalSupply: poolApr.totalSupply
      } as PairInfoDataResponse;
    });

    return allPoolsInfo;
  } catch (error) {
    console.log({ errorGetAllPoolsInfo: error });
  }
};
/**
 * get low high price for pair of [base and quote]
 * @tickerId pair symbols string
 * @param listLowHighPriceOfPair list low high price of pair
 * @param baseDenom
 * @param quoteDenom
 * @returns low and high price for pair
 */
export const getLowHighPriceOfPair = (
  tickerId: string,
  listLowHighPriceOfPair: LowHighPriceOfPairType[],
  baseDenom: string,
  quoteDenom: string
) => {
  const pair = pairsWithDenom.find(
    (pair) => pair.asset_denoms.includes(baseDenom) && pair.asset_denoms.includes(quoteDenom)
  );
  if (!pair) {
    return { low: 0, high: 0, pairAddr: "" };
  }

  const {
    low,
    high,
    pair: pairAddr
  } = listLowHighPriceOfPair.find((item) => item.pair.includes(baseDenom) && item.pair.includes(quoteDenom)) || {
    low: 0,
    high: 0,
    pair: ""
  };

  // TODO: hardcode Inverse Price for "ORAIX_USDC", "ORAI_INJ" pair
  const isInversePrice = [ORAIX_USDC, ORAI_INJ].includes(tickerId);

  return {
    low: low && isInversePrice ? 1 / low : low,
    high: high && isInversePrice ? 1 / high : high,
    pairAddr
  };
};

/**
 * Get List Low High Price Of Pairs timestamp
 * @param timestamp (optional) if it present, the price of asset will be calculated at this time.
 * @returns list LowHighPriceOfPair
 */
export const getListLowHighPriceOfPairs = async (timestamp?: number): Promise<LowHighPriceOfPairType[]> => {
  const duckDb = DuckDb.instances;
  const dbQuery = new DbQuery(duckDb);

  const listLowHighPriceOfPair: LowHighPriceOfPairType[] = await dbQuery.getLowHighPrice({ timestamp });
  if (!listLowHighPriceOfPair) return [];

  return listLowHighPriceOfPair;
};

/**
 * Get pool amount by timestamp
 * @param timestamp (optional) if it present, the price of asset will be calculated at this time.
 * @returns list pool amount history
 */
export const getListPoolAmount = async (timestamp?: number): Promise<PoolAmountHistory[]> => {
  const duckDb = DuckDb.instances;
  const dbQuery = new DbQuery(duckDb);

  const poolAmounts: PoolAmountHistory[] = await dbQuery.getListLpAmount({ timestamp });
  if (!poolAmounts) return [];

  return poolAmounts;
};

/**
 * getPriceStatistic of pool
 * @param listPoolAmount list pool amount histories
 * @param pairInfos list pair infos
 * @param tickerId ticker id (pair denoms string. Ex: "MILKY_USDT")
 * @param base_denom
 * @param quote_denom
 * @returns list price statistic of pool
 */
export const getPriceStatisticOfPool = (
  listPoolAmount: PoolAmountHistory[],
  pairInfos: PairInfoData[],
  tickerId: string,
  base_denom: string,
  quote_denom: string
) => {
  const pair = pairsWithDenom.find(
    (pair) => pair.asset_denoms.includes(base_denom) && pair.asset_denoms.includes(quote_denom)
  );
  if (!pair) {
    return {
      tickerId,
      price: 0,
      price_change: 0
    };
  }

  const pairAddr = findPairAddress(pairInfos, pair.asset_infos);
  const poolInfo = pairInfos.find((p) => p.pairAddr === pairAddr);

  const listPrices = listPoolAmount.reduce((acc, cur) => {
    if (cur.pairAddr === pairAddr) {
      let price = calculatePriceByPool(
        BigInt(cur.askPoolAmount),
        BigInt(cur.offerPoolAmount),
        +poolInfo.commissionRate
      );

      // TODO: hardcode Inverse Price for "ORAIX_USDC", "ORAI_INJ" pair
      if ([ORAIX_USDC, ORAI_INJ].includes(tickerId) && price) {
        price = 1 / price;
      }

      acc.push(price);
    }
    return acc;
  }, []);

  const by24hPrice = listPrices[listPrices.length - 1];
  const currentPrice = listPrices[0];

  let percentPriceChange = 0;
  if (by24hPrice !== 0) {
    percentPriceChange = ((currentPrice - by24hPrice) / by24hPrice) * 100;
  }

  return {
    tickerId,
    price: currentPrice || 0,
    price_change: percentPriceChange || 0
  };
};
