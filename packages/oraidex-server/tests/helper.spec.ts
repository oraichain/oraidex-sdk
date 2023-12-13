import { airiCw20Adress, pairs, parseAssetInfoOnlyDenom } from "@oraichain/oraidex-sync";
import { getDate24hBeforeNow, validateOraiAddress } from "../src/helper";
import { isEqual } from "lodash";

describe("test-helper", () => {
  it("test-getDate24hBeforeNow", () => {
    // setup
    const now = new Date("2023-07-16T16:07:48.000Z");
    // act
    const result = getDate24hBeforeNow(now);
    // assert
    expect(result).toEqual(new Date("2023-07-15T16:07:48.000Z"));
  });

  it.each([
    ["orai", false],
    ["orai1234", false],
    ["abc", false],
    ["orai1lus0f0rhx8s03gdllx2n6vhkmf0536dv57wfge", true], // ORAIX
    ["orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh", true] // USDT
  ])("test-validateContractAddress", (contractAddress, expected) => {
    const checkContractAddress = validateOraiAddress(contractAddress);
    // assert
    expect(checkContractAddress).toEqual(expected);
  });

  it.each([
    ["orai", airiCw20Adress],
    [airiCw20Adress, "orai"]
  ])("test-find-denom-pairs", (base, quote) => {
    console.log("pairs: ", JSON.stringify(pairs));
    const pair = pairs.find(
      (pair) =>
        pair.asset_infos.filter(
          (info) => parseAssetInfoOnlyDenom(info) === base || parseAssetInfoOnlyDenom(info) === quote
        ).length === 2
    );
    expect(pair).not.toBeUndefined();
  });
});
