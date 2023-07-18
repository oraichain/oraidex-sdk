import { DuckDb } from "../src/db";
import { toDisplay } from "../src/helper";

describe("test-duckdb", () => {
  let duckDb: DuckDb;

  it.each<[string, number]>([
    ["hello", 10001]
    // ["orai", 100],
    // ["foo", 10]
  ])(
    "test-duckdb-queryAllVolume-should-return-correct-total-volume-given-%s-should-have-%d",
    async (denom, expectedVolume) => {
      duckDb = await DuckDb.create(":memory:");
      await Promise.all([duckDb.createHeightSnapshot(), duckDb.createLiquidityOpsTable(), duckDb.createSwapOpsTable()]);
      await duckDb.insertSwapOps([
        {
          askDenom: "orai",
          commissionAmount: 0,
          offerAmount: 10000,
          offerDenom: "atom",
          returnAmount: 100,
          spreadAmount: 0,
          taxAmount: 0,
          timestamp: new Date(1689610068000).toISOString(),
          txhash: "foo"
        },
        {
          askDenom: "orai",
          commissionAmount: 0,
          offerAmount: 10,
          offerDenom: "atom",
          returnAmount: 1,
          spreadAmount: 0,
          taxAmount: 0,
          timestamp: new Date(1589610068000).toISOString(),
          txhash: "foo"
        },
        {
          askDenom: "atom",
          commissionAmount: 0,
          offerAmount: 10,
          offerDenom: "orai",
          returnAmount: 1,
          spreadAmount: 0,
          taxAmount: 0,
          timestamp: new Date(1589610068000).toISOString(),
          txhash: "foo"
        },
        {
          askDenom: "atom",
          commissionAmount: 0,
          offerAmount: 10,
          offerDenom: "orai",
          returnAmount: 1,
          spreadAmount: 0,
          taxAmount: 0,
          timestamp: new Date(1589610068000).toISOString(),
          txhash: "foo"
        }
      ]);
      let queryResult = await duckDb.queryAllVolume("orai", "atom");
      console.log("query result: ", queryResult);
      expect(queryResult.volume["orai"]).toEqual(121);
      expect(queryResult.volume["atom"]).toEqual(10012);

      queryResult = await duckDb.queryAllVolume("atom", "orai");
      console.log("query result: ", queryResult);
      expect(queryResult.volume["orai"]).toEqual(121);
      expect(queryResult.volume["atom"]).toEqual(10012);
    }
  );

  it("test-query-volume-last-24h", async () => {
    duckDb = await DuckDb.create(":memory:");
    await Promise.all([duckDb.createHeightSnapshot(), duckDb.createLiquidityOpsTable(), duckDb.createSwapOpsTable()]);
    await duckDb.insertSwapOps([
      {
        askDenom: "orai",
        commissionAmount: 0,
        offerAmount: 10000,
        offerDenom: "atom",
        returnAmount: 100,
        spreadAmount: 0,
        taxAmount: 0,
        timestamp: new Date("2023-07-17T16:07:48.000Z").toISOString(),
        txhash: "foo"
      },
      {
        askDenom: "atom",
        commissionAmount: 0,
        offerAmount: 10,
        offerDenom: "orai",
        returnAmount: 1,
        spreadAmount: 0,
        taxAmount: 0,
        timestamp: new Date("2023-07-16T16:07:48.000Z").toISOString(),
        txhash: "foo"
      },
      {
        askDenom: "orai",
        commissionAmount: 0,
        offerAmount: 10,
        offerDenom: "atom",
        returnAmount: 1,
        spreadAmount: 0,
        taxAmount: 0,
        timestamp: new Date(1389610068000).toISOString(),
        txhash: "foo"
      },
      {
        askDenom: "atom",
        commissionAmount: 0,
        offerAmount: 10,
        offerDenom: "orai",
        returnAmount: 1,
        spreadAmount: 0,
        taxAmount: 0,
        timestamp: new Date(1389610068000).toISOString(),
        txhash: "foo"
      }
    ]);
    let queryResult = await duckDb.queryAllVolumeRange(
      "orai",
      "atom",
      "2023-07-16T16:07:48.000Z",
      "2023-07-17T16:07:48.000Z"
    );
    console.log("result: ", queryResult);
    expect(queryResult.volume["orai"]).toEqual(110);
    expect(queryResult.volume["atom"]).toEqual(10001);

    queryResult = await duckDb.queryAllVolumeRange(
      "orai",
      "atom",
      "2023-07-16T16:07:48.000Z",
      "2023-07-17T16:07:48.000Z"
    );
    expect(queryResult.volume["orai"]).toEqual(110);
    expect(queryResult.volume["atom"]).toEqual(10001);
  });

  it("test-duckdb-insert-bulk-should-throw-error-when-wrong-data", async () => {
    //setup
    duckDb = await DuckDb.create(":memory:");
    await Promise.all([duckDb.createHeightSnapshot(), duckDb.createLiquidityOpsTable(), duckDb.createSwapOpsTable()]);
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
    //setup
    duckDb = await DuckDb.create(":memory:");
    await Promise.all([duckDb.createHeightSnapshot(), duckDb.createLiquidityOpsTable(), duckDb.createSwapOpsTable()]);
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

  // it("test-realdb", async () => {
  //   duckDb = await DuckDb.create("oraidex-sync-data");
  //   const latestTimestamp = await duckDb.queryLatestTimestampSwapOps();
  //   const now = new Date(latestTimestamp);
  //   function getDate24hBeforeNow(time: Date) {
  //     const twentyFourHoursInMilliseconds = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  //     const date24hBeforeNow = new Date(time.getTime() - twentyFourHoursInMilliseconds);
  //     return date24hBeforeNow;
  //   }
  //   const then = getDate24hBeforeNow(now).toISOString();
  //   // const baseVolume = await duckDb.queryAllVolumeRange("orai", then, now.toISOString());
  //   const baseVolume = await duckDb.queryAllVolume("orai");
  //   console.log("base volume: ", toDisplay(BigInt(baseVolume.volume)));
  // });
});
