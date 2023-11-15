import {
  AIRI_CONTRACT,
  AVERAGE_COSMOS_GAS_PRICE,
  MILKYBSC_ORAICHAIN_DENOM,
  MILKY_CONTRACT,
  ORAI,
  USDC_CONTRACT,
  USDT_CONTRACT
} from "../src/constant";
import { AmountDetails, TokenItemType, cosmosTokens, flattenTokens, oraichainTokens } from "../src/token";
import {
  calculateMinReceive,
  calculateTimeoutTimestamp,
  ethToTronAddress,
  findToTokenOnOraiBridge,
  getEvmAddress,
  getCosmosGasPrice,
  getSubAmountDetails,
  getTokenOnOraichain,
  getTokenOnSpecificChainId,
  handleSentFunds,
  isEthAddress,
  marshalEncodeObjsToStargateMsgs,
  parseAssetInfo,
  parseTokenInfo,
  parseTokenInfoRawDenom,
  toAmount,
  toAssetInfo,
  toDecimal,
  toDisplay,
  toTokenInfo,
  tronToEthAddress,
  validateNumber
} from "../src/helper";
import { CoinGeckoId, NetworkChainId, OraiToken } from "../src/network";
import { AssetInfo } from "@oraichain/oraidex-contracts-sdk";
import { getPairSwapV2, isFactoryV1 } from "../src/pairs";
import { Coin } from "@cosmjs/amino";
import { toBinary } from "@cosmjs/cosmwasm-stargate";

