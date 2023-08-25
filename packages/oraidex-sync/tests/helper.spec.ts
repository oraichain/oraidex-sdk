import { AssetInfo } from "@oraichain/oraidex-contracts-sdk";
import {
  findAssetInfoPathToUsdt,
  findMappedTargetedAssetInfo,
  findPairAddress,
  calculatePriceByPool,
  toAmount,
  toDisplay,
  toDecimal,
  roundTime,
  groupByTime,
  collectAccumulateLpData,
  concatDataToUniqueKey,
  removeOpsDuplication,
  calculateBasePriceFromSwapOp,
  getSwapDirection,
  findPairIndexFromDenoms,
  toObject,
  calculateSwapOhlcv
} from "../src/helper";
import { extractUniqueAndFlatten, pairs } from "../src/pairs";
import {
  ORAI,
  airiCw20Adress,
  atomIbcDenom,
  kwtCw20Address,
  milkyCw20Address,
  oraixCw20Address,
  osmosisIbcDenom,
  scAtomCw20Address,
  scOraiCw20Address,
  tronCw20Address,
  usdcCw20Address,
  usdtCw20Address
} from "../src/constants";
import { PairInfoData, ProvideLiquidityOperationData, SwapDirection, SwapOperationData } from "../src/types";
import { PoolResponse } from "@oraichain/oraidex-contracts-sdk/build/OraiswapPair.types";

describe("test-helper", () => {
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
        volume24Hour: 1n,
        apr: 1,
        totalLiquidity: 1,
        fee7Days: 1n
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
      // const result = calculatePriceByPool(BigInt(639997269712), BigInt(232967274783), commisionRate, 10 ** 6);
      const result = calculatePriceByPool(BigInt(397832351391), BigInt(193971155696), commisionRate);
      console.log({ result });
      expect(result.toString()).toEqual(expectedPrice);
    }
  );

  it("test-collectAccumulateLpData-should-aggregate-ops-with-same-pairs", () => {
    const poolResponses: PoolResponse[] = [
      {
        assets: [
          { info: { native_token: { denom: ORAI } }, amount: "1" },
          { info: { token: { contract_addr: usdtCw20Address } }, amount: "1" }
        ],
        total_share: "2"
      },
      {
        assets: [
          { info: { native_token: { denom: ORAI } }, amount: "4" },
          { info: { token: { contract_addr: atomIbcDenom } }, amount: "4" }
        ],
        total_share: "8"
      }
    ];
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
        uniqueKey: "3",
        timestamp: 1,
        txCreator: "a",
        txhash: "a",
        txheight: 1,
        taxRate: 1n
      }
    ];

    collectAccumulateLpData(ops, poolResponses);
    expect(ops[0].baseTokenReserve.toString()).toEqual("2");
    expect(ops[0].quoteTokenReserve.toString()).toEqual("2");
    expect(ops[1].baseTokenReserve.toString()).toEqual("1");
    expect(ops[1].quoteTokenReserve.toString()).toEqual("1");
    expect(ops[2].baseTokenReserve.toString()).toEqual("3");
    expect(ops[2].quoteTokenReserve.toString()).toEqual("3");
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

  // it.each<[[AssetInfo, AssetInfo], AssetInfo, number]>([
  //   [
  //     [{ native_token: { denom: ORAI } }, { native_token: { denom: atomIbcDenom } }],
  //     { native_token: { denom: atomIbcDenom } },
  //     0
  //   ],
  //   [
  //     [{ native_token: { denom: ORAI } }, { token: { contract_addr: usdtCw20Address } }],
  //     { native_token: { denom: ORAI } },
  //     1
  //   ],
  //   [
  //     [{ native_token: { denom: ORAI } }, { token: { contract_addr: usdcCw20Address } }],
  //     { native_token: { denom: ORAI } },
  //     1
  //   ],
  //   [
  //     [{ token: { contract_addr: tronCw20Address } }, { native_token: { denom: atomIbcDenom } }],
  //     { token: { contract_addr: tronCw20Address } },
  //     1
  //   ]
  // ])("test-findUsdOraiInPair", (infos, expectedInfo, expectedBase) => {
  //   // act
  //   const result = findUsdOraiInPair(infos);
  //   // assert
  //   expect(result.target).toEqual(expectedInfo);
  //   expect(result.baseIndex).toEqual(expectedBase);
  // });

  // it.each([
  //   [
  //     [
  //       {
  //         timestamp: 60000,
  //         pair: "orai-usdt",
  //         price: 1,
  //         volume: 100n
  //       },
  //       {
  //         timestamp: 60000,
  //         pair: "orai-usdt",
  //         price: 2,
  //         volume: 100n
  //       }
  //     ],
  //     {
  //       open: 1,
  //       close: 2,
  //       low: 1,
  //       high: 2,
  //       volume: 200n,
  //       timestamp: 60000,
  //       pair: "orai-usdt"
  //     }
  //   ]
  // ])("test-calculateOhlcv", (ops, expectedOhlcv) => {
  //   const ohlcv = calculateSwapOhlcv(ops);
  //   expect(toObject(ohlcv)).toEqual(toObject(expectedOhlcv));
  // });

  it.each([
    ["Buy" as SwapDirection, 2],
    ["Sell" as SwapDirection, 0.5]
  ])("test-calculatePriceFromOrder", (direction: SwapDirection, expectedPrice: number) => {
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
    ["orai", usdtCw20Address, "Sell" as SwapDirection]
  ])("test-getSwapDirection", (offerDenom: string, askDenom: string, expectedDirection: SwapDirection) => {
    // execute
    // throw error case when offer & ask not in pair
    try {
      getSwapDirection("foo", "bar");
    } catch (error) {
      expect(error).toEqual(new Error("Cannot find asset infos in list of pairs"));
    }
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
});
