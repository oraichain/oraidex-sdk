import { TransferBackMsg } from "@oraichain/common-contracts-sdk/build/CwIcs20Latest.types";
import { QuerySmartRouteArgs, Route, RouterResponse } from "../types";
import { Memo, Memo_IbcTransfer, Memo_IbcWasmTransfer, Memo_Route, Memo_SwapOperation } from "./universal_swap_memo";
import { IBC_TRANSFER_TIMEOUT } from "@oraichain/common";
import { UniversalSwapHelper } from "../helper";

// FIXME: either pass this as an argument or put this hard-coded value else where
export const SWAP_VENUE_NAME = "universal-swap";

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
export const buildUniversalSwapMemo = async (
  basic: {
    minimumReceive: string;
    recoveryAddr: string;
  },
  userSwap: RouterResponse,
  postActionIbcWasmTransfer?: Memo_IbcWasmTransfer,
  postActionContractCall?: { contractAddress: string; msg: string },
  postActionIbcTransfer?: Memo_IbcTransfer
) => {
  const { minimumReceive, recoveryAddr } = basic;

  const routes = userSwap.routes.map((route) => convertApiOpsToMemoRoute(route));

  const memo = Memo.fromPartial({
    timeoutTimestamp: IBC_TRANSFER_TIMEOUT,
    recoveryAddr,
    postSwapAction: {
      ibcWasmTransferMsg: postActionIbcWasmTransfer,
      contractCall: postActionContractCall,
      ibcTransferMsg: postActionIbcTransfer
    },
    userSwap: routes
      ? {
          smartSwapExactAssetIn: { routes },
          swapVenueName: SWAP_VENUE_NAME
        }
      : undefined,
    minimumReceive
  });
  const encodedMemo = Memo.encode(memo).finish();
  return Buffer.from(encodedMemo).toString("base64");
};
