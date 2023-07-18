import { DuckDb } from "../src/db";

describe("test-duckdb", () => {
  let duckDb: DuckDb;
  beforeAll(async () => {
    // fixture
    duckDb = await DuckDb.create(":memory:");
    await Promise.all([duckDb.createHeightSnapshot(), duckDb.createLiquidityOpsTable(), duckDb.createSwapOpsTable()]);
  });

  it("test-duckdb-queryAllVolume-should-return-total-volume-of-hello", async () => {
    await duckDb.insertSwapOps([
      {
        askDenom: "orai",
        commissionAmount: 0,
        offerAmount: 10000,
        offerDenom: "hello",
        returnAmount: 0,
        spreadAmount: 0,
        taxAmount: 0,
        timestamp: new Date(1689610068000).toISOString(),
        txhash: "foo"
      },
      {
        askDenom: "hello",
        commissionAmount: 0,
        offerAmount: 0,
        offerDenom: "foo",
        returnAmount: 1,
        spreadAmount: 0,
        taxAmount: 0,
        timestamp: new Date(1589610068000).toISOString(),
        txhash: "foo"
      }
    ]);
    const queryResult = await duckDb.queryAllVolume("hello");
    expect(queryResult.volume).toEqual(10001);
    expect(queryResult.denom).toEqual("hello");
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
    const newDate = new Date(1689610068000).toISOString();
    await duckDb.insertLpOps([
      {
        firstTokenAmount: 1,
        firstTokenDenom: "orai",
        firstTokenLp: 0,
        opType: "withdraw",
        secondTokenAmount: 2,
        secondTokenDenom: "atom",
        secondTokenLp: 0,
        timestamp: newDate,
        txCreator: "foobar",
        txhash: "foo"
      }
    ]);
    let queryResult = await duckDb.queryLpOps();
    queryResult[0].timestamp = new Date(queryResult[0].timestamp).toISOString();
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
