import { TransferBackMsg } from "@oraichain/common-contracts-sdk/build/CwIcs20Latest.types";
import { QuerySmartRouteArgs, SmartRouteSwapAPIOperations } from "../types";
import { Memo, Memo_Route, Memo_SwapOperation } from "./universal_swap_memo";
import { IBC_TRANSFER_TIMEOUT } from "@oraichain/common";
import { UniversalSwapHelper } from "../helper";

// FIXME: either pass this as an argument or put this hard-coded value else where
export const SWAP_VENUE_NAME = "universal-swap";

// TODO: write test cases
const convertApiOpsToMemoRoute = (sourceAsset: string, route: SmartRouteSwapAPIOperations) => {
  let returnOps: Memo_SwapOperation[] = [];
  for (let i = 0; i < route.paths.length; i++) {
    const path = route.paths[i];
    let denomIn = sourceAsset;
    // next denom in = previous denom out
    if (i !== 0) denomIn = returnOps[i - 1].denomOut;
    returnOps.push(Memo_SwapOperation.fromPartial({ poolId: path.poolId, denomIn, denomOut: path.tokenOut }));
  }
  let returnRoute = Memo_Route.fromPartial({ offerAmount: route.swapAmount, operations: returnOps });
  return returnRoute;
};

// TODO: write test cases
export const buildUniversalSwapMemo = async (
  basic: {
    minimumReceive: string;
    recoveryAddr: string;
    destReceiver: string;
  },
  userSwap: QuerySmartRouteArgs,
  postActionIbcWasmTransfer?: TransferBackMsg,
  postActionContractCall?: { contractAddress: string; msg: string }
) => {
  const { minimumReceive, recoveryAddr } = basic;
  const smartRouterResponse = await UniversalSwapHelper.generateSmartRouteForSwap(userSwap);
  const routes = smartRouterResponse.routes.map((route) => convertApiOpsToMemoRoute(userSwap.sourceAsset, route));
  const memo = Memo.fromPartial({
    timeoutTimestamp: IBC_TRANSFER_TIMEOUT,
    recoveryAddr,
    postSwapAction: {
      ibcWasmTransferMsg: {
        localChannelId: postActionIbcWasmTransfer.local_channel_id,
        remoteAddress: basic.destReceiver,
        remoteDenom: postActionIbcWasmTransfer.remote_denom,
        memo: postActionIbcWasmTransfer.memo,
        timeout: IBC_TRANSFER_TIMEOUT
      },
      contractCall: postActionContractCall
    },
    userSwap: {
      smartSwapExactAssetIn: { routes },
      swapVenueName: SWAP_VENUE_NAME
    },
    minimumReceive
  });
  const encodedMemo = Memo.encode(memo).finish();
  return Buffer.from(encodedMemo).toString("base64");
};
