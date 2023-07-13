import { duckDb } from ".";

async function querySwapOps() {
  return duckDb.querySwapOps();
}

async function queryLpOps() {
  return duckDb.queryLpOps();
}

export { queryLpOps, querySwapOps };
