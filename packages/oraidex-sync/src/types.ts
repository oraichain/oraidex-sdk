import { Log } from "@cosmjs/stargate/build/logs";
import { Tx } from "@oraichain/cosmos-rpc-sync";
import { Asset, AssetInfo, Decimal } from "@oraichain/oraidex-contracts-sdk";
import { ExecuteMsg as OraiswapPairExecuteMsg } from "@oraichain/oraidex-contracts-sdk/build/OraiswapPair.types";
import { ExecuteMsg as OraiswapTokenMsg } from "@oraichain/oraidex-contracts-sdk/build/OraiswapToken.types";
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";

export type AssetData = {
  info: AssetInfo;
  symbol: string;
  image: string;
  name: string;
};

export type SwapOperationData = {
  txhash: string;
  offerAsset: Asset;
  askAsset: Asset;
  taxAmount: number;
  commissionAmount: number;
  spreadAmount: number;
};

export type AccountTx = {
  accountAddress: string;
  txhash: string;
};

export type ProvideLiquidityOperationData = {
  txhash: string;
  firstTokenAsset: Asset;
  secondTokenAsset: Asset;
  provider: string;
};

export type TxAnlysisResult = {
  pairAssets: Asset[][];
  transactions: Tx[];
  swapOpsData: SwapOperationData[];
  accountTxs: AccountTx[];
  provideLiquidityOpsData: ProvideLiquidityOperationData[];
  withdrawLiquidityOpsData: WithdrawLiquidityOperationData[];
};

export type MsgExecuteContractWithLogs = MsgExecuteContract & {
  logs: Log;
};

export type ModifiedMsgExecuteContract = Omit<
  MsgExecuteContractWithLogs,
  "msg"
> & {
  msg: MsgType;
};

export type MsgType =
  | OraiswapPairExecuteMsg
  | OraiswapTokenMsg
  | OraiswapPairCw20HookMsg;

export type WithdrawLiquidityOperationData = ProvideLiquidityOperationData;

export type OraiswapPairCw20HookMsg = {
  swap:
    | { belief_price?: Decimal; max_spread?: Decimal; to?: string }
    | { withdraw_liquidity: {} };
};
