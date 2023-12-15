import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { fetchRetry, ROUTER_V2_CONTRACT } from "@oraichain/oraidex-common";
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
  getPoolAprsFromDuckDb
} from "@oraichain/oraidex-sync";
import bech32 from "bech32";
import "dotenv/config";

const rpcUrl = process.env.RPC_URL || "https://rpc.orai.io";

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
    console.log("Fetch simulate prices error: ", error);
  }
};

export const getAllPoolsInfo = async () => {
  try {
    const volumes = await getAllVolume24h();
    const allFee7Days = await getAllFees();
    const pools = await getPoolsFromDuckDb();
    const allPoolApr = await getPoolAprsFromDuckDb();
    const allLiquidities = await getPoolLiquidities(pools);
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
        totalLiquidity: allLiquidities[index],
        rewardPerSec: poolApr.rewardPerSec,
        offerPoolAmount: allPoolAmounts[index].offerPoolAmount,
        askPoolAmount: allPoolAmounts[index].askPoolAmount,
        totalSupply: poolApr.totalSupply
      } as PairInfoDataResponse;
    });

    return allPoolsInfo;
  } catch (error) {
    console.log({ errorGetAllPoolsInfo: error });
  }
};