describe("should helper functions in helper run exactly", () => {
  const amounts: AmountDetails = {
    usdt: "1000000", // 1
    orai: "1000000", // 1
    milky: "1000000", // 1
    [MILKYBSC_ORAICHAIN_DENOM]: "1000000000000000000" // 1
  };

  it.each<[string, boolean]>([
    ["0x", false],
    ["orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g", false],
    ["0x3C5C6b570C1DA469E8B24A2E8Ed33c278bDA3222", true]
  ])("test-is-eth-address-metamask", (address, expectedIsEthAddress) => {
    const isEth = isEthAddress(address);
    expect(isEth).toEqual(expectedIsEthAddress);
  });

  it("should get sub amount of evm token correctly and to sum display, to total display correctly", () => {
    // test for milky token that have evm denom => have sub amount.
    const tokenInfo = flattenTokens.find((t) => t.evmDenoms && t.coinGeckoId === "milky-token")!;
    const subAmounts = getSubAmountDetails(amounts, tokenInfo);
    expect(subAmounts).toEqual({
      [MILKYBSC_ORAICHAIN_DENOM]: "1000000000000000000"
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
    [USDC_CONTRACT, [ORAI], ORAI, true]
  ])("test-get-pair-swap", (contractAddress, expectedArr, exprectArrDenom, expectedArrIncludesOrai) => {
    const { arr, arrLength, arrIncludesOrai, arrDenom } = getPairSwapV2(contractAddress);
    expect(arr).toEqual(expectedArr);
    expect(arrLength).toEqual(arr!.length);
    expect(arrDenom).toEqual(exprectArrDenom);
    expect(arrIncludesOrai).toEqual(expectedArrIncludesOrai);
  });

  it("test-isFactoryV1-true", () => {
    const data = isFactoryV1([
      { native_token: { denom: ORAI } },
      { token: { contract_addr: "orai10ldgzued6zjp0mkqwsv2mux3ml50l97c74x8sg" } }
    ]);
    expect(data).toEqual(true);
  });

  it("test-isFactoryV1-false", () => {
    const data = isFactoryV1([
      { native_token: { denom: ORAI } },
      { token: { contract_addr: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd" } }
    ]);
    expect(data).toEqual(false);
  });

  it.each([
    ["1000000", "1000000", 1, 6, "990000"],
    ["1800000", "100000", 1, 6, "178200"],
    ["1000000000000000000", "1000000000000000000", 1, 18, "990000000000000000"],
    ["1800000", "100000", 1.25, 6, "177750"],
    ["1000000000000000000", "1000000000000000000", 1.5, 18, "985000000000000000"],
    ["180000.5", "10000.5", 1.25, 6, "1777"],
    ["100000000000000000.5", "100000000000000000.5", 1.5, 18, "9850000000000000"]
  ])(
    "calculateMinReceive should return correctly minimum receive",
    (simulateAverage: string, fromAmount: string, userSlippage: number, decimals: number, expectedResult) => {
      const result = calculateMinReceive(simulateAverage, fromAmount, userSlippage, decimals);
      expect(result).toEqual(expectedResult);
    }
  );

  it("getEvmAddress-happy-path", async () => {
    expect(getEvmAddress("oraie1ny7sdlyh7303deyqtzpmnznvyzat2jtyxs3y0v")).toEqual(
      "0x993d06fc97f45f16e4805883b98a6c20bab54964"
    );
    expect(ethToTronAddress("0x993d06fc97f45f16e4805883b98a6c20bab54964")).toEqual(
      "TPwTVfDDvmWSawsP7Ki1t3ecSBmaFeMMXc"
    );
    expect(tronToEthAddress("TPwTVfDDvmWSawsP7Ki1t3ecSBmaFeMMXc")).toEqual(
      "0x993d06fc97f45f16e4805883b98a6c20bab54964"
    );
  });

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

  describe("validateNumber", () => {
    it("validateNumber-NaN-should-return-zero", async () => {
      const amount = Number.NaN;
      const res = validateNumber(amount);
      expect(res).toBe(0);
    });

    it("validateNumber-infinite-should-return-zero", async () => {
      const amount = Number.POSITIVE_INFINITY;
      const res = validateNumber(amount);
      expect(res).toBe(0);
    });

    it("validateNumber-super-large-number", async () => {
      const amount = 2 * Math.pow(10, 21);
      const res = validateNumber(amount);
      expect(res).toBe(2e21);
    });

    it("validateNumber-happy-path-should-return-amount", async () => {
      const amount = 6;
      const res = validateNumber(amount);
      expect(res).toBe(6);
    });
  });

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

  it.each<[string, AssetInfo]>([
    [ORAI, { native_token: { denom: ORAI } }],
    ["airi", { token: { contract_addr: AIRI_CONTRACT } }]
  ])("test-toAssetInfo", (denom, expectedAssetInfo) => {
    // fixture
    const token = oraichainTokens.find((t) => t.denom === denom);
    const tokenInfo = toTokenInfo(token!);
    expect(toAssetInfo(tokenInfo)).toEqual(expectedAssetInfo);
  });

  it("test-calculateTimeoutTimestamp", () => {
    const now = 1000;
    expect(calculateTimeoutTimestamp(10, now)).toEqual((11000000000).toString());
  });

  it.each<[CoinGeckoId, NetworkChainId, CoinGeckoId, NetworkChainId | undefined]>([
    // ["cosmos", "cosmoshub-4", "cosmos", undefined],
    // ["osmosis", "osmosis-1", "osmosis", undefined],
    ["airight", "0x38", "airight", "oraibridge-subnet-2"],
    ["usd-coin", "0x01", "usd-coin", "oraibridge-subnet-2"],
    ["tron", "0x2b6653dc", "tron", "oraibridge-subnet-2"]
  ])(
    "test-findToTokenOnOraiBridge-when-universalSwap-from-Oraichain-to%s",
    (fromCoingeckoId, toChainId, expectedToCoinGeckoId, expectedToChainId) => {
      const toTokenTransfer = findToTokenOnOraiBridge(fromCoingeckoId, toChainId);
      expect(toTokenTransfer!.coinGeckoId).toEqual(expectedToCoinGeckoId);
      expect(toTokenTransfer!.chainId).toEqual(expectedToChainId);
    }
  );

  it.each<[CoinGeckoId, NetworkChainId, undefined]>([
    ["cosmos", "cosmoshub-4", undefined],
    ["osmosis", "osmosis-1", undefined]
  ])("test-findToTokenOnOraiBridge-expect-undefined", (fromCoingeckoId, toChainId) => {
    const toTokenTransfer = findToTokenOnOraiBridge(fromCoingeckoId, toChainId);
    expect(toTokenTransfer).toEqual(undefined);
  });

  it.each<[AssetInfo, string]>([
    [{ native_token: { denom: ORAI } }, ORAI],
    [{ token: { contract_addr: "foobar" } }, "foobar"]
  ])("test-parseAssetInfo-given-%j-should-receive-%s", (assetInfo, expectedResult) => {
    expect(parseAssetInfo(assetInfo)).toEqual(expectedResult);
  });

  it.each<[CoinGeckoId, NetworkChainId, boolean]>([
    ["wbnb", "0x38", false],
    ["wbnb", "Oraichain", true]
  ])("test-getTokenOnSpecificChainId", (coingeckoId, chainId, expectedResult) => {
    const result = getTokenOnSpecificChainId(coingeckoId, chainId);
    expect(result === undefined).toEqual(expectedResult);
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

  it.each<[string, string | undefined, AssetInfo, any]>([
    [ORAI, "10", { native_token: { denom: ORAI } }, { denom: ORAI, amount: "10" }],
    [ORAI, undefined, { native_token: { denom: ORAI } }, undefined],
    ["airi", "10", { token: { contract_addr: AIRI_CONTRACT } }, undefined],
    ["airi", undefined, { token: { contract_addr: AIRI_CONTRACT } }, undefined]
  ])("test-parseTokenInfo", (denom, amount, expectedInfo, expectedFund) => {
    // fixture
    const token = oraichainTokens.find((t) => t.denom === denom)!;
    const expectedResult: { info: AssetInfo; fund: any } = {
      info: expectedInfo,
      fund: expectedFund
    };
    expect(parseTokenInfo(token, amount)).toEqual(expectedResult);
  });

  it("test-handleSentFunds", () => {
    // fixture, reusable test data
    const oraiCoin: Coin = { denom: ORAI, amount: "1" };
    // first case, empty input, should return null
    expect(handleSentFunds()).toEqual(null);

    // second case, one input, should return one
    expect(handleSentFunds(oraiCoin)).toEqual([oraiCoin]);

    // third case, 2 inputs, should sort based on the denom alphabet order
    expect(handleSentFunds(oraiCoin, { denom: "foobar", amount: "2" })).toEqual([
      { denom: "foobar", amount: "2" },
      oraiCoin
    ]);
  });

  it("test-marshalEncodeObjsToStargateMsgs", () => {
    expect(marshalEncodeObjsToStargateMsgs([{ typeUrl: "foobar", value: "hello" }])).toEqual([
      { stargate: { type_url: "foobar", value: toBinary("hello") } }
    ]);
  });

  it("test-getCosmosGasPrice", () => {
    expect(getCosmosGasPrice({ low: 0, average: 0, high: 0 })).toEqual(0);
    expect(getCosmosGasPrice()).toEqual(AVERAGE_COSMOS_GAS_PRICE);
  });
});
