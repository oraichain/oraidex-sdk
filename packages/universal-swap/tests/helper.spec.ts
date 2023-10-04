import {
  CoinGeckoId,
  USDT_BSC_CONTRACT,
  USDT_TRON_CONTRACT,
  WRAP_BNB_CONTRACT,
  WRAP_TRON_TRX_CONTRACT,
  ibcInfos
} from "@oraichain/oraidex-common";
import {
  buildIbcWasmPairKey,
  buildSwapRouterKey,
  getEvmSwapRoute,
  getIbcInfo,
  isEvmSwappable,
  isSupportedNoPoolSwapEvm
} from "../src/helper";

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
    expect(getIbcInfo("osmosis-1", "oraibridge-subnet-2")).toEqual(undefined);
  });

  it("test-buildIbcWasmPairKey", () => {
    expect(buildIbcWasmPairKey("foo", "bar", "john-doe")).toEqual("foo/bar/john-doe");
  });
});
