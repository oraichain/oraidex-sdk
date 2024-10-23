import {
  AIRI_CONTRACT,
  ATOM,
  ATOM_ORAICHAIN_DENOM,
  AmountDetails,
  COSMOS_CHAIN_ID_COMMON,
  CoinGeckoId,
  CosmosChainId,
  EvmChainId,
  INJECTIVE_CONTRACT,
  INJECTIVE_ORAICHAIN_DENOM,
  KWT_BSC_CONTRACT,
  MILKY_BSC_CONTRACT,
  NEUTARO_INFO,
  NEUTARO_ORAICHAIN_DENOM,
  NetworkChainId,
  ORAI,
  ORAIX_CONTRACT,
  ORAIX_INFO,
  ORAI_BRIDGE_EVM_DENOM_PREFIX,
  ORAI_BRIDGE_EVM_ETH_DENOM_PREFIX,
  ORAI_BRIDGE_EVM_TRON_DENOM_PREFIX,
  ORAI_BSC_CONTRACT,
  ORAI_ETH_CONTRACT,
  ORAI_INFO,
  TokenInfo,
  TokenItemType,
  USDC_CONTRACT,
  USDC_INFO,
  USDT_BSC_CONTRACT,
  USDT_CONTRACT,
  USDT_ETH_CONTRACT,
  USDT_TRON_CONTRACT,
  WRAP_BNB_CONTRACT,
  WRAP_ETH_CONTRACT,
  WRAP_TRON_TRX_CONTRACT,
  flattenTokens,
  getTokenOnOraichain,
  getTokenOnSpecificChainId,
  ibcInfos,
  oraib2oraichain,
  oraichain2atom,
  oraichain2oraib,
  parseTokenInfoRawDenom,
  toDisplay
} from "@oraichain/oraidex-common";

import * as dexCommonHelper from "@oraichain/oraidex-common/build/helper";
import * as universalHelper from "../src/helper";
import {
  buildIbcWasmPairKey,
  buildSwapRouterKey,
  addOraiBridgeRoute,
  getRoute,
  getEvmSwapRoute,
  getIbcInfo,
  getSourceReceiver,
  isEvmNetworkNativeSwapSupported,
  isEvmSwappable,
  isSupportedNoPoolSwapEvm,
  generateSwapRoute,
  generateSwapOperationMsgs,
  UniversalSwapHelper
} from "../src/helper";
import { SwapRoute, UniversalSwapType } from "../src/types";
import { AssetInfo } from "@oraichain/oraidex-contracts-sdk";
import { SwapOperation } from "@oraichain/oraidex-contracts-sdk";
import { Coin, coin } from "@cosmjs/proto-signing";
import { expect, afterAll, beforeAll, describe, it, vi } from "vitest";
import { parseAssetInfo } from "../../oraidex-common/src";

