import { expect, afterAll, beforeAll, describe, it, vi } from "vitest";
import { calculateTimeoutTimestamp, generateError, IBC_TRANSFER_TIMEOUT } from "@oraichain/oraidex-common";
import { Action } from "@oraichain/osor-api-contracts-sdk/src/EntryPoint.types";
import { generateMsgSwap } from "../../src/msg/msgs";
import { Memo } from "../../src/proto/universal_swap_memo";

describe("test build swap msg", () => {
  it("Test build universal swap msg from cosmos-base ecosystem", () => {
    let route = {
      swapAmount: "10000000",
      returnAmount: "7340955",
      paths: [
        {
          chainId: "cosmoshub-4",
          tokenIn: "uatom",
          tokenInAmount: "10000000",
          tokenOut: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
          tokenOutAmount: "10000000",
          tokenOutChainId: "osmosis-1",
          actions: [
            {
              type: "Bridge",
              protocol: "Bridge",
              tokenIn: "uatom",
              tokenInAmount: "10000000",
              tokenOut: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
              tokenOutAmount: "10000000",
              tokenOutChainId: "osmosis-1",
              bridgeInfo: {
                port: "transfer",
                channel: "channel-141"
              }
            }
          ]
        },
        {
          chainId: "osmosis-1",
          tokenIn: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
          tokenInAmount: "10000000",
          tokenOut: "orai",
          tokenOutAmount: "7340955",
          tokenOutChainId: "Oraichain",
          actions: [
            {
              type: "Swap",
              protocol: "Osmosis",
              tokenIn: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
              tokenInAmount: "10000000",
              tokenOut: "ibc/161D7D62BAB3B9C39003334F1671208F43C06B643CC9EDBBE82B64793C857F1D",
              tokenOutAmount: "7340955",
              swapInfo: [
                {
                  poolId: "1135",
                  tokenOut: "uosmo"
                },
                {
                  poolId: "2173",
                  tokenOut: "ibc/161D7D62BAB3B9C39003334F1671208F43C06B643CC9EDBBE82B64793C857F1D"
                }
              ]
            },
            {
              type: "Bridge",
              protocol: "Bridge",
              tokenIn: "ibc/161D7D62BAB3B9C39003334F1671208F43C06B643CC9EDBBE82B64793C857F1D",
              tokenInAmount: "7340955",
              tokenOut: "orai",
              tokenOutAmount: "7340955",
              tokenOutChainId: "Oraichain",
              bridgeInfo: {
                port: "transfer",
                channel: "channel-216"
              }
            }
          ]
        }
      ]
    };

    // case 1: missing receiver  address
    try {
      let res = generateMsgSwap(route, 0.1, {});
    } catch (err) {
      expect(err).toEqual(generateError(`Missing receiver when build msg in osmosis-1`));
    }

    // case 2: missing current chain address

    try {
      let res = generateMsgSwap(route, 0.1, { Oraichain: "orai1hvr9d72r5um9lvt0rpkd4r75vrsqtw6yujhqs2" });
    } catch (err) {
      expect(err).toEqual(generateError(`Missing address of osmosis-1`));
    }

    let res = generateMsgSwap(route, 0.1, {
      Oraichain: "orai1hvr9d72r5um9lvt0rpkd4r75vrsqtw6yujhqs2",
      "cosmoshub-4": "cosmos1hvr9d72r5um9lvt0rpkd4r75vrsqtw6y0ppr3e",
      "osmosis-1": "osmo1hvr9d72r5um9lvt0rpkd4r75vrsqtw6y86jn8t"
    });
    expect(res).toEqual({
      typeUrl: "/ibc.applications.transfer.v1.MsgTransfer",
      value: {
        sourcePort: "transfer",
        sourceChannel: "channel-141",
        receiver: "osmo1h3jkejkcpthl45xrrm5geed3eq75p5rgfce9taufkwfr89k63muqweu2y7",
        token: { amount: "10000000", denom: "uatom" },
        sender: "cosmos1hvr9d72r5um9lvt0rpkd4r75vrsqtw6y0ppr3e",
        memo: JSON.stringify({
          wasm: {
            contract: "osmo1h3jkejkcpthl45xrrm5geed3eq75p5rgfce9taufkwfr89k63muqweu2y7",
            msg: {
              swap_and_action: {
                user_swap: {
                  swap_exact_asset_in: {
                    swap_venue_name: "osmosis-poolmanager",
                    operations: [
                      {
                        denom_in: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
                        denom_out: "uosmo",
                        pool: "1135"
                      },
                      {
                        denom_in: "uosmo",
                        denom_out: "ibc/161D7D62BAB3B9C39003334F1671208F43C06B643CC9EDBBE82B64793C857F1D",
                        pool: "2173"
                      }
                    ]
                  }
                },
                min_asset: {
                  native: {
                    amount: "6606859",
                    denom: "ibc/161D7D62BAB3B9C39003334F1671208F43C06B643CC9EDBBE82B64793C857F1D"
                  }
                },
                timeout_timestamp: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT),
                post_swap_action: {
                  ibc_transfer: {
                    ibc_info: {
                      source_channel: "channel-216",
                      receiver: "orai1hvr9d72r5um9lvt0rpkd4r75vrsqtw6yujhqs2",
                      memo: "",
                      recover_address: "osmo1hvr9d72r5um9lvt0rpkd4r75vrsqtw6y86jn8t"
                    }
                  }
                },
                affiliates: []
              }
            }
          }
        }),
        timeoutTimestamp: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT)
      }
    });
  });

  it("Test build universal swap msg from cosmos to evm", () => {
    let route = {
      swapAmount: "1000000",
      returnAmount: "634236000000000000",
      paths: [
        {
          chainId: "cosmoshub-4",
          tokenIn: "uatom",
          tokenInAmount: "1000000",
          tokenOut: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
          tokenOutAmount: "1000000",
          tokenOutChainId: "osmosis-1",
          actions: [
            {
              type: "Bridge",
              protocol: "Bridge",
              tokenIn: "uatom",
              tokenInAmount: "1000000",
              tokenOut: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
              tokenOutAmount: "1000000",
              tokenOutChainId: "osmosis-1",
              bridgeInfo: {
                port: "transfer",
                channel: "channel-141"
              }
            }
          ]
        },
        {
          chainId: "osmosis-1",
          tokenIn: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
          tokenInAmount: "1000000",
          tokenOut: "ibc/9C4DCD21B48231D0BC2AC3D1B74A864746B37E4292694C93C617324250D002FC",
          tokenOutAmount: "8405405",
          tokenOutChainId: "Oraichain",
          actions: [
            {
              type: "Swap",
              protocol: "Osmosis",
              tokenIn: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
              tokenInAmount: "1000000",
              tokenOut: "uosmo",
              tokenOutAmount: "8405405",
              swapInfo: [
                {
                  poolId: "1282",
                  tokenOut: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4"
                },
                {
                  poolId: "1464",
                  tokenOut: "uosmo"
                }
              ]
            },
            {
              type: "Bridge",
              protocol: "Bridge",
              tokenIn: "uosmo",
              tokenInAmount: "8405405",
              tokenOut: "ibc/9C4DCD21B48231D0BC2AC3D1B74A864746B37E4292694C93C617324250D002FC",
              tokenOutAmount: "8405405",
              tokenOutChainId: "Oraichain",
              bridgeInfo: {
                port: "transfer",
                channel: "channel-216"
              }
            }
          ]
        },
        {
          chainId: "Oraichain",
          tokenIn: "ibc/9C4DCD21B48231D0BC2AC3D1B74A864746B37E4292694C93C617324250D002FC",
          tokenInAmount: "8405405",
          tokenOut: "0xA325Ad6D9c92B55A3Fc5aD7e412B1518F96441C0",
          tokenOutAmount: "634236000000000000",
          tokenOutChainId: "0x38",
          actions: [
            {
              type: "Swap",
              protocol: "Oraidex",
              tokenIn: "ibc/9C4DCD21B48231D0BC2AC3D1B74A864746B37E4292694C93C617324250D002FC",
              tokenInAmount: "8405405",
              tokenOut: "orai",
              tokenOutAmount: "734971",
              swapInfo: [
                {
                  poolId: "orai1d37artrk4tkhz2qyjmaulc2jzjkx7206tmpfug",
                  tokenOut: "orai"
                }
              ]
            },
            {
              type: "Bridge",
              protocol: "Bridge",
              tokenIn: "orai",
              tokenInAmount: "734971",
              tokenOut: "0xA325Ad6D9c92B55A3Fc5aD7e412B1518F96441C0",
              tokenOutAmount: "634236000000000000",
              tokenOutChainId: "0x38",
              bridgeInfo: {
                port: "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm",
                channel: "channel-29"
              }
            }
          ]
        }
      ]
    };

    let res = generateMsgSwap(route, 0.1, {
      "0x38": "0x8c7E0A841269a01c0Ab389Ce8Fb3Cf150A94E797",
      "oraibridge-subnet-2": "oraib1hvr9d72r5um9lvt0rpkd4r75vrsqtw6ytnnvpf",
      Oraichain: "orai1hvr9d72r5um9lvt0rpkd4r75vrsqtw6yujhqs2",
      "cosmoshub-4": "cosmos1hvr9d72r5um9lvt0rpkd4r75vrsqtw6y0ppr3e",
      "osmosis-1": "osmo1hvr9d72r5um9lvt0rpkd4r75vrsqtw6y86jn8t"
    });

    expect(res).toEqual({
      typeUrl: "/ibc.applications.transfer.v1.MsgTransfer",
      value: {
        sourcePort: "transfer",
        sourceChannel: "channel-141",
        receiver: "osmo1h3jkejkcpthl45xrrm5geed3eq75p5rgfce9taufkwfr89k63muqweu2y7",
        token: { amount: "1000000", denom: "uatom" },
        sender: "cosmos1hvr9d72r5um9lvt0rpkd4r75vrsqtw6y0ppr3e",
        memo: JSON.stringify({
          wasm: {
            contract: "osmo1h3jkejkcpthl45xrrm5geed3eq75p5rgfce9taufkwfr89k63muqweu2y7",
            msg: {
              swap_and_action: {
                user_swap: {
                  swap_exact_asset_in: {
                    swap_venue_name: "osmosis-poolmanager",
                    operations: [
                      {
                        denom_in: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
                        denom_out: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4",
                        pool: "1282"
                      },
                      {
                        denom_in: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4",
                        denom_out: "uosmo",
                        pool: "1464"
                      }
                    ]
                  }
                },
                min_asset: { native: { amount: "7564864", denom: "uosmo" } },
                timeout_timestamp: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT),
                post_swap_action: {
                  ibc_transfer: {
                    ibc_info: {
                      source_channel: "channel-216",
                      receiver: "orai13mgxn93pjvd7eermj4ghet8assxdqttxugwk25rasuuqq2g5nczq43eesn",
                      memo: JSON.stringify({
                        wasm: {
                          contract: "orai13mgxn93pjvd7eermj4ghet8assxdqttxugwk25rasuuqq2g5nczq43eesn",
                          msg: {
                            swap_and_action: {
                              user_swap: {
                                swap_exact_asset_in: {
                                  swap_venue_name: "oraidex",
                                  operations: [
                                    {
                                      denom_in: "ibc/9C4DCD21B48231D0BC2AC3D1B74A864746B37E4292694C93C617324250D002FC",
                                      denom_out: "orai",
                                      pool: "orai1d37artrk4tkhz2qyjmaulc2jzjkx7206tmpfug"
                                    }
                                  ]
                                }
                              },
                              min_asset: { native: { amount: "661473", denom: "orai" } },
                              timeout_timestamp: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT),
                              post_swap_action: {
                                ibc_wasm_transfer: {
                                  ibc_wasm_info: {
                                    local_channel_id: "channel-29",
                                    remote_address: "oraib1hvr9d72r5um9lvt0rpkd4r75vrsqtw6ytnnvpf",
                                    remote_denom: "oraib0xA325Ad6D9c92B55A3Fc5aD7e412B1518F96441C0",
                                    memo: "oraib0x8c7E0A841269a01c0Ab389Ce8Fb3Cf150A94E797"
                                  }
                                }
                              },
                              affiliates: []
                            }
                          }
                        }
                      }),
                      recover_address: "osmo1hvr9d72r5um9lvt0rpkd4r75vrsqtw6y86jn8t"
                    }
                  }
                },
                affiliates: []
              }
            }
          }
        }),
        timeoutTimestamp: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT)
      }
    });
  });

  it("Test build universal swap msg from noble", () => {
    let route = {
      swapAmount: "1000000000",
      returnAmount: "996112805",
      paths: [
        {
          chainId: "noble-1",
          tokenIn: "uusdc",
          tokenInAmount: "1000000000",
          tokenOut: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
          tokenOutAmount: "997121725",
          tokenOutChainId: "Oraichain",
          actions: [
            {
              type: "Bridge",
              protocol: "Bridge",
              tokenIn: "uusdc",
              tokenInAmount: "1000000000",
              tokenOut: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
              tokenOutAmount: "997121725",
              tokenOutChainId: "Oraichain",
              bridgeInfo: {
                port: "transfer",
                channel: "channel-34"
              }
            }
          ]
        },
        {
          chainId: "Oraichain",
          tokenIn: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
          tokenInAmount: "997121725",
          tokenOut: "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh",
          tokenOutAmount: "996112805",
          tokenOutChainId: "Oraichain",
          actions: [
            {
              type: "Swap",
              protocol: "OraidexV3",
              tokenIn: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
              tokenInAmount: "997121725",
              tokenOut: "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh",
              tokenOutAmount: "996112805",
              swapInfo: [
                {
                  poolId:
                    "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh-orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd-500000000-10",
                  tokenOut: "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh"
                }
              ]
            }
          ]
        }
      ]
    };

    let res = generateMsgSwap(route, 0.1, {
      "0x38": "0x8c7E0A841269a01c0Ab389Ce8Fb3Cf150A94E797",
      "oraibridge-subnet-2": "oraib1hvr9d72r5um9lvt0rpkd4r75vrsqtw6ytnnvpf",
      Oraichain: "orai1hvr9d72r5um9lvt0rpkd4r75vrsqtw6yujhqs2",
      "cosmoshub-4": "cosmos1hvr9d72r5um9lvt0rpkd4r75vrsqtw6y0ppr3e",
      "osmosis-1": "osmo1hvr9d72r5um9lvt0rpkd4r75vrsqtw6y86jn8t",
      "noble-1": "noble1hvr9d72r5um9lvt0rpkd4r75vrsqtw6y8z5tfh"
    });

    expect(res).toEqual({
      typeUrl: "/ibc.applications.transfer.v1.MsgTransfer",
      value: {
        sourcePort: "transfer",
        sourceChannel: "channel-34",
        receiver: "orai1hvr9d72r5um9lvt0rpkd4r75vrsqtw6yujhqs2",
        token: { amount: "1000000000", denom: "uusdc" },
        sender: "noble1hvr9d72r5um9lvt0rpkd4r75vrsqtw6y8z5tfh",
        memo: Buffer.from(
          Memo.encode({
            userSwap: {
              swapVenueName: "oraidex",
              swapExactAssetIn: {
                operations: [
                  {
                    poolId:
                      "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh-orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd-500000000-10",
                    denomIn: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
                    denomOut: "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh"
                  }
                ]
              }
            },
            minimumReceive: "896501524",
            timeoutTimestamp: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT),
            postSwapAction: {
              transferMsg: {
                toAddress: "orai1hvr9d72r5um9lvt0rpkd4r75vrsqtw6yujhqs2"
              }
            },
            recoveryAddr: "orai1hvr9d72r5um9lvt0rpkd4r75vrsqtw6yujhqs2"
          }).finish()
        ).toString("base64"),
        timeoutTimestamp: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT)
      }
    });
  });

  it("Test build universal swap msg from noble to evm", () => {
    let route = {
      swapAmount: "1000000000",
      returnAmount: "886558424",
      paths: [
        {
          chainId: "noble-1",
          tokenIn: "uusdc",
          tokenInAmount: "1000000000",
          tokenOut: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
          tokenOutAmount: "997121083",
          tokenOutChainId: "Oraichain",
          actions: [
            {
              type: "Bridge",
              protocol: "Bridge",
              tokenIn: "uusdc",
              tokenInAmount: "1000000000",
              tokenOut: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
              tokenOutAmount: "997121083",
              tokenOutChainId: "Oraichain",
              bridgeInfo: {
                port: "transfer",
                channel: "channel-34"
              }
            }
          ]
        },
        {
          chainId: "Oraichain",
          tokenIn: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
          tokenInAmount: "997121083",
          tokenOut: "0x55d398326f99059fF775485246999027B3197955",
          tokenOutAmount: "886558424",
          tokenOutChainId: "0x38",
          actions: [
            {
              type: "Swap",
              protocol: "Oraidex",
              tokenIn: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
              tokenInAmount: "997121083",
              tokenOut: "orai",
              tokenOutAmount: "141853616",
              swapInfo: [
                {
                  poolId: "orai19ttg0j7w5kr83js32tmwnwxxdq9rkmw4m3d7mn2j2hkpugwwa4tszwsnkg",
                  tokenOut: "orai"
                }
              ]
            },
            {
              type: "Swap",
              protocol: "OraidexV3",
              tokenIn: "orai",
              tokenInAmount: "141853616",
              tokenOut: "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh",
              tokenOutAmount: "888072940",
              swapInfo: [
                {
                  poolId: "orai-orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh-3000000000-100",
                  tokenOut: "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh"
                }
              ]
            },
            {
              type: "Bridge",
              protocol: "Bridge",
              tokenIn: "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh",
              tokenInAmount: "888072940",
              tokenOut: "0x55d398326f99059fF775485246999027B3197955",
              tokenOutAmount: "886558424",
              tokenOutChainId: "0x38",
              bridgeInfo: {
                port: "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm",
                channel: "channel-29"
              }
            }
          ]
        }
      ]
    };

    let res = generateMsgSwap(route, 0.1, {
      "0x38": "0x8c7E0A841269a01c0Ab389Ce8Fb3Cf150A94E797",
      "oraibridge-subnet-2": "oraib1hvr9d72r5um9lvt0rpkd4r75vrsqtw6ytnnvpf",
      Oraichain: "orai1hvr9d72r5um9lvt0rpkd4r75vrsqtw6yujhqs2",
      "cosmoshub-4": "cosmos1hvr9d72r5um9lvt0rpkd4r75vrsqtw6y0ppr3e",
      "osmosis-1": "osmo1hvr9d72r5um9lvt0rpkd4r75vrsqtw6y86jn8t",
      "noble-1": "noble1hvr9d72r5um9lvt0rpkd4r75vrsqtw6y8z5tfh"
    });

    expect(res).toEqual({
      typeUrl: "/ibc.applications.transfer.v1.MsgTransfer",
      value: {
        sourcePort: "transfer",
        sourceChannel: "channel-34",
        receiver: "orai1hvr9d72r5um9lvt0rpkd4r75vrsqtw6yujhqs2",
        token: { amount: "1000000000", denom: "uusdc" },
        sender: "noble1hvr9d72r5um9lvt0rpkd4r75vrsqtw6y8z5tfh",
        memo: Buffer.from(
          Memo.encode({
            userSwap: {
              swapVenueName: "oraidex",
              swapExactAssetIn: {
                operations: [
                  {
                    poolId: "orai19ttg0j7w5kr83js32tmwnwxxdq9rkmw4m3d7mn2j2hkpugwwa4tszwsnkg",
                    denomIn: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
                    denomOut: "orai"
                  },
                  {
                    poolId: "orai-orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh-3000000000-100",
                    denomIn: "orai",
                    denomOut: "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh"
                  }
                ]
              }
            },
            minimumReceive: "799265646",
            timeoutTimestamp: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT),
            postSwapAction: {
              ibcWasmTransferMsg: {
                localChannelId: "channel-29",
                remoteAddress: "oraib1hvr9d72r5um9lvt0rpkd4r75vrsqtw6ytnnvpf",
                remoteDenom: "oraib0x55d398326f99059fF775485246999027B3197955",
                memo: "oraib0x8c7E0A841269a01c0Ab389Ce8Fb3Cf150A94E797"
              }
            },
            recoveryAddr: "orai1hvr9d72r5um9lvt0rpkd4r75vrsqtw6yujhqs2"
          }).finish()
        ).toString("base64"),
        timeoutTimestamp: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT)
      }
    });
  });
});
