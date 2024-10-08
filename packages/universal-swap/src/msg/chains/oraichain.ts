import { BridgeMsgInfo, MiddlewareResponse } from "../types";
import { ActionType, Path } from "../../types";
import { SwapOperation } from "@oraichain/osor-api-contracts-sdk/src/types";
import { Action, ExecuteMsg } from "@oraichain/osor-api-contracts-sdk/src/EntryPoint.types";
import { isCw20Token } from "../common";
import {
  BigDecimal,
  calculateTimeoutTimestamp,
  CONVERTER_CONTRACT,
  generateError,
  IBC_TRANSFER_TIMEOUT,
  isEthAddress,
  NetworkChainId
} from "@oraichain/oraidex-common";
import { toBinary } from "@cosmjs/cosmwasm-stargate";
import { Memo, Memo_PostAction, Memo_UserSwap } from "../../proto/universal_swap_memo";
import { EncodeObject } from "@cosmjs/proto-signing";
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";
import { TransferBackMsg } from "@oraichain/common-contracts-sdk/build/CwIcs20Latest.types";
import { toUtf8 } from "@cosmjs/encoding";
import { ChainMsg } from "./chain";

export class OraichainMsg extends ChainMsg {
  SWAP_VENUE_NAME = "oraidex";
  ENTRY_POINT_CONTRACT = "orai1yglsm0u2x3xmct9kq3lxa654cshaxj9j5d9rw5enemkkkdjgzj7sr3gwt0";

  constructor(
    path: Path,
    minimumReceive: string,
    receiver: string,
    currentChainAddress: string,
    memo: string = "",
    protected destPrefix: string = undefined,
    protected obridgeAddress: string = undefined
  ) {
    super(path, minimumReceive, receiver, currentChainAddress, memo);
    // check chainId  = "Oraichain"
    if (path.chainId !== "Oraichain") {
      throw generateError("This path must be on Oraichain");
    }
  }

  setMinimumReceiveForSwap(slippage: number = 0.01) {
    if (slippage > 1) {
      throw generateError("Slippage must be less than 1");
    }
    let [_, bridgeInfo] = this.getSwapAndBridgeInfo();

    let returnAmount = bridgeInfo ? bridgeInfo.amount : this.path.tokenOutAmount;
    let minimumReceive = new BigDecimal(1 - slippage).mul(returnAmount).toString();
    if (minimumReceive.includes(".")) {
      minimumReceive = minimumReceive.split(".")[0];
    }
    this.minimumReceive = minimumReceive;
  }

  /**
   * Converts the given input and output tokens to a pool ID using the converter contract in the Oraichain ecosystem.
   * @param tokenIn The input token to be converted
   * @param tokenOut The output token after conversion
   * @returns The pool ID generated based on the provided input and output tokens
   */
  pasreConverterMsgToPoolId = (tokenIn: string, tokenOut: string) => {
    // In Oraichain, conversion from native token to CW20 token always occurs
    // TODO: Query the converter contract to determine the appropriate conversion method

    if (isCw20Token(tokenIn)) {
      // Convert in reverse
      return toBinary({
        contract: CONVERTER_CONTRACT,
        msg: toBinary({
          convert_reverse: {
            from: {
              native_token: {
                denom: tokenOut
              }
            }
          }
        })
      });
    } else {
      // Convert normally
      return toBinary({
        contract: CONVERTER_CONTRACT,
        msg: toBinary({
          convert: {}
        })
      });
    }
  };

  /**
   * Function to build msg swap on Oraichain
   */
  getSwapAndBridgeInfo(): [SwapOperation[], BridgeMsgInfo] {
    let swapOps: SwapOperation[] = [];
    let bridgeInfo: BridgeMsgInfo;

    // build swap operations.
    // we have 2 main cases:
    // - swap + convert
    // - bridge (IBC bridge or Ibc wasm bridge)
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
        case ActionType.Convert: {
          swapOps.push({
            denom_in: action.tokenIn,
            denom_out: action.tokenOut,
            pool: this.pasreConverterMsgToPoolId(action.tokenIn, action.tokenOut)
          });
          break;
        }
        case ActionType.Bridge: {
          bridgeInfo = {
            amount: action.tokenInAmount,
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
          throw generateError("Only support swap + convert + bride on Oraichain");
      }
    }

    return [swapOps, bridgeInfo];
  }

  // function to generate postAction to ibc wasm
  getProtoForPostAction(bridgeInfo?: BridgeMsgInfo): Memo_PostAction {
    // case 1: transfer to receiver
    if (!bridgeInfo) {
      return {
        transferMsg: {
          toAddress: this.receiver
        }
      };
    }

    // case 2: ibc transfer
    if (bridgeInfo.sourcePort == "transfer") {
      return {
        ibcTransferMsg: {
          sourceChannel: bridgeInfo.sourceChannel,
          sourcePort: bridgeInfo.sourcePort,
          receiver: bridgeInfo.receiver,
          memo: bridgeInfo.memo,
          recoverAddress: this.currentChainAddress
        }
      };
    }

    // case 3: ibc wasm transfer

    if (bridgeInfo.sourcePort.startsWith("wasm")) {
      // handle noble & evm case
      let prefix = "";
      let isBridgeToEvm = isEthAddress(this.receiver);
      if (isBridgeToEvm) {
        if (!this.destPrefix || !this.obridgeAddress)
          throw generateError("Missing prefix or Obridge address for bridge to EVM");
        prefix = this.destPrefix;
      }

      return {
        ibcWasmTransferMsg: {
          localChannelId: bridgeInfo.sourceChannel,
          remoteAddress: isBridgeToEvm ? this.obridgeAddress : this.receiver,
          remoteDenom: prefix + bridgeInfo.toToken,
          memo: isBridgeToEvm ? prefix + this.receiver : this.memo
        }
      };
    }

    throw generateError("Missing postAction for ibc wasm memo");
  }