describe("test helper functions", () => {
  it("test-buildSwapRouterKey", () => {
    expect(buildSwapRouterKey("foo", "bar")).toEqual("foo-bar");
  });
  it.each<[string, string, string, string[] | undefined]>([
    ["0x38", USDT_BSC_CONTRACT, WRAP_BNB_CONTRACT, [USDT_BSC_CONTRACT, WRAP_BNB_CONTRACT]],
    ["0x38", WRAP_BNB_CONTRACT, USDT_BSC_CONTRACT, [WRAP_BNB_CONTRACT, USDT_BSC_CONTRACT]],
    ["0x38", WRAP_BNB_CONTRACT, USDT_TRON_CONTRACT, [WRAP_BNB_CONTRACT, USDT_BSC_CONTRACT]],
    ["0x38", "", USDT_TRON_CONTRACT, [WRAP_BNB_CONTRACT, USDT_BSC_CONTRACT]],
    ["0x38", USDT_BSC_CONTRACT, "", [USDT_BSC_CONTRACT, WRAP_BNB_CONTRACT]],
    ["0x38", WRAP_BNB_CONTRACT, WRAP_TRON_TRX_CONTRACT, undefined],
    ["Oraichain", WRAP_BNB_CONTRACT, WRAP_TRON_TRX_CONTRACT, undefined],
    ["0x01", WRAP_ETH_CONTRACT, USDT_ETH_CONTRACT, [WRAP_ETH_CONTRACT, USDT_ETH_CONTRACT]]
  ])("test-getEvmSwapRoute", (chainId, fromContractAddr, toContractAddr, expectedRoute) => {
    const result = getEvmSwapRoute(chainId, fromContractAddr, toContractAddr);
    expect(JSON.stringify(result)).toEqual(JSON.stringify(expectedRoute));
  });

  it.each<[CoinGeckoId, boolean]>([
    ["wbnb", true],
    ["weth", false],
    ["binancecoin", true],
    ["ethereum", true],
    ["kawaii-islands", false]
  ])("test-isSupportedNoPoolSwapEvm", (coingeckoId, expectedResult) => {
    expect(isSupportedNoPoolSwapEvm(coingeckoId)).toEqual(expectedResult);
  });

  it.each<[string, string, string | undefined, string | undefined, boolean]>([
    ["a", "b", "b", "c", false],
    ["a", "a", "b", "c", false],
    ["0x38", "0x38", USDT_TRON_CONTRACT, USDT_BSC_CONTRACT, false],
    ["0x38", "0x38", undefined, USDT_BSC_CONTRACT, true],
    ["0x38", "0x38", USDT_TRON_CONTRACT, undefined, true],
    ["0x38", "0x38", undefined, undefined, false],
    ["0x38", "0x38", WRAP_BNB_CONTRACT, USDT_BSC_CONTRACT, true]
  ])("test-isEvmSwappable", (fromChainId, toChainId, fromContractAddr, toContractAddr, expectedResult) => {
    const result = isEvmSwappable({ fromChainId, toChainId, fromContractAddr, toContractAddr });
    expect(result).toEqual(expectedResult);
  });

  it("test-getIbcInfo", () => {
    expect(() => {
      getIbcInfo("foobar" as any, "0x1ae6");
    }).toThrow();

    expect(getIbcInfo("Oraichain", "oraibridge-subnet-2")).toEqual(ibcInfos["Oraichain"]["oraibridge-subnet-2"]);
    expect(() => {
      getIbcInfo("osmosis-1", "oraibridge-subnet-2");
    }).toThrow();
  });

  it("test-buildIbcWasmPairKey", () => {
    expect(buildIbcWasmPairKey("foo", "bar", "john-doe")).toEqual("foo/bar/john-doe");
  });

  it.each<[NetworkChainId, boolean]>([
    ["0x01", true],
    ["0x38", true],
    ["Oraichain", false]
  ])("test-isEvmNetworkNativeSwapSupported", (chainId, expectedResult) => {
    expect(isEvmNetworkNativeSwapSupported(chainId)).toEqual(expectedResult);
  });

  it("test-getSourceReceiver-should-return-channel-1-plus-address", async () => {
    const keplrAddress = "orai1329tg05k3snr66e2r9ytkv6hcjx6fkxcarydx6";
    const tokenAddress = ORAI_BSC_CONTRACT;
    const res = getSourceReceiver(keplrAddress, tokenAddress);
    expect(res).toBe(`${oraib2oraichain}/${keplrAddress}`);
  });

  it("test-getSourceReceiver-should-return-only-address", async () => {
    const keplrAddress = "orai1329tg05k3snr66e2r9ytkv6hcjx6fkxcarydx6";
    let tokenAddress = KWT_BSC_CONTRACT;
    let res = getSourceReceiver(keplrAddress, tokenAddress);
    expect(res).toBe(keplrAddress);

    tokenAddress = MILKY_BSC_CONTRACT;
    res = getSourceReceiver(keplrAddress, tokenAddress);
    expect(res).toBe(keplrAddress);
  });

  it.each<[CoinGeckoId, NetworkChainId, CoinGeckoId, NetworkChainId, string, SwapRoute, boolean]>([
    [
      "airight",
      "0x38",
      "airight",
      "Oraichain",
      "",
      { swapRoute: "", universalSwapType: "other-networks-to-oraichain", isSmartRouter: false },
      false
    ],
    [
      "cosmos",
      "cosmoshub-4",
      "airight",
      "Oraichain",
      "",
      { swapRoute: "", universalSwapType: "other-networks-to-oraichain", isSmartRouter: false },
      false
    ],
    [
      "osmosis",
      "osmosis-1",
      "airight",
      "Oraichain",
      "",
      { swapRoute: "", universalSwapType: "other-networks-to-oraichain", isSmartRouter: false },
      false
    ],
    [
      "kawaii-islands",
      "kawaii_6886-1",
      "airight",
      "Oraichain",
      "",
      { swapRoute: "", universalSwapType: "other-networks-to-oraichain", isSmartRouter: false },
      false
    ],
    [
      "kawaii-islands",
      "0x1ae6",
      "airight",
      "Oraichain",
      "",
      { swapRoute: "", universalSwapType: "other-networks-to-oraichain", isSmartRouter: false },
      false
    ],
    [
      "airight",
      "0x38",
      "airight",
      "Oraichain",
      "orai1234",
      { swapRoute: "", universalSwapType: "other-networks-to-oraichain", isSmartRouter: true },
      false
    ],
    [
      "airight",
      "Oraichain",
      "tether",
      "Oraichain",
      "orai1234",
      { swapRoute: "", universalSwapType: "oraichain-to-oraichain", isSmartRouter: false },
      false
    ],
    [
      "airight",
      "0x38",
      "cosmos",
      "Oraichain",
      "orai1234",
      {
        swapRoute: "",
        universalSwapType: "other-networks-to-oraichain",
        isSmartRouter: true
      },
      false
    ],
    [
      "airight",
      "Oraichain",
      "cosmos",
      "cosmoshub-4",
      "orai1234",
      { swapRoute: "", universalSwapType: "oraichain-to-cosmos", isSmartRouter: false },
      false
    ],
    [
      "airight",
      "Oraichain",
      "cosmos",
      "cosmoshub-4",
      "orai1234",
      { swapRoute: "", universalSwapType: "oraichain-to-cosmos", isSmartRouter: false },
      false
    ],
    [
      "airight",
      "0x38",
      "cosmos",
      "cosmoshub-4",
      "orai1234",
      {
        // swapRoute: `${oraichain2atom}/orai1234:uatom`,
        swapRoute: "",
        universalSwapType: "other-networks-to-oraichain",
        isSmartRouter: true
      },
      false
    ],
    [
      "tether",
      "0x38",
      "oraichain-token",
      "0x01",
      "0x09beeedf51aa45718f46837c94712d89b157a9d3",
      {
        swapRoute: "",
        universalSwapType: "other-networks-to-oraichain",
        isSmartRouter: true
      },
      false
    ],
    [
      "usd-coin",
      "0x01",
      "tether",
      "0x38",
      "0x09beeedf51aa45718f46837c94712d89b157a9d3",
      {
        swapRoute: "",
        universalSwapType: "other-networks-to-oraichain",
        isSmartRouter: true
      },
      false
    ],
    [
      "usd-coin",
      "0x01",
      "tether",
      "0x2b6653dc",
      "0x09beeedf51aa45718f46837c94712d89b157a9d3",
      {
        // swapRoute: `${oraichain2oraib}/orai1234:${USDT_TRON_CONTRACT}`,
        swapRoute: "",
        universalSwapType: "other-networks-to-oraichain",
        isSmartRouter: true
      },
      false
    ],
    [
      "usd-coin",
      "0x01",
      "tether",
      "0x2b6653dc",
      "0x1234",
      {
        // swapRoute: `${oraichain2oraib}/${ORAI_BRIDGE_EVM_TRON_DENOM_PREFIX}0x1234:${USDT_TRON_CONTRACT}`,
        swapRoute: "",
        universalSwapType: "other-networks-to-oraichain",
        isSmartRouter: true
      },
      false
    ],
    [
      "usd-coin",
      "0x01",
      "wbnb",
      "0x38",
      "0x1234",
      {
        swapRoute: "",
        universalSwapType: "other-networks-to-oraichain",
        isSmartRouter: true
      },
      false
    ],
    [
      "oraichain-token",
      "Oraichain",
      "usd-coin",
      "0x01",
      "0x1234",
      { swapRoute: "", universalSwapType: "oraichain-to-evm", isSmartRouter: false },
      false
    ],
    [
      "kawaii-islands",
      "0x1ae6",
      "oraichain-token",
      "Oraichain",
      "orai1234",
      { swapRoute: "", universalSwapType: "other-networks-to-oraichain", isSmartRouter: false },
      true
    ],
    [
      "kawaii-islands",
      "kawaii_6886-1",
      "oraichain-token",
      "Oraichain",
      "orai1234",
      { swapRoute: "", universalSwapType: "other-networks-to-oraichain", isSmartRouter: false },
      true
    ],
    [
      "kawaii-islands",
      "0x38",
      "oraichain-token",
      "Oraichain",
      "orai1234",
      { swapRoute: "", universalSwapType: "other-networks-to-oraichain", isSmartRouter: false },
      false
    ],
    [
      "milky-token",
      "0x38",
      "oraichain-token",
      "Oraichain",
      "orai1234",
      { swapRoute: "", universalSwapType: "other-networks-to-oraichain", isSmartRouter: false },
      false
    ]
  ])(
    "test-getRoute-given %s coingecko id, chain id %s, send-to %s, chain id %s with receiver %s should have swapRoute %s",
    (fromCoingeckoId, fromChainId, toCoingeckoId, toChainId, receiver, swapRoute, willThrow) => {
      vi.spyOn(dexCommonHelper, "isEthAddress").mockImplementation((address) =>
        address.includes("0x") ? true : false
      );
      const fromToken = flattenTokens.find(
        (item) => item.coinGeckoId === fromCoingeckoId && item.chainId === fromChainId
      )!;
      const toToken = flattenTokens.find((item) => item.coinGeckoId === toCoingeckoId && item.chainId === toChainId);
      try {
        const receiverAddress = UniversalSwapHelper.getRoute(fromToken, toToken, receiver);
        expect(receiverAddress).toEqual(swapRoute);
        expect(willThrow).toEqual(false);
      } catch (error) {
        expect(willThrow).toEqual(true);
        expect(error).toEqual(new Error(`chain id ${fromToken.chainId} is currently not supported in universal swap`));
      }
    }
  );

  it.each<[string, any, any, boolean]>([
    ["orai12zyu8w93h0q2lcnt50g3fn0w3yqnhy4fvawaqz", "inj172zx58jd47h28rqkvznpsfmavas9h544t024u3", undefined, true],
    ["orai12zyu8w93h0q2lcnt50g3fn0w3yqnhy4fvawaqz", undefined, undefined, true],
    ["0x09beeedf51aa45718f46837c94712d89b157a9d3", undefined, undefined, false],
    [
      "orai12zyu8w93h0q2lcnt50g3fn0w3yqnhy4fvawaqz",
      undefined,
      {
        "0x01": "0x09beeedf51aa45718f46837c94712d89b157a9d3"
      },
      false
    ]
  ])("test-generateAddress-UniversalSwapHelper", (oraiAddress, injAddress, evmInfo, willThrow) => {
    try {
      const expectAddresses = {
        [COSMOS_CHAIN_ID_COMMON.ORAICHAIN_CHAIN_ID]: oraiAddress,
        [COSMOS_CHAIN_ID_COMMON.INJECTVE_CHAIN_ID]: injAddress,
        [COSMOS_CHAIN_ID_COMMON.NOBLE_CHAIN_ID]: UniversalSwapHelper.getAddress("noble", {
          address118: oraiAddress,
          address60: injAddress
        }),
        [COSMOS_CHAIN_ID_COMMON.CELESTIA_CHAIN_ID]: UniversalSwapHelper.getAddress("celestia", {
          address118: oraiAddress,
          address60: injAddress
        }),
        [COSMOS_CHAIN_ID_COMMON.COSMOSHUB_CHAIN_ID]: UniversalSwapHelper.getAddress("cosmos", {
          address118: oraiAddress,
          address60: injAddress
        }),
        [COSMOS_CHAIN_ID_COMMON.OSMOSIS_CHAIN_ID]: UniversalSwapHelper.getAddress("osmo", {
          address118: oraiAddress,
          address60: injAddress
        }),
        [COSMOS_CHAIN_ID_COMMON.ORAIBRIDGE_CHAIN_ID]: UniversalSwapHelper.getAddress("oraib", {
          address118: oraiAddress,
          address60: injAddress
        }),
        ...evmInfo
      };

      const generateAddress = UniversalSwapHelper.generateAddress({ oraiAddress, injAddress, evmInfo });
      expect(generateAddress).toMatchObject(expectAddresses);
    } catch (error) {
      expect(willThrow).toEqual(false);
    }
  });

  // it.each<
  //   [
  //     CoinGeckoId,
  //     EvmChainId | CosmosChainId,
  //     CoinGeckoId,
  //     EvmChainId | CosmosChainId,
  //     string,
  //     string,
  //     SwapRoute,
  //     boolean
  //   ]
  // >([
  //   [
  //     "cosmos",
  //     "cosmoshub-4",
  //     "cosmos",
  //     "Oraichain",
  //     "orai1ek2243955krr3enky8jq8y8vhh3p63y5wjzs4j",
  //     "orai1ek2243955krr3enky8jq8y8vhh3p63y5wjzs4j",
  //     {
  //       swapRoute: parseToIbcHookMemo(
  //         "orai1ek2243955krr3enky8jq8y8vhh3p63y5wjzs4j",
  //         "orai1ek2243955krr3enky8jq8y8vhh3p63y5wjzs4j",
  //         "",
  //         parseTokenInfoRawDenom(getTokenOnSpecificChainId("cosmos", "Oraichain") as TokenItemType)
  //       ),
  //       universalSwapType: "cosmos-to-others"
  //     },
  //     false
  //   ],
  //   [
  //     "cosmos",
  //     "cosmoshub-4",
  //     "oraichain-token",
  //     "Oraichain",
  //     "orai1ek2243955krr3enky8jq8y8vhh3p63y5wjzs4j",
  //     "orai1ek2243955krr3enky8jq8y8vhh3p63y5wjzs4j",
  //     {
  //       swapRoute: parseToIbcHookMemo(
  //         "orai1ek2243955krr3enky8jq8y8vhh3p63y5wjzs4j",
  //         "orai1ek2243955krr3enky8jq8y8vhh3p63y5wjzs4j",
  //         "",
  //         parseTokenInfoRawDenom(getTokenOnSpecificChainId("oraichain-token", "Oraichain") as TokenItemType)
  //       ),
  //       universalSwapType: "cosmos-to-others"
  //     },
  //     false
  //   ],
  //   [
  //     "cosmos",
  //     "cosmoshub-4",
  //     "tether",
  //     "0x01",
  //     "orai1ek2243955krr3enky8jq8y8vhh3p63y5wjzs4j",
  //     "0x09beeedf51aa45718f46837c94712d89b157a9d3",
  //     {
  //       swapRoute: parseToIbcHookMemo(
  //         "orai1ek2243955krr3enky8jq8y8vhh3p63y5wjzs4j",
  //         `${ORAI_BRIDGE_EVM_ETH_DENOM_PREFIX}0x09beeedf51aa45718f46837c94712d89b157a9d3`,
  //         ibcInfos["Oraichain"]["0x01"]?.channel ?? "",
  //         `${ORAI_BRIDGE_EVM_ETH_DENOM_PREFIX}${parseTokenInfoRawDenom(
  //           getTokenOnSpecificChainId("tether", "0x01") as TokenItemType
  //         )}`
  //       ),
  //       universalSwapType: "cosmos-to-others"
  //     },
  //     false
  //   ],
  //   [
  //     "cosmos",
  //     "cosmoshub-4",
  //     "tether",
  //     "0x38",
  //     "orai1ek2243955krr3enky8jq8y8vhh3p63y5wjzs4j",
  //     "0x09beeedf51aa45718f46837c94712d89b157a9d3",
  //     {
  //       swapRoute: parseToIbcHookMemo(
  //         "orai1ek2243955krr3enky8jq8y8vhh3p63y5wjzs4j",
  //         `${ORAI_BRIDGE_EVM_DENOM_PREFIX}0x09beeedf51aa45718f46837c94712d89b157a9d3`,
  //         ibcInfos["Oraichain"]["0x38"]?.channel ?? "",
  //         `${ORAI_BRIDGE_EVM_DENOM_PREFIX}${parseTokenInfoRawDenom(
  //           getTokenOnSpecificChainId("tether", "0x38") as TokenItemType
  //         )}`
  //       ),
  //       universalSwapType: "cosmos-to-others"
  //     },
  //     false
  //   ],
  //   [
  //     "cosmos",
  //     "cosmoshub-4",
  //     "tether",
  //     "0x2b6653dc",
  //     "orai1ek2243955krr3enky8jq8y8vhh3p63y5wjzs4j",
  //     "0x09beeedf51aa45718f46837c94712d89b157a9d3",
  //     {
  //       swapRoute: parseToIbcHookMemo(
  //         "orai1ek2243955krr3enky8jq8y8vhh3p63y5wjzs4j",
  //         `${ORAI_BRIDGE_EVM_TRON_DENOM_PREFIX}0x09beeedf51aa45718f46837c94712d89b157a9d3`,
  //         ibcInfos["Oraichain"]["0x2b6653dc"]?.channel ?? "",
  //         `${ORAI_BRIDGE_EVM_TRON_DENOM_PREFIX}${parseTokenInfoRawDenom(
  //           getTokenOnSpecificChainId("tether", "0x2b6653dc") as TokenItemType
  //         )}`
  //       ),
  //       universalSwapType: "cosmos-to-others"
  //     },
  //     false
  //   ],
  //   [
  //     "osmosis",
  //     "osmosis-1",
  //     "cosmos",
  //     "cosmoshub-4",
  //     "orai1ek2243955krr3enky8jq8y8vhh3p63y5wjzs4j",
  //     "orai1ek2243955krr3enky8jq8y8vhh3p63y5wjzs4j",
  //     {
  //       swapRoute: parseToIbcHookMemo(
  //         "orai1ek2243955krr3enky8jq8y8vhh3p63y5wjzs4j",
  //         "orai1ek2243955krr3enky8jq8y8vhh3p63y5wjzs4j",
  //         ibcInfos["Oraichain"]["cosmoshub-4"]?.channel as string,
  //         parseTokenInfoRawDenom(getTokenOnSpecificChainId("cosmos", "cosmoshub-4") as TokenItemType)
  //       ),
  //       universalSwapType: "cosmos-to-others"
  //     },
  //     false
  //   ],
  //   [
  //     "usd-coin",
  //     "noble-1",
  //     "cosmos",
  //     "cosmoshub-4",
  //     "orai1ek2243955krr3enky8jq8y8vhh3p63y5wjzs4j",
  //     "cosmos1ek2243955krr3enky8jq8y8vhh3p63y5wjzs4j",
  //     {
  //       swapRoute: parseToIbcWasmMemo(
  //         "cosmos1ek2243955krr3enky8jq8y8vhh3p63y5wjzs4j",
  //         ibcInfos["Oraichain"]["cosmoshub-4"]?.channel as string,
  //         parseTokenInfoRawDenom(getTokenOnSpecificChainId("cosmos", "cosmoshub-4") as TokenItemType)
  //       ),
  //       universalSwapType: "cosmos-to-others"
  //     },
  //     false
  //   ],
  //   [
  //     "usd-coin",
  //     "noble-1",
  //     "oraichain-token",
  //     "Oraichain",
  //     "orai1ek2243955krr3enky8jq8y8vhh3p63y5wjzs4j",
  //     "orai1ek2243955krr3enky8jq8y8vhh3p63y5wjzs4j",
  //     {
  //       swapRoute: parseToIbcWasmMemo(
  //         "orai1ek2243955krr3enky8jq8y8vhh3p63y5wjzs4j",
  //         "",
  //         parseTokenInfoRawDenom(getTokenOnSpecificChainId("oraichain-token", "Oraichain") as TokenItemType)
  //       ),
  //       universalSwapType: "cosmos-to-others"
  //     },
  //     false
  //   ]
  // ])(
  //   "test-ibc-hooks-getRoute-given %s coingecko id, chain id %s, send-to %s, chain id %s with receiver %s should have swapRoute %s",
  //   (
  //     fromCoingeckoId,
  //     fromChainId,
  //     toCoingeckoId,
  //     toChainId,
  //     receiverOnOrai,
  //     destinationReceiver,
  //     swapRoute,
  //     willThrow
  //   ) => {
  //     vi.spyOn(dexCommonHelper, "isEthAddress").mockImplementation((address) =>
  //       address.includes("0x") ? true : false
  //     );

  //     const fromToken = flattenTokens.find(
  //       (item) => item.coinGeckoId === fromCoingeckoId && item.chainId === fromChainId
  //     )!;
  //     const toToken = flattenTokens.find((item) => item.coinGeckoId === toCoingeckoId && item.chainId === toChainId);
  //     try {
  //       const receiverAddress = getRoute(fromToken, toToken, destinationReceiver, receiverOnOrai);
  //       expect(receiverAddress).toEqual(swapRoute);
  //       expect(willThrow).toEqual(false);
  //     } catch (error) {
  //       expect(willThrow).toEqual(true);
  //       expect(error).toEqual(new Error(`chain id ${fromToken.chainId} is currently not supported in universal swap`));
  //     }
  //   }
  // );

  it("test-addOraiBridgeRoute-empty-swapRoute", async () => {
    vi.spyOn(UniversalSwapHelper, "getRouteV2").mockResolvedValue("");
    const sourceReceiver = "orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g";
    const result = await UniversalSwapHelper.addOraiBridgeRoute(
      { sourceReceiver, destReceiver: undefined },
      { contractAddress: "any" } as any,
      undefined as any,
      "0",
      1,
      {
        isSourceReceiverTest: false
      }
    );
    expect(result.swapRoute).toEqual(`${oraib2oraichain}/${sourceReceiver}`);
  });
  it("test-addOraiBridgeRoute-empty-sourceReceiver", async () => {
    await expect(
      UniversalSwapHelper.addOraiBridgeRoute(
        { sourceReceiver: "", destReceiver: undefined },
        undefined as any,
        undefined as any,
        "0",
        1,
        {
          isSourceReceiverTest: false
        }
      )
    ).rejects.toThrow();
  });

  it.each<[string, any]>([
    [
      "channel-1/orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g:0x1234",
      {
        oraiBridgeChannel: "channel-1",
        oraiReceiver: "orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g",
        finalDestinationChannel: "",
        finalReceiver: "0x1234",
        tokenIdentifier: ""
      }
    ],
    [
      "orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g:0x1234",
      {
        oraiBridgeChannel: "",
        oraiReceiver: "orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g",
        finalDestinationChannel: "",
        finalReceiver: "0x1234",
        tokenIdentifier: ""
      }
    ],
    [
      "orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g",
      {
        oraiBridgeChannel: "",
        oraiReceiver: "orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g",
        finalDestinationChannel: "",
        finalReceiver: "",
        tokenIdentifier: ""
      }
    ],
    [
      "orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g:0x1234:atom",
      {
        oraiBridgeChannel: "",
        oraiReceiver: "orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g",
        finalDestinationChannel: "",
        finalReceiver: "0x1234",
        tokenIdentifier: "atom"
      }
    ],
    [
      "orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g:channel-29/0x1234:atom",
      {
        oraiBridgeChannel: "",
        oraiReceiver: "orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g",
        finalDestinationChannel: "channel-29",
        finalReceiver: "0x1234",
        tokenIdentifier: "atom"
      }
    ],
    [
      "channel-1/orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g:channel-29/0x1234:atom",
      {
        oraiBridgeChannel: "channel-1",
        oraiReceiver: "orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g",
        finalDestinationChannel: "channel-29",
        finalReceiver: "0x1234",
        tokenIdentifier: "atom"
      }
    ]
  ])("test-unmarshalOraiBridgeRoute-%s", (destination, routeData) => {
    expect(universalHelper.unmarshalOraiBridgeRoute(destination)).toEqual(routeData);
  });

  it.each<[AssetInfo, AssetInfo, AssetInfo[], SwapOperation[]]>([
    [
      NEUTARO_INFO,
      ORAI_INFO,
      [USDC_INFO],
      [
        {
          orai_swap: {
            offer_asset_info: NEUTARO_INFO,
            ask_asset_info: USDC_INFO
          }
        },
        {
          orai_swap: {
            offer_asset_info: USDC_INFO,
            ask_asset_info: ORAI_INFO
          }
        }
      ]
    ],
    [
      ORAI_INFO,
      NEUTARO_INFO,
      [USDC_INFO],
      [
        {
          orai_swap: {
            offer_asset_info: ORAI_INFO,
            ask_asset_info: USDC_INFO
          }
        },
        {
          orai_swap: {
            offer_asset_info: USDC_INFO,
            ask_asset_info: NEUTARO_INFO
          }
        }
      ]
    ],
    [
      ORAI_INFO,
      USDC_INFO,
      [],
      [
        {
          orai_swap: {
            offer_asset_info: ORAI_INFO,
            ask_asset_info: USDC_INFO
          }
        }
      ]
    ],
    [
      ORAIX_INFO,
      NEUTARO_INFO,
      [ORAI_INFO, USDC_INFO],
      [
        {
          orai_swap: {
            offer_asset_info: ORAIX_INFO,
            ask_asset_info: ORAI_INFO
          }
        },
        {
          orai_swap: {
            offer_asset_info: ORAI_INFO,
            ask_asset_info: USDC_INFO
          }
        },
        {
          orai_swap: {
            offer_asset_info: USDC_INFO,
            ask_asset_info: NEUTARO_INFO
          }
        }
      ]
    ],
    [
      NEUTARO_INFO,
      ORAIX_INFO,
      [USDC_INFO, ORAI_INFO],
      [
        {
          orai_swap: {
            offer_asset_info: NEUTARO_INFO,
            ask_asset_info: USDC_INFO
          }
        },
        {
          orai_swap: {
            offer_asset_info: USDC_INFO,
            ask_asset_info: ORAI_INFO
          }
        },
        {
          orai_swap: {
            offer_asset_info: ORAI_INFO,
            ask_asset_info: ORAIX_INFO
          }
        }
      ]
    ]
  ])("test-generateSwapRoute", (offerAsset, askAsset, swapRoute, expectSwapRoute) => {
    const getSwapRoute: SwapOperation[] = generateSwapRoute(offerAsset, askAsset, swapRoute);
    expect(getSwapRoute).toEqual(expect.arrayContaining(expectSwapRoute));
    getSwapRoute.forEach((swap) => {
      expect(swap).toMatchObject({
        orai_swap: expect.objectContaining({
          offer_asset_info: expect.any(Object),
          ask_asset_info: expect.any(Object)
        })
      });
    });
  });

  it.each<[AssetInfo, AssetInfo, SwapOperation[]]>([
    [
      ORAIX_INFO,
      NEUTARO_INFO,
      [
        {
          orai_swap: {
            offer_asset_info: ORAIX_INFO,
            ask_asset_info: ORAI_INFO
          }
        },
        {
          orai_swap: {
            offer_asset_info: ORAI_INFO,
            ask_asset_info: USDC_INFO
          }
        },
        {
          orai_swap: {
            offer_asset_info: USDC_INFO,
            ask_asset_info: NEUTARO_INFO
          }
        }
      ]
    ],
    [
      NEUTARO_INFO,
      ORAIX_INFO,
      [
        {
          orai_swap: {
            offer_asset_info: NEUTARO_INFO,
            ask_asset_info: USDC_INFO
          }
        },
        {
          orai_swap: {
            offer_asset_info: USDC_INFO,
            ask_asset_info: ORAI_INFO
          }
        },
        {
          orai_swap: {
            offer_asset_info: ORAI_INFO,
            ask_asset_info: ORAIX_INFO
          }
        }
      ]
    ]
  ])("test-generateSwapOperationMsgs", (offerAsset, askAsset, expectSwapRoute) => {
    const getSwapOperationMsgsRoute = generateSwapOperationMsgs(offerAsset, askAsset);
    expect(getSwapOperationMsgsRoute).toEqual(expect.arrayContaining(expectSwapRoute));
    getSwapOperationMsgsRoute.forEach((swap) => {
      expect(swap).toMatchObject({
        orai_swap: expect.objectContaining({
          offer_asset_info: expect.any(Object),
          ask_asset_info: expect.any(Object)
        })
      });
    });
  });

  it.each<[AmountDetails, TokenItemType, Coin, number]>([
    [
      {
        injective: "10000"
      },
      getTokenOnOraichain("injective-protocol"),
      coin(1000, INJECTIVE_ORAICHAIN_DENOM),
      1
    ],
    [
      {
        [INJECTIVE_ORAICHAIN_DENOM]: "1000",
        injective: "10000"
      },
      getTokenOnOraichain("injective-protocol"),
      coin(1000, INJECTIVE_ORAICHAIN_DENOM),
      0
    ],
    [{}, getTokenOnOraichain("injective-protocol"), coin(1000, INJECTIVE_ORAICHAIN_DENOM), 0]
  ])("test-generate-convert-msgs", async (currentBal: AmountDetails, tokenInfo, toSend, msgLength) => {
    const msg = universalHelper.generateConvertCw20Erc20Message(currentBal, tokenInfo, "orai123", toSend);
    console.dir(msg, { depth: null });
    expect(msg.length).toEqual(msgLength);
  });

  it.each<[AmountDetails, TokenItemType, number]>([
    [{}, getTokenOnOraichain("cosmos"), 0],
    [{ [`${INJECTIVE_ORAICHAIN_DENOM}`]: "10" }, getTokenOnOraichain("injective-protocol"), 1],
    [{ injective: "10" }, getTokenOnOraichain("injective-protocol"), 0]
  ])(
    "test-generateConvertErc20Cw20Message-should-return-correct-message-length",
    (amountDetails, tokenInfo, expectedMessageLength) => {
      const result = universalHelper.generateConvertErc20Cw20Message(amountDetails, tokenInfo, "john doe");
      expect(result.length).toEqual(expectedMessageLength);
    }
  );

  it.skip.each<[AssetInfo, AssetInfo, any[], SwapOperation[]]>([
    [
      ORAIX_INFO,
      NEUTARO_INFO,
      [
        { poolId: "1", tokenOut: ORAI },
        { poolId: "2", tokenOut: USDC_CONTRACT },
        { poolId: "1", tokenOut: NEUTARO_ORAICHAIN_DENOM }
      ],
      [
        {
          orai_swap: {
            offer_asset_info: ORAIX_INFO,
            ask_asset_info: ORAI_INFO
          }
        },
        {
          orai_swap: {
            offer_asset_info: ORAI_INFO,
            ask_asset_info: USDC_INFO
          }
        },
        {
          orai_swap: {
            offer_asset_info: USDC_INFO,
            ask_asset_info: NEUTARO_INFO
          }
        }
      ]
    ],
    [
      NEUTARO_INFO,
      ORAIX_INFO,
      [
        { poolId: "3", tokenOut: USDC_CONTRACT },
        { poolId: "2", tokenOut: ORAI },
        { poolId: "1", tokenOut: ORAIX_CONTRACT }
      ],
      [
        {
          orai_swap: {
            offer_asset_info: NEUTARO_INFO,
            ask_asset_info: USDC_INFO
          }
        },
        {
          orai_swap: {
            offer_asset_info: USDC_INFO,
            ask_asset_info: ORAI_INFO
          }
        },
        {
          orai_swap: {
            offer_asset_info: ORAI_INFO,
            ask_asset_info: ORAIX_INFO
          }
        }
      ]
    ]
  ])("test-generateSmartRouteForSwap", async (offerAsset, askAsset, paths, expectSwapRoute) => {
    vi.spyOn(UniversalSwapHelper, "querySmartRoute").mockResolvedValue({
      swapAmount: "1",
      returnAmount: "1",
      routes: [{ swapAmount: "1", returnAmount: "1", paths: paths }]
    });
    const res = await UniversalSwapHelper.generateSmartRouteForSwap(
      offerAsset,
      "Oraichain",
      askAsset,
      "Oraichain",
      "1",
      { url: "test" }
    );
    let getSwapOperationMsgsRoute = res.routes[0].paths;
    expect(getSwapOperationMsgsRoute).toEqual(expect.arrayContaining(expectSwapRoute));
    getSwapOperationMsgsRoute.forEach((swap) => {
      expect(swap).toMatchObject({
        orai_swap: expect.objectContaining({
          offer_asset_info: expect.any(Object),
          ask_asset_info: expect.any(Object)
        })
      });
    });
  });
});
