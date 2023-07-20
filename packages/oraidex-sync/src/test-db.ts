import { CosmWasmClient, OraiswapRouterQueryClient, SwapOperation } from "@oraichain/oraidex-contracts-sdk";
import { DuckDb } from "./db";
import { SwapOperationData } from "./types";
import { pairs, uniqueInfos } from "./pairs";
import { parseAssetInfoOnlyDenom } from "./helper";
import { simulateSwapPriceWithUsdt } from "./query";
import "dotenv/config";

const start = async () => {
  const duckdb = await DuckDb.create("oraidex-sync-data");
  // const result = await duckdb.conn.all(
  //   `SELECT (timestamp // ?) as time,
  //       any_value(txheight) as height,
  //       sum(volume) as volume,
  //       denom,
  //       from volume_info
  //       where denom = ?
  //       group by time, denom
  //       order by time`,
  //   60,
  //   "orai"
  // );
  // result.forEach((item) => {
  //   item.time = parseInt((item.time * 60).toFixed(0));
  // });
  // console.log(result);
  let volumeInfos = await duckdb.conn.all(
    "pivot volume_info on denom using sum(volume) group by timestamp, txheight order by timestamp"
  );
  for (let volInfo of volumeInfos) {
    for (const key in volInfo) {
      if (volInfo[key] === null) volInfo[key] = 0;
    }
  }
  console.log("volume infos: ", volumeInfos);

  const cosmwasmClient = await CosmWasmClient.connect(process.env.RPC_URL);
  let finalArray = [];
  let prices;
  let heightCount = 0;
  for (let i = 0; i < volumeInfos.length; i++) {
    const volInfo = volumeInfos[i];
    cosmwasmClient.setQueryClientWithHeight(volInfo.txheight);
    const router = new OraiswapRouterQueryClient(
      cosmwasmClient,
      "orai1j0r67r9k8t34pnhy00x3ftuxuwg0r6r4p8p6rrc8az0ednzr8y9s3sj2sf"
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
    const indexOf = finalArray.findIndex(
      (data) => new Date(data.timestamp).toISOString() === new Date(tempData["timestamp"]).toISOString()
    );
    if (indexOf === -1) finalArray.push(tempData);
    else {
      finalArray[indexOf] = {
        ...finalArray[indexOf],
        volume_price: finalArray[indexOf].volume_price + tempData["volume_price"]
      };
    }
    heightCount++;
  }
  console.log("temp data: ", finalArray);
  // let swapTokenMap = [];
  // const baseVolume = 1000000000;
  // for (let i = 0; i < swapOps.length; i++) {
  //   const indexOf = swapTokenMap.findIndex(
  //     (swapMap) => new Date(swapMap.timestamp).toISOString() === new Date(swapOps[i].timestamp).toISOString()
  //   );
  //   console.log("index of: ", indexOf);
  //   if (indexOf === -1) {
  //     swapTokenMap.push({
  //       timestamp: swapOps[i].timestamp,
  //       tokenData: uniqueInfos.map((info) => {
  //         if (parseAssetInfoOnlyDenom(info) === swapOps[i].offerDenom) {
  //           return { denom: swapOps[i].offerDenom, amount: swapOps[i].offerAmount };
  //         }
  //         if (parseAssetInfoOnlyDenom(info) === swapOps[i].askDenom) {
  //           return { denom: swapOps[i].askDenom, amount: swapOps[i].returnAmount };
  //         }
  //         return { denom: parseAssetInfoOnlyDenom(info), amount: 0 };
  //       })
  //     });
  //   } else {
  //     swapTokenMap[indexOf] = {
  //       ...swapTokenMap[indexOf],
  //       tokenData: swapTokenMap[indexOf].tokenData.map((tokenData) => {
  //         if (tokenData.denom === swapOps[i].offerDenom)
  //           return { ...tokenData, amount: tokenData.amount + swapOps[i].offerAmount };
  //         if (tokenData.denom === swapOps[i].askDenom)
  //           return { ...tokenData, amount: tokenData.amount + swapOps[i].returnAmount };
  //         return tokenData;
  //       })
  //     };
  //   }
  // }
  // console.log(
  //   swapTokenMap.map((tokenMap) => ({
  //     ...tokenMap,
  //     tokenData: tokenMap.tokenData.reduce((acc, item) => {
  //       acc[item.denom] = item.amount;
  //       return acc;
  //     }, {})
  //   }))
  // );
  // const newData = calculatePrefixSum(
  //   100000000000,
  //   result.map((res) => ({ denom: "", amount: res.liquidity }))
  // );
  // console.log("new data: ", newData);
};

start();
