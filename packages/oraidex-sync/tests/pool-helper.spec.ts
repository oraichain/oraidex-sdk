import { Asset, AssetInfo, OraiswapStakingTypes } from "@oraichain/oraidex-contracts-sdk";
import {
  ORAI,
  airiCw20Adress,
  atomIbcDenom,
  milkyCw20Address,
  oraiInfo,
  scAtomCw20Address,
  usdtCw20Address,
  usdtInfo
} from "../src/constants";

import * as helper from "../src/helper";
import { DuckDb, pairs } from "../src/index";
import * as poolHelper from "../src/pool-helper";
import { PairInfoData, PairMapping, ProvideLiquidityOperationData } from "../src/types";

describe("test-pool-helper", () => {
  let duckDb: DuckDb;

  afterAll(jest.resetModules);
  afterEach(jest.resetModules);
  afterEach(jest.restoreAllMocks);

  it.each<[string, [AssetInfo, AssetInfo], boolean]>([
    [
      "has-both-native-token-that-contain-ORAI-should-return: false",
      [oraiInfo, { native_token: { denom: atomIbcDenom } }],
      false
    ],
    // [
    //   // NOTE: currently this case not exist, but in future maybe
    //   "has-both-native-token-that-NOT-contain-ORAI-should-return: true",
    //   [osmosisIbcDenom, atomIbcDenom],
    //   true
    // ],
    [
      "has-one-native-token-that-NOT-contain-ORAI-should-return: true",
      [
        { native_token: { denom: atomIbcDenom } },
        {
          token: {
            contract_addr: scAtomCw20Address
          }
        }
      ],
      true
    ],
    [
      "NOT-has-native-token-should-return-is-has-fee: false",
      [
        {
          token: {
            contract_addr: milkyCw20Address
          }
        },
        usdtInfo
      ],
      false
    ]
  ])("test-isPoolHasFee-with-pool-%s", (_caseName, assetInfos, expectIsHasFee) => {
    const result = poolHelper.isPoolHasFee(assetInfos);
    expect(result).toBe(expectIsHasFee);
  });

  it.each<[string, [AssetInfo, AssetInfo], PairMapping | undefined]>([
    [
      "assetInfos-valid-in-list-pairs",
      [usdtInfo, oraiInfo],
      {
        asset_infos: [oraiInfo, usdtInfo],
        symbols: ["ORAI", "USDT"],
        factoryV1: true
      }
    ],
    [
      "assetInfos-invalid-in-list-pairs",
      [
        {
          token: {
            contract_addr: "invalid"
          }
        },
        {
          native_token: {
            denom: atomIbcDenom
          }
        }
      ],
      undefined
    ]
  ])(
    "test-getPairByAssetInfos-with-%s-should-return-correctly-pair",
    (_caseName: string, assetInfos: [AssetInfo, AssetInfo], expectedPair: PairMapping | undefined) => {
      const result = poolHelper.getPairByAssetInfos(assetInfos);
      expect(result).toStrictEqual(expectedPair);
    }
  );

  describe("test-calculate-price-group-funcs", () => {
    // use orai/usdt in this test suite
    // it("test-getPriceByAsset-when-duckdb-empty-should-return-0", async () => {
    //   // setup
    //   duckDb = await DuckDb.create(":memory:");
    //   await Promise.all([duckDb.createPairInfosTable()]);

    //   // act & assertion
    //   const result = await poolHelper.getPriceByAsset([oraiInfo, usdtInfo], "base_in_quote");
    //   expect(result).toEqual(0);
    // });

    it.each<[[AssetInfo, AssetInfo], poolHelper.RatioDirection, number]>([
      [[oraiInfo, { token: { contract_addr: "invalid-token" } }], "base_in_quote", 0],
      [[oraiInfo, usdtInfo], "base_in_quote", 0.5],
      [[oraiInfo, usdtInfo], "quote_in_base", 2]
    ])("test-getPriceByAsset-should-return-correctly-price", async (assetInfos, ratioDirection, expectedPrice) => {
      // setup
      duckDb = await DuckDb.create(":memory:");
      await duckDb.createPairInfosTable();
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
      await duckDb.insertPairInfos(pairInfoData);

      // mock result of nested function implemented inside getPriceByAsset.
      jest.spyOn(helper, "fetchPoolInfoAmount").mockResolvedValue({
        askPoolAmount: 1000n,
        offerPoolAmount: 2000n
      });
      jest.spyOn(helper, "calculatePriceByPool").mockReturnValue(0.5);

      // assert
      const result = await poolHelper.getPriceByAsset(assetInfos, ratioDirection);
      expect(result).toEqual(expectedPrice);
    });

    it.each([
      ["asset-is-cw20-USDT", usdtInfo, 1],
      [
        "asset-is-MILKY-that-mapped-with-USDT",
        {
          token: {
            contract_addr: milkyCw20Address
          }
        },
        0.5
      ],
      ["asset-is-ORAI", oraiInfo, 2],
      [
        "asset-is-pair-with-ORAI",
        {
          native_token: {
            denom: atomIbcDenom
          }
        },
        1
      ],
      [
        "asset-is-NOT-pair-with-ORAI",
        {
          token: {
            contract_addr: scAtomCw20Address
          }
        },
        0.5
      ]
    ])(
      "test-getPriceAssetByUsdt-with-%p-should-return-correctly-price-of-asset-in-USDT",
      async (_caseName: string, assetInfo: AssetInfo, expectedPrice: number) => {
        // setup & mock
        duckDb = await DuckDb.create(":memory:");
        await Promise.all([duckDb.createPairInfosTable(), duckDb.createLiquidityOpsTable()]);
        const pairInfoData: PairInfoData[] = [
          {
            firstAssetInfo: JSON.stringify(oraiInfo as AssetInfo),
            secondAssetInfo: JSON.stringify(usdtInfo as AssetInfo),
            commissionRate: "",
            pairAddr: "orai1c5s03c3l336dgesne7dylnmhszw8554tsyy9yt",
            liquidityAddr: "",
            oracleAddr: "",
            symbols: "1",
            fromIconUrl: "1",
            toIconUrl: "1",
            offerPoolAmount: 1n,
            askPoolAmount: 1n
          },
          {
            firstAssetInfo: JSON.stringify(oraiInfo as AssetInfo),
            secondAssetInfo: JSON.stringify({ native_token: { denom: atomIbcDenom } } as AssetInfo),
            commissionRate: "",
            pairAddr: "orai/atom",
            liquidityAddr: "",
            oracleAddr: "",
            symbols: "1",
            fromIconUrl: "1",
            toIconUrl: "1",
            offerPoolAmount: 1n,
            askPoolAmount: 1n
          }
        ];
        await duckDb.insertPairInfos(pairInfoData);
        const lpOpsData: ProvideLiquidityOperationData[] = [
          {
            basePrice: 1,
            baseTokenAmount: 1,
            baseTokenDenom: "orai",
            baseTokenReserve: 1000000000 / 2,
            opType: "withdraw",
            uniqueKey: "2",
            quoteTokenAmount: 2,
            quoteTokenDenom: usdtCw20Address,
            quoteTokenReserve: 1000000000,
            timestamp: 1,
            txCreator: "foobar",
            txhash: "foo",
            txheight: 1,
            taxRate: 1n
          }
        ];
        await duckDb.insertLpOps(lpOpsData);
        jest.spyOn(poolHelper, "getOraiPrice").mockResolvedValue(2);
        jest.spyOn(poolHelper, "getPriceByAsset").mockResolvedValue(0.5);

        // act
        const result = await poolHelper.getPriceAssetByUsdt(assetInfo);

        // assertion
        expect(result).toEqual(expectedPrice);
      }
    );
  });

  describe("test-calculate-fee-of-pools", () => {
    it.each([
      [
        "with-case-asset-is-cw20-token-should-return-null",
        {
          info: {
            token: {
              contract_addr: airiCw20Adress
            }
          },
          amount: "100"
        },
        null
      ],
      [
        "with-case-asset-is-native-token-should-return-correctly-fee",
        {
          info: {
            native_token: {
              denom: atomIbcDenom
            }
          },
          amount: "100"
        },
        {
          amount: "11.53846153846154",
          info: { native_token: { denom: atomIbcDenom } }
        }
      ]
    ])("test-calculateFeeByAsset-%s", (_caseName: string, inputAsset: Asset, expectedFee: Asset | null) => {
      const shareRatio = 0.5;
      const result = poolHelper.calculateFeeByAsset(inputAsset, shareRatio);
      expect(result).toStrictEqual(expectedFee);
    });

    it("test-calculateLiquidityFee-should-return-correctly-fee-in-USDT", async () => {
      // mock
      jest.spyOn(poolHelper, "convertFeeAssetToUsdt").mockResolvedValue(1e6);

      // act
      const liquidityFee = await poolHelper.calculateLiquidityFee(
        {
          firstAssetInfo: "1",
          secondAssetInfo: "1",
          commissionRate: "1",
          pairAddr: "orai1c5s03c3l336dgesne7dylnmhszw8554tsyy9yt",
          liquidityAddr: "1",
          oracleAddr: "1",
          symbols: "1",
          fromIconUrl: "1",
          toIconUrl: "1",
          offerPoolAmount: 1n,
          askPoolAmount: 1n
        },
        13344890,
        1
      );

      // assertion
      expect(liquidityFee).toEqual(2000000n);
    });

    it.each([
      ["test-convertFeeAssetToUsdt-with-asset-NULL-should-return-fee-is-0", null, 0],
      [
        "test-convertFeeAssetToUsdt-with-asset-native-should-return-correctly-fee",
        {
          info: oraiInfo,
          amount: "1"
        },
        2
      ]
    ])("%s", async (_caseName: string, assetFee: Asset | null, expectedResult: number) => {
      // mock
      jest.spyOn(poolHelper, "getPriceAssetByUsdt").mockResolvedValueOnce(2);

      // act
      const result = await poolHelper.convertFeeAssetToUsdt(assetFee);

      // assert
      expect(result).toEqual(expectedResult);
    });
  });

  describe("test-calculate-APR-pool", () => {
    it.each<[string, AssetInfo[], AssetInfo]>([
      [
        "case-asset-info-pairs-is-NOT-reversed-and-base-asset-NOT-ORAI",
        [
          {
            token: {
              contract_addr: scAtomCw20Address
            }
          },
          {
            native_token: {
              denom: atomIbcDenom
            }
          }
        ],
        {
          token: {
            contract_addr: scAtomCw20Address
          }
        }
      ],
      ["case-asset-info-pairs-is-NOT-reversed-and-base-asset-is-ORAI", [oraiInfo, usdtInfo], usdtInfo],
      [
        "case-asset-info-pairs-is-reversed-and-base-asset-NOT-ORAI",
        [
          {
            native_token: {
              denom: atomIbcDenom
            }
          },
          {
            token: {
              contract_addr: scAtomCw20Address
            }
          }
        ],
        {
          token: {
            contract_addr: scAtomCw20Address
          }
        }
      ],
      ["case-asset-info-pairs-is-reversed-and-base-asset-is-ORAI", [usdtInfo, oraiInfo], usdtInfo]
    ])(
      "test-getStakingAssetInfo-with-%p-should-return-correctly-staking-asset-info",
      (_caseName: string, assetInfos: AssetInfo[], expectedStakingAssetInfo: AssetInfo) => {
        const result = poolHelper.getStakingAssetInfo(assetInfos);
        expect(result).toStrictEqual(expectedStakingAssetInfo);
      }
    );
  });

  it("test-calculateAprResult-should-return-correctly-APR", async () => {
    // setup
    const allLiquidities = Array(pairs.length).fill(1e6);
    const allTotalSupplies = Array(pairs.length).fill("100000");
    const allBondAmounts = Array(pairs.length).fill("1");
    const allRewardPerSec: OraiswapStakingTypes.RewardsPerSecResponse[] = Array(pairs.length).fill({
      assets: [
        {
          amount: "1",
          info: oraiInfo
        }
      ]
    });
    jest.spyOn(poolHelper, "getPriceAssetByUsdt").mockResolvedValue(1);

    // act
    const result = await poolHelper.calculateAprResult(
      allLiquidities,
      allTotalSupplies,
      allBondAmounts,
      allRewardPerSec
    );

    // assertion
    expect(result.length).toEqual(pairs.length);
    expect(result).toStrictEqual(Array(pairs.length).fill(315360000));
  });
});
