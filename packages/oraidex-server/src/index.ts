import * as dotenv from "dotenv";
import express from "express";
import {
  DuckDb,
  TickerInfo,
  pairs,
  parseAssetInfoOnlyDenom,
  findPairAddress,
  toDisplay,
  OraiDexSync,
  simulateSwapPrice,
  getPoolInfos,
  calculatePrefixSum,
  uniqueInfos,
  simulateSwapPriceWithUsdt
} from "@oraichain/oraidex-sync";
import cors from "cors";
import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { OraiswapRouterQueryClient, PairInfo } from "@oraichain/oraidex-contracts-sdk";
import { getDate24hBeforeNow, parseSymbolsToTickerId } from "./helper";
import { MulticallQueryClient } from "@oraichain/common-contracts-sdk";

dotenv.config();

const app = express();
app.use(cors());

let duckDb: DuckDb;

const port = parseInt(process.env.PORT) || 2024;
const hostname = process.env.HOSTNAME || "0.0.0.0";
const rpcUrl = process.env.RPC_URL || "https://rpc.orai.io";

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
    const data: TickerInfo[] = (
      await Promise.allSettled(
        pairs.map(async (pair) => {
          const symbols = pair.symbols;
          const pairAddr = findPairAddress(pairInfos, pair.asset_infos);
          const tickerId = parseSymbolsToTickerId(symbols);
          // const { baseIndex, targetIndex, target } = findUsdOraiInPair(pair.asset_infos);
          const baseIndex = 0;
          const targetIndex = 1;
          const latestTimestamp = endTime ? parseInt(endTime as string) : await duckDb.queryLatestTimestampSwapOps();
          const then = getDate24hBeforeNow(new Date(latestTimestamp * 1000)).getTime() / 1000;
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
  const timeFrame = parseInt(tf as string);
  const volumeInfos = await duckDb.pivotVolumeRange(parseInt(startTime as string), parseInt(endTime as string));
  const cosmwasmClient = await CosmWasmClient.connect(process.env.RPC_URL);
  let finalArray = [];
  let prices;
  let heightCount = 0;
  for (let i = 0; i < volumeInfos.length; i++) {
    const volInfo = volumeInfos[i];
    cosmwasmClient.setQueryClientWithHeight(volInfo.txheight);
    const router = new OraiswapRouterQueryClient(
      cosmwasmClient,
      process.env.ROUTER_CONTRACT_ADDRESS || "orai1j0r67r9k8t34pnhy00x3ftuxuwg0r6r4p8p6rrc8az0ednzr8y9s3sj2sf"
    );
    if (heightCount % 1000 === 0) {
      // prevent simulating too many times. TODO: calculate this using pool data from
      prices = (await Promise.all(uniqueInfos.map((info) => simulateSwapPriceWithUsdt(info, router))))
        .map((price) => ({ ...price, info: parseAssetInfoOnlyDenom(price.info) }))
        .reduce((acc, cur) => {
          acc[cur.info] = parseFloat(cur.amount);
          return acc;
        }, {});
    }
    let tempData = {};
    for (const key in volInfo) {
      if (key === "timestamp" || key === "txheight") continue;
      if (Object.keys(tempData).includes("volume_price")) {
        tempData["volume_price"] += volInfo[key] * prices[key];
      } else {
        tempData["timestamp"] = volInfo["timestamp"];
        tempData["volume_price"] = 0;
      }
    }
    const indexOf = finalArray.findIndex((data) => data.timestamp === tempData["timestamp"]);
    if (indexOf === -1) finalArray.push(tempData);
    else {
      finalArray[indexOf] = {
        ...finalArray[indexOf],
        volume_price: finalArray[indexOf].volume_price + tempData["volume_price"]
      };
    }
    heightCount++;
  }
  let finalFinalArray = [];
  for (let data of finalArray) {
    let time = Math.floor(data.timestamp / timeFrame);
    let index = finalFinalArray.findIndex((data) => data.timestamp === time);
    if (index === -1) {
      finalFinalArray.push({ timestamp: time, volume_price: data.volume_price });
    } else {
      finalFinalArray[index].volume_price += data.volume_price;
    }
  }
  res.status(200).send(finalFinalArray);
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
