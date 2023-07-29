import { DuckDb } from "../src/db";
import { isoToTimestampNumber } from "../src/helper";
import { ProvideLiquidityOperationData } from "../src/types";

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
          direction: "Buy",
          offerAmount: 10000,
          offerDenom: "atom",
          uniqueKey: "1",
          returnAmount: 100,
          spreadAmount: 0,
          taxAmount: 0,
          timestamp: 168961006800 / 1000,
          txhash: "foo",
          txheight: 1
        },
        {
          askDenom: "orai",
          commissionAmount: 0,
          direction: "Buy",
          offerAmount: 10,
          offerDenom: "atom",
          uniqueKey: "2",
          returnAmount: 1,
          spreadAmount: 0,
          taxAmount: 0,
          timestamp: 1589610068000 / 1000,
          txhash: "foo",
          txheight: 1
        },
        {
          askDenom: "atom",
          commissionAmount: 0,
          direction: "Sell",
          offerAmount: 10,
          offerDenom: "orai",
          uniqueKey: "3",
          returnAmount: 1,
          spreadAmount: 0,
          taxAmount: 0,
          timestamp: 1589610068000 / 1000,
          txhash: "foo",
          txheight: 1
        },
        {
          askDenom: "atom",
          commissionAmount: 0,
          direction: "Sell",
          offerAmount: 10,
          offerDenom: "orai",
          uniqueKey: "4",
          returnAmount: 1,
          spreadAmount: 0,
          taxAmount: 0,
          timestamp: 1589610068000 / 1000,
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
        direction: "Buy",
        offerAmount: 10000,
        offerDenom: "atom",
        uniqueKey: "1",
        returnAmount: 100,
        spreadAmount: 0,
        taxAmount: 0,
        timestamp: new Date("2023-07-17T16:07:48.000Z").getTime() / 1000,
        txhash: "foo",
        txheight: 1
      },
      {
        askDenom: "atom",
        commissionAmount: 0,
        direction: "Sell",
        offerAmount: 10,
        offerDenom: "orai",
        uniqueKey: "2",
        returnAmount: 1,
        spreadAmount: 0,
        taxAmount: 0,
        timestamp: new Date("2023-07-16T16:07:48.000Z").getTime() / 1000,
        txhash: "foo",
        txheight: 1
      },
      {
        askDenom: "orai",
        commissionAmount: 0,
        direction: "Buy",
        offerAmount: 100000,
        offerDenom: "atom",
        uniqueKey: "3",
        returnAmount: 10000,
        spreadAmount: 0,
        taxAmount: 0,
        timestamp: new Date(1389610068000).getTime() / 1000,
        txhash: "foo",
        txheight: 1
      },
      {
        askDenom: "atom",
        commissionAmount: 0,
        direction: "Sell",
        offerAmount: 1000000,
        offerDenom: "orai",
        uniqueKey: "4",
        returnAmount: 10000,
        spreadAmount: 0,
        taxAmount: 0,
        timestamp: new Date(1389610068000).getTime() / 1000,
        txhash: "foo",
        txheight: 1
      }
    ]);
    let queryResult = await duckDb.queryAllVolumeRange(
      "orai",
      "atom",
      isoToTimestampNumber("2023-07-16T16:07:48.000Z"),
      isoToTimestampNumber("2023-07-17T16:07:48.000Z")
    );
    console.log("result: ", queryResult);
    expect(queryResult.volume["orai"]).toEqual(110);
    expect(queryResult.volume["atom"]).toEqual(10001);

    queryResult = await duckDb.queryAllVolumeRange(
      "orai",
      "atom",
      isoToTimestampNumber("2023-07-16T16:07:48.000Z"),
      isoToTimestampNumber("2023-07-17T16:07:48.000Z")
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
          basePrice: 1,
          txhash: "foo",
          timestamp: new Date().getTime() / 1000,
          baseTokenAmount: "abcd" as any,
          baseTokenReserve: 0,
          baseTokenDenom: "orai",
          uniqueKey: "1",
          quoteTokenAmount: 2,
          quoteTokenReserve: 0,
          quoteTokenDenom: "atom",
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
    const newDate = 1689610068000 / 1000;
    const data: ProvideLiquidityOperationData[] = [
      {
        basePrice: 1,
        baseTokenAmount: 1,
        baseTokenDenom: "orai",
        baseTokenReserve: 0,
        opType: "withdraw",
        uniqueKey: "2",
        quoteTokenAmount: 2,
        quoteTokenDenom: "atom",
        quoteTokenReserve: 0,
        timestamp: newDate,
        txCreator: "foobar",
        txhash: "foo",
        txheight: 1
      }
    ];
    await duckDb.insertLpOps(data);
    let queryResult = await duckDb.queryLpOps();
    queryResult[0].timestamp = queryResult[0].timestamp;
    expect(queryResult[0]).toEqual(data[0]);
  });

  it("test-insert-same-unique-key-should-replace-data", async () => {
    // setup
    duckDb = await DuckDb.create(":memory:");
    await Promise.all([duckDb.createHeightSnapshot(), duckDb.createLiquidityOpsTable(), duckDb.createSwapOpsTable()]);
    const currentTimeStamp = Math.round(new Date().getTime() / 1000);
    let data: ProvideLiquidityOperationData[] = [
      {
        basePrice: 1,
        baseTokenAmount: 1,
        baseTokenDenom: "orai",
        baseTokenReserve: 0,
        opType: "withdraw",
        uniqueKey: "2",
        quoteTokenAmount: 2,
        quoteTokenDenom: "atom",
        quoteTokenReserve: 0,
        timestamp: currentTimeStamp,
        txCreator: "foobar",
        txhash: "foo",
        txheight: 1
      }
    ];
    await duckDb.insertLpOps(data);

    let queryResult = await duckDb.queryLpOps();
    expect(queryResult[0]).toEqual(data[0]);

    // now we insert another one. Data should be the same
    await duckDb.insertLpOps(data);

    queryResult = await duckDb.queryLpOps();
    expect(queryResult.length).toEqual(1);
    expect(queryResult[0]).toEqual(data[0]);

    // when insert a different unique key, then the length increases to 2
    data[0].uniqueKey = "3";
    await duckDb.insertLpOps(data);
    queryResult = await duckDb.queryLpOps();
    expect(queryResult.length).toEqual(2);
  });
});
