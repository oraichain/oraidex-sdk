import { DuckDb, PairInfoData } from "@oraichain/oraidex-sync";
import * as oraidexSyncPoolHelper from "@oraichain/oraidex-sync/build/pool-helper";
import * as oraidexSyncHelper from "@oraichain/oraidex-sync/build/helper";
import { CACHE_KEY, cache } from "../src/map-cache";
import { DbQuery, GetHistoricalChart } from "./../src/db-query";
import {
  ORAI,
  ORAIX_CONTRACT,
  ORAIX_INFO,
  ORAI_INFO,
  USDC_CONTRACT,
  USDC_INFO,
  USDT_CONTRACT
} from "@oraichain/oraidex-common";
import { AllPairsInfo } from "../src/helper";

describe("test-db-query", () => {
  afterEach(jest.restoreAllMocks);

  afterEach(() => {
    cache.set(CACHE_KEY.POOLS_INFO, []);
  });

  it("test-getSwapVolume-should-throw-error-when-input-pair-invalid", async () => {
    // arrange
    const input: GetHistoricalChart = {
      pair: "invalid-pair",
      type: "day"
    };
    const duckdb = await DuckDb.create(":memory:");
    const dbQuery = new DbQuery(duckdb);

    // act & assertion
    await expect(dbQuery.getSwapVolume(input)).rejects.toThrow(`Cannot find asset infos for pairAddr: ${input.pair}`);
  });

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
    const coingeckoPrices = {
      "oraichain-token": 1,
      oraidex: 1,
      tether: 1,
      "usd-coin": 1
    };
    cache.set(CACHE_KEY.COINGECKO_PRICES, coingeckoPrices);

    // act
    const result = await dbQuery.getSwapVolume({ pair, type });

    // assert
    result.map((item, index) => {
      expect(item.value).toEqual(expectedResult[index]);
    });
  });

  it.each<["day" | "week" | "month", number[]]>([
    ["day", [1, 2, 1]],
    ["week", [3, 1]],
    ["month", [3, 1]]
  ])("test-getSwapVolumeAllPair", async (type, expectedResult) => {
    // setup
    const PAIR_ORAIX_USDC =
      "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd-orai1lus0f0rhx8s03gdllx2n6vhkmf0536dv57wfge";
    const PAIR_ORAI_USDT = "orai-orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh";
    const duckdb = await DuckDb.create(":memory:");
    const dbQuery = new DbQuery(duckdb);

    await duckdb.createPairInfosTable();
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
    const coingeckoPrices = {
      "oraichain-token": 1,
      oraidex: 1,
      tether: 1,
      "usd-coin": 1
    };
    cache.set(CACHE_KEY.COINGECKO_PRICES, coingeckoPrices);

    // act
    const result = await dbQuery.getSwapVolumeAllPair({ type });

    // assert
    result.map((item, index) => {
      expect(item.value).toEqual(expectedResult[index]);
    });
  });

  it("test-getLiquidityChart-should-throw-error-when-input-pair-invalid", async () => {
    // arrange
    const input: GetHistoricalChart = {
      pair: "invalid-pair",
      type: "day"
    };
    const duckdb = await DuckDb.create(":memory:");
    const dbQuery = new DbQuery(duckdb);

    // act & assertion
    await expect(dbQuery.getLiquidityChart(input)).rejects.toThrow(
      `Cannot find asset infos for pairAddr: ${input.pair}`
    );
  });

  it("test-getLiquidityChart-should-throw-error-when-db-dont-have-pair-for-assetInfos", async () => {
    // arrange
    const input: GetHistoricalChart = {
      pair: `${ORAI}-${USDT_CONTRACT}`,
      type: "day"
    };
    const duckdb = await DuckDb.create(":memory:");
    const dbQuery = new DbQuery(duckdb);
    jest.spyOn(duckdb, "getPoolByAssetInfos").mockResolvedValue(undefined as any);

    // act & assertion
    await expect(dbQuery.getLiquidityChart(input)).rejects.toThrow(
      `Cannot find pair for assetInfos: ${JSON.stringify([ORAI_INFO, { token: { contract_addr: USDT_CONTRACT } }])}`
    );
  });

  it.each<["day" | "week" | "month", number[]]>([
    ["day", [4, 6, 5]],
    ["week", [6, 5]],
    ["month", [6, 5]]
  ])("test-getLiquidityChart", async (type, expectedResult) => {
    // setup
    const pair = "orai-orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh";
    const pairAddr = "orai1c5s03c3l336dgesne7dylnmhszw8554tsyy9yt"; // ORAI/USDT

    const duckdb = await DuckDb.create(":memory:");
    const dbQuery = new DbQuery(duckdb);

    await duckdb.createLpAmountHistoryTable();
    await duckdb.insertPoolAmountHistory([
      {
        offerPoolAmount: 1000000n,
        askPoolAmount: 1n,
        height: 1,
        timestamp: 1708387200, // Tuesday, 20 February 2024 00:00:00
        totalShare: "1",
        pairAddr,
        uniqueKey: "1"
      },
      {
        offerPoolAmount: 2000000n,
        askPoolAmount: 1n,
        height: 2,
        timestamp: 1708387201, // Tuesday, 20 February 2024 00:00:01
        totalShare: "1",
        pairAddr,
        uniqueKey: "2"
      },
      {
        offerPoolAmount: 3000000n,
        askPoolAmount: 1n,
        height: 3,
        timestamp: 1708473600, // Tuesday, 21 February 2024 00:00:00
        totalShare: "1",
        pairAddr,
        uniqueKey: "3"
      },
      {
        offerPoolAmount: 5000000n,
        askPoolAmount: 1n,
        height: 4,
        timestamp: 1710906613, // Wednesday, 20 March 2024 03:50:13
        totalShare: "1",
        pairAddr,
        uniqueKey: "4"
      },
      {
        offerPoolAmount: 4000000n,
        askPoolAmount: 1n,
        height: 5,
        timestamp: 1710906614, // Wednesday, 20 March 2024 03:50:14
        totalShare: "1",
        pairAddr,
        uniqueKey: "5"
      }
    ]);

    jest.spyOn(duckdb, "getPoolByAssetInfos").mockResolvedValue({ pairAddr } as PairInfoData);
    jest.spyOn(oraidexSyncPoolHelper, "getPriceAssetByUsdt").mockResolvedValue(1);

    // mock price orai = 1 usdt
    const coingeckoPrices = {
      "oraichain-token": 1
    };
    cache.set(CACHE_KEY.COINGECKO_PRICES, coingeckoPrices);

    // mock cached pools info to get latest lp in usdt
    cache.set(CACHE_KEY.POOLS_INFO, [
      {
        pairAddr,
        totalLiquidity: 5e6
      }
    ]);

    // act
    const result = await dbQuery.getLiquidityChart({ pair, type });

    // assert
    result.map((item, index) => {
      expect(item.value).toEqual(expectedResult[index]);
    });
  });

  it.each<["day" | "week" | "month", number[]]>([
    ["week", [10, 11]],
    ["month", [10, 11]]
  ])("test-getLiquidityChartAllPools", async (type, expectedResult) => {
    // setup
    const pairAddr = "orai1c5s03c3l336dgesne7dylnmhszw8554tsyy9yt"; // ORAI/USDT
    const pairAddrOraixUsdc = "orai19ttg0j7w5kr83js32tmwnwxxdq9rkmw4m3d7mn2j2hkpugwwa4tszwsnkg"; // ORAIX/USDC

    const duckdb = await DuckDb.create(":memory:");
    const dbQuery = new DbQuery(duckdb);

    await duckdb.createLpAmountHistoryTable();
    await duckdb.insertPoolAmountHistory([
      {
        offerPoolAmount: 1000000n,
        askPoolAmount: 1n,
        height: 1,
        timestamp: 1708387200, // Tuesday, 20 February 2024 00:00:00
        totalShare: "1",
        pairAddr,
        uniqueKey: "1"
      },
      {
        offerPoolAmount: 2000000n,
        askPoolAmount: 1n,
        height: 2,
        timestamp: 1708387201, // Tuesday, 20 February 2024 00:00:01
        totalShare: "1",
        pairAddr,
        uniqueKey: "2"
      },
      {
        offerPoolAmount: 2000000n,
        askPoolAmount: 1n,
        height: 2,
        timestamp: 1708387201, // Tuesday, 20 February 2024 00:00:01
        totalShare: "1",
        pairAddr: pairAddrOraixUsdc,
        uniqueKey: "2.1"
      },
      {
        offerPoolAmount: 3000000n,
        askPoolAmount: 1n,
        height: 3,
        timestamp: 1708473600, // Tuesday, 21 February 2024 00:00:00
        totalShare: "1",
        pairAddr,
        uniqueKey: "3"
      },
      {
        offerPoolAmount: 4000000n,
        askPoolAmount: 1n,
        height: 4,
        timestamp: 1710906613, // Wednesday, 20 March 2024 03:50:13
        totalShare: "1",
        pairAddr,
        uniqueKey: "4"
      },
      {
        offerPoolAmount: 4000000n,
        askPoolAmount: 1n,
        height: 4,
        timestamp: 1710906613, // Wednesday, 20 March 2024 03:50:13
        totalShare: "1",
        pairAddr: pairAddrOraixUsdc,
        uniqueKey: "4.1"
      },
      {
        offerPoolAmount: 5000000n,
        askPoolAmount: 1n,
        height: 5,
        timestamp: 1710906614, // Wednesday, 20 March 2024 03:50:14
        totalShare: "1",
        pairAddr,
        uniqueKey: "5"
      }
    ]);

    // insert pair orai/usdt & oraix/usdc
    await duckdb.createPairInfosTable();
    await duckdb.insertPairInfos([
      {
        firstAssetInfo: JSON.stringify(ORAI_INFO),
        secondAssetInfo: JSON.stringify({ token: { contract_addr: USDT_CONTRACT } }),
        commissionRate: "1",
        pairAddr: pairAddr,
        liquidityAddr: "1",
        oracleAddr: "1",
        symbols: "1",
        fromIconUrl: "1",
        toIconUrl: "1"
      },
      {
        firstAssetInfo: JSON.stringify({ token: { contract_addr: USDC_CONTRACT } }),
        secondAssetInfo: JSON.stringify({ token: { contract_addr: ORAIX_CONTRACT } }),
        commissionRate: "1",
        pairAddr: pairAddrOraixUsdc,
        liquidityAddr: "2",
        oracleAddr: "3",
        symbols: "1",
        fromIconUrl: "1",
        toIconUrl: "1"
      }
    ]);

    // mock price orai = 1 usdt
    const coingeckoPrices = {
      "oraichain-token": 1,
      oraidex: 1,
      "usd-coin": 1
    };
    cache.set(CACHE_KEY.COINGECKO_PRICES, coingeckoPrices);

    // mock cached pools info to get latest lp in usdt
    cache.set(CACHE_KEY.POOLS_INFO, [
      {
        pairAddr,
        totalLiquidity: 5e6
      },
      {
        pairAddr: pairAddrOraixUsdc,
        totalLiquidity: 6e6
      }
    ]);

    const pairs: AllPairsInfo[] = [
      {
        symbol: "orai/usdt",
        info: `${ORAI}-${USDT_CONTRACT}`,
        asset_infos: [ORAI_INFO, { token: { contract_addr: USDT_CONTRACT } }],
        symbols: ["ORAI", "USDT"]
      },
      {
        symbol: "usdc/oraix",
        info: `${USDC_CONTRACT}-${ORAIX_CONTRACT}`,
        asset_infos: [USDC_INFO, ORAIX_INFO],
        symbols: ["USDC", "ORAIX"]
      }
    ];

    // act
    const result = await dbQuery.getLiquidityChartAllPools({ type }, pairs);

    // assert
    result.map((item, index) => {
      expect(item.value).toEqual(expectedResult[index]);
    });
  });

  it.each<[string, number, number, number, number]>([["orai-usdt", 1710820213, 1710906613, 1, 2]])(
    "test-getSwapVolumeForPairByRangeTime",
    async (pair, then, now, basePriceInUsdt, expectedResult) => {
      // setup
      const duckdb = await DuckDb.create(":memory:");
      const dbQuery = new DbQuery(duckdb);

      await duckdb.createSwapOhlcv();
      await duckdb.insertOhlcv([
        {
          uniqueKey: "1",
          timestamp: 1708387200, // Tuesday, 20 February 2024 00:00:00
          pair,
          volume: 1000000n,
          open: 2,
          close: 2,
          low: 2,
          high: 2
        },
        {
          uniqueKey: "2",
          timestamp: 1710906600, // Wednesday, 20 March 2024 03:50:13
          pair,
          volume: 1000000n,
          open: 2,
          close: 2,
          low: 2,
          high: 2
        },
        {
          uniqueKey: "3",
          timestamp: 1710906613, // Wednesday, 20 March 2024 03:50:13
          pair,
          volume: 1000000n,
          open: 2,
          close: 2,
          low: 2,
          high: 2
        }
      ]);

      // act
      const result = await dbQuery.getSwapVolumeForPairByRangeTime(pair, then, now, basePriceInUsdt);

      // assert
      expect(result).toEqual(expectedResult);
    }
  );

  it("test-getLatestLiquidityPools", async () => {
    // setup
    const duckdb = await DuckDb.create(":memory:");
    const dbQuery = new DbQuery(duckdb);

    jest.spyOn(oraidexSyncHelper, "getPoolsFromDuckDb").mockResolvedValue([]);
    jest.spyOn(oraidexSyncPoolHelper, "getPoolLiquidities").mockResolvedValue([1, 2, 3, 4, 5]);

    // act
    const result = await dbQuery.getLatestLiquidityPools();

    // assert
    expect(result).toEqual(15);
  });
});