import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { CoinGeckoId, CoinGeckoPrices, PAIRS, oraichainTokens, pairLpTokens } from "@oraichain/oraidex-common";
import {
  INJECTIVE_CONTRACT,
  ORAIX_CONTRACT,
  ORAI_INFO,
  ROUTER_V2_CONTRACT,
  USDC_CONTRACT,
  USDT_CONTRACT
} from "@oraichain/oraidex-common/build/constant";
import { fetchRetry } from "@oraichain/oraidex-common/build/helper";
import { AssetInfo, OraiswapRouterQueryClient } from "@oraichain/oraidex-contracts-sdk";
import {
  DuckDb,
  ORAI,
  PairInfoData,
  PairInfoDataResponse,
  PairMapping,
  PoolAmountHistory,
  calculatePriceByPool,
  findPairAddress,
  getAllFees,
  getAllVolume24h,
  getAvgPoolLiquidities,
  getPoolAmounts,
  getPoolAprsFromDuckDb,
  getPoolLiquidities,
  getPoolsFromDuckDb,
  injAddress,
  oraiInfo,
  oraixCw20Address,
  pairs,
  pairsWithDenom,
  parseAssetInfoOnlyDenom,
  simulateSwapPrice,
  usdcCw20Address
} from "@oraichain/oraidex-sync";
import bech32 from "bech32";
import "dotenv/config";
import { DbQuery, LowHighPriceOfPairType } from "./db-query";
import { CACHE_KEY, cache } from "./map-cache";

const rpcUrl = process.env.RPC_URL || "https://rpc.orai.io";
const ORAI_INJ = "ORAI_INJ";
const ORAIX_USDC = "ORAIX_USDC";

// The pairs are rearranged in the correct order of base and quote
export const ARRANGED_PAIRS = PAIRS.map((pair) => {
  const pairDenoms = pair.asset_infos.map((assetInfo) => parseAssetInfoOnlyDenom(assetInfo));
  if (pairDenoms.some((denom) => denom === ORAI) && pairDenoms.some((denom) => denom === INJECTIVE_CONTRACT))
    return {
      ...pair,
      asset_infos: [
        ORAI_INFO,
        {
          token: {
            contract_addr: INJECTIVE_CONTRACT
          }
        } as AssetInfo
      ],
      symbols: ["ORAI", "INJ"]
    } as PairMapping;

  if (pairDenoms.some((denom) => denom === ORAIX_CONTRACT) && pairDenoms.some((denom) => denom === USDC_CONTRACT))
    return {
      ...pair,
      asset_infos: [
        {
          token: {
            contract_addr: ORAIX_CONTRACT
          }
        } as AssetInfo,
        {
          token: {
            contract_addr: USDC_CONTRACT
          }
        } as AssetInfo
      ],
      symbols: ["ORAIX", "USDC"]
    } as PairMapping;
  return pair;
});

export type AllPairsInfo = {
  symbol: string;
  info: string;
  asset_infos: [AssetInfo, AssetInfo];
  symbols: [string, string];
  factoryV1?: boolean;
};
export const ARRANGED_PAIRS_CHART: AllPairsInfo[] = PAIRS.map((pair) => {
  const assets = pair.asset_infos.map(parseAssetInfoOnlyDenom);
  return {
    ...pair,
    symbol: `${pair.symbols[0]}/${pair.symbols[1]}`,
    info: `${assets[0]}-${assets[1]}`
  };
});

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
      process.env.ORDERBOOK_API_ENDPOINT || "https://orderbook-backend.oraidex.io"
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
      process.env.ORDERBOOK_API_ENDPOINT || "https://orderbook-backend.oraidex.io"
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
    const avgLiquidities = await getAvgPoolLiquidities(pools);
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
        aprBoost: poolApr?.aprBoost ?? 0,
        totalLiquidity: allLiquidities[index],
        avgLiquidities: avgLiquidities[pool.liquidityAddr],
        rewardPerSec: poolApr.rewardPerSec,
        offerPoolAmount: allPoolAmounts[index].offerPoolAmount,
        askPoolAmount: allPoolAmounts[index].askPoolAmount,
        totalSupply: poolApr.totalSupply
      } as PairInfoDataResponse;
    });

    // TODO: ignore pool ORAI/BTC and pool undefined
    return allPoolsInfo.filter((pools) => pools && pools.liquidityAddr !== pairLpTokens.ORAI_BTC);
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

export const getAssetInfosFromPairString = (pair: string): [AssetInfo, AssetInfo] => {
  const modifiedPair = [pair.split("-")[1], pair.split("-")[0]].join("-");
  const pairChart = ARRANGED_PAIRS_CHART.find((p) => p.info === pair || p.info === modifiedPair);
  if (!pairChart) return null;

  return pairChart.asset_infos;
};

/**
 * Constructs the URL to retrieve prices from CoinGecko.
 * @param tokens
 * @returns
 */
export const buildCoinGeckoPricesURL = (tokens: readonly string[]): string =>
  `https://price.market.orai.io/simple/price?ids=${tokens.join("%2C")}&vs_currencies=usd`;

export const getCoingeckoPrices = async <T extends CoinGeckoId>(
  tokens: string[],
  signal?: AbortSignal
): Promise<CoinGeckoPrices<string>> => {
  const coingeckoIds = tokens?.length > 0 ? tokens : oraichainTokens.map((t) => t.coinGeckoId);
  const coingeckoPricesURL = buildCoinGeckoPricesURL(coingeckoIds);

  const prices = cache.get(CACHE_KEY.COINGECKO_PRICES) ?? {};

  // by default not return data then use cached version
  try {
    const resp = await fetchRetry(coingeckoPricesURL, { signal });
    const rawData = (await resp.json()) as {
      [C in T]?: {
        usd: number;
      };
    };
    // update cached
    for (const key in rawData) {
      prices[key] = rawData[key].usd;
    }
  } catch {
    // remain old cache
    console.log("error getting coingecko prices: ", prices);
  }
  return prices;
};
