import { MILKYBSC_ORAICHAIN_DENOM, MILKY_CONTRACT, ORAI, USDC_CONTRACT, USDT_CONTRACT } from "../src/constant";
import { AmountDetails, TokenItemType, cosmosTokens, flattenTokens, oraichainTokens } from "../src/token";
import {
  calculateMinReceive,
  ethToTronAddress,
  formateNumberDecimalsAuto,
  getEvmAddress,
  getSubAmountDetails,
  getTokenOnOraichain,
  parseAssetInfo,
  parseTokenInfoRawDenom,
  reduceString,
  tronToEthAddress
} from "../src/helper";
import { CoinGeckoId } from "../src/network";
import { AssetInfo } from "@oraichain/oraidex-contracts-sdk";
import { getPairSwapV2, isFactoryV1 } from "../src/pairs";

describe("should helper functions in helper run exactly", () => {
  const amounts: AmountDetails = {
    usdt: "1000000", // 1
    orai: "1000000", // 1
    milky: "1000000", // 1
    [MILKYBSC_ORAICHAIN_DENOM]: "1000000000000000000" // 1
  };

  it("should get sub amount of evm token correctly and to sum display, to total display correctly", () => {
    // test for milky token that have evm denom => have sub amount.
    const tokenInfo = flattenTokens.find((t) => t.evmDenoms && t.coinGeckoId === "milky-token")!;
    const subAmounts = getSubAmountDetails(amounts, tokenInfo);
    expect(subAmounts).toEqual({
      [MILKYBSC_ORAICHAIN_DENOM]: "1000000000000000000"
    });
  });

  it.each([
    [4.1, "4.1"],
    [4.033333333, "4.03"],
    [0.033333333, "0.0333"],
    [0.0000066, "0.000007"],
    [0.0000064, "0.000006"]
  ])("should formate number decimals auto run correctly", (price: number, expectedFormat: string) => {
    const priceFormated = formateNumberDecimalsAuto({
      price: price,
      maxDecimal: 6,
      minDecimal: 2,
      unit: "",
      minPrice: 1
    });
    expect(priceFormated).toEqual(expectedFormat);
  });

  describe("reduceString function", () => {
    it.each([
      ["Hello world!", 5, 5, "Hello...orld!"],
      ["orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g", 10, 7, "orai1g4h64...jvfgs7g"],
      ["A B C D E F G H I J K L M N O P Q R S T U V W X Y Z", 2, 3, "A ...Y Z"]
    ])('should return a shortened string with "..." in between', (str, from, end, expected) => {
      expect(reduceString(str, from, end)).toEqual(expected);
    });

    it('should return "-" if the input string is null', () => {
      expect(reduceString("", 5, 6)).toEqual("-");
    });
  });

  it.each<[TokenItemType, string]>([
    [
      flattenTokens.find((item) => item.coinGeckoId === "airight" && item.chainId === "Oraichain")!,
      flattenTokens.find((item) => item.coinGeckoId === "airight" && item.chainId === "Oraichain")!.contractAddress!
    ],
    [
      flattenTokens.find((item) => item.coinGeckoId === "cosmos" && item.chainId === "Oraichain")!,
      flattenTokens.find((item) => item.coinGeckoId === "cosmos" && item.chainId === "Oraichain")!.denom
    ]
  ])("test-parseTokenInfoRawDenom-given-%j-should-receive-%s", (token, expectedDenom) => {
    expect(parseTokenInfoRawDenom(token)).toEqual(expectedDenom);
  });

  it.each<[CoinGeckoId, TokenItemType, string]>([
    ["airight", cosmosTokens.find((token) => token.coinGeckoId === "airight" && token.chainId === "Oraichain")!, ""],
    ["tether", cosmosTokens.find((token) => token.coinGeckoId === "tether" && token.chainId === "Oraichain")!, ""],
    ["tron", cosmosTokens.find((token) => token.coinGeckoId === "tron" && token.chainId === "Oraichain")!, ""],
    [
      "kawaii-islands",
      cosmosTokens.find((token) => token.coinGeckoId === "kawaii-islands" && token.chainId === "Oraichain")!,
      "KWT and MILKY not supported in this function"
    ]
  ])("test-getTokenOnOraichain-given-%s-should-receive-%j", (coingeckoId, expectedToken, err) => {
    try {
      expect(getTokenOnOraichain(coingeckoId)).toEqual(expectedToken);
    } catch (error) {
      expect(error).toEqual(new Error(err));
    }
  });

  it.each<[AssetInfo, string]>([
    [{ native_token: { denom: ORAI } }, ORAI],
    [{ token: { contract_addr: "foobar" } }, "foobar"]
  ])("test-parseAssetInfo-given-%j-should-receive-%s", (assetInfo, expectedResult) => {
    expect(parseAssetInfo(assetInfo)).toEqual(expectedResult);
  });

  it.each<[string, string[], string, boolean]>([
    [MILKY_CONTRACT, [USDT_CONTRACT], "usdt", false],
    [USDC_CONTRACT, ["orai"], "orai", true]
  ])("test-get-pair-swap", (contractAddress, expectedArr, exprectArrDenom, expectedArrIncludesOrai) => {
    const { arr, arrLength, arrIncludesOrai, arrDenom } = getPairSwapV2(contractAddress);
    expect(arr).toEqual(expectedArr);
    expect(arrLength).toEqual(arr!.length);
    expect(arrDenom).toEqual(exprectArrDenom);
    expect(arrIncludesOrai).toEqual(expectedArrIncludesOrai);
  });

  it("test-isFactoryV1-true", () => {
    const data = isFactoryV1([
      { native_token: { denom: "orai" } },
      { token: { contract_addr: "orai10ldgzued6zjp0mkqwsv2mux3ml50l97c74x8sg" } }
    ]);
    expect(data).toEqual(true);
  });

  it("test-isFactoryV1-false", () => {
    const data = isFactoryV1([
      { native_token: { denom: "orai" } },
      { token: { contract_addr: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd" } }
    ]);
    expect(data).toEqual(false);
  });

  it.each([
    ["1000000", "1000000", 1, 6, "990000"],
    ["1800000", "100000", 1, 6, "178200"],
    ["1000000000000000000", "1000000000000000000", 1, 18, "990000000000000000"]
  ])(
    "calculateMinReceive should return correctly minimum receive",
    (simulateAverage: string, fromAmount: string, userSlippage: number, decimals: number, expectedResult) => {
      const result = calculateMinReceive(simulateAverage, fromAmount, userSlippage, decimals);
      expect(result).toEqual(expectedResult);
    }
  );

  it("test-getEvmAddress", () => {
    expect(getEvmAddress("oraie1ny7sdlyh7303deyqtzpmnznvyzat2jtyxs3y0v")).toEqual(
      "0x993d06fc97f45f16e4805883b98a6c20bab54964"
    );
    expect(() => {
      getEvmAddress("");
    }).toThrow("bech32 address is empty");
    expect(() => {
      getEvmAddress("foobar");
    }).toThrow();
  });
  it("test-ethToTronAddress", () => {
    expect(ethToTronAddress("0x993d06fc97f45f16e4805883b98a6c20bab54964")).toEqual(
      "TPwTVfDDvmWSawsP7Ki1t3ecSBmaFeMMXc"
    );
  });
  it("test-tronToEthAddress", () => {
    expect(tronToEthAddress("TPwTVfDDvmWSawsP7Ki1t3ecSBmaFeMMXc")).toEqual(
      "0x993d06fc97f45f16e4805883b98a6c20bab54964"
    );
  });
});
