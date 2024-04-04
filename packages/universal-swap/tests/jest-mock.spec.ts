import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { toBase64, toUtf8, fromHex, fromUtf8 } from "@cosmjs/encoding";
import { TokenItemType, flattenTokens, toAmount, IBC_WASM_CONTRACT, ORAI } from "@oraichain/oraidex-common";
import { QuerySmartContractStateResponse, QuerySmartContractStateRequest } from "cosmjs-types/cosmwasm/wasm/v1/query";
import { UniversalSwapHelper } from "../src/helper";
import { mockStatus } from "./test-common";
// import {Ics20} from '@oraichain/common-contracts-sdk/build'

jest.mock("@oraichain/common-contracts-sdk/build", () => {
  const originalModule = jest.requireActual("@oraichain/common-contracts-sdk/build");
  class CwIcs20LatestQueryClient {
    constructor() {}
    channelWithKey = jest
      .fn()
      .mockResolvedValue({ balance: { native: { denom: ORAI, amount: toAmount(1).toString() } } });
    pairMapping = jest.fn();
  }
  return {
    ...originalModule,
    __esModule: true,
    default: CwIcs20LatestQueryClient
  };
});

describe("test-jest-mock", () => {
  const channel = "channel-29";
  const simulateAmount = "100";
  // afterEach(() => {
  //   jest.resetAllMocks();
  // });
  it.each<[TokenItemType, TokenItemType, string, string, boolean]>([
    [
      flattenTokens.find((t) => t.chainId === "Oraichain" && t.coinGeckoId === "oraichain-token")!,
      flattenTokens.find((t) => t.chainId === "0x01" && t.coinGeckoId === "oraichain-token")!,
      simulateAmount,
      channel,
      false
    ]
    // [
    //   flattenTokens.find((t) => t.chainId === "Oraichain" && t.coinGeckoId === "oraichain-token")!,
    //   flattenTokens.find((t) => t.chainId === "Oraichain" && t.coinGeckoId === "oraichain-token")!,
    //   toAmount(10).toString(),
    //   channel,
    //   true
    // ]
  ])(
    "test-universal-swap-checkBalanceChannelIbc-with-jest-mock-%",
    async (fromToken, toToken, amount, channel, willThrow) => {
      const client = await CosmWasmClient.connect("https://rpc.orai.io");
      try {
        await UniversalSwapHelper.checkBalanceChannelIbc(
          {
            source: "wasm." + IBC_WASM_CONTRACT,
            channel: channel,
            timeout: 3600
          },
          fromToken,
          toToken,
          amount,
          client,
          IBC_WASM_CONTRACT
        );
        expect(willThrow).toEqual(false);
      } catch (error) {
        expect(willThrow).toEqual(true);
      }
    }
  );
});
