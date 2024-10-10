import { expect, afterAll, beforeAll, describe, it, vi } from "vitest";
import { BridgeMsgInfo } from "../../src/msg";
import { calculateTimeoutTimestamp, generateError, IBC_TRANSFER_TIMEOUT } from "@oraichain/oraidex-common";
import { Action } from "@oraichain/osor-api-contracts-sdk/src/EntryPoint.types";
import { OsmosisMsg } from "../../build/msg";

describe("test build osmosis msg", () => {
  const validPath = {
    chainId: "osmosis-1",
    tokenIn: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4",
    tokenInAmount: "999000",
    tokenOut: "uatom",
    tokenOutAmount: "217432",
    tokenOutChainId: "cosmoshub-4",
    actions: [
      {
        type: "Swap",
        protocol: "Osmosis",
        tokenIn: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4",
        tokenInAmount: "999000",
        tokenOut: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
        tokenOutAmount: "217432",
        swapInfo: [
          {
            poolId: "1282",
            tokenOut: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2"
          }
        ]
      },
      {
        type: "Bridge",
        protocol: "Bridge",
        tokenIn: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
        tokenInAmount: "217432",
        tokenOut: "uatom",
        tokenOutAmount: "217432",
        tokenOutChainId: "cosmoshub-4",
        bridgeInfo: {
          port: "transfer",
          channel: "channel-0"
        }
      }
    ]
  };
  let receiver = "cosmos1hvr9d72r5um9lvt0rpkd4r75vrsqtw6y0ppr3e";
  const currentAddress = "osmo1hvr9d72r5um9lvt0rpkd4r75vrsqtw6y86jn8t";

  it.each<[BridgeMsgInfo, Action, string]>([
    [
      undefined,
      {
        transfer: {
          to_address: receiver
        }
      },
      ""
    ],
    [
      {
        amount: "217432",
        sourceChannel: "channel-301",
        sourcePort: "transfer",
        memo: "{}",
        receiver: receiver,
        timeout: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT),
        fromToken: "osmo",
        toToken: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
        fromChain: "osmosis-1",
        toChain: "cosmoshub-4"
      },
      {
        ibc_transfer: {
          ibc_info: {
            source_channel: "channel-301",
            receiver: receiver,
            memo: "{}",
            recover_address: currentAddress
          }
        }
      },
      ""
    ],
    [
      {
        amount: "217432",
        sourceChannel: "channel-301",
        sourcePort: "wasm.orai123",
        memo: "{}",
        receiver: receiver,
        timeout: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT),
        fromToken: "osmos",
        toToken: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
        fromChain: "osmosis-1",
        toChain: "cosmoshub-4"
      },
      {
        ibc_transfer: {
          ibc_info: {
            source_channel: "channel-301",
            receiver: receiver,
            memo: "{}",
            recover_address: currentAddress
          }
        }
      },
      ""
    ]
  ])("osmosis test get post action", (bridgeInfo, expectedAction, expectedError) => {
    let osmosis = new OsmosisMsg(validPath, "1", receiver, currentAddress);
    try {
      let postAction = osmosis.getPostAction(bridgeInfo);
      expect(postAction).toEqual(expectedAction);
    } catch (err) {
      expect(err).toEqual(generateError(`Missing postAction for universalSwap on ${validPath.chainId}`));
    }
  });

  it("Valid path with swap + bridge", () => {
    const nextMemo = "{}";
    let osmosis = new OsmosisMsg(validPath, "1", receiver, currentAddress, nextMemo);

    let [swapOps, bridgeInfo] = osmosis.getSwapAndBridgeInfo();
    expect(bridgeInfo).toEqual({
      amount: "217432",
      sourceChannel: "channel-0",
      sourcePort: "transfer",
      memo: nextMemo,
      receiver: receiver,
      timeout: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT),
      fromToken: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
      toToken: "uatom",
      fromChain: "osmosis-1",
      toChain: "cosmoshub-4"
    });
    expect(swapOps).toEqual([
      {
        denom_in: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4",
        denom_out: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
        pool: "1282"
      }
    ]);

    let memoAsMiddleware = osmosis.genMemoAsMiddleware();
    expect(memoAsMiddleware).toEqual({
      receiver: osmosis.ENTRY_POINT_CONTRACT,
      memo: JSON.stringify({
        wasm: {
          contract: osmosis.ENTRY_POINT_CONTRACT,
          msg: {
            swap_and_action: {
              user_swap: {
                swap_exact_asset_in: {
                  swap_venue_name: osmosis.SWAP_VENUE_NAME,
                  operations: [
                    {
                      denom_in: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4",
                      denom_out: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
                      pool: "1282"
                    }
                  ]
                }
              },
              min_asset: {
                native: { amount: "1", denom: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2" }
              },
              timeout_timestamp: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT),
              post_swap_action: {
                ibc_transfer: {
                  ibc_info: {
                    source_channel: "channel-0",
                    receiver: receiver,
                    memo: "{}",
                    recover_address: currentAddress
                  }
                }
              },
              affiliates: []
            }
          }
        }
      })
    });

    let executeMsg = osmosis.genExecuteMsg();
    expect(executeMsg.typeUrl).toEqual("/cosmwasm.wasm.v1.MsgExecuteContract");
  });

  it("Valid path with bridge only", () => {
    const nextMemo = "{}";
    let validPathBridgeOnly = {
      chainId: "osmosis-1",
      tokenIn: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
      tokenInAmount: "999000",
      tokenOut: "uatom",
      tokenOutAmount: "999000",
      tokenOutChainId: "cosmoshub-4",
      actions: [
        {
          type: "Bridge",
          protocol: "Bridge",
          tokenIn: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
          tokenInAmount: "999000",
          tokenOut: "uatom",
          tokenOutAmount: "999000",
          tokenOutChainId: "cosmoshub-4",
          bridgeInfo: {
            port: "transfer",
            channel: "channel-0"
          }
        }
      ]
    };
    let osmosis = new OsmosisMsg(validPathBridgeOnly, "1", receiver, currentAddress, nextMemo);

    let [swapOps, bridgeInfo] = osmosis.getSwapAndBridgeInfo();
    expect(bridgeInfo).toEqual({
      amount: "999000",
      sourceChannel: "channel-0",
      sourcePort: "transfer",
      memo: nextMemo,
      receiver: receiver,
      timeout: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT),
      fromToken: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
      toToken: "uatom",
      fromChain: "osmosis-1",
      toChain: "cosmoshub-4"
    });
    expect(swapOps).toEqual([]);

    let memoAsMiddleware = osmosis.genMemoAsMiddleware();
    expect(memoAsMiddleware).toEqual({
      receiver: currentAddress,
      memo: JSON.stringify({
        forward: {
          receiver: "cosmos1hvr9d72r5um9lvt0rpkd4r75vrsqtw6y0ppr3e",
          port: "transfer",
          channel: "channel-0",
          timeout: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT),
          retries: 2,
          next: "{}"
        }
      })
    });

    let executeMsg = osmosis.genExecuteMsg();
    expect(executeMsg).toEqual({
      typeUrl: "/ibc.applications.transfer.v1.MsgTransfer",
      value: {
        sourcePort: bridgeInfo.sourcePort,
        sourceChannel: bridgeInfo.sourceChannel,
        receiver: receiver,
        token: {
          amount: validPathBridgeOnly.tokenInAmount,
          denom: validPathBridgeOnly.tokenIn
        },
        sender: currentAddress,
        memo: nextMemo,
        timeoutTimestamp: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT)
      }
    });
  });

  it("Valid path with swap only", () => {
    const nextMemo = "{}";
    receiver = currentAddress;
    const validPathSwapOnly = {
      chainId: "osmosis-1",
      tokenIn: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4",
      tokenInAmount: "999000",
      tokenOut: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
      tokenOutAmount: "217432",
      tokenOutChainId: "osmosis-1",
      actions: [
        {
          type: "Swap",
          protocol: "Osmosis",
          tokenIn: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4",
          tokenInAmount: "999000",
          tokenOut: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
          tokenOutAmount: "217432",
          swapInfo: [
            {
              poolId: "1282",
              tokenOut: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2"
            }
          ]
        }
      ]
    };
    let osmosis = new OsmosisMsg(validPathSwapOnly, "1", receiver, currentAddress, nextMemo);

    let [swapOps, bridgeInfo] = osmosis.getSwapAndBridgeInfo();
    expect(bridgeInfo).toEqual(undefined);
    expect(swapOps).toEqual([
      {
        denom_in: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4",
        denom_out: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
        pool: "1282"
      }
    ]);

    let memoAsMiddleware = osmosis.genMemoAsMiddleware();
    expect(memoAsMiddleware).toEqual({
      receiver: osmosis.ENTRY_POINT_CONTRACT,
      memo: JSON.stringify({
        wasm: {
          contract: osmosis.ENTRY_POINT_CONTRACT,
          msg: {
            swap_and_action: {
              user_swap: {
                swap_exact_asset_in: {
                  swap_venue_name: osmosis.SWAP_VENUE_NAME,
                  operations: [
                    {
                      denom_in: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4",
                      denom_out: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
                      pool: "1282"
                    }
                  ]
                }
              },
              min_asset: {
                native: { amount: "1", denom: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2" }
              },
              timeout_timestamp: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT),
              post_swap_action: {
                transfer: {
                  to_address: receiver
                }
              },
              affiliates: []
            }
          }
        }
      })
    });

    let executeMsg = osmosis.genExecuteMsg();
    expect(executeMsg.typeUrl).toEqual("/cosmwasm.wasm.v1.MsgExecuteContract");
  });

  it("Invalid path not ibc transfer", () => {
    const nextMemo = "{}";

    const invalidPathNotIbcTransfer = {
      chainId: "osmosis-1",
      tokenIn: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
      tokenInAmount: "999000",
      tokenOut: "uatom",
      tokenOutAmount: "999000",
      tokenOutChainId: "cosmoshub-4",
      actions: [
        {
          type: "Bridge",
          protocol: "Bridge",
          tokenIn: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
          tokenInAmount: "999000",
          tokenOut: "uatom",
          tokenOutAmount: "999000",
          tokenOutChainId: "cosmoshub-4",
          bridgeInfo: {
            port: "wasm.osmo123",
            channel: "channel-0"
          }
        }
      ]
    };
    let osmosis = new OsmosisMsg(invalidPathNotIbcTransfer, "1", receiver, currentAddress, nextMemo);
    try {
      osmosis.genMemoAsMiddleware();
    } catch (err) {
      expect(err).toEqual(generateError(`Only support IBC bridge on ${invalidPathNotIbcTransfer.chainId}`));
    }
  });
});
