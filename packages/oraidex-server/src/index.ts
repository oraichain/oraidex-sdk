#!/usr/bin/env node

import { AssetInfo } from "@oraichain/oraidex-contracts-sdk";
import {
  DuckDb,
  GetCandlesQuery,
  GetPoolDetailQuery,
  GetPriceAssetByUsdt,
  GetPricePairQuery,
  GetStakedByUserQuery,
  ORAI,
  OraiDexSync,
  PairMapping,
  SummaryInfo,
  TickerInfo,
  VolumeRange,
  findPairAddress,
  getOraiPrice,
  getPairLiquidity,
  getPriceAssetByUsdt,
  getPriceByAsset,
  getVolumePairByUsdt,
  injAddress,
  oraiInfo,
  oraiUsdtPairOnlyDenom,
  oraixCw20Address,
  pairs,
  pairsOnlyDenom,
  pairsWithDenom,
  parseAssetInfo,
  parseAssetInfoOnlyDenom,
  toDisplay,
  usdcCw20Address,
  usdtInfo
} from "@oraichain/oraidex-sync";
import cors from "cors";
import "dotenv/config";
import express, { Request } from "express";
import fs from "fs";
import { isEqual } from "lodash";
import path from "path";
import {
  ARRANGED_PAIRS_CHART,
  fetchSimulatePrices,
  getAllPoolsInfo,
  getCoingeckoPrices,
  getDate24hBeforeNow,
  getListLowHighPriceOfPairs,
  getListPoolAmount,
  getLowHighPriceOfPair,
  getOrderbookSummary,
  getOrderbookTicker,
  getPriceStatisticOfPool,
  getSpecificDateBeforeNow,
  pairToString,
  parseSymbolsToTickerId,
  validateOraiAddress
} from "./helper";
import { CACHE_KEY, cache, registerListener, updateInterval } from "./map-cache";
import { BigDecimal } from "@oraichain/oraidex-common/build/bigdecimal";
import { ORAIX_CONTRACT, USDC_CONTRACT, oraichainTokens } from "@oraichain/oraidex-common";
import { DbQuery, GetHistoricalChart, GetSwapHistory } from "./db-query";

// cache
registerListener(CACHE_KEY.COINGECKO_PRICES, getCoingeckoPrices);
registerListener(CACHE_KEY.POOLS_INFO, getAllPoolsInfo);
registerListener(CACHE_KEY.SIMULATE_PRICE, fetchSimulatePrices);
registerListener(CACHE_KEY.TICKER_ORDER_BOOK, getOrderbookSummary);

updateInterval();

const app = express();
app.use(cors());

export let duckDb: DuckDb;

const port = parseInt(process.env.PORT) || 2024;
const hostname = process.env.HOSTNAME || "0.0.0.0";

