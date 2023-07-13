import { duckDb } from "../src";
import {
  ProvideLiquidityOperationData,
  SwapOperationData,
  TxAnlysisResult,
  WithdrawLiquidityOperationData
} from "./types";

async function insertSwapOps(ops: SwapOperationData[]) {
  await duckDb.insertSwapOps(ops);
}

async function insertLiquidityOps(ops: ProvideLiquidityOperationData[] | WithdrawLiquidityOperationData[]) {
  await duckDb.insertLpOps(ops);
}

async function insertParsedTxs(txs: TxAnlysisResult) {
  // insert swap ops
  const results = await Promise.all([
    insertSwapOps(txs.swapOpsData),
    insertLiquidityOps(txs.provideLiquidityOpsData),
    insertLiquidityOps(txs.withdrawLiquidityOpsData)
  ]);
  console.log("insert results: ", results);
}

export { insertParsedTxs };
