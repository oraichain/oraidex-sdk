import { TransferBackMsg } from "@oraichain/common-contracts-sdk/build/CwIcs20Latest.types";
import { Route, RouterResponse } from "../types";
import {
  Memo,
  Memo_IbcTransfer,
  Memo_IbcWasmTransfer,
  Memo_Route,
  Memo_SwapOperation,
  Memo_Transfer
} from "./universal_swap_memo";
import { IBC_TRANSFER_TIMEOUT } from "@oraichain/common";

// FIXME: either pass this as an argument or put this hard-coded value else where
export const SWAP_VENUE_NAME = "oraidex";

// TODO: write test cases
// currently, we are only support swap on Oraichain with exactly one route
// TODO: support multi-route +  universal swap on other dex
const convertApiOpsToMemoRoute = (route: Route) => {
  // no route => don't swap
  if (route.paths.length == 0) return;

  let returnOps: Memo_SwapOperation[] = [];
  if (route.paths.length != 1) {
    throw new Error("Only support swap on Oraichain!");
  }
  let actions = route.paths[0].actions;

  actions.forEach((action) => {
    if (action.type !== "Swap") {
      throw new Error("Only support swap on Oraichain!");
    }
    let denomIn = action.tokenIn;
    // next denom in = previous denom out
    if (!action.swapInfo) throw new Error("No swap info with action type Swap");
    returnOps.push(
      ...action.swapInfo.map((info) => {
        let tmp = denomIn;
        denomIn = info.tokenOut;
        return Memo_SwapOperation.fromPartial({ poolId: info.poolId, denomIn: tmp, denomOut: info.tokenOut });
      })
    );
  });
  let returnRoute = Memo_Route.fromPartial({ offerAmount: route.swapAmount, operations: returnOps });
  return returnRoute;
};

// TODO: write test cases
export const buildUniversalSwapMemo = (
  basic: {
    minimumReceive: string;
    recoveryAddr: string;
  },
  userSwap: RouterResponse = { returnAmount: "", routes: [], swapAmount: "" },
  postActionIbcWasmTransfer?: Memo_IbcWasmTransfer,
  postActionContractCall?: { contractAddress: string; msg: string },
  postActionIbcTransfer?: Memo_IbcTransfer,
  postActionTransfer?: Memo_Transfer
) => {
  const { minimumReceive, recoveryAddr } = basic;

  const routes = userSwap?.routes?.map((route) => convertApiOpsToMemoRoute(route)).filter((route) => route);
  const hasPostSwapAction =
    postActionContractCall === undefined &&
    postActionIbcTransfer === undefined &&
    postActionIbcWasmTransfer === undefined &&
    postActionTransfer === undefined;

  const memo = Memo.fromPartial({
    timeoutTimestamp: (Date.now() + IBC_TRANSFER_TIMEOUT * 1000) * 1000000, // nanoseconds
    recoveryAddr,
    postSwapAction: !hasPostSwapAction
      ? {
          ibcWasmTransferMsg: postActionIbcWasmTransfer,
          contractCall: postActionContractCall,
          ibcTransferMsg: postActionIbcTransfer,
          transferMsg: postActionTransfer
        }
      : undefined,
    userSwap:
      routes?.length > 0
        ? {
            smartSwapExactAssetIn: { routes },
            swapVenueName: SWAP_VENUE_NAME
          }
        : undefined,
    minimumReceive
  });
  console.dir(memo, { depth: null });
  const encodedMemo = Memo.encode(memo).finish();
  return Buffer.from(encodedMemo).toString("base64");
};

let user_swap: RouterResponse = {
  swapAmount: "1000",
  returnAmount: "1000",
  routes: [
    {
      swapAmount: "1000",
      returnAmount: "1000",
      paths: [
        {
          chainId: "Oraichain",
          tokenIn: "orai",
          tokenInAmount: "1000",
          tokenOut: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
          tokenOutAmount: "1000",
          tokenOutChainId: "Oraichain",
          actions: [
            {
              type: "Swap",
              tokenIn: "orai",
              tokenInAmount: "1000",
              tokenOut: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
              tokenOutAmount: "1000",
              swapInfo: [
                {
                  poolId: "orai1c5s03c3l336dgesne7dylnmhszw8554tsyy9yt",
                  tokenOut: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
};
