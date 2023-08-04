#!/usr/bin/env node

import "dotenv/config";
import express, { Request } from "express";
import {
  DuckDb,
  TickerInfo,
  pairs,
  parseAssetInfoOnlyDenom,
  findPairAddress,
  toDisplay,
  OraiDexSync,
  simulateSwapPrice,
  pairsOnlyDenom,
  VolumeRange,
  oraiUsdtPairOnlyDenom,
  ORAI
} from "@oraichain/oraidex-sync";
import cors from "cors";
import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { OraiswapRouterQueryClient } from "@oraichain/oraidex-contracts-sdk";
import { getDate24hBeforeNow, getSpecificDateBeforeNow, pairToString, parseSymbolsToTickerId } from "./helper";
import { GetCandlesQuery } from "@oraichain/oraidex-sync";
import fs from "fs";
import path from "path";

const app = express();
app.use(cors());

let duckDb: DuckDb;

const port = parseInt(process.env.PORT) || 2024;
const hostname = process.env.HOSTNAME || "0.0.0.0";
const rpcUrl = process.env.RPC_URL || "https://rpc.orai.io";

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
    const cosmwasmClient = await CosmWasmClient.connect(rpcUrl);
    const routerContract = new OraiswapRouterQueryClient(
      cosmwasmClient,
      process.env.ROUTER_CONTRACT_ADDRESS || "orai1j0r67r9k8t34pnhy00x3ftuxuwg0r6r4p8p6rrc8az0ednzr8y9s3sj2sf"
    );
    const pairInfos = await duckDb.queryPairInfos();
    const latestTimestamp = endTime ? parseInt(endTime as string) : await duckDb.queryLatestTimestampSwapOps();
    const then = getDate24hBeforeNow(new Date(latestTimestamp * 1000)).getTime() / 1000;
    const data: TickerInfo[] = (
      await Promise.allSettled(
        pairs.map(async (pair) => {
          const symbols = pair.symbols;
          const pairAddr = findPairAddress(pairInfos, pair.asset_infos);
          const tickerId = parseSymbolsToTickerId(symbols);
          // const { baseIndex, targetIndex, target } = findUsdOraiInPair(pair.asset_infos);
          const baseIndex = 0;
          const targetIndex = 1;
          console.log(latestTimestamp, then);
          const baseInfo = parseAssetInfoOnlyDenom(pair.asset_infos[baseIndex]);
          const targetInfo = parseAssetInfoOnlyDenom(pair.asset_infos[targetIndex]);
          const volume = await duckDb.queryAllVolumeRange(baseInfo, targetInfo, then, latestTimestamp);
          let tickerInfo: TickerInfo = {
            ticker_id: tickerId,
            base_currency: symbols[baseIndex],
            target_currency: symbols[targetIndex],
            last_price: "",
            base_volume: toDisplay(BigInt(volume.volume[baseInfo])).toString(),
            target_volume: toDisplay(BigInt(volume.volume[targetInfo])).toString(),
            pool_id: pairAddr ?? "",
            base: symbols[baseIndex],
            target: symbols[targetIndex]
          };
          try {
            // reverse because in pairs, we put base info as first index
            const price = await simulateSwapPrice(pair.asset_infos, routerContract);
            tickerInfo.last_price = price;
          } catch (error) {
            tickerInfo.last_price = "0";
          }
          return tickerInfo;
        })
      )
    ).map((result) => {
      if (result.status === "fulfilled") return result.value;
      else console.log("result: ", result.reason);
    });
    console.table(data);
    res.status(200).send(data);
  } catch (error) {
    console.log("error: ", error);
    res.status(500).send(`Error: ${JSON.stringify(error)}`);
  }
});

