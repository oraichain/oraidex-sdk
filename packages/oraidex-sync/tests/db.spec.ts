import { DuckDb } from "../src/db";

describe("test-duckdb", () => {
  let duckDb: DuckDb;
  beforeAll(async () => {
    // fixture
    duckDb = await DuckDb.create(":memory:");
    await Promise.all([duckDb.createHeightSnapshot(), duckDb.createLiquidityOpsTable(), duckDb.createSwapOpsTable()]);
  });

  it("test-duckdb-queryLatestTimestampSwapOps-should-return-the-latest-timestamp-row", async () => {
    await duckDb.insertSwapOps([
      {
        txhash: "foo",
        timestamp: new Date(1689610068000).toISOString(),
        offerAmount: 1,
        offerDenom: "0",
        offerVolume: 1,
        askDenom: "orai",
        askVolume: 2,
        returnAmount: 0,
        taxAmount: 0,
        commissionAmount: 0,
        spreadAmount: 0
      },
      {
        txhash: "foo",
        timestamp: new Date(1589610068000).toISOString(),
        offerAmount: 1,
        offerDenom: "0",
        offerVolume: 1,
        askDenom: "orai",
        askVolume: 2,
        returnAmount: 0,
        taxAmount: 0,
        commissionAmount: 0,
        spreadAmount: 0
      }
    ]);
    const queryResult = await duckDb.queryLatestTimestampSwapOps();
    expect(new Date(queryResult[0].timestamp).toISOString()).toEqual(
      new Date("2023-07-17T16:07:48.000Z").toISOString()
    );
  });

  it("test-duckdb-insert-bulk-should-throw-error-when-wrong-data", async () => {
    // act & test
    await expect(
      duckDb.insertLpOps([
        {
          txhash: "foo",
          timestamp: new Date().toISOString(),
          firstTokenAmount: "abcd" as any,
          firstTokenLp: 0,
          firstTokenDenom: "orai",
          secondTokenAmount: 2,
          secondTokenLp: 0,
          secondTokenDenom: "atom",
          txCreator: "foobar",
          opType: "provide"
        }
      ])
    ).rejects.toThrow();
  });

  it("test-duckdb-insert-bulk-should-pass-and-can-query", async () => {
    // act & test
    const newDate = new Date().toISOString();
    await duckDb.insertLpOps([
      {
        txhash: "foo",
        timestamp: newDate,
        firstTokenAmount: 1,
        firstTokenLp: 0,
        firstTokenDenom: "orai",
        secondTokenAmount: 2,
        secondTokenLp: 0,
        secondTokenDenom: "atom",
        txCreator: "foobar",
        opType: "withdraw"
      }
    ]);
    const queryResult = await duckDb.queryLpOps();
    console.log("query result: ", queryResult);
    expect(queryResult[0]).toEqual({
      txhash: "foo",
      timestamp: newDate,
      firstTokenAmount: 1,
      firstTokenLp: 0,
      firstTokenDenom: "orai",
      secondTokenAmount: 2,
      secondTokenLp: 0,
      secondTokenDenom: "atom",
      txCreator: "foobar",
      opType: "withdraw"
    });
  });
});
