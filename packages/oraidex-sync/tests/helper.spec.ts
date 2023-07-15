import { AssetInfo } from "@oraichain/oraidex-contracts-sdk";
import { calculatePrefixSum, findAssetInfoPathToUsdt, findMappedTargetedAssetInfo } from "../src/helper";
import { pairs } from "../src/pairs";
import {
  airiCw20Adress,
  milkyCw20Address,
  scAtomCw20Address,
  usdcCw20Address,
  usdtCw20Address
} from "../src/constants";

describe("test-helper", () => {
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

  it("test-calculatePrefixSum", () => {
    const data = [
      {
        denom: "foo",
        amount: 100
      },
      { denom: "foo", amount: 10 },
      { denom: "bar", amount: 5 },
      { denom: "bar", amount: -1 },
      { denom: "hello", amount: 5 }
    ];
    const result = calculatePrefixSum(1, data);
    expect(result).toEqual([
      { denom: "foo", amount: 101 },
      { denom: "foo", amount: 111 },
      { denom: "bar", amount: 6 },
      { denom: "bar", amount: 5 },
      { denom: "hello", amount: 6 }
    ]);
  });
});