  /**
   * Function to generate memo msg for swap through ibc wasm after bridge
   * @returns
   */
  genMemoForIbcWasm(): MiddlewareResponse {
    let [swapOps, bridgeInfo] = this.getSwapAndBridgeInfo();
    let userSwap: Memo_UserSwap;
    if (swapOps.length) {
      userSwap = {
        swapVenueName: this.SWAP_VENUE_NAME,
        swapExactAssetIn: {
          operations: swapOps.map((operation) => ({
            poolId: operation.pool,
            denomIn: operation.denom_in,
            denomOut: operation.denom_out
          }))
        }
      };
    }
    let memo: Memo = {
      userSwap,
      minimumReceive: this.minimumReceive,
      timeoutTimestamp: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT),
      postSwapAction: this.getProtoForPostAction(bridgeInfo),
      recoveryAddr: this.currentChainAddress
    };
    const encodedMemo = Memo.encode(memo).finish();
    return {
      receiver: this.currentChainAddress,
      memo: Buffer.from(encodedMemo).toString("base64")
    };
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

    // case 3: ibc wasm transfer
    if (bridgeInfo.sourcePort.startsWith("wasm")) {
      // handle noble & evm case
      let prefix = "";
      let isBridgeToEvm = isEthAddress(this.receiver);
      if (isBridgeToEvm) {
        if (!this.destPrefix || !this.obridgeAddress)
          throw generateError("Missing prefix or Obridge address for bridge to EVM");
        prefix = this.destPrefix;
      }

      return {
        ibc_wasm_transfer: {
          ibc_wasm_info: {
            local_channel_id: bridgeInfo.sourceChannel,
            remote_address: isBridgeToEvm ? this.obridgeAddress : this.receiver,
            remote_denom: prefix + bridgeInfo.toToken,
            memo: isBridgeToEvm ? prefix + this.receiver : this.memo
          }
        }
      };
    }

    throw generateError("Missing postAction for postAction in Oraichain");
  }
  /**
   * Function to generate memo for action on oraichain as middleware
   */
  genMemoAsMiddleware(): MiddlewareResponse {
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
      return {
        receiver: this.currentChainAddress,
        memo: JSON.stringify({
          forward: {
            receiver: this.receiver,
            port: bridgeInfo.sourcePort,
            channel: bridgeInfo.sourceChannel,
            timeout: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT),
            retries: 2,
            next: this.memo
          }
        })
      };
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

    return {
      receiver: this.ENTRY_POINT_CONTRACT,
      memo: JSON.stringify({
        wasm: {
          contract: this.ENTRY_POINT_CONTRACT,
          msg
        }
      })
    };
  }

  /**
   * Function to generate execute msg on Oraichain
   */

  genExecuteMsg(): EncodeObject {
    let [swapOps, bridgeInfo] = this.getSwapAndBridgeInfo();

    // we have 3 cases:
    // - case 1: ibc transfer
    // - case 2;  ibc wasm transfer
    // - case 3: swap and action

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

      // ibc wasm transfer
      if (bridgeInfo.sourcePort.startsWith("wasm")) {
        let prefix = "";
        let isBridgeToEvm = isEthAddress(this.receiver);
        if (isBridgeToEvm) {
          if (!this.destPrefix || !this.obridgeAddress)
            throw generateError("Missing prefix or Obridge address for bridge to EVM");
          prefix = this.destPrefix;
        }

        const ibcWasmContractAddress = bridgeInfo.sourcePort.split(".")[1];
        if (!ibcWasmContractAddress)
          throw generateError("IBC Wasm source port is invalid. Cannot transfer to the destination chain");

        const msg: TransferBackMsg = {
          local_channel_id: bridgeInfo.sourceChannel,
          remote_address: isBridgeToEvm ? this.obridgeAddress : this.receiver,
          remote_denom: prefix + bridgeInfo.toToken,
          timeout: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT),
          memo: isBridgeToEvm ? prefix + this.receiver : this.memo
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
                      contract: ibcWasmContractAddress,
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
            contract: ibcWasmContractAddress,
            msg: toUtf8(
              JSON.stringify({
                transfer_to_remote: {
                  msg
                }
              })
            ),
            funds: [
              {
                denom: this.path.tokenIn,
                amount: this.path.tokenInAmount
              }
            ]
          })
        };
      }

      throw generateError("Error on generate executeMsg on Oraichain: Only support ibc or ibc wasm bridge");
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
    if (isCw20Token(this.path.tokenIn)) {
      return {
        typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
        value: MsgExecuteContract.fromPartial({
          sender: this.currentChainAddress,
          contract: this.path.tokenIn,
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
        msg: toUtf8(JSON.stringify(msg)),
        funds: [
          {
            denom: this.path.tokenIn,
            amount: this.path.tokenInAmount
          }
        ]
      })
    };
  }
}
