import { AssetInfo } from "@oraichain/oraidex-contracts-sdk";
import { PoolResponse } from "@oraichain/oraidex-contracts-sdk/build/OraiswapPair.types";
import {
  ORAI,
  airiCw20Adress,
  atomIbcDenom,
  injAddress,
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
import { pairs } from "../src/pairs";
import { LpOpsData, PairInfoData, ProvideLiquidityOperationData, SwapDirection, SwapOperationData } from "../src/types";
import { DuckDb, collectAccumulateLpAndSwapData, getVolumePairByAsset, getVolumePairByUsdt } from "../src";
import * as poolHelper from "../src/pool-helper";
import * as helper from "../src/helper";
import * as parse from "../src/parse";
import { SwapOperation } from "@oraichain/oraidex-contracts-sdk/build/OraiswapRouter.types";
import { BTC_CONTRACT, WETH_CONTRACT, pairLpTokens } from "@oraichain/oraidex-common";

describe("test-helper", () => {
  let duckDb: DuckDb;
  beforeAll(async () => {
    duckDb = await DuckDb.create(":memory:");
  });
  afterEach(jest.restoreAllMocks);

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
        toIconUrl: "1"
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
        lp_token: pairLpTokens.AIRI_ORAI,
        symbols: ["AIRI", "ORAI"],
        factoryV1: true
      },
      {
        asset_infos: [{ token: { contract_addr: oraixCw20Address } }, { native_token: { denom: ORAI } }],
        lp_token: pairLpTokens.ORAIX_ORAI,
        symbols: ["ORAIX", "ORAI"],
        factoryV1: true
      },
      {
        asset_infos: [{ token: { contract_addr: scOraiCw20Address } }, { native_token: { denom: ORAI } }],
        lp_token: pairLpTokens.SCORAI_ORAI,
        symbols: ["scORAI", "ORAI"]
      },
      {
        asset_infos: [{ native_token: { denom: ORAI } }, { native_token: { denom: atomIbcDenom } }],
        lp_token: pairLpTokens.ATOM_ORAI,
        symbols: ["ORAI", "ATOM"],
        factoryV1: true
      },
      {
        asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: usdtCw20Address } }],
        lp_token: pairLpTokens.USDT_ORAI,
        symbols: ["ORAI", "USDT"],
        factoryV1: true
      },
      {
        asset_infos: [{ token: { contract_addr: kwtCw20Address } }, { native_token: { denom: ORAI } }],
        lp_token: pairLpTokens.KWT_ORAI,
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
        lp_token: pairLpTokens.OSMO_ORAI,
        symbols: ["ORAI", "OSMO"],
        factoryV1: true
      },
      {
        asset_infos: [{ token: { contract_addr: milkyCw20Address } }, { token: { contract_addr: usdtCw20Address } }],
        lp_token: pairLpTokens.MILKY_USDT,
        symbols: ["MILKY", "USDT"],
        factoryV1: true
      },
      {
        asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: usdcCw20Address } }],
        lp_token: pairLpTokens.USDC_ORAI,
        symbols: ["ORAI", "USDC"]
      },
      {
        asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: tronCw20Address } }],
        lp_token: pairLpTokens.TRX_ORAI,
        symbols: ["ORAI", "wTRX"]
      },
      {
        asset_infos: [{ token: { contract_addr: scAtomCw20Address } }, { native_token: { denom: atomIbcDenom } }],
        lp_token: pairLpTokens.SCATOM_ATOM,
        symbols: ["scATOM", "ATOM"]
      },
      // we will reverse order for this pair in api /tickers for Coingecko
      {
        asset_infos: [{ token: { contract_addr: injAddress } }, { native_token: { denom: ORAI } }],
        lp_token: pairLpTokens.INJ_ORAI,
        symbols: ["INJ", "ORAI"]
      },
      {
        asset_infos: [{ token: { contract_addr: usdcCw20Address } }, { token: { contract_addr: oraixCw20Address } }],
        lp_token: pairLpTokens.USDC_ORAIX,
        symbols: ["USDC", "ORAIX"]
      },
      {
        asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: WETH_CONTRACT } }],
        lp_token: pairLpTokens.ORAI_WETH,
        symbols: ["ORAI", "WETH"]
      },
      {
        asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: BTC_CONTRACT } }],
        lp_token: pairLpTokens.ORAI_BTC,
        symbols: ["ORAI", "BTC"]
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
    // setup, test with orai/usdt
    jest.spyOn(duckDb, "getPoolByAssetInfos").mockResolvedValue({
      firstAssetInfo: JSON.stringify(oraiInfo),
      secondAssetInfo: JSON.stringify(usdtInfo),
      commissionRate: "",
      pairAddr: "oraiUsdtPairAddr",
      liquidityAddr: "",
      oracleAddr: "",
      symbols: "1",
      fromIconUrl: "1",
      toIconUrl: "1"
    });
    const poolResponses: PoolResponse[] = [
      {
        assets: [
          { info: oraiInfo, amount: "1" },
          { info: usdtInfo, amount: "1" }
        ],
        total_share: "1"
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
        baseTokenAmount: 2,
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
        quoteTokenDenom: usdtCw20Address,
        direction: "Buy",
        height: 2,
        timestamp: 1
      }
    ];
    jest.spyOn(helper, "recalculateTotalShare").mockReturnValue(1n);

    // act
    const accumulatedData = await collectAccumulateLpAndSwapData(lpOpsData, poolResponses);

    // assertion
    expect(accumulatedData).toStrictEqual({
      oraiUsdtPairAddr: { askPoolAmount: 2n, height: 2, offerPoolAmount: 3n, timestamp: 1, totalShare: "1" }
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
    ["Buy" as SwapDirection, 100n, 200n, 2],
    ["Sell" as SwapDirection, 105n, 214n, 2.038095238095238]
  ])(
    "test-calculateBasePriceFromSwapOp",
    (direction: SwapDirection, basePoolAmount, quotePoolAmount, expectedPrice: number) => {
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
        commissionAmount: 1,
        basePoolAmount,
        quotePoolAmount
      } as SwapOperationData;
      // first case undefined, return 0
      expect(calculateBasePriceFromSwapOp(undefined as any)).toEqual(0);
      // other cases
      const price = calculateBasePriceFromSwapOp(swapOp);
      expect(price).toEqual(expectedPrice);
    }
  );

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

  it.each([
    ["case-asset-info-pairs-is-NOT-reversed", [oraiInfo, usdtInfo], false],
    ["case-asset-info-pairs-is-reversed", [usdtInfo, oraiInfo], true]
  ])(
    "test-isAssetInfoPairReverse-should-return-correctly",
    (_caseName: string, assetInfos: AssetInfo[], expectedResult: boolean) => {
      const result = helper.isAssetInfoPairReverse(assetInfos);
      expect(result).toBe(expectedResult);
    }
  );

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
    const result = parse.parsePoolAmount(poolInfo, assetInfo);

    // assertion
    expect(result).toEqual(expectedResult);
  });

  describe("test-get-pair-liquidity", () => {
    it.each([
      [0n, 0n, 0],
      [1n, 1n, 4]
    ])(
      "test-getPairLiquidity-should-return-correctly-liquidity-by-USDT",
      async (offerPoolAmount: bigint, askPoolAmount: bigint, expectedResult: number) => {
        // setup
        jest.spyOn(duckDb, "getLatestLpPoolAmount").mockResolvedValue({
          offerPoolAmount,
          askPoolAmount,
          timestamp: 1,
          height: 1,
          pairAddr: "oraiUsdtPairAddr",
          uniqueKey: "1",
          totalShare: "1"
        });
        jest.spyOn(poolHelper, "getPriceAssetByUsdt").mockResolvedValue(2);

        // act
        const poolInfo: PairInfoData = {
          firstAssetInfo: JSON.stringify(oraiInfo),
          secondAssetInfo: JSON.stringify(usdtInfo),
          commissionRate: "",
          pairAddr: "oraiUsdtPairAddr",
          liquidityAddr: "",
          oracleAddr: "",
          symbols: "1",
          fromIconUrl: "1",
          toIconUrl: "1"
        };

        const result = await helper.getPairLiquidity(poolInfo);

        // assertion
        expect(result).toEqual(expectedResult);
      }
    );
  });

  describe("test-get-volume-pairs", () => {
    it("test-getVolumePairByAsset-should-return-correctly-sum-volume-swap-&-liquidity", async () => {
      // setup mock
      jest.spyOn(duckDb, "getVolumeSwap").mockResolvedValue(1n);

      // act
      const result = await getVolumePairByAsset(["orai", "usdt"], new Date(1693394183), new Date(1693394183));

      // assert
      expect(result).toEqual(1n);
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
      expect(result.every((value) => value.volume === 1n));
    });
  });

  describe("test-get-fee-pair", () => {
    it("test-getFeePair-should-return-correctly-sum-fee-swap-&-liquidity", async () => {
      //setup mock
      jest.spyOn(helper, "getFeeSwapInUsdt").mockResolvedValue(1n);
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
      expect(result.every((value) => value.fee === 1n));
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

  it.each<[string, bigint]>([
    ["deposit", 1100n],
    ["withdraw", 900n]
  ])("test-recalculateTotalShare-should-calculate-correctly-total-share", (opType, expectedResult) => {
    // setup
    const totalShare = 1000n;
    const offerAmount = 1n;
    const askAmount = 1n;
    const offerPooAmount = 10n;
    const askPooAmount = 10n;

    // act
    const result = helper.recalculateTotalShare({
      totalShare,
      offerAmount,
      askAmount,
      offerPooAmount,
      askPooAmount,
      opType
    });

    // assertion
    expect(result).toEqual(expectedResult);
  });
});
