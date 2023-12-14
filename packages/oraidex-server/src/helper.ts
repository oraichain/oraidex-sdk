import { fetchRetry } from "@oraichain/oraidex-common";
import bech32 from "bech32";
import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { AssetInfo, OraiswapRouterQueryClient } from "@oraichain/oraidex-contracts-sdk";
import {
  simulateSwapPrice,
  pairs,
  parseAssetInfoOnlyDenom,
  ORAI,
  injAddress,
  oraiInfo,
  PairMapping,
  oraixCw20Address,
  usdcCw20Address
} from "@oraichain/oraidex-sync";
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
    const ORDERBOOK_TICKER_API_ENDPOINT = "https://server.oraidex.io/v2/tickers";
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
  const cosmwasmClient = await CosmWasmClient.connect(rpcUrl);
  const routerContract = new OraiswapRouterQueryClient(
    cosmwasmClient,
    process.env.ROUTER_CONTRACT_ADDRESS || "orai1j0r67r9k8t34pnhy00x3ftuxuwg0r6r4p8p6rrc8az0ednzr8y9s3sj2sf"
  );

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

    if (pairDenoms.some((denom) => denom === oraixCw20Address) && pairDenoms.some((denom) => denom === usdcCw20Address))
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
};
