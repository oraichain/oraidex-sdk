import { expect, afterAll, beforeAll, describe, it, vi } from "vitest";
import { calculateTimeoutTimestamp, generateError, IBC_TRANSFER_TIMEOUT } from "@oraichain/oraidex-common";
import { Action } from "@oraichain/osor-api-contracts-sdk/src/EntryPoint.types";
import { generateMsgSwap } from "../../src/msg/msgs";

describe("test build swap msg", () => {
  it("Test universal swap from cosmos-base ecosystem", () => {
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
});
