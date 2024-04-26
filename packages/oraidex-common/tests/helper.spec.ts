import { Coin } from "@cosmjs/amino";
import { toBinary } from "@cosmjs/cosmwasm-stargate";
import { StargateClient } from "@cosmjs/stargate";
import { Event } from "@cosmjs/tendermint-rpc/build/tendermint37";
import { AssetInfo } from "@oraichain/oraidex-contracts-sdk";
import { AIRI_CONTRACT, AVERAGE_COSMOS_GAS_PRICE, BTC_CONTRACT, MILKYBSC_ORAICHAIN_DENOM, ORAI } from "../src/constant";
import {
  calculateMinReceive,
  calculateTimeoutTimestamp,
  checkValidateAddressWithNetwork,
  decodeProto,
  ethToTronAddress,
  findToTokenOnOraiBridge,
  getCosmosGasPrice,
  getEvmAddress,
  getSubAmountDetails,
  getTokenOnOraichain,
  getTokenOnSpecificChainId,
  handleSentFunds,
  isEthAddress,
  marshalEncodeObjsToStargateMsgs,
  parseAssetInfo,
  parseTokenInfo,
  parseTokenInfoRawDenom,
  parseTxToMsgsAndEvents,
  parseWasmEvents,
  toAmount,
  toAssetInfo,
  toDecimal,
  toDisplay,
  toTokenInfo,
  tronToEthAddress,
  validateAndIdentifyCosmosAddress,
  validateEvmAddress,
  validateNumber,
  validateTronAddress,
  parseAssetInfoFromContractAddrOrDenom
} from "../src/helper";
import { CoinGeckoId, NetworkChainId } from "../src/network";
import { isFactoryV1 } from "../src/pairs";
import { AmountDetails, TokenItemType, cosmosTokens, flattenTokens, oraichainTokens } from "../src/token";
import fs from "fs";
import path from "path";

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
    ["tron", cosmosTokens.find((token) => token.coinGeckoId === "tron" && token.chainId === "Oraichain")!, ""]
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
    ["tron", cosmosTokens.find((token) => token.coinGeckoId === "tron" && token.chainId === "Oraichain")!, ""]
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

  // TODO: add more tests for this func
  it("test-parseTxToMsgsAndEvents", async () => {
    // case 1: undefined input
    const reuslt = parseTxToMsgsAndEvents(undefined as any);
    expect(reuslt).toEqual([]);

    // case 2: real tx with multiple msgs and multiple contract calls
    // got data from tx hash 9B435E4014DEBA5AB80D4BB8F52D766A6C14BFCAC21F821CDB96F4ABB4E29B17 Oraichain.
    const rawLog = fs.readFileSync(path.join(__dirname, "indexed-tx-raw-log.json")).toString();
    const tx = Buffer.from(fs.readFileSync(path.join(__dirname, "indexed-tx-tx.json")).toString(), "base64");
    const data = parseTxToMsgsAndEvents({ rawLog, tx } as any);
    expect(data.length).toEqual(2);
    expect(data[0].message).toMatchObject({
      sender: "orai16hv74w3eu3ek0muqpgp4fekhrqgpzl3hd3qeqk",
      contract: "orai1nt58gcu4e63v7k55phnr3gaym9tvk3q4apqzqccjuwppgjuyjy6sxk8yzp",
      msg: {
        execute_order_book_pair: {
          asset_infos: [
            {
              token: {
                contract_addr: "orai1lplapmgqnelqn253stz6kmvm3ulgdaytn89a8mz9y85xq8wd684s6xl3lt"
              }
            },
            {
              token: {
                contract_addr: "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh"
              }
            }
          ],
          limit: 100
        }
      },
      funds: []
    });
    expect(data[0].attrs.length).toEqual(5);
    expect(data[1].message).toMatchObject({
      sender: "orai16hv74w3eu3ek0muqpgp4fekhrqgpzl3hd3qeqk",
      contract: "orai1nt58gcu4e63v7k55phnr3gaym9tvk3q4apqzqccjuwppgjuyjy6sxk8yzp",
      msg: {
        execute_order_book_pair: {
          asset_infos: [
            { native_token: { denom: "orai" } },
            {
              token: {
                contract_addr: "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh"
              }
            }
          ],
          limit: 100
        }
      },
      funds: []
    });
    expect(data[0].attrs.length).toEqual(5);
  }, 20000);

  it("test-decodeProto-with-value-input-undefined", () => {
    expect(() => decodeProto(undefined)).toThrow("value is not defined");
  });

  it.each([
    [
      // case 1: value with type_url and valid value
      {
        type_url: "/cosmos.gov.v1beta1.TextProposal",
        value: Uint8Array.from([10, 3, 97, 98, 99]) // Example byte array
      },
      { title: "abc", description: "" }
    ],

    [
      // case 2: value with typeUrl and valid value
      {
        type_url: "/cosmos.gov.v1beta1.TextProposal",
        value: Uint8Array.from([10, 3, 97, 98, 99])
      },
      { title: "abc", description: "" }
    ],

    // case 3: value is object with binary string and object properties is binary string
    [
      {
        key1: "InZhbHVlMSI=",
        key2: {
          nestedKey: "Im5lc3RlZC1zdHJpbmctdmFsdWUi"
        }
      },
      {
        key1: "value1",
        key2: {
          nestedKey: "nested-string-value"
        }
      }
    ],

    // case 4: value is object with text string
    [
      {
        key1: "text-string"
      },
      {
        key1: "text-string"
      }
    ],

    // case 5: value.msg is instance of Uint8Array
    [
      {
        msg: Uint8Array.from([123, 34, 107, 101, 121, 34, 58, 34, 118, 97, 108, 117, 101, 34, 125]) // Uint8Array representation of '{"key": "value"}'
      },
      {
        msg: {
          key: "value"
        }
      }
    ]
  ])("test-decodeProto", (value, expectation) => {
    // act
    const res = decodeProto(value);

    // assertion
    expect(res).toEqual(expectation);
  });

  it.each<[string, readonly Event[], { [key: string]: string }[]]>([
    ["empty-events-array", [], []],
    ["events-with-single-event-without-attributes", [{ type: "wasmEvent", attributes: [] }], []],
    [
      "events-with-single-event-with-attributes",
      [
        {
          type: "wasmEvent",
          attributes: [
            { key: "_contract_address", value: "addr1" },
            { key: "key1", value: "value1" }
          ]
        }
      ],
      [{ _contract_address: "addr1", key1: "value1" }]
    ],
    [
      "events-with-multiple-events-with-and-without-attributes",
      [
        {
          type: "wasmEvent",
          attributes: [
            { key: "_contract_address", value: "addr1" },
            { key: "key2", value: "value2" }
          ]
        },
        { type: "otherEvent", attributes: [{ key: "key3", value: "value3" }] },
        { type: "wasmEvent", attributes: [{ key: "_contract_address", value: "addr2" }] }
      ],
      [{ _contract_address: "addr1", key2: "value2" }, { _contract_address: "addr2" }]
    ]
  ])("test-parseWasmEvents-with-case: %p", (_case, input, expectedOutput) => {
    expect(parseWasmEvents(input)).toEqual(expectedOutput);
  });

  it.each<[string, NetworkChainId, { isValid: boolean; network?: string; error?: string }]>([
    [
      "0x1CE09E54A5d7432ecabf3b085BAda7920aeb7dab",
      "0x01",
      {
        isValid: true,
        network: "0x01"
      }
    ],
    [
      "0x1CE09E54A5d7432ecabf3b085BAda7920aeb7dab",
      "0x38",
      {
        isValid: true,
        network: "0x38"
      }
    ],
    [
      "TPF97BNTx2pyNayUhz6B88JSzfdz5SHDbm",
      "0x2b6653dc",
      {
        isValid: true,
        network: "0x2b6653dc"
      }
    ],
    [
      "orai1hvr9d72r5um9lvt0rpkd4r75vrsqtw6yujhqs2",
      "Oraichain",
      {
        isValid: true,
        network: "Oraichain"
      }
    ],
    [
      "osmo1hvr9d72r5um9lvt0rpkd4r75vrsqtw6y86jn8t",
      "0x38",
      {
        isValid: false
      }
    ],
    [
      "osmo1hvr9d72r5um9lvt0rpkd4r75vrsqtw6y86jn8t",
      "Oraichain",
      {
        isValid: false,
        error: "Network doesn't match"
      }
    ],
    [
      "TPF97BNTx2pyNayUhz6B88JSzfdz5SHDbm",
      "Oraichain",
      {
        isValid: false,
        error: "Invalid address"
      }
    ]
  ])("test-check-validate-address-wallet-with-network", (address, network, expected) => {
    const check = checkValidateAddressWithNetwork(address, network);

    expect(check).toEqual(expected);
  });

  it.each([
    ["0x1CE09E54A5d7432ecabf3b085BAda7920aeb7dab", "0x01", true],
    ["TEu6u8JLCFs6x1w5s8WosNqYqVx2JMC5hQ", "0x2b6653dc", false],
    ["TEu6u8JLCFs6x1w5s8WosNqYqVx2JMC5hQ", "0x01", false],
    ["0x1", "0x38", false],
    ["", "0x38", false]
  ])("test-validateEvmAddress", (value, network, expectation) => {
    try {
      const { isValid } = validateEvmAddress(value, network);
      expect(isValid).toEqual(expectation);
    } catch (error) {
      expect(expectation).toEqual(false);
    }
  });

  it.each([
    ["TEu6u8JLCFs6x1w5s8WosNqYqVx2JMC5hQ", "0x2b6653dc", true],
    ["0x1CE09E54A5d7432ecabf3b085BAda7920aeb7dab", "0x01", false],
    ["TEu6u8JLCFs6x1w5s8WosNqYqVx2JMC5hQ", "0x01", false],
    ["TE", "0x2b6653dc", false],
    ["", "0x2b6653dc", false]
  ])("test-validateTronAddress", (value, network, expectation) => {
    try {
      const { isValid } = validateTronAddress(value, network);
      expect(isValid).toEqual(expectation);
    } catch (error) {
      expect(expectation).toEqual(false);
    }
  });

  it.each([
    ["orai12zyu8w93h0q2lcnt50g3fn0w3yqnhy4fvawaqz", "Oraichain", true],
    ["orai1", "Oraichain", false],
    ["", "Oraichain", false],
    ["cosmos12zyu8w93h0q2lcnt50g3fn0w3yqnhy4flwc7p3", "cosmoshub-4", true],
    ["cosmos12", "cosmoshub-4", false],
    ["", "cosmoshub-4", false]
  ])("test-validateTronAddress", (value, network, expectation) => {
    try {
      const { isValid } = validateAndIdentifyCosmosAddress(value, network);
      expect(isValid).toEqual(expectation);
    } catch (error) {
      expect(expectation).toEqual(false);
    }
  });

  it.each<[string, AssetInfo | null]>([
    ["", null],
    ["orai333", null],
    ["orai", { native_token: { denom: "orai" } }],
    [BTC_CONTRACT, { token: { contract_addr: BTC_CONTRACT } }]
  ])("test-generateConvertErc20Cw20Message-should-return-correct-message", (addressOrDenom, expectedMessage) => {
    const result = parseAssetInfoFromContractAddrOrDenom(addressOrDenom);
    expect(result).toEqual(expectedMessage);
  });
});
