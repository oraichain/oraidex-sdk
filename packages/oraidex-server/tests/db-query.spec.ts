import { DbQuery } from "./../src/db-query";
import { DuckDb } from "@oraichain/oraidex-sync";
import * as helper from "./../src/helper";

describe("test-db-query", () => {
  it.each<["day" | "week" | "month", bigint, bigint, number[]]>([
    ["day", 1000000n, 2000000n, [1, 2, 2]],
    ["week", 1000000n, 2000000n, [3, 2]],
    ["month", 1000000n, 2000000n, [3, 2]]
  ])("test-getSwapVolume", async (type, value1, value2, expectedResult) => {
    // setup
    const pair =
      "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd-orai1lus0f0rhx8s03gdllx2n6vhkmf0536dv57wfge";
    const duckdb = await DuckDb.create(":memory:");
    const dbQuery = new DbQuery(duckdb);

    await duckdb.createSwapOhlcv();
    await duckdb.insertOhlcv([
      {
        uniqueKey: "1",
        timestamp: 1708387200, // Tuesday, 20 February 2024 00:00:00
        pair,
        volume: value1, // base volume
        open: 2,
        close: 2,
        low: 2,
        high: 2
      },
      {
        uniqueKey: "2",
        timestamp: 1708473600, // Tuesday, 21 February 2024 00:00:00
        pair,
        volume: value2,
        open: 2,
        close: 2,
        low: 2,
        high: 2
      },
      {
        uniqueKey: "3",
        timestamp: 1710906613, // Wednesday, 20 March 2024 03:50:13
        pair,
        volume: value2,
        open: 2,
        close: 2,
        low: 2,
        high: 2
      }
    ]);

    // mock price orai = 1 usdt
    jest.spyOn(helper, "getPriceAssetByUsdtWithTimestamp").mockResolvedValue(1);

    // act
    const result = await dbQuery.getSwapVolume({ pair, type });

    // assert
    result.map((item, index) => {
      expect(item.value).toEqual(expectedResult[index]);
    });
  });

  it("test-getSwapVolumeAllPair", async () => {
    // setup
    const PAIR_ORAIX_USDC =
      "orai1lus0f0rhx8s03gdllx2n6vhkmf0536dv57wfge-orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd";
    const PAIR_ORAI_USDT = "orai-orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh";
    const duckdb = await DuckDb.create(":memory:");
    const dbQuery = new DbQuery(duckdb);

    await duckdb.createSwapOhlcv();
    await duckdb.insertOhlcv([
      {
        uniqueKey: "1",
        timestamp: 1708387200, // Tuesday, 20 February 2024 00:00:00
        pair: PAIR_ORAIX_USDC,
        volume: 1000000n, // base volume
        open: 2,
        close: 2,
        low: 2,
        high: 2
      },
      {
        uniqueKey: "2",
        timestamp: 1708473600, // Tuesday, 21 February 2024 00:00:00
        pair: PAIR_ORAI_USDT,
        volume: 1000000n,
        open: 2,
        close: 2,
        low: 2,
        high: 2
      },
      {
        uniqueKey: "3",
        timestamp: 1708473600, // Tuesday, 21 February 2024 00:00:00
        pair: PAIR_ORAIX_USDC,
        volume: 1000000n,
        open: 2,
        close: 2,
        low: 2,
        high: 2
      },
      {
        uniqueKey: "4",
        timestamp: 1710906613, // Wednesday, 20 March 2024 03:50:13
        pair: PAIR_ORAIX_USDC,
        volume: 1000000n,
        open: 2,
        close: 2,
        low: 2,
        high: 2
      }
    ]);

    // mock price orai = 1 usdt
    jest.spyOn(helper, "getPriceAssetByUsdtWithTimestamp").mockResolvedValue(1);

    // act
    const type = "day";
    const result = await dbQuery.getSwapVolumeAllPair({ type });

    // assert
    expect(result).toEqual([
      { time: "2024-02-19T17:00:00.000Z", value: 1 },
      { time: "2024-02-20T17:00:00.000Z", value: 2 },
      { time: "2024-03-19T17:00:00.000Z", value: 1 }
    ]);
  });
});
