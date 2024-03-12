import { ORAIX_INFO } from "@oraichain/oraidex-common";
import {
  getAssetInfosFromPairString,
  getDate24hBeforeNow,
  getPriceAssetInUsd,
  validateOraiAddress
} from "../src/helper";
import { CACHE_KEY, cache } from "../src/map-cache";
import * as poolHelper from "@oraichain/oraidex-sync/build/pool-helper";

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
    ["orai", null],
    [
      "orai-orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh",
      [{ native_token: { denom: "orai" } }, { token: { contract_addr: "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh" } }]
    ],
    [
      "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd-orai1lus0f0rhx8s03gdllx2n6vhkmf0536dv57wfge",
      [
        {
          token: { contract_addr: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd" }
        },
        {
          token: { contract_addr: "orai1lus0f0rhx8s03gdllx2n6vhkmf0536dv57wfge" }
        }
      ]
    ],
    [
      "orai1lus0f0rhx8s03gdllx2n6vhkmf0536dv57wfge-orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
      [
        {
          token: { contract_addr: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd" }
        },
        {
          token: { contract_addr: "orai1lus0f0rhx8s03gdllx2n6vhkmf0536dv57wfge" }
        }
      ]
    ]
  ])("test-getAssetInfosFromPairString", (contractAddress, expected) => {
    // act
    const result = getAssetInfosFromPairString(contractAddress);

    // assert
    expect(result).toEqual(expected);
  });

  describe("test-getPriceAssetInUsd", () => {
    it("should-throw-error-when-input-is-not-a-valid-asset", async () => {
      const assetInfo = {
        token: {
          contract_addr: "invalid-asset"
        }
      };
      await expect(getPriceAssetInUsd(assetInfo)).rejects.toThrow(
        `Cannot find token for assetInfo: ${JSON.stringify(assetInfo)}`
      );
    });

    it("should-return-price-from-cache", async () => {
      // arrange
      cache.set(CACHE_KEY.COINGECKO_PRICES, {
        oraidex: 1
      });

      // act
      const res = await getPriceAssetInUsd(ORAIX_INFO);

      // assertion
      expect(res).toEqual(1);

      cache.set(CACHE_KEY.COINGECKO_PRICES, undefined);
    });

    it("should-return-price-from-pool-if-cache-is-not-available", async () => {
      // arrange
      jest.spyOn(poolHelper, "getPriceAssetByUsdt").mockResolvedValue(2);

      // act
      const res = await getPriceAssetInUsd(ORAIX_INFO);

      // assertion
      expect(res).toEqual(2);
    });
  });
});
