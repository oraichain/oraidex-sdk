import { Asset, AssetInfo } from "@oraichain/oraidex-contracts-sdk";
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
import { DuckDb } from "../src/index";
import * as poolHelper from "../src/poolHelper";
import { PairInfoData, PairMapping, ProvideLiquidityOperationData } from "../src/types";

describe("test-pool-helper", () => {
  let duckDb: DuckDb;
  beforeAll(async () => {
    duckDb = await DuckDb.create(":memory:");
    await Promise.all([
      duckDb.createHeightSnapshot(),
      duckDb.createLiquidityOpsTable(),
      duckDb.createSwapOpsTable(),
      duckDb.createPairInfosTable(),
      duckDb.createSwapOhlcv()
    ]);
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

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

  it.each([
    [
      "test-calculateFeeByAsset-with-case-asset-is-cw20-token-should-return-null",
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
      "test-calculateFeeByAsset-with-case-asset-is-native-token-should-return-correctly-fee",
      {
        info: {
          native_token: {
            denom: atomIbcDenom
          }
        },
        amount: "100"
      },
      {
        amount: "1000000",
        info: { native_token: { denom: atomIbcDenom } }
      }
    ]
  ])("%s", (_caseName: string, inputAsset: Asset, expectedFee: Asset | null) => {
    const shareRatio = 100000;
    const result = poolHelper.calculateFeeByAsset(inputAsset, shareRatio);
    expect(result).toStrictEqual(expectedFee);
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
    afterEach(jest.clearAllMocks);

    it("test-getPriceByAsset-when-duckdb-empty-should-throw-error", async () => {
      await expect(poolHelper.getPriceByAsset([oraiInfo, usdtInfo], "base_in_quote")).rejects.toBeInstanceOf(Error);
    });

    it.each<[[AssetInfo, AssetInfo], poolHelper.RatioDirection, number]>([
      [[oraiInfo, usdtInfo], "base_in_quote", 0.5],
      [[oraiInfo, usdtInfo], "quote_in_base", 2]
    ])("test-getPriceByAsset-should-return-correctly-price", async (assetInfos, ratioDirection, expectedPrice) => {
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
      ["asset-is-ORAI", oraiInfo, 0.5],
      [
        "asset-is-not-pair-with-ORAI",
        {
          native_token: {
            denom: atomIbcDenom
          }
        },
        1
      ]
    ])(
      "test-getPriceAssetByUsdt-with-%p-should-return-price-of-asset-in-USDT",
      async (_caseName: string, assetInfo: AssetInfo, expectedPrice: number) => {
        // setup
        let pairInfoData: PairInfoData[] = [
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
            volume24Hour: 1n,
            apr: 1,
            totalLiquidity: 1,
            fee7Days: 1n
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
            volume24Hour: 1n,
            apr: 1,
            totalLiquidity: 1,
            fee7Days: 1n
          }
        ];
        await duckDb.insertPairInfos(pairInfoData);
        const data: ProvideLiquidityOperationData[] = [
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
        await duckDb.insertLpOps(data);
        jest.spyOn(poolHelper, "getPriceByAsset").mockResolvedValue(4);
        jest.spyOn(poolHelper, "getOraiPrice").mockResolvedValue(2);

        // act
        const result = await poolHelper.getPriceAssetByUsdt(assetInfo);

        // assertion
        expect(result).toEqual(expectedPrice);
      }
    );
  });

  describe("test-calculate-fee-of-pools", () => {
    // setup
    const usdtFeeInfo = {
      info: usdtInfo,
      amount: "1"
    };
    const shareRatio = 0.5;

    it.each([
      ["test-calculateFeeByAsset-with-asset-info-is-NOT-native-token-should-return-null", usdtInfo, null],
      [
        "test-calculateFeeByAsset-with-asset-info-is-native-token-should-return-correctly-fee",
        oraiInfo,
        { amount: "0.11538461538461542", info: { native_token: { denom: "orai" } } }
      ]
    ])("%s", (_caseName: string, assetInfo: AssetInfo, expectedResult: Asset | null) => {
      // act
      const result = poolHelper.calculateFeeByAsset(
        {
          info: assetInfo,
          amount: "1"
        },
        shareRatio
      );
      // assert
      expect(result).toEqual(expectedResult);
    });

    it.each([
      ["test-calculateFeeByUsdt-with-asset-NULL-should-return-fee-is-0", null, 0],
      [
        "test-calculateFeeByUsdt-with-asset-native-should-return-correctly-fee",
        {
          info: oraiInfo,
          amount: "1"
        },
        0.5
      ]
    ])("%s", async (_caseName: string, assetFee: Asset | null, expectedResult: number) => {
      // mock
      jest.spyOn(poolHelper, "getPriceAssetByUsdt").mockResolvedValueOnce(2);

      // act
      const result = await poolHelper.calculateFeeByUsdt(assetFee);

      // assert
      expect(result).toEqual(expectedResult);
    });
  });

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
