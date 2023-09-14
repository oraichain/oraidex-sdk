import { AssetInfo, SwapOperation } from "@oraichain/oraidex-contracts-sdk";
import { PoolResponse } from "@oraichain/oraidex-contracts-sdk/build/OraiswapPair.types";
import {
  ORAI,
  airiCw20Adress,
  atomIbcDenom,
  kwtCw20Address,
  milkyCw20Address,
  oraiInfo,
  oraixCw20Address,
  osmosisIbcDenom,
  scAtomCw20Address,
  scOraiCw20Address,
  tronCw20Address,
  usdcCw20Address,
  usdtCw20Address,
  usdtInfo
} from "../src/constants";
import {
  calculateBasePriceFromSwapOp,
  calculatePriceByPool,
  concatDataToUniqueKey,
  findAssetInfoPathToUsdt,
  findMappedTargetedAssetInfo,
  findPairAddress,
  findPairIndexFromDenoms,
  getSwapDirection,
  groupByTime,
  removeOpsDuplication,
  roundTime,
  toAmount,
  toDecimal,
  toDisplay
} from "../src/helper";
import { extractUniqueAndFlatten, pairs } from "../src/pairs";
import { LpOpsData, PairInfoData, ProvideLiquidityOperationData, SwapDirection, SwapOperationData } from "../src/types";
import { DuckDb, collectAccumulateLpAndSwapData, getVolumePairByAsset, getVolumePairByUsdt } from "../src";
import * as poolHelper from "../src/pool-helper";
import * as helper from "../src/helper";

