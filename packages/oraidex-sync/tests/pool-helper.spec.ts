import { Asset, AssetInfo, PairInfo } from "@oraichain/oraidex-contracts-sdk";
import {
  ORAI,
  airiCw20Adress,
  atomIbcDenom,
  milkyCw20Address,
  scAtomCw20Address,
  usdtCw20Address
} from "../src/constants";

import { PairMapping } from "../src/types";
import * as helper from "../src/helper";
import * as poolHelper from "../src/poolHelper";
import { mock } from "node:test";
describe("test-pool-helper", () => {
  afterEach(() => {
    jest.clearAllMocks();
    // jest.resetAllMocks();
    // jest.restoreAllMocks();
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
      [
        {
          token: {
            contract_addr: usdtCw20Address
          }
        },
        {
          native_token: {
            denom: ORAI
          }
        }
      ],
      {
        asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: usdtCw20Address } }],
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

  // it.each<[[AssetInfo, AssetInfo], Pick<PairInfo, "contract_addr" | "commission_rate">]>([
  //   [
  //     [
  //       {
  //         native_token: {
  //           denom: ORAI
  //         }
  //       },
  //       {
  //         token: {
  //           contract_addr: usdtCw20Address
  //         }
  //       }
  //     ],
  //     {
  //       contract_addr: "orai123",
  //       commission_rate: "0.003"
  //     }
  //   ]
  // ])("test-getPairInfoFromAssets-should-return-correctly-pair-info", async (assetInfos, expectedPairInfo) => {
  //   const getPairInfoFromAssetsSpy = jest.spyOn(helper, "getPairInfoFromAssets");
  //   const mockPairInfoFromAssets = {
  //     commission_rate: "0.003",
  //     contract_addr: "orai1234"
  //   };
  //   getPairInfoFromAssetsSpy.mockResolvedValue(mockPairInfoFromAssets);
  //   const result = await helper.getPairInfoFromAssets(assetInfos);
  //   console.log({ result });
  //   // expect(result).toStrictEqual(expectedPairInfo);
  // });

  describe("test-calculate-price-group-funcs", () => {
    afterEach(jest.clearAllMocks);
    it.each<[[AssetInfo, AssetInfo], poolHelper.RatioDirection, number]>([
      [
        [
          {
            native_token: {
              denom: ORAI
            }
          },
          {
            token: {
              contract_addr: usdtCw20Address
            }
          }
        ],
        "base_in_quote",
        0.5
      ],
      [
        [
          {
            native_token: {
              denom: ORAI
            }
          },
          {
            token: {
              contract_addr: usdtCw20Address
            }
          }
        ],
        "quote_in_base",
        2
      ]
    ])("test-getPriceByAsset-should-return-correctly-price", async (assetInfos, ratioDirection, expectedPrice) => {
      // Mock the return values for fetchPoolInfoAmount and calculatePriceByPool
      const mockAskPoolAmount = 1000n;
      const mockOfferPoolAmount = 2000n;
      const mockAssetPrice = 0.5;
      const mockPairInfoFromAssets = {
        commission_rate: "0.003",
        contract_addr: "orai1234"
      };

      const getPairInfoFromAssetsSpy = jest.spyOn(helper, "getPairInfoFromAssets");
      getPairInfoFromAssetsSpy.mockResolvedValue(mockPairInfoFromAssets);

      const fetchPoolInfoAmountSpy = jest.spyOn(helper, "fetchPoolInfoAmount");
      const calculatePriceByPoolSpy = jest.spyOn(helper, "calculatePriceByPool");
      // Mock the fetchPoolInfoAmount function
      fetchPoolInfoAmountSpy.mockResolvedValue({
        askPoolAmount: mockAskPoolAmount,
        offerPoolAmount: mockOfferPoolAmount
      });

      // Mock the calculatePriceByPool function
      calculatePriceByPoolSpy.mockReturnValue(mockAssetPrice);

      const result = await poolHelper.getPriceByAsset(assetInfos, ratioDirection);
      expect(result).toEqual(expectedPrice);
    });

    it.each([
      [
        {
          native_token: {
            denom: "not-pair-with-orai"
          }
        },
        0
      ],
      [
        {
          native_token: {
            denom: atomIbcDenom
          }
        },
        1
      ]
    ])(
      "test-getPriceAssetByUsdt-should-return-price-of-asset-in-USDT",
      async (assetInfo: AssetInfo, expectedPrice: number) => {
        const mockPriceByAssetValue = 4;
        const mockOraiPrice = 2;

        const getPriceByAssetSpy = jest.spyOn(poolHelper, "getPriceByAsset");
        getPriceByAssetSpy.mockResolvedValue(mockPriceByAssetValue);

        const getOraiPriceSpy = jest.spyOn(poolHelper, "getOraiPrice");
        getOraiPriceSpy.mockResolvedValue(mockOraiPrice);

        const result = await poolHelper.getPriceAssetByUsdt(assetInfo);
        expect(result).toEqual(expectedPrice);
      }
    );
  });
});
