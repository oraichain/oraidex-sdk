import { BridgeMsgInfo, MiddlewareResponse } from "../types";
import { ActionType, Path } from "../../types";
import { Action } from "@oraichain/osor-api-contracts-sdk/src/EntryPoint.types";
import {
  BigDecimal,
  calculateTimeoutTimestamp,
  generateError,
  IBC_TRANSFER_TIMEOUT,
  NetworkChainId
} from "@oraichain/oraidex-common";

import { EncodeObject } from "@cosmjs/proto-signing";
import { ChainMsg } from "./chain";

export class CosmosMsg extends ChainMsg {
  constructor(path: Path, minimumReceive: string, receiver: string, currentChainAddress: string, memo: string = "") {
    super(path, minimumReceive, receiver, currentChainAddress, memo);
  }

  setMinimumReceiveForSwap(slippage: number = 0.01) {
    if (slippage <= 0 || slippage >= 1) {
      throw generateError("Slippage must be between 0 and 1");
    }
    let bridgeInfo = this.getBridgeInfo();
    let minimumReceive = new BigDecimal(1 - slippage).mul(bridgeInfo.amount).toString();
    if (minimumReceive.includes(".")) {
      minimumReceive = minimumReceive.split(".")[0];
    }
    this.minimumReceive = minimumReceive;
  }

  /**
   * Function to get IBC info of Cosmos-base ecosystem
   */
  getBridgeInfo(): BridgeMsgInfo {
    let bridgeInfo: BridgeMsgInfo;

    for (const action of this.path.actions) {
      if (action.type === ActionType.Bridge) {
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
      } else {
        throw generateError(`Only support bridge on ${this.path.chainId}`);
      }
    }

    if (!bridgeInfo) {
      throw generateError("Bridge action not found in path actions");
    }

    // check bridge type must be ibc bridge
    if (bridgeInfo.sourcePort != "transfer") {
      throw generateError(`Only support IBC bridge on ${this.path.chainId}`);
    }

    return bridgeInfo;
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

    throw generateError(`Missing postAction for universalSwap on ${this.path.chainId}`);
  }
  /**
   * Function to generate memo for action on oraichain as middleware
   */
  genMemoAsMiddleware(): MiddlewareResponse {
    let bridgeInfo = this.getBridgeInfo();
    if (!bridgeInfo) {
      throw generateError("Bridge information is missing.");
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

  /**
   * Function to generate execute msg on Cosmos-base network
   */

  genExecuteMsg(): EncodeObject {
    let bridgeInfo = this.getBridgeInfo();
    if (bridgeInfo.sourcePort != "transfer") {
      throw generateError("Error on generate executeMsg on Oraichain: Only support ibc transfer");
    }
    // ibc transfer

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
}
