import { DuckDb } from "./db";

async function testAggregateLp() {
  const duckDb = await DuckDb.create("oraidex-sync-data");
  let result = await duckDb.conn.all(
    "select timestamp, firstTokenDenom, opType, sum(firstTokenAmount) as firstTokenAmount, if (opType ='provide', sum(firstTokenAmount), sum(firstTokenAmount) - sum(firstTokenAmount) * 2) as firstTokenAmount from lp_ops_data group by timestamp, firstTokenDenom, opType order by timestamp desc"
  );
  console.log("results: ", result);
  const currentLiquidity = 10000000000;
  let prefixSumObj = {};
  for (let data of result) {
    if (!(`temp-${data.firstTokenDenom}` in prefixSumObj)) {
      prefixSumObj[`temp-${data.firstTokenDenom}`] = currentLiquidity + data.firstTokenAmount;
      data.firstTokenAmount = prefixSumObj[`temp-${data.firstTokenDenom}`];
      continue;
    }
    prefixSumObj[`temp-${data.firstTokenDenom}`] += data.firstTokenAmount;
    data.firstTokenAmount = prefixSumObj[`temp-${data.firstTokenDenom}`];
  }
  console.log("new results: ", result);
}