describe("test-helper", () => {
  let duckDb: DuckDb;

  afterAll(jest.resetModules);
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.resetAllMocks();
  });
  describe("bigint", () => {
    describe("toAmount", () => {
      it("toAmount-percent", () => {
        const bondAmount = BigInt(1000);
        const percentValue = (toAmount(0.3, 6) * bondAmount) / BigInt(100000000);
        expect(percentValue.toString()).toBe("3");
      });

      it.each([
        [6000, 18, "6000000000000000000000"],
        [2000000, 18, "2000000000000000000000000"],
        [6000.5043177, 6, "6000504317"],
        [6000.504317725654, 6, "6000504317"],
        [0.0006863532, 6, "686"]
      ])(
        "toAmount number %.7f with decimal %d should return %s",
        (amount: number, decimal: number, expectedAmount: string) => {
          const res = toAmount(amount, decimal).toString();
          expect(res).toBe(expectedAmount);
        }
      );
    });

    describe("toDisplay", () => {
      it.each([
        ["1000", 6, "0.001", 6],
        ["454136345353413531", 15, "454.136345", 6],
        ["454136345353413531", 15, "454.13", 2],
        ["100000000000000", 18, "0.0001", 6]
      ])(
        "toDisplay number %d with decimal %d should return %s",
        (amount: string, decimal: number, expectedAmount: string, desDecimal: number) => {
          const res = toDisplay(amount, decimal, desDecimal).toString();
          expect(res).toBe(expectedAmount);
        }
      );
    });

    describe("toDecimal", () => {
      it("toDecimal-happy-path", async () => {
        const numerator = BigInt(6);
        const denominator = BigInt(3);
        const res = toDecimal(numerator, denominator);
        expect(res).toBe(2);
      });

      it("should return 0 when denominator is zero", async () => {
        const numerator = BigInt(123456);
        const denominator = BigInt(0);
        expect(toDecimal(numerator, denominator)).toBe(0);
      });

      it("should correctly convert a fraction into its equivalent decimal value", () => {
        const numerator = BigInt(1);
        const denominator = BigInt(3);

        // Convert the fraction to its decimal value using toDecimal.
        const decimalValue = toDecimal(numerator, denominator);
        // Expect the decimal value to be equal to the expected value.
        expect(decimalValue).toBeCloseTo(0.333333, 6);
      });

      it.each([
        [BigInt(1), BigInt(3), 0.333333, 6],
        [BigInt(1), BigInt(3), 0.3333, 4],
        [BigInt(1), BigInt(2), 0.5, 6]
      ])(
        "should correctly convert a fraction into its equivalent decimal value",
        (numerator, denominator, expectedDecValue, desDecimal) => {
          // Convert the fraction to its decimal value using toDecimal.
          const decimalValue = toDecimal(numerator, denominator);
          // Expect the decimal value to be equal to the expected value.
          expect(decimalValue).toBeCloseTo(expectedDecValue, desDecimal);
        }
      );
    });
  });

  it.each<[AssetInfo, number]>([
    [{ token: { contract_addr: usdtCw20Address } }, 2],
    [{ token: { contract_addr: usdcCw20Address } }, 1],
    [{ native_token: { denom: "orai" } }, 9],
    [{ token: { contract_addr: airiCw20Adress } }, 1]
  ])("test-findMappedTargetedAssetInfo", (info, expectedListLength) => {
    // setup

    // act
    const result = findMappedTargetedAssetInfo(info);

    // assert
    expect(result.length).toEqual(expectedListLength);
  });

  it.each<[AssetInfo, number]>([
    [{ token: { contract_addr: usdtCw20Address } }, 1],
    [{ native_token: { denom: "orai" } }, 2],
    [{ token: { contract_addr: airiCw20Adress } }, 3],
    [{ token: { contract_addr: milkyCw20Address } }, 2],
    [{ token: { contract_addr: scAtomCw20Address } }, 4]
  ])("test-findAssetInfoPathToUsdt", (info, expectedListLength) => {
    // setup

    // act
    const result = findAssetInfoPathToUsdt(info);

    // assert
    expect(result.length).toEqual(expectedListLength);
  });

  it("test-extractUniqueAndFlatten-extracting-unique-items-in-pair-mapping", () => {
    // act
    const result = extractUniqueAndFlatten(pairs);
    // assert
    expect(result).toEqual([
      { token: { contract_addr: "orai10ldgzued6zjp0mkqwsv2mux3ml50l97c74x8sg" } },
      { native_token: { denom: "orai" } },
      { token: { contract_addr: "orai1lus0f0rhx8s03gdllx2n6vhkmf0536dv57wfge" } },
      {
        token: { contract_addr: "orai1065qe48g7aemju045aeyprflytemx7kecxkf5m7u5h5mphd0qlcs47pclp" }
      },
      {
        native_token: { denom: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78" }
      },
      { token: { contract_addr: "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh" } },
      { token: { contract_addr: "orai1nd4r053e3kgedgld2ymen8l9yrw8xpjyaal7j5" } },
      {
        native_token: { denom: "ibc/9C4DCD21B48231D0BC2AC3D1B74A864746B37E4292694C93C617324250D002FC" }
      },
      { token: { contract_addr: "orai1gzvndtzceqwfymu2kqhta2jn6gmzxvzqwdgvjw" } },
      {
        token: { contract_addr: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd" }
      },
      {
        token: { contract_addr: "orai1c7tpjenafvgjtgm9aqwm7afnke6c56hpdms8jc6md40xs3ugd0es5encn0" }
      },
      {
        token: { contract_addr: "orai19q4qak2g3cj2xc2y3060t0quzn3gfhzx08rjlrdd3vqxhjtat0cq668phq" }
      }
    ]);
  });
  it.each<[AssetInfo, string | undefined]>([
    [{ token: { contract_addr: usdtCw20Address } }, "orai1c5s03c3l336dgesne7dylnmhszw8554tsyy9yt"],
    [{ token: { contract_addr: "foo" } }, undefined]
  ])("test-findPairAddress", (assetInfo, expectedPairAddr) => {
    // setup
    let pairInfoData: PairInfoData[] = [
      {
        firstAssetInfo: JSON.stringify({ native_token: { denom: ORAI } } as AssetInfo),
        secondAssetInfo: JSON.stringify({ token: { contract_addr: usdtCw20Address } } as AssetInfo),
        commissionRate: "",
        pairAddr: "orai1c5s03c3l336dgesne7dylnmhszw8554tsyy9yt",
        liquidityAddr: "",
        oracleAddr: "",
        symbols: "1",
        fromIconUrl: "1",
        toIconUrl: "1",
        offerPoolAmount: 1n,
        askPoolAmount: 1n
      }
    ];
    let assetInfos: [AssetInfo, AssetInfo] = [{ native_token: { denom: ORAI } }, assetInfo];

    // act
    const result = findPairAddress(pairInfoData, assetInfos);

    // assert
    expect(result).toEqual(expectedPairAddr);
  });

  it("test-pairs-should-persist-correct-order-and-has-correct-data", () => {
    // this test should be updated once there's a new pair coming
    expect(pairs).toEqual([
      {
        asset_infos: [{ token: { contract_addr: airiCw20Adress } }, { native_token: { denom: ORAI } }],
        symbols: ["AIRI", "ORAI"],
        factoryV1: true
      },
      {
        asset_infos: [{ token: { contract_addr: oraixCw20Address } }, { native_token: { denom: ORAI } }],
        symbols: ["ORAIX", "ORAI"],
        factoryV1: true
      },
      {
        asset_infos: [{ token: { contract_addr: scOraiCw20Address } }, { native_token: { denom: ORAI } }],
        symbols: ["scORAI", "ORAI"]
      },
      {
        asset_infos: [{ native_token: { denom: ORAI } }, { native_token: { denom: atomIbcDenom } }],
        symbols: ["ORAI", "ATOM"],
        factoryV1: true
      },
      {
        asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: usdtCw20Address } }],
        symbols: ["ORAI", "USDT"],
        factoryV1: true
      },
      {
        asset_infos: [{ token: { contract_addr: kwtCw20Address } }, { native_token: { denom: ORAI } }],
        symbols: ["KWT", "ORAI"],
        factoryV1: true
      },
      {
        asset_infos: [
          { native_token: { denom: ORAI } },
          {
            native_token: { denom: osmosisIbcDenom }
          }
        ],
        symbols: ["ORAI", "OSMO"],
        factoryV1: true
      },
      {
        asset_infos: [{ token: { contract_addr: milkyCw20Address } }, { token: { contract_addr: usdtCw20Address } }],
        symbols: ["MILKY", "USDT"],
        factoryV1: true
      },
      {
        asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: usdcCw20Address } }],
        symbols: ["ORAI", "USDC"]
      },
      {
        asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: tronCw20Address } }],
        symbols: ["ORAI", "WTRX"]
      },
      {
        asset_infos: [{ token: { contract_addr: scAtomCw20Address } }, { native_token: { denom: atomIbcDenom } }],
        symbols: ["scATOM", "ATOM"]
      }
    ]);
  });

  it.each([
    [new Date("2023-07-12T15:12:16.943634115Z").getTime(), 60, 1689174720],
    [new Date("2023-07-12T15:12:24.943634115Z").getTime(), 60, 1689174720],
    [new Date("2023-07-12T15:13:01.943634115Z").getTime(), 60, 1689174780]
  ])("test-roundTime", (date: number, interval: number, expectedResult) => {
    const roundedTime = roundTime(date, interval);
    expect(roundedTime).toEqual(expectedResult);
  });

  it("test-groupByTime-should-group-the-first-two-elements-into-one", () => {
    const data = [
      {
        askDenom: "orai",
        commissionAmount: 0,
        offerAmount: 10000,
        offerDenom: "atom",
        returnAmount: 100,
        spreadAmount: 0,
        taxAmount: 0,
        timestamp: 1690119727,
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
        timestamp: 1690119740,
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
        timestamp: 1690119800,
        txhash: "foo",
        txheight: 1
      }
    ];

    const result = groupByTime(data);
    expect(result).toEqual([
      {
        askDenom: "orai",
        commissionAmount: 0,
        offerAmount: 10000,
        offerDenom: "atom",
        returnAmount: 100,
        spreadAmount: 0,
        taxAmount: 0,
        timestamp: 1690119720,
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
        timestamp: 1690119720,
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
        timestamp: 1690119780,
        txhash: "foo",
        txheight: 1
      }
    ]);
  });

  it.each([
    [0, "2.747144"],
    [0.003, "2.738902568"]
  ])(
    "test-calculatePriceByPool-ORAI/USDT-pool-with-commision-rate=%s-should-return-price-%s-USDT",
    (commisionRate, expectedPrice) => {
      // base denom is ORAI, quote denom is USDT => base pool is ORAI, quote pool is USDT.
      const result = calculatePriceByPool(BigInt(639997269712), BigInt(232967274783), commisionRate, 10 ** 6);
      expect(result.toString()).toEqual(expectedPrice);
    }
  );

  it("test-collectAccumulateLpAndSwapData-should-aggregate-ops-with-same-pairs", async () => {
    // setup, test with orai/usdt & orai/atom pair
    const poolResponses: PoolResponse[] = [
      {
        assets: [
          { info: oraiInfo, amount: "1" },
          { info: usdtInfo, amount: "1" }
        ],
        total_share: "1"
      },
      {
        assets: [
          { info: oraiInfo, amount: "4" },
          { info: { native_token: { denom: atomIbcDenom } }, amount: "4" }
        ],
        total_share: "8"
      }
    ];

    const lpOpsData: LpOpsData[] = [
      {
        baseTokenAmount: 1,
        baseTokenDenom: ORAI,
        quoteTokenAmount: 1,
        quoteTokenDenom: usdtCw20Address,
        opType: "withdraw",
        height: 1,
        timestamp: 1
      },
      {
        baseTokenAmount: 2,
        baseTokenDenom: ORAI,
        quoteTokenAmount: 2,
        quoteTokenDenom: usdtCw20Address,
        opType: "provide",
        height: 1,
        timestamp: 1
      },
      {
        baseTokenAmount: 1,
        baseTokenDenom: ORAI,
        quoteTokenAmount: -1,
        quoteTokenDenom: usdtCw20Address,
        direction: "Buy",
        height: 1,
        timestamp: 1
      },
      {
        baseTokenAmount: 1,
        baseTokenDenom: ORAI,
        quoteTokenAmount: -1,
        quoteTokenDenom: usdtCw20Address,
        direction: "Sell",
        height: 1,
        timestamp: 1
      },
      {
        baseTokenAmount: 1,
        baseTokenDenom: ORAI,
        quoteTokenAmount: -1,
        quoteTokenDenom: atomIbcDenom,
        direction: "Sell",
        height: 1,
        timestamp: 1
      }
    ];
    duckDb = await DuckDb.create(":memory:");
    await duckDb.createPairInfosTable();

    await duckDb.insertPairInfos([
      {
        firstAssetInfo: JSON.stringify(oraiInfo),
        secondAssetInfo: JSON.stringify(usdtInfo),
        commissionRate: "",
        pairAddr: "oraiUsdtPairAddr",
        liquidityAddr: "",
        oracleAddr: "",
        symbols: "1",
        fromIconUrl: "1",
        toIconUrl: "1",
        offerPoolAmount: 1n,
        askPoolAmount: 1n
      },
      {
        firstAssetInfo: JSON.stringify(oraiInfo),
        secondAssetInfo: JSON.stringify({ native_token: { denom: atomIbcDenom } }),
        commissionRate: "",
        pairAddr: "oraiAtomPairAddr",
        liquidityAddr: "",
        oracleAddr: "",
        symbols: "1",
        fromIconUrl: "1",
        toIconUrl: "1",
        offerPoolAmount: 1n,
        askPoolAmount: 1n
      }
    ]);

    // act
    const accumulatedData = await collectAccumulateLpAndSwapData(lpOpsData, poolResponses);

    // assertion
    expect(accumulatedData).toStrictEqual({
      oraiUsdtPairAddr: { askPoolAmount: 2n, height: 1, offerPoolAmount: 2n, timestamp: 1 },
      oraiAtomPairAddr: { askPoolAmount: 3n, height: 1, offerPoolAmount: 5n, timestamp: 1 }
    });
  });

  it("test-concatDataToUniqueKey-should-return-unique-key-in-correct-order-from-timestamp-to-first-to-second-amount-and-denom", () => {
    // setup
    const firstDenom = "foo";
    const firstAmount = 1;
    const secondDenom = "bar";
    const secondAmount = 1;
    const txheight = 100;

    // act
    const result = concatDataToUniqueKey({ firstAmount, firstDenom, secondAmount, secondDenom, txheight });

    // assert
    expect(result).toEqual("100-foo-1-bar-1");
  });

  it("test-remove-ops-duplication-should-remove-duplication-keys-before-inserting", () => {
    const ops: ProvideLiquidityOperationData[] = [
      {
        basePrice: 1,
        baseTokenAmount: 1,
        baseTokenDenom: ORAI,
        quoteTokenAmount: 1,
        quoteTokenDenom: usdtCw20Address,
        baseTokenReserve: 1,
        quoteTokenReserve: 1,
        opType: "provide",
        uniqueKey: "1",
        timestamp: 1,
        txCreator: "a",
        txhash: "a",
        txheight: 1,
        taxRate: 1n
      },
      {
        basePrice: 1,
        baseTokenAmount: 1,
        baseTokenDenom: ORAI,
        quoteTokenAmount: 1,
        quoteTokenDenom: usdtCw20Address,
        baseTokenReserve: 1,
        quoteTokenReserve: 1,
        opType: "withdraw",
        uniqueKey: "2",
        timestamp: 1,
        txCreator: "a",
        txhash: "a",
        txheight: 1,
        taxRate: 1n
      },
      {
        basePrice: 1,
        baseTokenAmount: 1,
        baseTokenDenom: ORAI,
        quoteTokenAmount: 1,
        quoteTokenDenom: atomIbcDenom,
        baseTokenReserve: 1,
        quoteTokenReserve: 1,
        opType: "withdraw",
        uniqueKey: "1",
        timestamp: 1,
        txCreator: "a",
        txhash: "a",
        txheight: 1,
        taxRate: 1n
      }
    ];
    const newOps = removeOpsDuplication(ops);
    expect(newOps.length).toEqual(2);
    expect(newOps[1].uniqueKey).toEqual("2");
  });

  describe("test-ohlcv-calculation", () => {
    // setup
    const ops: SwapOperationData[] = [
      {
        offerAmount: 2,
        offerDenom: ORAI,
        returnAmount: 1,
        askDenom: usdtCw20Address,
        direction: "Buy",
        uniqueKey: "1",
        timestamp: 1,
        txCreator: "a",
        txhash: "a",
        txheight: 1,
        spreadAmount: 1,
        taxAmount: 1,
        commissionAmount: 1
      } as SwapOperationData,
      {
        offerAmount: 2,
        offerDenom: ORAI,
        returnAmount: 1,
        askDenom: usdtCw20Address,
        direction: "Sell",
        uniqueKey: "1",
        timestamp: 1,
        txCreator: "a",
        txhash: "a",
        txheight: 1,
        spreadAmount: 1,
        taxAmount: 1,
        commissionAmount: 1
      } as SwapOperationData,
      {
        offerAmount: 2,
        offerDenom: ORAI,
        returnAmount: 1,
        askDenom: atomIbcDenom,
        direction: "Sell",
        uniqueKey: "1",
        timestamp: 1,
        txCreator: "a",
        txhash: "a",
        txheight: 1,
        spreadAmount: 1,
        taxAmount: 1,
        commissionAmount: 1
      } as SwapOperationData
    ];
    const opsByPair = ops.slice(0, 2);

    it("test-calculateSwapOhlcv-should-return-correctly-swap-ohlcv", () => {
      // setup
      const pair = "orai-usdt";
      jest.spyOn(helper, "calculateBasePriceFromSwapOp").mockReturnValue(1);
      jest.spyOn(helper, "concatOhlcvToUniqueKey").mockReturnValue("orai-usdt-unique-key");

      // act
      const swapOhlcv = helper.calculateSwapOhlcv(opsByPair, pair);

      // assertion
      expect(swapOhlcv).toStrictEqual({
        uniqueKey: "orai-usdt-unique-key",
        timestamp: 1,
        pair,
        volume: 3n,
        open: 1,
        close: 1,
        low: 1,
        high: 1
      });
    });

    it("test-groupSwapOpsByPair-should-return-correctly-group-swap-ops-by-pair", () => {
      // act
      const result = helper.groupSwapOpsByPair(ops);

      // assertion
      expect(result[`${ORAI}-${usdtCw20Address}`].length).toEqual(opsByPair.length);
      expect(result[`${ORAI}-${usdtCw20Address}`][0]).toStrictEqual(opsByPair[0]);
      expect(result[`${ORAI}-${usdtCw20Address}`][1]).toStrictEqual(opsByPair[1]);
      expect(result[`${ORAI}-${atomIbcDenom}`][0]).toStrictEqual(ops[2]);
    });
  });

  it.each([
    ["Buy" as SwapDirection, 2],
    ["Sell" as SwapDirection, 0.5]
  ])("test-calculateBasePriceFromSwapOp", (direction: SwapDirection, expectedPrice: number) => {
    const swapOp = {
      offerAmount: 2,
      offerDenom: ORAI,
      returnAmount: 1,
      askDenom: usdtCw20Address,
      direction,
      uniqueKey: "1",
      timestamp: 1,
      txCreator: "a",
      txhash: "a",
      txheight: 1,
      spreadAmount: 1,
      taxAmount: 1,
      commissionAmount: 1
    } as SwapOperationData;
    // first case undefined, return 0
    expect(calculateBasePriceFromSwapOp(undefined as any)).toEqual(0);
    // other cases
    const price = calculateBasePriceFromSwapOp(swapOp);
    expect(price).toEqual(expectedPrice);
  });

  it.each([
    [usdtCw20Address, "orai", "Buy" as SwapDirection],
    ["orai", usdtCw20Address, "Sell" as SwapDirection],
    ["foo", "bar", undefined]
  ])("test-getSwapDirection", (offerDenom: string, askDenom: string, expectedDirection: SwapDirection | undefined) => {
    // execute
    const result = getSwapDirection(offerDenom, askDenom);
    expect(result).toEqual(expectedDirection);
  });

  it.each([
    ["orai", usdtCw20Address, 4],
    [usdtCw20Address, "orai", 4],
    ["orai", airiCw20Adress, 0],
    ["orai", "foo", -1]
  ])(
    "test-findPairIndexFromDenoms-given-%s-and-%s-should-return-index-%d-from-pair-list",
    (offerDenom: string, askDenom: string, expectedIndex: number) => {
      const result = findPairIndexFromDenoms(offerDenom, askDenom);
      expect(result).toEqual(expectedIndex);
    }
  );

  // it.each([
  //   ["case-asset-info-pairs-is-NOT-reversed", [oraiInfo, usdtInfo], false],
  //   ["case-asset-info-pairs-is-reversed", [usdtInfo, oraiInfo], true]
  // ])(
  //   "test-isAssetInfoPairReverse-should-return-correctly",
  //   (_caseName: string, assetInfos: AssetInfo[], expectedResult: boolean) => {
  //     const result = helper.isAssetInfoPairReverse(assetInfos);
  //     expect(result).toBe(expectedResult);
  //   }
  // );

  it("test-getSymbolFromAsset-should-throw-error-for-assetInfos-not-valid", () => {
    const asset_infos = [oraiInfo, { token: { contract_addr: "invalid-token" } }] as [AssetInfo, AssetInfo];
    expect(() => helper.getSymbolFromAsset(asset_infos)).toThrowError(
      `cannot found pair with asset_infos: ${JSON.stringify(asset_infos)}`
    );
  });

  it("test-getSymbolFromAsset-should-return-correctly-symbol-of-pair-for-valid-assetInfos", () => {
    const asset_infos = [oraiInfo, usdtInfo] as [AssetInfo, AssetInfo];
    expect(helper.getSymbolFromAsset(asset_infos)).toEqual("ORAI/USDT");
  });

  it.each([
    [oraiInfo, 1n],
    [{ native_token: { denom: atomIbcDenom } }, 0n]
  ])("test-parsePoolAmount-given-trueAsset-%p-should-return-%p", (assetInfo: AssetInfo, expectedResult: bigint) => {
    // setup
    const poolInfo: PoolResponse = {
      assets: [
        {
          info: oraiInfo,
          amount: "1"
        },
        {
          info: usdtInfo,
          amount: "1"
        }
      ],
      total_share: "5"
    };

    // act
    const result = helper.parsePoolAmount(poolInfo, assetInfo);

    // assertion
    expect(result).toEqual(expectedResult);
  });

  describe("test-get-pair-liquidity", () => {
    beforeEach(async () => {
      duckDb = await DuckDb.create(":memory:");
    });

    it.each([
      [0n, 0n, 0],
      [1n, 1n, 4]
    ])(
      "test-getPairLiquidity-should-return-correctly-liquidity-by-USDT",
      async (offerPoolAmount: bigint, askPoolAmount: bigint, expectedResult: number) => {
        // setup
        await duckDb.createPoolOpsTable();
        await duckDb.insertPoolAmountHistory([
          {
            offerPoolAmount,
            askPoolAmount,
            timestamp: 1,
            height: 1,
            pairAddr: "oraiUsdtPairAddr",
            uniqueKey: "1"
          }
        ]);
        const poolInfo: PairInfoData = {
          firstAssetInfo: JSON.stringify(oraiInfo),
          secondAssetInfo: JSON.stringify(usdtInfo),
          commissionRate: "",
          pairAddr: "oraiUsdtPairAddr",
          liquidityAddr: "",
          oracleAddr: "",
          symbols: "1",
          fromIconUrl: "1",
          toIconUrl: "1",
          offerPoolAmount,
          askPoolAmount
        };
        jest.spyOn(poolHelper, "getPriceAssetByUsdt").mockResolvedValue(2);

        // act
        const result = await helper.getPairLiquidity(poolInfo);

        // assertion
        expect(result).toEqual(expectedResult);
      }
    );
  });

  describe("test-get-volume-pairs", () => {
    it("test-getVolumePairByAsset-should-return-correctly-sum-volume-swap-&-liquidity", async () => {
      //setup mock
      duckDb = await DuckDb.create(":memory:");
      jest.spyOn(duckDb, "getVolumeSwap").mockResolvedValue(1n);
      jest.spyOn(duckDb, "getVolumeLiquidity").mockResolvedValue(1n);

      // act
      const result = await getVolumePairByAsset(["orai", "usdt"], new Date(1693394183), new Date(1693394183));

      // assert
      expect(result).toEqual(2n);
    });

    it("test-getVolumePairByUsdt-should-return-correctly-volume-pair-in-USDT", async () => {
      //setup
      const [baseAssetInfo, quoteAssetInfo] = [oraiInfo, usdtInfo];
      jest.spyOn(helper, "getVolumePairByAsset").mockResolvedValue(1n);
      jest.spyOn(poolHelper, "getPriceAssetByUsdt").mockResolvedValue(2);

      // act
      const result = await getVolumePairByUsdt(
        [baseAssetInfo, quoteAssetInfo],
        new Date(1693394183),
        new Date(1693394183)
      );

      // assert
      expect(result).toEqual(2n);
    });

    it("test-getAllVolume24h-should-return-correctly-volume-all-pair", async () => {
      //setup mock
      jest.spyOn(helper, "getVolumePairByUsdt").mockResolvedValue(1n);

      // act
      const result = await helper.getAllVolume24h();

      // assert
      expect(result.length).toEqual(pairs.length);
      expect(result.every((value) => value === 1n));
    });
  });

  describe("test-get-fee-pair", () => {
    it("test-getFeePair-should-return-correctly-sum-fee-swap-&-liquidity", async () => {
      //setup mock
      duckDb = await DuckDb.create(":memory:");
      jest.spyOn(duckDb, "getFeeSwap").mockResolvedValue(1n);
      jest.spyOn(duckDb, "getFeeLiquidity").mockResolvedValue(1n);

      // act
      const result = await helper.getFeePair([oraiInfo, usdtInfo], new Date(1693394183), new Date(1693394183));

      // assert
      expect(result).toEqual(2n);
    });

    it("test-getAllFees-should-return-correctly-fee-all-pair", async () => {
      //setup mock
      jest.spyOn(helper, "getFeePair").mockResolvedValue(1n);

      // act
      const result = await helper.getAllFees();

      // assert
      expect(result.length).toEqual(pairs.length);
      expect(result.every((value) => value === 1n));
    });
  });

  it.each([
    [
      [oraiInfo, usdtInfo],
      [
        {
          orai_swap: {
            offer_asset_info: oraiInfo,
            ask_asset_info: usdtInfo
          }
        }
      ]
    ],
    [
      [oraiInfo, usdtInfo, { native_token: { denom: atomIbcDenom } }],
      [
        {
          orai_swap: {
            offer_asset_info: oraiInfo,
            ask_asset_info: usdtInfo
          }
        },
        {
          orai_swap: {
            offer_asset_info: usdtInfo,
            ask_asset_info: { native_token: { denom: atomIbcDenom } }
          }
        }
      ]
    ]
  ])(
    "test-generateSwapOperations-should-return-correctly-swap-ops",
    (infoPath: AssetInfo[], expectedResult: SwapOperation[]) => {
      const result = helper.generateSwapOperations(infoPath);
      expect(result).toStrictEqual(expectedResult);
    }
  );
});
