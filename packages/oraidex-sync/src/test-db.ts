import { DuckDb } from "./db";
import { calculatePrefixSum } from "./helper";

const start = async () => {
  const duckDb = await DuckDb.create("oraidex-sync-data-test");
  const startTime = new Date("2023-07-06T00:00:00.000Z");
  const endTime = new Date("2023-07-12T00:00:00.000Z");
  console.log(startTime.getTime(), endTime.getTime());
  const result = await duckDb.queryTotalLpTimeFrame(86400, startTime.toISOString(), endTime.toISOString());
  console.log("result: ", result);
  // const newData = calculatePrefixSum(
  //   100000000000,
  //   result.map((res) => ({ denom: "", amount: res.liquidity }))
  // );
  // console.log("new data: ", newData);
};

start();
