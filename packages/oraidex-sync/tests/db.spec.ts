import { DuckDb } from "../src/db";

describe("test-duckdb", () => {
  let duckDb: DuckDb;
  beforeAll(async () => {
    // fixture
    duckDb = new DuckDb();
    await duckDb.initDuckDb("oraidex-sync-data-test");
    await Promise.all([duckDb.createHeightSnapshot(), duckDb.createLiquidityOpsTable(), duckDb.createSwapOpsTable()]);
  });

  it("test-duckdb-insert-bulk-should-throw-error-when-wrong-data", async () => {
    // act & test
    await expect(
      duckDb.insertLpOps([
        {
          txhash: "foo",
          timestamp: new Date().toISOString(),
          firstTokenAmount: "abcd" as any,
          firstTokenDenom: "orai",
          secondTokenAmount: 2,
          secondTokenDenom: "atom",
          txCreator: "foobar",
          opType: "provide"
        }
      ])
    ).rejects.toThrow();
  });

  it("test-duckdb-insert-bulk-should-pass-and-can-query", async () => {
    // act & test
    await duckDb.insertLpOps([
      {
        txhash: "foo",
        timestamp: new Date().toISOString(),
        firstTokenAmount: 1,
        firstTokenDenom: "orai",
        secondTokenAmount: 2,
        secondTokenDenom: "atom",
        txCreator: "foobar",
        opType: "withdraw"
      }
    ]);
    const queryResult = await duckDb.queryLpOps();
    console.log("query result: ", queryResult);
  });
});
