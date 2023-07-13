import {
  ProvideLiquidityOperationData,
  SwapOperationData,
  TxAnlysisResult,
  WithdrawLiquidityOperationData,
} from "./types";

async function insertSwapOps(ops: SwapOperationData[]) {}

async function insertProvideLiquidityOps(
  ops: ProvideLiquidityOperationData[]
) {}

async function insertWithdrawLiquidityOps(
  ops: WithdrawLiquidityOperationData[]
) {}

async function insertParsedTxs(txs: TxAnlysisResult) {
  // insert swap ops
  const insertResults = await Promise.all([
    insertSwapOps(txs.swapOpsData),
    insertProvideLiquidityOps(txs.provideLiquidityOpsData),
    insertWithdrawLiquidityOps(txs.withdrawLiquidityOpsData),
  ]);
  console.log("insert results: ", insertResults);
  // insert provide liquidity ops
  // insert withdraw liquidity ops
}

export { insertParsedTxs };
