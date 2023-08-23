import { AssetInfo } from "@oraichain/oraidex-contracts-sdk";
import { isPoolHasFee, parseDenomToAssetLiquidity } from "../src/parse";
import {
  ORAI,
  airiCw20Adress,
  atomIbcDenom,
  milkyCw20Address,
  scAtomCw20Address,
  usdtCw20Address
} from "../src/constants";

describe("test-parse", () => {
  it.each<[[string, string], [AssetInfo, AssetInfo] | null]>([
    [["invalidDenom", "invalidDenom"], null],
    [[ORAI, "invalidDenom"], null],
    [
      [ORAI, airiCw20Adress],
      [{ token: { contract_addr: airiCw20Adress } }, { native_token: { denom: ORAI } }]
    ]
  ])(
    "test-parseDenomToAssetLiquidity-with-denom-%s-should-return-correctly-asset-%o",
    (denoms: [string, string], expectedResult: [AssetInfo, AssetInfo] | null) => {
      const result = parseDenomToAssetLiquidity(denoms);
      // ✅ PASS
      expect(result).toStrictEqual(expectedResult);
    }
  );

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
    const result = isPoolHasFee(assetInfos);
    expect(result).toBe(expectIsHasFee);
  });
});
