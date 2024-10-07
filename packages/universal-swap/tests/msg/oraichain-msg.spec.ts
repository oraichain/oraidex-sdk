import { expect, afterAll, beforeAll, describe, it, vi } from "vitest";
import { BridgeMsgInfo, OraichainMsg } from "../../src/msg";
import { calculateTimeoutTimestamp, generateError, IBC_TRANSFER_TIMEOUT } from "@oraichain/oraidex-common";
import { Action } from "@oraichain/osor-api-contracts-sdk/src/EntryPoint.types";
import { OsmosisMsg } from "../../build/msg";
import { Memo } from "../../src/proto/universal_swap_memo";

describe("test build oraichain msg", () => {
  const validPath = {
    chainId: "Oraichain",
    tokenIn: "orai",
    tokenInAmount: "1000000",
    tokenOut: "uatom",
    tokenOutAmount: "1359212",
    tokenOutChainId: "cosmoshub-4",
    actions: [
      {
        type: "Swap",
        protocol: "Oraidex",
        tokenIn: "orai",
        tokenInAmount: "1000000",
        tokenOut: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
        tokenOutAmount: "1359212",
        swapInfo: [
          {
            poolId: "orai1jf74ry4m0jcy9emsaudkhe7vte9l8qy8enakvs",
            tokenOut: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78"
          }
        ]
      },
      {
        type: "Bridge",
        protocol: "Bridge",
        tokenIn: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
        tokenInAmount: "1359212",
        tokenOut: "uatom",
        tokenOutAmount: "1359212",
        tokenOutChainId: "cosmoshub-4",
        bridgeInfo: {
          port: "transfer",
          channel: "channel-15"
        }
      }
    ]
  };
  let receiver = "cosmos1hvr9d72r5um9lvt0rpkd4r75vrsqtw6y0ppr3e";
  const currentAddress = "orai1hvr9d72r5um9lvt0rpkd4r75vrsqtw6yujhqs2";

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
        fromToken: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
        toToken: "uatom",
        fromChain: "Oraichain",
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
        fromToken: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
        toToken: "uusdc",
        fromChain: "Oraichain",
        toChain: "noble-1"
      },
      {
        ibc_wasm_transfer: {
          ibc_wasm_info: {
            local_channel_id: "channel-301",
            remote_address: "cosmos1hvr9d72r5um9lvt0rpkd4r75vrsqtw6y0ppr3e",
            remote_denom: "uusdc",
            memo: ""
          }
        }
      },
      ""
    ]
  ])("oraichain test get post action", (bridgeInfo, expectedAction, expectedError) => {
    let oraichain = new OraichainMsg(validPath, "1", receiver, currentAddress);
    try {
      let postAction = oraichain.getPostAction(bridgeInfo);
      expect(postAction).toEqual(expectedAction);
    } catch (err) {
      expect(err).toEqual(generateError(`Missing postAction for universalSwap on ${validPath.chainId}`));
    }
  });

  it("Valid path with swap + ibc bridge", () => {
    const nextMemo = "{}";
    let oraichainMsg = new OraichainMsg(validPath, "1", receiver, currentAddress, nextMemo);

    let [swapOps, bridgeInfo] = oraichainMsg.getSwapAndBridgeInfo();
    expect(bridgeInfo).toEqual({
      amount: "1359212",
      sourceChannel: "channel-15",
      sourcePort: "transfer",
      memo: "{}",
      receiver: receiver,
      timeout: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT),
      fromToken: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
      toToken: "uatom",
      fromChain: "Oraichain",
      toChain: "cosmoshub-4"
    });
    expect(swapOps).toEqual([
      {
        denom_in: "orai",
        denom_out: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
        pool: "orai1jf74ry4m0jcy9emsaudkhe7vte9l8qy8enakvs"
      }
    ]);

    let memoAsMiddleware = oraichainMsg.genMemoAsMiddleware();
    expect(memoAsMiddleware).toEqual({
      receiver: oraichainMsg.ENTRY_POINT_CONTRACT,
      memo: JSON.stringify({
        wasm: {
          contract: oraichainMsg.ENTRY_POINT_CONTRACT,
          msg: {
            swap_and_action: {
              user_swap: {
                swap_exact_asset_in: {
                  swap_venue_name: oraichainMsg.SWAP_VENUE_NAME,
                  operations: [
                    {
                      denom_in: "orai",
                      denom_out: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
                      pool: "orai1jf74ry4m0jcy9emsaudkhe7vte9l8qy8enakvs"
                    }
                  ]
                }
              },
              min_asset: {
                native: { amount: "1", denom: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78" }
              },
              timeout_timestamp: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT),
              post_swap_action: {
                ibc_transfer: {
                  ibc_info: {
                    source_channel: "channel-15",
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

    let executeMsg = oraichainMsg.genExecuteMsg();
    expect(executeMsg.typeUrl).toEqual("/cosmwasm.wasm.v1.MsgExecuteContract");

    let memoForIbcWasm = oraichainMsg.genMemoForIbcWasm();
    expect(memoForIbcWasm).toEqual({
      receiver: currentAddress,
      memo: Buffer.from(
        Memo.encode({
          userSwap: {
            swapVenueName: oraichainMsg.SWAP_VENUE_NAME,
            swapExactAssetIn: {
              operations: swapOps.map((operation) => ({
                poolId: operation.pool,
                denomIn: operation.denom_in,
                denomOut: operation.denom_out
              }))
            }
          },
          minimumReceive: "1",
          timeoutTimestamp: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT),
          postSwapAction: {
            ibcTransferMsg: {
              sourceChannel: bridgeInfo.sourceChannel,
              sourcePort: bridgeInfo.sourcePort,
              receiver: bridgeInfo.receiver,
              memo: bridgeInfo.memo,
              recoverAddress: currentAddress
            }
          },
          recoveryAddr: currentAddress
        }).finish()
      ).toString("base64")
    });
  });

  it("Valid path with ibc bridge only", () => {
    const nextMemo = "{}";
    let validPathBridgeOnly = {
      chainId: "Oraichain",
      tokenIn: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
      tokenInAmount: "999000",
      tokenOut: "uatom",
      tokenOutAmount: "999000",
      tokenOutChainId: "cosmoshub-4",
      actions: [
        {
          type: "Bridge",
          protocol: "Bridge",
          tokenIn: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
          tokenInAmount: "999000",
          tokenOut: "uatom",
          tokenOutAmount: "999000",
          tokenOutChainId: "cosmoshub-4",
          bridgeInfo: {
            port: "transfer",
            channel: "channel-15"
          }
        }
      ]
    };
    let oraichainMsg = new OraichainMsg(validPathBridgeOnly, "1", receiver, currentAddress, nextMemo);

    let [swapOps, bridgeInfo] = oraichainMsg.getSwapAndBridgeInfo();
    expect(bridgeInfo).toEqual({
      amount: "999000",
      sourceChannel: "channel-15",
      sourcePort: "transfer",
      memo: nextMemo,
      receiver: receiver,
      timeout: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT),
      fromToken: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
      toToken: "uatom",
      fromChain: "Oraichain",
      toChain: "cosmoshub-4"
    });
    expect(swapOps).toEqual([]);

    let memoAsMiddleware = oraichainMsg.genMemoAsMiddleware();
    expect(memoAsMiddleware).toEqual({
      receiver: currentAddress,
      memo: JSON.stringify({
        forward: {
          receiver: "cosmos1hvr9d72r5um9lvt0rpkd4r75vrsqtw6y0ppr3e",
          port: "transfer",
          channel: "channel-15",
          timeout: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT),
          retries: 2,
          next: "{}"
        }
      })
    });

    let executeMsg = oraichainMsg.genExecuteMsg();
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

    let memoForIbcWasm = oraichainMsg.genMemoForIbcWasm();
    expect(memoForIbcWasm).toEqual({
      receiver: currentAddress,
      memo: Buffer.from(
        Memo.encode({
          userSwap: undefined,
          minimumReceive: "1",
          timeoutTimestamp: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT),
          postSwapAction: {
            ibcTransferMsg: {
              sourceChannel: bridgeInfo.sourceChannel,
              sourcePort: bridgeInfo.sourcePort,
              receiver: bridgeInfo.receiver,
              memo: bridgeInfo.memo,
              recoverAddress: currentAddress
            }
          },
          recoveryAddr: currentAddress
        }).finish()
      ).toString("base64")
    });
  });

  it("Valid path with swap only", () => {
    const nextMemo = "{}";
    receiver = currentAddress;
    const validPathSwapOnly = {
      chainId: "Oraichain",
      tokenIn: "orai",
      tokenInAmount: "999000",
      tokenOut: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
      tokenOutAmount: "217432",
      tokenOutChainId: "Oraichain",
      actions: [
        {
          type: "Swap",
          protocol: "Oraidex",
          tokenIn: "orai",
          tokenInAmount: "1000000",
          tokenOut: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
          tokenOutAmount: "1359212",
          swapInfo: [
            {
              poolId: "orai1jf74ry4m0jcy9emsaudkhe7vte9l8qy8enakvs",
              tokenOut: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78"
            }
          ]
        }
      ]
    };
    let oraichainMsg = new OraichainMsg(validPathSwapOnly, "1", receiver, currentAddress, nextMemo);

    let [swapOps, bridgeInfo] = oraichainMsg.getSwapAndBridgeInfo();
    expect(bridgeInfo).toEqual(undefined);
    expect(swapOps).toEqual([
      {
        denom_in: "orai",
        denom_out: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
        pool: "orai1jf74ry4m0jcy9emsaudkhe7vte9l8qy8enakvs"
      }
    ]);

    let memoAsMiddleware = oraichainMsg.genMemoAsMiddleware();
    expect(memoAsMiddleware).toEqual({
      receiver: oraichainMsg.ENTRY_POINT_CONTRACT,
      memo: JSON.stringify({
        wasm: {
          contract: oraichainMsg.ENTRY_POINT_CONTRACT,
          msg: {
            swap_and_action: {
              user_swap: {
                swap_exact_asset_in: {
                  swap_venue_name: oraichainMsg.SWAP_VENUE_NAME,
                  operations: [
                    {
                      denom_in: "orai",
                      denom_out: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
                      pool: "orai1jf74ry4m0jcy9emsaudkhe7vte9l8qy8enakvs"
                    }
                  ]
                }
              },
              min_asset: {
                native: { amount: "1", denom: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78" }
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

    let executeMsg = oraichainMsg.genExecuteMsg();
    expect(executeMsg.typeUrl).toEqual("/cosmwasm.wasm.v1.MsgExecuteContract");

    let memoForIbcWasm = oraichainMsg.genMemoForIbcWasm();
    expect(memoForIbcWasm).toEqual({
      receiver: currentAddress,
      memo: Buffer.from(
        Memo.encode({
          userSwap: {
            swapVenueName: oraichainMsg.SWAP_VENUE_NAME,
            swapExactAssetIn: {
              operations: swapOps.map((operation) => ({
                poolId: operation.pool,
                denomIn: operation.denom_in,
                denomOut: operation.denom_out
              }))
            }
          },
          minimumReceive: "1",
          timeoutTimestamp: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT),
          postSwapAction: {
            transferMsg: {
              toAddress: receiver
            }
          },
          recoveryAddr: currentAddress
        }).finish()
      ).toString("base64")
    });
  });

  it("Valid path with swap + ibc wasm bridge", () => {
    const nextMemo = "{}";
    const validPath = {
      chainId: "Oraichain",
      tokenIn: "orai",
      tokenInAmount: "150000",
      tokenOut: "0x55d398326f99059fF775485246999027B3197955",
      tokenOutAmount: "306106",
      tokenOutChainId: "0x38",
      actions: [
        {
          type: "Swap",
          protocol: "Oraidex",
          tokenIn: "orai",
          tokenInAmount: "150000",
          tokenOut: "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh",
          tokenOutAmount: "936043",
          swapInfo: [
            {
              poolId: "orai1c5s03c3l336dgesne7dylnmhszw8554tsyy9yt",
              tokenOut: "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh"
            }
          ]
        },
        {
          type: "Bridge",
          protocol: "Bridge",
          tokenIn: "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh",
          tokenInAmount: "936043",
          tokenOut: "0x55d398326f99059fF775485246999027B3197955",
          tokenOutAmount: "306106",
          tokenOutChainId: "0x38",
          bridgeInfo: {
            port: "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm",
            channel: "channel-29"
          }
        }
      ]
    };

    let receiver = "0x0000000000000000000000000000000000000000";
    const currentAddress = "orai1hvr9d72r5um9lvt0rpkd4r75vrsqtw6yujhqs2";
    const oraiBridgeAddr = "oraib1hvr9d72r5um9lvt0rpkd4r75vrsqtw6ytnnvpf";
    let oraichainMsg = new OraichainMsg(validPath, "1", receiver, currentAddress, nextMemo, "oraib", oraiBridgeAddr);

    let [swapOps, bridgeInfo] = oraichainMsg.getSwapAndBridgeInfo();
    expect(bridgeInfo).toEqual({
      amount: "936043",
      sourceChannel: "channel-29",
      sourcePort: "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm",
      memo: "{}",
      receiver: receiver,
      timeout: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT),
      fromToken: "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh",
      toToken: "0x55d398326f99059fF775485246999027B3197955",
      fromChain: "Oraichain",
      toChain: "0x38"
    });
    expect(swapOps).toEqual([
      {
        denom_in: "orai",
        denom_out: "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh",
        pool: "orai1c5s03c3l336dgesne7dylnmhszw8554tsyy9yt"
      }
    ]);

    let memoAsMiddleware = oraichainMsg.genMemoAsMiddleware();
    expect(memoAsMiddleware).toEqual({
      receiver: oraichainMsg.ENTRY_POINT_CONTRACT,
      memo: JSON.stringify({
        wasm: {
          contract: oraichainMsg.ENTRY_POINT_CONTRACT,
          msg: {
            swap_and_action: {
              user_swap: {
                swap_exact_asset_in: {
                  swap_venue_name: oraichainMsg.SWAP_VENUE_NAME,
                  operations: [
                    {
                      denom_in: "orai",
                      denom_out: "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh",
                      pool: "orai1c5s03c3l336dgesne7dylnmhszw8554tsyy9yt"
                    }
                  ]
                }
              },
              min_asset: {
                cw20: { amount: "1", address: "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh" }
              },
              timeout_timestamp: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT),
              post_swap_action: {
                ibc_wasm_transfer: {
                  ibc_wasm_info: {
                    local_channel_id: "channel-29",
                    remote_address: oraiBridgeAddr,
                    remote_denom: "oraib0x55d398326f99059fF775485246999027B3197955",
                    memo: "oraib0x0000000000000000000000000000000000000000"
                  }
                }
              },
              affiliates: []
            }
          }
        }
      })
    });

    let executeMsg = oraichainMsg.genExecuteMsg();
    expect(executeMsg.typeUrl).toEqual("/cosmwasm.wasm.v1.MsgExecuteContract");

    let memoForIbcWasm = oraichainMsg.genMemoForIbcWasm();
    expect(memoForIbcWasm).toEqual({
      receiver: currentAddress,
      memo: Buffer.from(
        Memo.encode({
          userSwap: {
            swapVenueName: oraichainMsg.SWAP_VENUE_NAME,
            swapExactAssetIn: {
              operations: swapOps.map((operation) => ({
                poolId: operation.pool,
                denomIn: operation.denom_in,
                denomOut: operation.denom_out
              }))
            }
          },
          minimumReceive: "1",
          timeoutTimestamp: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT),
          postSwapAction: {
            ibcWasmTransferMsg: {
              localChannelId: bridgeInfo.sourceChannel,
              remoteAddress: oraiBridgeAddr,
              remoteDenom: "oraib0x55d398326f99059fF775485246999027B3197955",
              memo: "oraib0x0000000000000000000000000000000000000000"
            }
          },
          recoveryAddr: currentAddress
        }).finish()
      ).toString("base64")
    });
  });

  it("Invalid path in gen memo as middleware with ibc wasm bridge", () => {
    const nextMemo = "{}";
    const invalidPath = {
      chainId: "Oraichain",
      tokenIn: "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh",
      tokenInAmount: "936043",
      tokenOut: "0x55d398326f99059fF775485246999027B3197955",
      tokenOutAmount: "936043",
      tokenOutChainId: "0x38",
      actions: [
        {
          type: "Bridge",
          protocol: "Bridge",
          tokenIn: "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh",
          tokenInAmount: "936043",
          tokenOut: "0x55d398326f99059fF775485246999027B3197955",
          tokenOutAmount: "306106",
          tokenOutChainId: "0x38",
          bridgeInfo: {
            port: "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm",
            channel: "channel-29"
          }
        }
      ]
    };

    let receiver = "0x0000000000000000000000000000000000000000";
    const currentAddress = "orai1hvr9d72r5um9lvt0rpkd4r75vrsqtw6yujhqs2";
    const oraiBridgeAddr = "oraib1hvr9d72r5um9lvt0rpkd4r75vrsqtw6ytnnvpf";
    let oraichainMsg = new OraichainMsg(invalidPath, "1", receiver, currentAddress, nextMemo, "oraib", oraiBridgeAddr);

    try {
      oraichainMsg.genMemoAsMiddleware();
    } catch (err) {
      expect(err).toEqual(generateError(`Error on generate memo as middleware: Only support ibc bridge`));
    }
  });

  it("Valid path in genMemoForIbcWasm with ibc wasm bridge only", () => {
    const nextMemo = "{}";
    const validPath = {
      chainId: "Oraichain",
      tokenIn: "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh",
      tokenInAmount: "936043",
      tokenOut: "0x55d398326f99059fF775485246999027B3197955",
      tokenOutAmount: "306106",
      tokenOutChainId: "0x38",
      actions: [
        {
          type: "Bridge",
          protocol: "Bridge",
          tokenIn: "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh",
          tokenInAmount: "936043",
          tokenOut: "0x55d398326f99059fF775485246999027B3197955",
          tokenOutAmount: "306106",
          tokenOutChainId: "0x38",
          bridgeInfo: {
            port: "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm",
            channel: "channel-29"
          }
        }
      ]
    };

    let receiver = "0x0000000000000000000000000000000000000000";
    const currentAddress = "orai1hvr9d72r5um9lvt0rpkd4r75vrsqtw6yujhqs2";
    const oraiBridgeAddr = "oraib1hvr9d72r5um9lvt0rpkd4r75vrsqtw6ytnnvpf";
    let oraichainMsg = new OraichainMsg(validPath, "1", receiver, currentAddress, nextMemo, "oraib", oraiBridgeAddr);

    let [swapOps, bridgeInfo] = oraichainMsg.getSwapAndBridgeInfo();
    expect(bridgeInfo).toEqual({
      amount: "936043",
      sourceChannel: "channel-29",
      sourcePort: "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm",
      memo: "{}",
      receiver: receiver,
      timeout: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT),
      fromToken: "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh",
      toToken: "0x55d398326f99059fF775485246999027B3197955",
      fromChain: "Oraichain",
      toChain: "0x38"
    });
    expect(swapOps).toEqual([]);

    let executeMsg = oraichainMsg.genExecuteMsg();
    expect(executeMsg.typeUrl).toEqual("/cosmwasm.wasm.v1.MsgExecuteContract");

    let memoForIbcWasm = oraichainMsg.genMemoForIbcWasm();
    expect(memoForIbcWasm).toEqual({
      receiver: currentAddress,
      memo: Buffer.from(
        Memo.encode({
          userSwap: undefined,
          minimumReceive: "1",
          timeoutTimestamp: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT),
          postSwapAction: {
            ibcWasmTransferMsg: {
              localChannelId: bridgeInfo.sourceChannel,
              remoteAddress: oraiBridgeAddr,
              remoteDenom: "oraib0x55d398326f99059fF775485246999027B3197955",
              memo: "oraib0x0000000000000000000000000000000000000000"
            }
          },
          recoveryAddr: currentAddress
        }).finish()
      ).toString("base64")
    });
  });

  it("Valid path but missing obridge address or destPrefix on bridge to evm", () => {
    const nextMemo = "{}";
    const validPath = {
      chainId: "Oraichain",
      tokenIn: "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh",
      tokenInAmount: "936043",
      tokenOut: "0x55d398326f99059fF775485246999027B3197955",
      tokenOutAmount: "306106",
      tokenOutChainId: "0x38",
      actions: [
        {
          type: "Bridge",
          protocol: "Bridge",
          tokenIn: "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh",
          tokenInAmount: "936043",
          tokenOut: "0x55d398326f99059fF775485246999027B3197955",
          tokenOutAmount: "306106",
          tokenOutChainId: "0x38",
          bridgeInfo: {
            port: "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm",
            channel: "channel-29"
          }
        }
      ]
    };
    let receiver = "0x0000000000000000000000000000000000000000";
    const currentAddress = "orai1hvr9d72r5um9lvt0rpkd4r75vrsqtw6yujhqs2";
    const oraiBridgeAddr = "oraib1hvr9d72r5um9lvt0rpkd4r75vrsqtw6ytnnvpf";
    const destPrefix = "oraib";
    // missing oraibridge address
    try {
      let oraichainMsg = new OraichainMsg(validPath, "1", receiver, currentAddress, nextMemo, destPrefix);
      oraichainMsg.genExecuteMsg();
    } catch (err) {
      expect(err).toEqual(generateError(`Missing prefix or Obridge address for bridge to EVM`));
    }

    // missing destPrefix
    try {
      let oraichainMsg = new OraichainMsg(
        validPath,
        "1",
        receiver,
        currentAddress,
        nextMemo,
        undefined,
        oraiBridgeAddr
      );
      oraichainMsg.genExecuteMsg();
    } catch (err) {
      expect(err).toEqual(generateError(`Missing prefix or Obridge address for bridge to EVM`));
    }
  });
});
