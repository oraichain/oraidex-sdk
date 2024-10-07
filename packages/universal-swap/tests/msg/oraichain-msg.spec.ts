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

  // it("Valid path with bridge only", () => {
  //   const nextMemo = "{}";
  //   let validPathBridgeOnly = {
  //     chainId: "osmosis-1",
  //     tokenIn: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
  //     tokenInAmount: "999000",
  //     tokenOut: "uatom",
  //     tokenOutAmount: "999000",
  //     tokenOutChainId: "cosmoshub-4",
  //     actions: [
  //       {
  //         type: "Bridge",
  //         protocol: "Bridge",
  //         tokenIn: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
  //         tokenInAmount: "999000",
  //         tokenOut: "uatom",
  //         tokenOutAmount: "999000",
  //         tokenOutChainId: "cosmoshub-4",
  //         bridgeInfo: {
  //           port: "transfer",
  //           channel: "channel-0"
  //         }
  //       }
  //     ]
  //   };
  //   let osmosis = new OsmosisMsg(validPathBridgeOnly, "1", receiver, currentAddress, nextMemo);

  //   let [swapOps, bridgeInfo] = osmosis.getSwapAndBridgeInfo();
  //   expect(bridgeInfo).toEqual({
  //     amount: "999000",
  //     sourceChannel: "channel-0",
  //     sourcePort: "transfer",
  //     memo: nextMemo,
  //     receiver: receiver,
  //     timeout: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT),
  //     fromToken: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
  //     toToken: "uatom",
  //     fromChain: "osmosis-1",
  //     toChain: "cosmoshub-4"
  //   });
  //   expect(swapOps).toEqual([]);

  //   let memoAsMiddleware = osmosis.genMemoAsMiddleware();
  //   expect(memoAsMiddleware).toEqual({
  //     receiver: currentAddress,
  //     memo: JSON.stringify({
  //       forward: {
  //         receiver: "cosmos1hvr9d72r5um9lvt0rpkd4r75vrsqtw6y0ppr3e",
  //         port: "transfer",
  //         channel: "channel-0",
  //         timeout: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT),
  //         retries: 2,
  //         next: "{}"
  //       }
  //     })
  //   });

  //   let executeMsg = osmosis.genExecuteMsg();
  //   expect(executeMsg).toEqual({
  //     typeUrl: "/ibc.applications.transfer.v1.MsgTransfer",
  //     value: {
  //       sourcePort: bridgeInfo.sourcePort,
  //       sourceChannel: bridgeInfo.sourceChannel,
  //       receiver: receiver,
  //       token: {
  //         amount: validPathBridgeOnly.tokenInAmount,
  //         denom: validPathBridgeOnly.tokenIn
  //       },
  //       sender: currentAddress,
  //       memo: nextMemo,
  //       timeoutTimestamp: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT)
  //     }
  //   });
  // });

  // it("Valid path with swap only", () => {
  //   const nextMemo = "{}";
  //   receiver = currentAddress;
  //   const validPathSwapOnly = {
  //     chainId: "osmosis-1",
  //     tokenIn: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4",
  //     tokenInAmount: "999000",
  //     tokenOut: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
  //     tokenOutAmount: "217432",
  //     tokenOutChainId: "osmosis-1",
  //     actions: [
  //       {
  //         type: "Swap",
  //         protocol: "Osmosis",
  //         tokenIn: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4",
  //         tokenInAmount: "999000",
  //         tokenOut: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
  //         tokenOutAmount: "217432",
  //         swapInfo: [
  //           {
  //             poolId: "1282",
  //             tokenOut: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2"
  //           }
  //         ]
  //       }
  //     ]
  //   };
  //   let osmosis = new OsmosisMsg(validPathSwapOnly, "1", receiver, currentAddress, nextMemo);

  //   let [swapOps, bridgeInfo] = osmosis.getSwapAndBridgeInfo();
  //   expect(bridgeInfo).toEqual(undefined);
  //   expect(swapOps).toEqual([
  //     {
  //       denom_in: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4",
  //       denom_out: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
  //       pool: "1282"
  //     }
  //   ]);

  //   let memoAsMiddleware = osmosis.genMemoAsMiddleware();
  //   expect(memoAsMiddleware).toEqual({
  //     receiver: osmosis.ENTRY_POINT_CONTRACT,
  //     memo: JSON.stringify({
  //       wasm: {
  //         contract: osmosis.ENTRY_POINT_CONTRACT,
  //         msg: {
  //           swap_and_action: {
  //             user_swap: {
  //               swap_exact_asset_in: {
  //                 swap_venue_name: osmosis.SWAP_VENUE_NAME,
  //                 operations: [
  //                   {
  //                     denom_in: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4",
  //                     denom_out: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
  //                     pool: "1282"
  //                   }
  //                 ]
  //               }
  //             },
  //             min_asset: {
  //               native: { amount: "1", denom: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2" }
  //             },
  //             timeout_timestamp: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT),
  //             post_swap_action: {
  //               transfer: {
  //                 to_address: receiver
  //               }
  //             },
  //             affiliates: []
  //           }
  //         }
  //       }
  //     })
  //   });

  //   let executeMsg = osmosis.genExecuteMsg();
  //   expect(executeMsg.typeUrl).toEqual("/cosmwasm.wasm.v1.MsgExecuteContract");
  // });

  // it("Invalid path not ibc transfer", () => {
  //   const nextMemo = "{}";

  //   const invalidPathNotIbcTransfer = {
  //     chainId: "osmosis-1",
  //     tokenIn: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
  //     tokenInAmount: "999000",
  //     tokenOut: "uatom",
  //     tokenOutAmount: "999000",
  //     tokenOutChainId: "cosmoshub-4",
  //     actions: [
  //       {
  //         type: "Bridge",
  //         protocol: "Bridge",
  //         tokenIn: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
  //         tokenInAmount: "999000",
  //         tokenOut: "uatom",
  //         tokenOutAmount: "999000",
  //         tokenOutChainId: "cosmoshub-4",
  //         bridgeInfo: {
  //           port: "wasm.osmo123",
  //           channel: "channel-0"
  //         }
  //       }
  //     ]
  //   };
  //   let osmosis = new OsmosisMsg(invalidPathNotIbcTransfer, "1", receiver, currentAddress, nextMemo);
  //   try {
  //     osmosis.genMemoAsMiddleware();
  //   } catch (err) {
  //     expect(err).toEqual(generateError(`Only support IBC bridge on ${invalidPathNotIbcTransfer.chainId}`));
  //   }
  // });
});