// TODO: refactor this and add unit tests
app.get("/volume/v2/historical/chart", async (req, res) => {
  const { startTime, endTime, tf } = req.query;
  const timeFrame = tf ? parseInt(tf as string) : 60;
  const latestTimestamp = endTime ? parseInt(endTime as string) : await duckDb.queryLatestTimestampSwapOps();
  const then = startTime
    ? parseInt(startTime as string)
    : getSpecificDateBeforeNow(new Date(latestTimestamp * 1000), 259200).getTime() / 1000;
  const volumeInfos = await Promise.all(
    pairsOnlyDenom.map((pair) => {
      return duckDb.getVolumeRange(timeFrame, then, latestTimestamp, pairToString(pair.asset_infos));
    })
  );
  // console.log("volume infos: ", volumeInfos);
  let volumeRanges: { [time: string]: VolumeRange[] } = {};
  for (let volumePair of volumeInfos) {
    for (let volume of volumePair) {
      if (!volumeRanges[volume.time]) volumeRanges[volume.time] = [{ ...volume }];
      else volumeRanges[volume.time].push({ ...volume });
    }
  }
  let result = [];
  for (let [time, volumeData] of Object.entries(volumeRanges)) {
    const oraiUsdtVolumeData = volumeData.find((data) => data.pair === pairToString(oraiUsdtPairOnlyDenom));
    if (!oraiUsdtVolumeData) {
      res.status(500).send("Cannot find ORAI_USDT volume data in the volume list");
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
});

// app.get("/liquidity/v2/historical/chart", async (req, res) => {
//   let { start, end, tf } = req.query;
//   // start, end time is timestamp in ms. tf is the in sec
//   let timeframe: number;
//   console.log(start, end, tf);

//   try {
//     start = new Date(parseInt(start as string)).toISOString();
//     end = new Date(parseInt(end as string)).toISOString();
//     timeframe = parseInt(tf as string);
//   } catch (error) {
//     console.log("input error /liquidity/v2/historical/chart: ", error);
//     res.status(400).send(error);
//     return;
//   }

//   try {
//     const result = await duckDb.queryTotalLpTimeFrame(timeframe, start as string, end as string);
//     const cosmwasmClient = await CosmWasmClient.connect(rpcUrl);
//     cosmwasmClient.setQueryClientWithHeight(result[0].height);
//     const multicall = new MulticallQueryClient(
//       cosmwasmClient,
//       process.env.MULTICALL_CONTRACT_ADDRES || "orai1q7x644gmf7h8u8y6y8t9z9nnwl8djkmspypr6mxavsk9ual7dj0sxpmgwd"
//     );
//     const pairInfos = await duckDb.queryPairInfos();
//     const poolInfos = await getPoolInfos(
//       pairInfos.map(
//         (info) =>
//           ({
//             asset_infos: [JSON.parse(info.firstAssetInfo), JSON.parse(info.secondAssetInfo)],
//             commission_rate: info.commissionRate,
//             contract_addr: info.pairAddr,
//             liquidity_token: info.liquidityAddr,
//             oracle_addr: info.oracleAddr
//           } as PairInfo)
//       ),
//       multicall
//     );
//     let totalInitialLp = 0;
//     for (let info of poolInfos) {
//       totalInitialLp += parseInt(info.total_share);
//     }
//     console.log("total init lp: ", totalInitialLp);
//     const prefixSum = calculatePrefixSum(
//       totalInitialLp,
//       result.map((res) => ({ ...res, denom: "", amount: res.liquidity }))
//     );
//     console.log("prefix sum: ", prefixSum);
//     res.status(200).send("hello world");
//   } catch (error) {
//     console.log("server error /liquidity/v2/historical/chart: ", error);
//     res.status(500).send(JSON.stringify(error));
//   } finally {
//     return;
//   }
// });

app.get("/v1/candles/", async (req: Request<{}, {}, {}, GetCandlesQuery>, res) => {
  try {
    const candles = await duckDb.getOhlcvCandles(req.query);
    res.status(200).send(candles);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.listen(port, hostname, async () => {
  // sync data for the service to read
  // console.dir(pairInfos, { depth: null });
  duckDb = await DuckDb.create(process.env.DUCKDB_PROD_FILENAME || "oraidex-sync-data");
  const oraidexSync = await OraiDexSync.create(
    duckDb,
    process.env.RPC_URL || "https://rpc.orai.io",
    process.env as any
  );
  oraidexSync.sync();
  console.log(`[server]: oraiDEX info server is running at http://${hostname}:${port}`);
});
