import { BridgeMsgInfo } from "./types";
import { ActionType, Path } from "../types";
import { SwapOperation } from "@oraichain/osor-api-contracts-sdk/src/types";
import { Swap, Action, ExecuteMsg } from "@oraichain/osor-api-contracts-sdk/src/EntryPoint.types";
import { isCw20Token, validatePath } from "./common";
import {
  calculateTimeoutTimestamp,
  generateError,
  IBC_TRANSFER_TIMEOUT,
  NetworkChainId
} from "@oraichain/oraidex-common";
import { toBinary } from "@cosmjs/cosmwasm-stargate";
import { EncodeObject } from "@cosmjs/proto-signing";
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";
import { toUtf8 } from "@cosmjs/encoding";

export class OsmosisMsg {
  SWAP_VENUE_NAME = "osmosis-poolmanager";
  ENTRY_POINT_CONTRACT = "";

  constructor(
    protected path: Path,
    protected minimumReceive: string,
    protected receiver: string,
    protected currentChainAddress: string,
    protected memo: string = undefined
  ) {
    // check chainId  = "osmosis-1"
    if (path.chainId !== "osmosis-1") {
      throw generateError("This path must be on Osmosis");
    }
    // validate path
    validatePath(path);
  }

  /**
   * Function to build msg swap on Oraichain
   */
  getSwapAndBridgeInfo(): [SwapOperation[], BridgeMsgInfo] {
    let swapOps: SwapOperation[] = [];
    let bridgeInfo: BridgeMsgInfo;

    // build swap operations.
    // we have 2 main cases:
    // - swap
    // - IBC BRIDGE
    for (let action of this.path.actions) {
      switch (action.type) {
        case ActionType.Swap: {
          let denomIn = action.tokenIn;
          action.swapInfo.forEach((swapInfo) => {
            swapOps.push({
              denom_in: denomIn,
              denom_out: swapInfo.tokenOut,
              pool: swapInfo.poolId
            });
            denomIn = swapInfo.tokenOut;
          });
          break;
        }
        case ActionType.Bridge: {
          bridgeInfo = {
            sourceChannel: action.bridgeInfo.channel,
            sourcePort: action.bridgeInfo.port,
            memo: this.memo,
            receiver: this.receiver,
            timeout: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT),
            fromToken: action.tokenIn,
            toToken: action.tokenOut,
            fromChain: this.path.chainId as NetworkChainId,
            toChain: this.path.tokenOutChainId as NetworkChainId
          };
          break;
        }
        default:
          throw generateError("Only support swap + bride on Osmosis");
      }
    }

    return [swapOps, bridgeInfo];
  }

  getPostAction(bridgeInfo?: BridgeMsgInfo): Action {
    // case 1: transfer to receiver
    if (!bridgeInfo) {
      return {
        transfer: {
          to_address: this.receiver
        }
      };
    }

    // case 2: ibc transfer
    if (bridgeInfo.sourcePort == "transfer") {
      return {
        ibc_transfer: {
          ibc_info: {
            source_channel: bridgeInfo.sourceChannel,
            receiver: bridgeInfo.receiver,
            memo: bridgeInfo.memo,
            recover_address: this.currentChainAddress
          }
        }
      };
    }

    throw generateError("Missing postAction for universalSwap on Oraichain");
  }
  /**
   * Function to generate memo for action on oraichain as middleware
   */
  genMemoAsMiddleware(): string {
    let [swapOps, bridgeInfo] = this.getSwapAndBridgeInfo();

    // we have 2 cases:
    // - first case: only ibc transfer (build IBC forward middleware msg)
    // - second case: swap + action => swap through osor entry point

    if (swapOps.length == 0) {
      // bridge only
      if (bridgeInfo.sourcePort != "transfer") {
        throw generateError("Error on generate memo as middleware: Only support ibc bridge");
      }

      // ibc bridge
      return JSON.stringify({
        forward: {
          receiver: this.receiver,
          port: bridgeInfo.sourcePort,
          channel: bridgeInfo.sourceChannel,
          timeout: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT),
          retries: 2,
          next: this.memo
        }
      });
    }

    let tokenOutOfSwap = swapOps[swapOps.length - 1].denom_out;
    let min_asset = isCw20Token(tokenOutOfSwap)
      ? {
          cw20: {
            amount: this.minimumReceive,
            address: tokenOutOfSwap
          }
        }
      : {
          native: {
            amount: this.minimumReceive,
            denom: tokenOutOfSwap
          }
        };

    let msg: ExecuteMsg = {
      swap_and_action: {
        user_swap: {
          swap_exact_asset_in: {
            swap_venue_name: this.SWAP_VENUE_NAME,
            operations: swapOps
          }
        },
        min_asset: min_asset,
        timeout_timestamp: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT),
        post_swap_action: this.getPostAction(bridgeInfo),
        affiliates: []
      }
    };

    return JSON.stringify({
      wasm: {
        contract: this.ENTRY_POINT_CONTRACT,
        msg
      }
    });
  }

  /**
   * Function to generate execute msg on Osmosis
   */

  genExecuteMsg(): EncodeObject {
    let [swapOps, bridgeInfo] = this.getSwapAndBridgeInfo();

    // we have 2 cases:
    // - case 1: ibc transfer
    // - case 2: swap and action

    if (swapOps.length == 0) {
      // ibc transfer
      if (bridgeInfo.sourcePort == "transfer") {
        return {
          typeUrl: "/ibc.applications.transfer.v1.MsgTransfer",
          value: {
            sourcePort: bridgeInfo.sourcePort,
            sourceChannel: bridgeInfo.sourceChannel,
            receiver: this.receiver,
            token: {
              amount: this.path.tokenInAmount,
              denom: this.path.tokenIn
            },
            sender: this.currentChainAddress,
            memo: this.memo,
            timeoutTimestamp: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT)
          }
        };
      }

      throw generateError("Error on generate executeMsg on Oraichain: Only support ibc transfer");
    }

    let tokenOutOfSwap = swapOps[swapOps.length - 1].denom_out;
    let min_asset = isCw20Token(tokenOutOfSwap)
      ? {
          cw20: {
            amount: this.minimumReceive,
            address: tokenOutOfSwap
          }
        }
      : {
          native: {
            amount: this.minimumReceive,
            denom: tokenOutOfSwap
          }
        };

    // swap and action
    let msg: ExecuteMsg = {
      swap_and_action: {
        affiliates: [],
        min_asset,
        post_swap_action: this.getPostAction(bridgeInfo),
        timeout_timestamp: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT),
        user_swap: {
          swap_exact_asset_in: { swap_venue_name: this.SWAP_VENUE_NAME, operations: swapOps }
        }
      }
    };

    // if asset info is native => send native way, else send cw20 way
    if (isCw20Token(bridgeInfo.fromToken)) {
      return {
        typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
        value: MsgExecuteContract.fromPartial({
          sender: this.currentChainAddress,
          contract: bridgeInfo.fromToken,
          msg: toUtf8(
            JSON.stringify({
              send: {
                send: {
                  contract: this.ENTRY_POINT_CONTRACT,
                  amount: this.path.tokenInAmount,
                  msg: toBinary(msg)
                }
              }
            })
          ),
          funds: []
        })
      };
    }
    // native token
    return {
      typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
      value: MsgExecuteContract.fromPartial({
        sender: this.currentChainAddress,
        contract: this.ENTRY_POINT_CONTRACT,
        msg: toUtf8(
          JSON.stringify({
            msg
          })
        ),
        funds: [
          {
            amount: bridgeInfo.fromToken,
            denom: this.path.tokenInAmount
          }
        ]
      })
    };
  }
}
