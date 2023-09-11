import fs from "fs";
import { oraiInfo, usdtInfo } from "../src";
import { DuckDb } from "../src/db";
import { isoToTimestampNumber } from "../src/helper";
import { GetFeeSwap, GetVolumeQuery, PairInfoData, ProvideLiquidityOperationData } from "../src/types";
describe("test-duckdb", () => {
  let duckDb: DuckDb;
  afterAll(jest.resetModules);

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.resetAllMocks();
  });
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
          txheight: 1,
          taxRate: 1n
        }
      ])
    ).rejects.toThrow();
  });

  it("test-duckdb-insert-bulk-should-pass-and-can-query", async () => {
    //setup
    duckDb = await DuckDb.create(":memory:");
    await Promise.all([duckDb.createLiquidityOpsTable()]);
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
        txheight: 1,
        taxRate: 1
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
        txheight: 1,
        taxRate: 1
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

  it("test-updatePairInfoAmount-should-success", async () => {
    // setup
    duckDb = await DuckDb.create(":memory:");
    await duckDb.createPairInfosTable();
    await duckDb.insertPairInfos([
      {
        firstAssetInfo: JSON.stringify(oraiInfo),
        secondAssetInfo: JSON.stringify(usdtInfo),
        commissionRate: "",
        pairAddr: "orai1c5s03c3l336dgesne7dylnmhszw8554tsyy9yt",
        liquidityAddr: "",
        oracleAddr: "",
        symbols: "1",
        fromIconUrl: "1",
        toIconUrl: "1",
        offerPoolAmount: 1n,
        askPoolAmount: 1n
      } as PairInfoData
    ]);

    // act
    await duckDb.updatePairInfoAmount(2n, 3n, "orai1c5s03c3l336dgesne7dylnmhszw8554tsyy9yt");

    // assertion
    const pairInfoAfterUpdate = await duckDb.getPoolByAssetInfos([oraiInfo, usdtInfo]);
    expect(pairInfoAfterUpdate.offerPoolAmount).toEqual(2);
    expect(pairInfoAfterUpdate.askPoolAmount).toEqual(3);
  });

  it("test-getFeeSwap-should-return-correctly-fee-in-USDT", async () => {
    // setup
    duckDb = await DuckDb.create(":memory:");
    await duckDb.createSwapOpsTable();
    await duckDb.insertSwapOps([
      {
        askDenom: "orai",
        commissionAmount: 1e6,
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
        commissionAmount: 1e6,
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
      }
    ]);
    const payload: GetFeeSwap = {
      offerDenom: "orai",
      askDenom: "atom",
      startTime: 1589610068000 / 1000,
      endTime: 1689610068000 / 1000
    };

    // act
    const feeSwap = await duckDb.getFeeSwap(payload);

    // assertion
    expect(feeSwap).toEqual(2000000n);
  });

  it.each([
    ["invalid-pair", 1, 3, 0n],
    ["orai-usdt", 1, 3, 2n],
    ["orai-usdt", 1, 5, 3n]
  ])(
    "test-getVolumeSwap-should-return-correctly-volume-in-base-asset",
    async (pair: string, startTime: number, endTime: number, expectedResult: bigint) => {
      // setup
      duckDb = await DuckDb.create(":memory:");
      await duckDb.createSwapOhlcv();
      await duckDb.insertOhlcv([
        {
          uniqueKey: "1",
          timestamp: 1,
          pair: "orai-usdt",
          volume: 1n, // base volume
          open: 2,
          close: 2, // base price
          low: 2,
          high: 2
        },
        {
          uniqueKey: "2",
          timestamp: 3,
          pair: "orai-usdt",
          volume: 1n, // base volume
          open: 2,
          close: 2, // base price
          low: 2,
          high: 2
        },
        {
          uniqueKey: "3",
          timestamp: 5,
          pair: "orai-usdt",
          volume: 1n, // base volume
          open: 2,
          close: 2, // base price
          low: 2,
          high: 2
        }
      ]);

      const payload: GetVolumeQuery = {
        pair,
        startTime,
        endTime
      };

      // act
      const volumeSwap = await duckDb.getVolumeSwap(payload);

      // assertion
      expect(volumeSwap).toEqual(expectedResult);
    }
  );

  describe("test-get-fee-&-volume-liquidity", () => {
    // setup
    beforeAll(async () => {
      duckDb = await DuckDb.create(":memory:");
      await duckDb.createLiquidityOpsTable();
      await duckDb.insertLpOps([
        {
          basePrice: 1,
          baseTokenAmount: 1,
          baseTokenDenom: "orai",
          baseTokenReserve: 0,
          opType: "withdraw",
          uniqueKey: "1",
          quoteTokenAmount: 2,
          quoteTokenDenom: "atom",
          quoteTokenReserve: 0,
          timestamp: 1589610068000 / 1000,
          txCreator: "foobar",
          txhash: "foo",
          txheight: 1,
          taxRate: 1
        },
        {
          basePrice: 1,
          baseTokenAmount: 1,
          baseTokenDenom: "orai",
          baseTokenReserve: 0,
          opType: "provide",
          uniqueKey: "2",
          quoteTokenAmount: 2,
          quoteTokenDenom: "atom",
          quoteTokenReserve: 0,
          timestamp: 1589610068000 / 1000,
          txCreator: "foobar",
          txhash: "foo",
          txheight: 1,
          taxRate: 2
        }
      ]);
    });

    it("test-getFeeLiquidity-should-return-correctly-fee-in-USDT", async () => {
      const payload: GetFeeSwap = {
        offerDenom: "orai",
        askDenom: "atom",
        startTime: 1589610068000 / 1000,
        endTime: 1689610068000 / 1000
      };

      // act
      const feeSwap = await duckDb.getFeeLiquidity(payload);

      // assertion
      expect(feeSwap).toEqual(3n);
    });

    it("test-getVolumeLiquidity-should-return-correctly-volume-liquidity-in-base-asset", async () => {
      // act
      const payload: GetFeeSwap = {
        offerDenom: "orai",
        askDenom: "atom",
        startTime: 1589610068000 / 1000,
        endTime: 1689610068000 / 1000
      };
      const volumeByBaseAsset = await duckDb.getVolumeLiquidity(payload);

      // assertion
      expect(volumeByBaseAsset).toEqual(2n);
    });
  });
});
