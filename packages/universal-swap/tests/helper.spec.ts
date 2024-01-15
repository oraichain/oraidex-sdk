import {
  AIRI_CONTRACT,
  ATOM,
  ATOM_ORAICHAIN_DENOM,
  CoinGeckoId,
  CosmosChainId,
  EvmChainId,
  KWT_BSC_CONTRACT,
  MILKY_BSC_CONTRACT,
  NetworkChainId,
  ORAI_BRIDGE_EVM_TRON_DENOM_PREFIX,
  ORAI_BSC_CONTRACT,
  ORAI_ETH_CONTRACT,
  STABLE_DENOM,
  TokenItemType,
  USDC_ETH_CONTRACT,
  USDT_BSC_CONTRACT,
  USDT_CONTRACT,
  USDT_TRON_CONTRACT,
  WRAP_BNB_CONTRACT,
  WRAP_TRON_TRX_CONTRACT,
  flattenTokens,
  getTokenOnOraichain,
  getTokenOnSpecificChainId,
  ibcInfos,
  oraib2oraichain,
  oraichain2atom,
  oraichain2oraib,
  parseTokenInfoRawDenom
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
  isSupportedNoPoolSwapEvm
} from "../src/helper";
import { SwapRoute, UniversalSwapType } from "../src/types";
import { parseToIbcHookMemo, parseToIbcWasmMemo } from "../src/proto/proto-gen";

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
    ["Oraichain", WRAP_BNB_CONTRACT, WRAP_TRON_TRX_CONTRACT, undefined]
  ])("test-getEvmSwapRoute", (chainId, fromContractAddr, toContractAddr, expectedRoute) => {
    const result = getEvmSwapRoute(chainId, fromContractAddr, toContractAddr);
    expect(JSON.stringify(result)).toEqual(JSON.stringify(expectedRoute));
  });

  it.each<[CoinGeckoId, boolean]>([
    ["wbnb", true],
    ["weth", true],
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

  it.each<
    [CoinGeckoId, EvmChainId | CosmosChainId, CoinGeckoId, EvmChainId | CosmosChainId, string, SwapRoute, boolean]
  >([
    [
      "airight",
      "0x01",
      "airight",
      "Oraichain",
      "orai1234",
      { swapRoute: "", universalSwapType: "other-networks-to-oraichain" },
      false
    ],
    [
      "airight",
      "0x38",
      "airight",
      "0x01",
      "orai1234",
      { swapRoute: "", universalSwapType: "other-networks-to-oraichain" },
      false
    ],
    [
      "airight",
      "0x38",
      "airight",
      "Oraichain",
      "",
      { swapRoute: "", universalSwapType: "other-networks-to-oraichain" },
      false
    ],
    [
      "cosmos",
      "cosmoshub-4",
      "airight",
      "Oraichain",
      "",
      { swapRoute: "", universalSwapType: "other-networks-to-oraichain" },
      false
    ],
    [
      "osmosis",
      "osmosis-1",
      "airight",
      "Oraichain",
      "",
      { swapRoute: "", universalSwapType: "other-networks-to-oraichain" },
      false
    ],
    [
      "kawaii-islands",
      "kawaii_6886-1",
      "airight",
      "Oraichain",
      "",
      { swapRoute: "", universalSwapType: "other-networks-to-oraichain" },
      false
    ],
    [
      "kawaii-islands",
      "0x1ae6",
      "airight",
      "Oraichain",
      "",
      { swapRoute: "", universalSwapType: "other-networks-to-oraichain" },
      false
    ],
    [
      "airight",
      "0x38",
      "airight",
      "Oraichain",
      "orai1234",
      { swapRoute: "orai1234", universalSwapType: "other-networks-to-oraichain" },
      false
    ],
    [
      "airight",
      "Oraichain",
      "tether",
      "Oraichain",
      "orai1234",
      { swapRoute: "", universalSwapType: "oraichain-to-oraichain" },
      false
    ],
    [
      "airight",
      "0x38",
      "cosmos",
      "Oraichain",
      "orai1234",
      {
        swapRoute: parseToIbcWasmMemo("orai1234", "", ATOM_ORAICHAIN_DENOM),
        universalSwapType: "other-networks-to-oraichain"
      },
      false
    ],
    [
      "airight",
      "Oraichain",
      "cosmos",
      "cosmoshub-4",
      "orai1234",
      { swapRoute: "", universalSwapType: "oraichain-to-cosmos" },
      false
    ],
    [
      "airight",
      "Oraichain",
      "cosmos",
      "cosmoshub-4",
      "orai1234",
      { swapRoute: "", universalSwapType: "oraichain-to-cosmos" },
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
        swapRoute: parseToIbcWasmMemo("orai1234", oraichain2atom, "uatom"),
        universalSwapType: "other-networks-to-oraichain"
      },
      false
    ],
    [
      "tether",
      "0x38",
      "oraichain-token",
      "0x01",
      "orai1234",
      {
        // swapRoute: `${oraichain2oraib}/orai1234:${ORAI_ETH_CONTRACT}`,
        swapRoute: parseToIbcWasmMemo("orai1234", oraichain2oraib, ORAI_ETH_CONTRACT),
        universalSwapType: "other-networks-to-oraichain"
      },
      false
    ],
    [
      "usd-coin",
      "0x01",
      "tether",
      "0x38",
      "orai1234",
      {
        // swapRoute: `${oraichain2oraib}/orai1234:${USDT_BSC_CONTRACT}`,
        swapRoute: parseToIbcWasmMemo("orai1234", oraichain2oraib, USDT_BSC_CONTRACT),
        universalSwapType: "other-networks-to-oraichain"
      },
      false
    ],
    [
      "usd-coin",
      "0x01",
      "tether",
      "0x2b6653dc",
      "orai1234",
      {
        // swapRoute: `${oraichain2oraib}/orai1234:${USDT_TRON_CONTRACT}`,
        swapRoute: parseToIbcWasmMemo("orai1234", oraichain2oraib, USDT_TRON_CONTRACT),
        universalSwapType: "other-networks-to-oraichain"
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
        swapRoute: parseToIbcWasmMemo(
          `${ORAI_BRIDGE_EVM_TRON_DENOM_PREFIX}0x1234`,
          oraichain2oraib,
          USDT_TRON_CONTRACT
        ),
        universalSwapType: "other-networks-to-oraichain"
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
        universalSwapType: "other-networks-to-oraichain"
      },
      false
    ]
  ])(
    "test-getRoute-given %s coingecko id, chain id %s, send-to %s, chain id %s with receiver %s should have swapRoute %s",
    (fromCoingeckoId, fromChainId, toCoingeckoId, toChainId, receiver, swapRoute, willThrow) => {
      jest
        .spyOn(dexCommonHelper, "isEthAddress")
        .mockImplementation((address) => (address.includes("0x") ? true : false));
      const fromToken = flattenTokens.find(
        (item) => item.coinGeckoId === fromCoingeckoId && item.chainId === fromChainId
      )!;
      const toToken = flattenTokens.find((item) => item.coinGeckoId === toCoingeckoId && item.chainId === toChainId);
      try {
        const receiverAddress = getRoute(fromToken, toToken, receiver);
        expect(receiverAddress).toEqual(swapRoute);
        expect(willThrow).toEqual(false);
      } catch (error) {
        expect(willThrow).toEqual(true);
        expect(error).toEqual(new Error(`chain id ${fromToken.chainId} is currently not supported in universal swap`));
      }
    }
  );

  it.each<
    [
      CoinGeckoId,
      EvmChainId | CosmosChainId,
      CoinGeckoId,
      EvmChainId | CosmosChainId,
      string,
      string,
      SwapRoute,
      boolean
    ]
  >([
    [
      "cosmos",
      "cosmoshub-4",
      "cosmos",
      "Oraichain",
      "orai1ek2243955krr3enky8jq8y8vhh3p63y5wjzs4j",
      "0x1234",
      {
        swapRoute: parseToIbcHookMemo(
          "orai1ek2243955krr3enky8jq8y8vhh3p63y5wjzs4j",
          "0x1234",
          "",
          parseTokenInfoRawDenom(getTokenOnSpecificChainId("cosmos", "Oraichain") as TokenItemType)
        ),
        universalSwapType: "cosmos-to-others"
      },
      false
    ],
    [
      "cosmos",
      "cosmoshub-4",
      "oraichain-token",
      "Oraichain",
      "orai1ek2243955krr3enky8jq8y8vhh3p63y5wjzs4j",
      "0x1234",
      {
        swapRoute: parseToIbcHookMemo(
          "orai1ek2243955krr3enky8jq8y8vhh3p63y5wjzs4j",
          "0x1234",
          "",
          parseTokenInfoRawDenom(getTokenOnSpecificChainId("oraichain-token", "Oraichain") as TokenItemType)
        ),
        universalSwapType: "cosmos-to-others"
      },
      true
    ],
    [
      "osmosis",
      "osmosis-1",
      "cosmos",
      "cosmoshub-4",
      "orai1ek2243955krr3enky8jq8y8vhh3p63y5wjzs4j",
      "0x1234",
      {
        swapRoute: parseToIbcHookMemo(
          "orai1ek2243955krr3enky8jq8y8vhh3p63y5wjzs4j",
          "0x1234",
          ibcInfos["Oraichain"]["cosmoshub-4"]?.channel as string,
          parseTokenInfoRawDenom(getTokenOnSpecificChainId("cosmos", "cosmoshub-4") as TokenItemType)
        ),
        universalSwapType: "cosmos-to-others"
      },
      true
    ]
  ])(
    "test-ibc-hooks-getRoute-given %s coingecko id, chain id %s, send-to %s, chain id %s with receiver %s should have swapRoute %s",
    (
      fromCoingeckoId,
      fromChainId,
      toCoingeckoId,
      toChainId,
      receiverOnOrai,
      destinationReceiver,
      swapRoute,
      willThrow
    ) => {
      jest
        .spyOn(dexCommonHelper, "isEthAddress")
        .mockImplementation((address) => (address.includes("0x") ? true : false));
      const fromToken = flattenTokens.find(
        (item) => item.coinGeckoId === fromCoingeckoId && item.chainId === fromChainId
      )!;
      const toToken = flattenTokens.find((item) => item.coinGeckoId === toCoingeckoId && item.chainId === toChainId);
      try {
        const receiverAddress = getRoute(fromToken, toToken, destinationReceiver, receiverOnOrai);
        expect(receiverAddress).toEqual(swapRoute);
        expect(willThrow).toEqual(false);
      } catch (error) {
        expect(willThrow).toEqual(true);
        expect(error).toEqual(new Error(`chain id ${fromToken.chainId} is currently not supported in universal swap`));
      }
    }
  );

  it("test-addOraiBridgeRoute-empty-swapRoute", () => {
    const result = addOraiBridgeRoute("receiver", "any" as any, "any" as any);
    expect(result.swapRoute).toEqual(`${oraib2oraichain}/receiver`);
  });
  it("test-addOraiBridgeRoute-non-empty-swapRoute", () => {
    const result = addOraiBridgeRoute(
      "receiver",
      flattenTokens.find((item) => item.coinGeckoId === "airight" && item.chainId === "0x38")!,
      flattenTokens.find((item) => item.coinGeckoId === "oraichain-token" && item.chainId === "Oraichain")!,
      "foobar"
    );
    // expect(result.swapRoute).toEqual(`${oraib2oraichain}/receiver:foobar:orai`);
    const memo = parseToIbcWasmMemo("foobar", "", "orai");
    expect(result.swapRoute).toEqual(`${oraib2oraichain}/receiver:${memo}`);
  });

  it.each<[string, any]>([
    [
      "channel-1/orai1234:0x1234",
      {
        oraiBridgeChannel: "channel-1",
        oraiReceiver: "orai1234",
        finalDestinationChannel: "",
        finalReceiver: "0x1234",
        tokenIdentifier: ""
      }
    ],
    [
      "orai1234:0x1234",
      {
        oraiBridgeChannel: "",
        oraiReceiver: "orai1234",
        finalDestinationChannel: "",
        finalReceiver: "0x1234",
        tokenIdentifier: ""
      }
    ],
    [
      "orai1234",
      {
        oraiBridgeChannel: "",
        oraiReceiver: "orai1234",
        finalDestinationChannel: "",
        finalReceiver: "",
        tokenIdentifier: ""
      }
    ],
    [
      "orai1234:0x1234:atom",
      {
        oraiBridgeChannel: "",
        oraiReceiver: "orai1234",
        finalDestinationChannel: "",
        finalReceiver: "0x1234",
        tokenIdentifier: "atom"
      }
    ],
    [
      "orai1234:channel-29/0x1234:atom",
      {
        oraiBridgeChannel: "",
        oraiReceiver: "orai1234",
        finalDestinationChannel: "channel-29",
        finalReceiver: "0x1234",
        tokenIdentifier: "atom"
      }
    ],
    [
      "channel-1/orai1234:channel-29/0x1234:atom",
      {
        oraiBridgeChannel: "channel-1",
        oraiReceiver: "orai1234",
        finalDestinationChannel: "channel-29",
        finalReceiver: "0x1234",
        tokenIdentifier: "atom"
      }
    ]
  ])("test-unmarshalOraiBridgeRoute-%s", (destination, routeData) => {
    expect(universalHelper.unmarshalOraiBridgeRoute(destination)).toEqual(routeData);
  });
});
