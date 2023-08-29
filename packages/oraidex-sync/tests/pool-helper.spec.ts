import fs from "fs";
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

import { PairMapping } from "../src/types";
import * as helper from "../src/helper";
import * as poolHelper from "../src/poolHelper";
import { DuckDb } from "../src/index";

describe("test-pool-helper", () => {
  let duckDb: DuckDb;
  beforeAll(async () => {
    duckDb = await DuckDb.create(":memory:");
  });
  afterAll(() => {
    fs.unlink(":memory:", () => {});
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  it.each<[string, [AssetInfo, AssetInfo], boolean]>([
    [
      "has-both-native-token-that-contain-ORAI-should-return: false",
      [{ native_token: { denom: ORAI } }, { native_token: { denom: atomIbcDenom } }],
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
        {
          token: {
            contract_addr: usdtCw20Address
          }
        }
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
    afterEach(jest.clearAllMocks);
    it.each<[[AssetInfo, AssetInfo], poolHelper.RatioDirection, number]>([
      [[oraiInfo, usdtInfo], "base_in_quote", 0.5],
      [[oraiInfo, usdtInfo], "quote_in_base", 2]
    ])("test-getPriceByAsset-should-return-correctly-price", async (assetInfos, ratioDirection, expectedPrice) => {
      // Mock the return values for fetchPoolInfoAmount and calculatePriceByPool
      const mockAskPoolAmount = 1000n;
      const mockOfferPoolAmount = 2000n;
      const mockAssetPrice = 0.5;

      const fetchPoolInfoAmountSpy = jest.spyOn(helper, "fetchPoolInfoAmount");
      const calculatePriceByPoolSpy = jest.spyOn(helper, "calculatePriceByPool");
      fetchPoolInfoAmountSpy.mockResolvedValue({
        askPoolAmount: mockAskPoolAmount,
        offerPoolAmount: mockOfferPoolAmount
      });

      calculatePriceByPoolSpy.mockReturnValue(mockAssetPrice);

      const result = await poolHelper.getPriceByAsset(assetInfos, ratioDirection);
      expect(result).toEqual(expectedPrice);
    });

    it.each([
      ["asset-is-cw20-USDT", usdtInfo, 1],
      ["asset-is-ORAI", oraiInfo, 2],
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
        const mockPriceByAssetValue = 4;
        jest.spyOn(poolHelper, "getPriceByAsset").mockResolvedValue(mockPriceByAssetValue);

        const mockOraiPrice = 2;
        jest.spyOn(poolHelper, "getOraiPrice").mockResolvedValue(mockOraiPrice);

        const result = await poolHelper.getPriceAssetByUsdt(assetInfo);
        expect(result).toEqual(expectedPrice);
      }
    );
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
