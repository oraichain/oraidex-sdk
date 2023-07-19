import { DuckDb } from "../src/db";

describe("test-duckdb", () => {
  let duckDb: DuckDb;

  it.each<[string[], number[]]>([
    [
      ["orai", "atom"],
      [121, 10012]
    ],
    [
      ["atom", "orai"],
      [10012, 121]
    ]
  ])(
    "test-duckdb-queryAllVolume-should-return-correct-total-volume-given-%s-should-have-%d",
    async (denoms, expectedVolumes) => {
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
          txhash: "foo",
          txheight: 1
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
          txhash: "foo",
          txheight: 1
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
          txhash: "foo",
          txheight: 1
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
          txhash: "foo",
          txheight: 1
        }
      ]);
      let queryResult = await duckDb.queryAllVolume(denoms[0], denoms[1]);
      expect(queryResult.volume[denoms[0]]).toEqual(expectedVolumes[0]);
      expect(queryResult.volume[denoms[1]]).toEqual(expectedVolumes[1]);
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
        txhash: "foo",
        txheight: 1
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
        txhash: "foo",
        txheight: 1
      },
      {
        askDenom: "orai",
        commissionAmount: 0,
        offerAmount: 100000,
        offerDenom: "atom",
        returnAmount: 10000,
        spreadAmount: 0,
        taxAmount: 0,
        timestamp: new Date(1389610068000).toISOString(),
        txhash: "foo",
        txheight: 1
      },
      {
        askDenom: "atom",
        commissionAmount: 0,
        offerAmount: 1000000,
        offerDenom: "orai",
        returnAmount: 10000,
        spreadAmount: 0,
        taxAmount: 0,
        timestamp: new Date(1389610068000).toISOString(),
        txhash: "foo",
        txheight: 1
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
          opType: "provide",
          txheight: 1
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
        txhash: "foo",
        txheight: 1
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
      opType: "withdraw",
      txheight: 1
    });
  });

  it("test-realdb", async () => {
    duckDb = await DuckDb.create("oraidex-sync-data");
    await duckDb.queryAllLp();
    // const latestTimestamp = await duckDb.queryLatestTimestampSwapOps();
    // const now = new Date(latestTimestamp);
    // function getDate24hBeforeNow(time: Date) {
    //   const twentyFourHoursInMilliseconds = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    //   const date24hBeforeNow = new Date(time.getTime() - twentyFourHoursInMilliseconds);
    //   return date24hBeforeNow;
    // }
    // const then = getDate24hBeforeNow(now).toISOString();
    // // const baseVolume = await duckDb.queryAllVolumeRange("orai", then, now.toISOString());
    // const baseVolume = await duckDb.queryAllVolume("orai");
    // console.log("base volume: ", toDisplay(BigInt(baseVolume.volume)));
  });
});
