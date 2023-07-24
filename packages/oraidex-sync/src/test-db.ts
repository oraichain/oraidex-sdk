import { CosmWasmClient, OraiswapRouterQueryClient, SwapOperation } from "@oraichain/oraidex-contracts-sdk";
import { DuckDb } from "./db";
import { SwapOperationData } from "./types";
import { pairs, uniqueInfos } from "./pairs";
import { groupByTime, parseAssetInfoOnlyDenom } from "./helper";
import { simulateSwapPriceWithUsdt } from "./query";
import "dotenv/config";

const start = async () => {
  const duckdb = await DuckDb.create("oraidex-sync-data-v1.2");
  const tf = 86400;
  const firstTokenResult = await duckdb.conn.all(
    `SELECT * 
        from swap_ops_data
        where timestamp >= 1690168508 and timestamp <= 1690169408 and askDenom = 'ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78'
        order by timestamp`
  );
  console.log(firstTokenResult);

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