app.get("/version", async (req, res) => {
  try {
    const packageContent = fs.readFileSync(path.join(__dirname, "../package.json"), { encoding: "utf-8" });
    const packageJson = JSON.parse(packageContent);
    res.status(200).send(packageJson.version);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/pairs", async (req, res) => {
  try {
    const pairInfos = await duckDb.queryPairInfos();
    res.status(200).send(
      pairs.map((pair) => {
        const pairAddr = findPairAddress(pairInfos, pair.asset_infos);
        return {
          ticker_id: parseSymbolsToTickerId(pair.symbols),
          base: pair.symbols[0],
          target: pair.symbols[1],
          pool_id: pairAddr ?? ""
        };
      })
    );
  } catch (error) {
    res.status(500).send(`Error getting pair infos: ${JSON.stringify(error)}`);
  }
});

app.get("/tickers", async (req, res) => {
  try {
    const { endTime } = req.query;
    const pairInfos = await duckDb.queryPairInfos();
    const latestTimestamp = endTime ? parseInt(endTime as string) : await duckDb.queryLatestTimestampSwapOps();
    const then = getDate24hBeforeNow(new Date(latestTimestamp * 1000)).getTime() / 1000;

    // hardcode reverse order for ORAI/INJ, USDC/ORAIX
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

    const data: TickerInfo[] = [];
    for (const pair of arrangedPairs) {
      const symbols = pair.symbols;
      const pairInfo = pairInfos.find(
        (pairInfo) =>
          pair.asset_infos.some((info) => parseAssetInfo(info) === pairInfo.firstAssetInfo) &&
          pair.asset_infos.some((info) => parseAssetInfo(info) === pairInfo.secondAssetInfo)
      );
      if (!pairInfo)
        throw new Error(
          `Cannot find pair info with assetInfos: ${pairInfo.firstAssetInfo} and ${pairInfo.secondAssetInfo}`
        );

      const pairAddr = findPairAddress(pairInfos, pair.asset_infos);
      const tickerId = parseSymbolsToTickerId(symbols);
      const baseIndex = 0;
      const targetIndex = 1;
      const baseInfo = parseAssetInfoOnlyDenom(pair.asset_infos[baseIndex]);
      const targetInfo = parseAssetInfoOnlyDenom(pair.asset_infos[targetIndex]);
      const volume = await duckDb.queryAllVolumeRange(baseInfo, targetInfo, then, latestTimestamp);
      const liquidityInUsd = await getPairLiquidity(pairInfo);
      const BASE_API_ORAIDEX_UNIVERSAL_SWAP_URL = "https://oraidex.io/universalswap";

      const [from, to] = [
        oraichainTokens.find((token) => token.contractAddress === baseInfo || token.denom === baseInfo),
        oraichainTokens.find((token) => token.contractAddress === targetInfo || token.denom === targetInfo)
      ];

      const tickerInfo: TickerInfo = {
        ticker_id: tickerId,
        base_currency: symbols[baseIndex],
        target_currency: symbols[targetIndex],
        last_price: "0",
        base_volume: toDisplay(BigInt(volume.volume[baseInfo])).toString(),
        target_volume: toDisplay(BigInt(volume.volume[targetInfo])).toString(),
        pool_id: pairAddr ?? "",
        base: symbols[baseIndex],
        target: symbols[targetIndex],
        liquidity_in_usd: new BigDecimal(liquidityInUsd).div(10 ** 6).toString(),
        pair_url: `${BASE_API_ORAIDEX_UNIVERSAL_SWAP_URL}?from=${from ? from.denom : "orai"}&to=${
          to ? to.denom : "usdt"
        }`
      };
      data.push(tickerInfo);
    }

    // reverse because in pairs, we put base info as first index
    const prices = cache.get(CACHE_KEY.SIMULATE_PRICE) || [];

    const tickerOrderbook = await getOrderbookTicker();
    prices.forEach((price, index) => {
      if (price) {
        data[index].last_price = price;
      }
    });

    const finalData = tickerOrderbook?.length ? tickerOrderbook.concat(data) : data;
    res.status(200).send(finalData);
  } catch (error) {
    console.log("error: ", error);
    res.status(500).send(`Error: ${JSON.stringify(error)}`);
  }
});

// TODO: refactor this and add unit tests
app.get("/volume/v2/historical/chart", async (req, res) => {
  try {
    const { startTime, endTime, tf } = req.query;
    const timeFrame = tf ? parseInt(tf as string) : 60;
    const latestTimestamp = endTime ? parseInt(endTime as string) : await duckDb.queryLatestTimestampSwapOps();
    const then = startTime
      ? parseInt(startTime as string)
      : getSpecificDateBeforeNow(new Date(latestTimestamp * 1000), 25920000).getTime() / 1000;
    const volumeInfos = [];
    for (const { asset_infos } of pairsOnlyDenom) {
      const volume = await duckDb.getVolumeRange(timeFrame, then, latestTimestamp, pairToString(asset_infos));
      volumeInfos.push(volume);
    }

    const volumeRanges: { [time: string]: VolumeRange[] } = {};
    for (const volumePair of volumeInfos) {
      for (const volume of volumePair) {
        if (!volumeRanges[volume.time]) volumeRanges[volume.time] = [{ ...volume }];
        else volumeRanges[volume.time].push({ ...volume });
      }
    }
    const result = [];
    for (const [time, volumeData] of Object.entries(volumeRanges)) {
      const oraiUsdtVolumeData = volumeData.find((data) => data.pair === pairToString(oraiUsdtPairOnlyDenom));
      if (!oraiUsdtVolumeData) {
        return res.status(500).send("Cannot find ORAI_USDT volume data in the volume list");
      }
      const totalVolumePrice = volumeData.reduce((acc, volData) => {
        // console.log("base price in usdt: ", basePriceInUsdt);
        // if base denom is orai then we calculate vol using quote vol
        let volumePrice = 0;
        if (volData.pair.split("-")[0] === ORAI) {
          volumePrice = oraiUsdtVolumeData.basePrice * toDisplay(BigInt(volData.baseVolume));
        } else if (volData.pair.split("-")[1] === ORAI) {
          volumePrice = oraiUsdtVolumeData.basePrice * toDisplay(BigInt(volData.quoteVolume));
        } else {
          return acc; // skip for now cuz dont know how to calculate price if not paired if with ORAI
        }
        // volume price is calculated based on the base currency & quote volume
        return acc + volumePrice;
      }, 0);
      result.push({ time, value: totalVolumePrice });
    }
    res.status(200).send(result);
  } catch (error) {
    console.log("error: ", error);
    res.status(500).send(`Error: ${JSON.stringify(error)}`);
  }
});

app.get("/v1/candles/", async (req: Request<{}, {}, {}, GetCandlesQuery>, res) => {
  try {
    if (!req.query.pair || !req.query.tf || !req.query.startTime || !req.query.endTime)
      return res.status(400).send("Not enough query params");

    const candles = await duckDb.getOhlcvCandles(req.query);

    // reverse data for pool oraix/usdc to display price asset in stable coin
    const pairDenoms = req.query.pair.split("-");
    if (pairDenoms[0] === USDC_CONTRACT && pairDenoms[1] === ORAIX_CONTRACT) {
      const pairInfo = pairsWithDenom.find(
        (pair) => pair.asset_denoms[0] === pairDenoms[0] && pair.asset_denoms[1] === pairDenoms[1]
      );
      if (!pairInfo) return res.status(400).send("Not found pair");

      const currentBaseAssetPrice = await getPriceByAsset(pairInfo.asset_infos, "base_in_quote");
      return res.status(200).send(
        candles.map((candle) => {
          return {
            ...candle,
            open: 1 / candle.open,
            close: 1 / candle.close,
            low: 1 / candle.low,
            high: 1 / candle.high,
            volume: Math.floor(Number(candle.volume) / currentBaseAssetPrice)
          };
        })
      );
    }
    res.status(200).send(candles);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/v1/pools/", async (_req, res) => {
  try {
    const allPoolInfoResponse = cache.get(CACHE_KEY.POOLS_INFO);
    res.status(200).send(allPoolInfoResponse ?? []);
  } catch (error) {
    console.log({ error });
    res.status(500).send(error.message);
  }
});

app.get("/v1/pool-detail", async (req: Request<{}, {}, {}, GetPoolDetailQuery>, res) => {
  const { pairDenoms } = req.query;
  if (!pairDenoms) return res.status(400).send("Not enough query params: pairDenoms");

  try {
    const [baseDenom, quoteDenom] = pairDenoms && pairDenoms.split("_");
    const pair = pairs.find((pair) =>
      isEqual(
        pair.asset_infos.map((asset_info) => parseAssetInfoOnlyDenom(asset_info)),
        [baseDenom, quoteDenom]
      )
    );
    if (!pair) throw new Error(`Cannot find pair with denoms: ${pairDenoms}`);

    const tf = 24 * 60 * 60; // second of 24h
    const currentDate = new Date();
    const oneDayBeforeNow = getSpecificDateBeforeNow(new Date(), tf);
    const twoDayBeforeNow = getSpecificDateBeforeNow(new Date(), tf * 2);
    const poolVolume = await getVolumePairByUsdt(pair.asset_infos, oneDayBeforeNow, currentDate);
    const poolVolumeOnedayBefore = await getVolumePairByUsdt(pair.asset_infos, twoDayBeforeNow, oneDayBeforeNow);
    const pool = await duckDb.getPoolByAssetInfos(pair.asset_infos);

    let percentVolumeChange = 0;
    if (poolVolumeOnedayBefore !== 0n) {
      percentVolumeChange = (Number(poolVolume - poolVolumeOnedayBefore) / Number(poolVolumeOnedayBefore)) * 100;
    }

    const poolApr = await duckDb.getLatestPoolApr(pool.pairAddr);
    const poolLiquidity = await getPairLiquidity(pool);
    const poolDetailResponse = {
      ...pool,
      volume24Hour: poolVolume?.toString() ?? "0",
      volume24hChange: percentVolumeChange,
      apr: poolApr?.apr ?? 0,
      aprBoost: poolApr?.aprBoost ?? 0,
      totalLiquidity: poolLiquidity,
      rewardPerSec: poolApr?.rewardPerSec
    };
    res.status(200).send(poolDetailResponse);
  } catch (error) {
    console.log({ error });
    res.status(500).send(error.message);
  }
});

// get price & volume ORAI in specific time (default: 24h).
app.get("/orai-info", async (req, res) => {
  try {
    // query tf is in minute unit.
    const SECONDS_PER_DAY = 24 * 60 * 60;
    const tf = req.query.tf ? Number(req.query.tf) * 60 : SECONDS_PER_DAY;
    const currentDate = new Date();
    const dateBeforeNow = getSpecificDateBeforeNow(new Date(), tf);
    const oneDayBeforeNow = getSpecificDateBeforeNow(new Date(), SECONDS_PER_DAY);
    const timestamp = Math.round(dateBeforeNow.getTime() / 1000);
    const volume24h = await getVolumePairByUsdt([oraiInfo, usdtInfo], oneDayBeforeNow, currentDate);
    const oraiPriceByTime = await getOraiPrice(timestamp);
    const currenOraiPrice = await getOraiPrice();

    let percentPriceChange = 0;
    if (oraiPriceByTime !== 0) {
      percentPriceChange = ((currenOraiPrice - oraiPriceByTime) / oraiPriceByTime) * 100;
    }

    res.status(200).send({
      price: currenOraiPrice,
      volume_24h: toDisplay(volume24h),
      price_change: percentPriceChange
    });
  } catch (error) {
    console.log({ error });
    res.status(500).send(`Error: ${JSON.stringify(error)}`);
  }
});

// get price base asset & volume of specific pair in specific time (default: 24h)
app.get("/price", async (req: Request<{}, {}, {}, GetPricePairQuery>, res) => {
  try {
    if (!req.query.base_denom || !req.query.quote_denom) {
      return res.status(400).send("Not enough query params: base_denom, quote_denom, tf");
    }

    // query tf is in minute unit
    const SECONDS_PER_DAY = 24 * 60 * 60;
    const tf = req.query.tf ? Number(req.query.tf) * 60 : SECONDS_PER_DAY;
    const dateBeforeNow = getSpecificDateBeforeNow(new Date(), tf);
    const timestamp = Math.round(dateBeforeNow.getTime() / 1000);

    const pair = pairsWithDenom.find(
      (pair) => pair.asset_denoms[0] === req.query.base_denom && pair.asset_denoms[1] === req.query.quote_denom
    );
    if (!pair)
      return res.status(400).send(`Not found pair with assets: ${req.query.base_denom}-${req.query.quote_denom}`);

    const baseAssetPriceByTime = await getPriceByAsset(pair.asset_infos, "base_in_quote", timestamp);
    const currentBaseAssetPrice = await getPriceByAsset(pair.asset_infos, "base_in_quote");

    let percentPriceChange = 0;
    if (baseAssetPriceByTime !== 0) {
      percentPriceChange = ((currentBaseAssetPrice - baseAssetPriceByTime) / baseAssetPriceByTime) * 100;
    }

    res.status(200).send({
      price: currentBaseAssetPrice,
      price_change: percentPriceChange
    });
  } catch (error) {
    console.log({ error });
    res.status(500).send(`Error: ${JSON.stringify(error)}`);
  }
});

app.get("/v1/my-staking", async (req: Request<{}, {}, {}, GetStakedByUserQuery>, res) => {
  if (!req.query.stakerAddress) {
    return res.status(400).send("Not enough query params: stakerAddress");
  }

  try {
    const DEFAULT_TIME_FRAME = 30 * 24 * 60 * 60; // 30 days in second unit.
    const tf = +req.query.tf || DEFAULT_TIME_FRAME;
    const now = new Date();
    const startTime = Math.round(getSpecificDateBeforeNow(now, tf).getTime() / 1000);
    const endTime = Math.round(now.getTime() / 1000);

    let stakingAssetDenom;
    if (req.query.pairDenoms) {
      const [baseDenom, quoteDenom] = req.query.pairDenoms && req.query.pairDenoms.split("_");
      const pair = pairs.find((pair) =>
        isEqual(
          pair.asset_infos.map((asset_info) => parseAssetInfoOnlyDenom(asset_info)),
          [baseDenom, quoteDenom]
        )
      );
      stakingAssetDenom = pair && pair.lp_token;
    }

    const earned = await duckDb.getMyEarnedAmount(req.query.stakerAddress, startTime, endTime, stakingAssetDenom);
    const earnedWithKey = earned.reduce((accumulator, item) => {
      accumulator[item.stakingAssetDenom] = item.earnAmountInUsdt;
      return accumulator;
    }, {});

    const result = pairs.reduce(
      (result, item) => {
        const stakingAssetDenom = item.lp_token;
        result[stakingAssetDenom] = {
          earnAmountInUsdt: earnedWithKey[stakingAssetDenom] || 0
        };
        return result;
      },
      {} as {
        [key: string]: {
          earnAmountInUsdt: number;
        };
      }
    );

    const finalResult = Object.entries(result).map(([denom, values]) => ({
      stakingAssetDenom: denom,
      earnAmountInUsdt: values.earnAmountInUsdt
    }));

    if (stakingAssetDenom)
      return res.status(200).send([finalResult.find((stakeItem) => stakeItem.stakingAssetDenom === stakingAssetDenom)]);

    res.status(200).send(finalResult);
  } catch (error) {
    console.log({ error });
    res.status(500).send(`Error: ${JSON.stringify(error)}`);
  }
});

app.get("/price-by-usdt/", async (req: Request<{}, {}, {}, GetPriceAssetByUsdt>, res) => {
  try {
    const { contractAddress, denom } = req.query;
    let price = 0;
    if (contractAddress) {
      const checkValidContractAddress = validateOraiAddress(contractAddress);
      if (!checkValidContractAddress) {
        res.status(200).send({ price: 0 });
        return;
      }
      price = await getPriceAssetByUsdt({
        token: {
          contract_addr: contractAddress
        }
      });
    } else {
      price = await getPriceAssetByUsdt({
        native_token: {
          denom: denom
        }
      });
    }

    res.status(200).send({ price });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// API for CMC
app.get("/v1/summary", async (req, res) => {
  try {
    const { endTime } = req.query;
    const pairInfos = await duckDb.queryPairInfos();

    const latestTimestamp = endTime ? parseInt(endTime as string) : await duckDb.queryLatestTimestampSwapOps();
    const then = getDate24hBeforeNow(new Date(latestTimestamp * 1000)).getTime() / 1000;

    const SECONDS_PER_DAY = 24 * 60 * 60;
    const dateBeforeNow = getSpecificDateBeforeNow(new Date(), SECONDS_PER_DAY);
    const timestamp = Math.round(dateBeforeNow.getTime() / 1000);

    const listPoolAmount = await getListPoolAmount(timestamp);
    const listLowHighPrice24h = await getListLowHighPriceOfPairs(timestamp);
    const listLowHighPriceAll = await getListLowHighPriceOfPairs();

    // hardcode reverse order for ORAI/INJ, USDC/ORAIX
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

    const data: SummaryInfo[] = [];
    for (const pair of arrangedPairs) {
      const symbols = pair.symbols;
      const tickerId = parseSymbolsToTickerId(symbols);
      const baseIndex = 0;
      const targetIndex = 1;
      const baseInfo = parseAssetInfoOnlyDenom(pair.asset_infos[baseIndex]);
      const targetInfo = parseAssetInfoOnlyDenom(pair.asset_infos[targetIndex]);
      const volume = await duckDb.queryAllVolumeRange(baseInfo, targetInfo, then, latestTimestamp);
      const priceStatistic = getPriceStatisticOfPool(listPoolAmount, pairInfos, tickerId, baseInfo, targetInfo);
      const { low: lowest_price_24h, high: highest_price_24h } = getLowHighPriceOfPair(
        tickerId,
        listLowHighPrice24h,
        baseInfo,
        targetInfo
      );
      const { low: lowest_ask, high: highest_bid } = getLowHighPriceOfPair(
        tickerId,
        listLowHighPriceAll,
        baseInfo,
        targetInfo
      );

      const tickerInfo: SummaryInfo = {
        trading_pairs: tickerId,
        base_currency: symbols[baseIndex],
        quote_currency: symbols[targetIndex],
        last_price: priceStatistic.price,
        base_volume: toDisplay(BigInt(volume.volume[baseInfo])),
        quote_volume: toDisplay(BigInt(volume.volume[targetInfo])),
        lowest_ask: lowest_ask,
        highest_bid: highest_bid,
        price_change_percent_24h: priceStatistic.price_change,
        highest_price_24h: highest_price_24h,
        lowest_price_24h: lowest_price_24h
      };
      data.push(tickerInfo);
    }

    // reverse because in pairs, we put base info as first index
    const prices = cache.get(CACHE_KEY.SIMULATE_PRICE) || [];

    prices.forEach((price, index) => {
      if (price) {
        data[index].last_price = data[index].last_price || Number(price);
        data[index].highest_price_24h = data[index].highest_price_24h || Number(price);
        data[index].lowest_price_24h = data[index].lowest_price_24h || Number(price);
      }
    });

    let tickerOrderbook = cache.get(CACHE_KEY.TICKER_ORDER_BOOK) || [];
    if (!tickerOrderbook.length) return res.status(200).send([]);

    if (!tickerOrderbook.length) {
      tickerOrderbook = await getOrderbookSummary();
    }

    const finalData = tickerOrderbook?.length ? tickerOrderbook.concat(data) : data;
    res.status(200).send(finalData);
  } catch (error) {
    console.log("error: ", error);
    res.status(500).send(`Error: ${JSON.stringify(error)}`);
  }
});

// ====== API for pool info oraidex 3.2
app.get("/v1/liquidity/historical/chart", async (req: Request<{}, {}, {}, GetHistoricalChart>, res) => {
  try {
    if (!req.query.type) {
      return res.status(400).send("Not enough query params: type");
    }
    if (!["day", "week", "month"].includes(req.query.type)) {
      return res.status(400).send("Type must be: day | week | month");
    }

    const duckDb = DuckDb.instances;
    const dbQuery = new DbQuery(duckDb);
    const result = await dbQuery.getLiquidityChart(req.query);
    res.status(200).send(result);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/v1/liquidity/historical/all-charts", async (req: Request<{}, {}, {}, GetHistoricalChart>, res) => {
  try {
    if (!req.query.type) {
      return res.status(400).send("Not enough query params: type");
    }
    if (!["day", "week", "month"].includes(req.query.type)) {
      return res.status(400).send("Type must be: day | week | month");
    }

    const duckDb = DuckDb.instances;
    const dbQuery = new DbQuery(duckDb);
    const result = await dbQuery.getLiquidityChartAllPools(req.query, ARRANGED_PAIRS_CHART);
    res.status(200).send(result);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/v1/volume/historical/all-charts", async (req: Request<{}, {}, {}, GetHistoricalChart>, res) => {
  try {
    if (!req.query.type) {
      return res.status(400).send("Not enough query params: type");
    }
    if (!["day", "week", "month"].includes(req.query.type)) {
      return res.status(400).send("Type must be: day | week | month");
    }

    const duckDb = DuckDb.instances;
    const dbQuery = new DbQuery(duckDb);
    const result = await dbQuery.getSwapVolumeAllPair(req.query);
    res.status(200).send(result);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/v1/volume/historical/chart", async (req: Request<{}, {}, {}, GetHistoricalChart>, res) => {
  try {
    if (!req.query.pair || !req.query.type) {
      return res.status(400).send("Not enough query params: pair || type");
    }
    if (!["day", "week", "month"].includes(req.query.type)) {
      return res.status(400).send("Type must be: day | week | month");
    }

    const duckDb = DuckDb.instances;
    const dbQuery = new DbQuery(duckDb);
    const result = await dbQuery.getSwapVolume(req.query);
    res.status(200).send(result);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/v1/swap/historical", async (req: Request<{}, {}, {}, GetSwapHistory>, res) => {
  try {
    if (!req.query.offerDenom || !req.query.askDenom) {
      return res.status(400).send("Not enough query params: offerDenom | askDenom");
    }
    const duckDb = DuckDb.instances;
    const dbQuery = new DbQuery(duckDb);

    const result = await dbQuery.getSwapHistory(req.query);
    res.status(200).send(result);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

process.on("uncaughtException", (error) => {
  console.log("uncaughtException", error);
});

process.on("unhandledRejection", (error) => {
  console.log("unhandledRejection", error);
});

app
  .listen(port, hostname, async () => {
    // sync data for the service to read
    duckDb = await DuckDb.create(process.env.DUCKDB_PROD_FILENAME);
    duckDb.conn.exec("SET memory_limit='1000MB'");

    const oraidexSync = await OraiDexSync.create(
      duckDb,
      process.env.RPC_URL || "https://rpc.orai.io",
      process.env as any
    );
    oraidexSync.sync();
    console.log(`[server]: oraiDEX info server is running at http://${hostname}:${port}`);
  })
  .on("error", (err) => {
    console.log("error when start oraiDEX server", err);
    process.exit(1);
  });
