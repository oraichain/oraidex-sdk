import { expect, afterAll, beforeAll, describe, it, vi } from "vitest";
import { BridgeMsgInfo, CosmosMsg } from "../../src/msg";
import { calculateTimeoutTimestamp, generateError, IBC_TRANSFER_TIMEOUT } from "@oraichain/oraidex-common";
import { Action } from "@oraichain/osor-api-contracts-sdk/src/EntryPoint.types";

describe("test build cosmos msg", () => {
  const validPath = {
    chainId: "cosmoshub-4",
    tokenIn: "uatom",
    tokenInAmount: "217432",
    tokenOut: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
    tokenOutAmount: "217432",
    tokenOutChainId: "Oraichain",
    actions: [
      {
        type: "Bridge",
        protocol: "Bridge",
        tokenIn: "uatom",
        tokenInAmount: "217432",
        tokenOut: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
        tokenOutAmount: "217432",
        tokenOutChainId: "Oraichain",
        bridgeInfo: {
          port: "transfer",
          channel: "channel-301"
        }
      }
    ]
  };

  const receiver = "orai1hvr9d72r5um9lvt0rpkd4r75vrsqtw6yujhqs2";
  const currentAddress = "cosmos1hvr9d72r5um9lvt0rpkd4r75vrsqtw6y0ppr3e";

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
        receiver: "orai1hvr9d72r5um9lvt0rpkd4r75vrsqtw6yujhqs2",
        timeout: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT),
        fromToken: "uatom",
        toToken: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
        fromChain: "cosmoshub-4",
        toChain: "Oraichain"
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
        receiver: "orai1hvr9d72r5um9lvt0rpkd4r75vrsqtw6yujhqs2",
        timeout: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT),
        fromToken: "uatom",
        toToken: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
        fromChain: "cosmoshub-4",
        toChain: "Oraichain"
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
  ])("cosmos test get post action", (bridgeInfo, expectedAction, expectedError) => {
    let cosmos = new CosmosMsg(validPath, "1", receiver, currentAddress);
    try {
      let postAction = cosmos.getPostAction(bridgeInfo);
      expect(postAction).toEqual(expectedAction);
    } catch (err) {
      expect(err).toEqual(generateError(`Missing postAction for universalSwap on ${validPath.chainId}`));
    }
  });

  it("Valid path", () => {
    const nextMemo = "{}";
    let cosmos = new CosmosMsg(validPath, "1", receiver, currentAddress, nextMemo);

    let bridgeInfo = cosmos.getBridgeInfo();
    expect(bridgeInfo).toEqual({
      amount: "217432",
      sourceChannel: "channel-301",
      sourcePort: "transfer",
      memo: "{}",
      receiver: "orai1hvr9d72r5um9lvt0rpkd4r75vrsqtw6yujhqs2",
      timeout: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT),
      fromToken: "uatom",
      toToken: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
      fromChain: "cosmoshub-4",
      toChain: "Oraichain"
    });

    let memoAsMiddleware = cosmos.genMemoAsMiddleware();
    expect(memoAsMiddleware).toEqual({
      receiver: currentAddress,
      memo: JSON.stringify({
        forward: {
          receiver: receiver,
          port: bridgeInfo.sourcePort,
          channel: bridgeInfo.sourceChannel,
          timeout: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT),
          retries: 2,
          next: nextMemo
        }
      })
    });

    let executeMsg = cosmos.genExecuteMsg();
    expect(executeMsg).toEqual({
      typeUrl: "/ibc.applications.transfer.v1.MsgTransfer",
      value: {
        sourcePort: bridgeInfo.sourcePort,
        sourceChannel: bridgeInfo.sourceChannel,
        receiver: receiver,
        token: {
          amount: validPath.tokenInAmount,
          denom: validPath.tokenIn
        },
        sender: currentAddress,
        memo: nextMemo,
        timeoutTimestamp: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT)
      }
    });
  });

  it("Invalid path", () => {
    const nextMemo = "{}";
    const invalidPathNotBridgeAction = {
      chainId: "cosmoshub-4",
      tokenIn: "uatom",
      tokenInAmount: "217432",
      tokenOut: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
      tokenOutAmount: "217432",
      tokenOutChainId: "Oraichain",
      actions: [
        {
          type: "Swap",
          protocol: "Oraidex",
          tokenIn: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
          tokenInAmount: "217432",
          tokenOut: "orai",
          tokenOutAmount: "159680",
          swapInfo: [
            {
              poolId: "orai1jf74ry4m0jcy9emsaudkhe7vte9l8qy8enakvs",
              tokenOut: "orai"
            }
          ]
        }
      ]
    };

    let cosmos = new CosmosMsg(invalidPathNotBridgeAction, "1", receiver, currentAddress, nextMemo);

    try {
      cosmos.genMemoAsMiddleware();
    } catch (err) {
      expect(err).toEqual(generateError(`Only support bridge on ${invalidPathNotBridgeAction.chainId}`));
    }

    const invalidPathNotIbcTransfer = {
      chainId: "cosmoshub-4",
      tokenIn: "uatom",
      tokenInAmount: "217432",
      tokenOut: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
      tokenOutAmount: "217432",
      tokenOutChainId: "Oraichain",
      actions: [
        {
          type: "Bridge",
          protocol: "Bridge",
          tokenIn: "uatom",
          tokenInAmount: "217432",
          tokenOut: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
          tokenOutAmount: "217432",
          tokenOutChainId: "Oraichain",
          bridgeInfo: {
            port: "wasm.cosmos123",
            channel: "channel-301"
          }
        }
      ]
    };
    try {
      cosmos = new CosmosMsg(invalidPathNotIbcTransfer, "1", receiver, currentAddress, nextMemo);
      cosmos.genExecuteMsg();
    } catch (err) {
      expect(err).toEqual(generateError(`Only support IBC bridge on ${invalidPathNotBridgeAction.chainId}`));
    }
  });
});
