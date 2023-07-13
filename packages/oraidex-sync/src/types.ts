import { Log } from "@cosmjs/stargate/build/logs";
import { Tx } from "@oraichain/cosmos-rpc-sync";
import { Addr, Asset, AssetInfo, Binary, Decimal, SwapOperation, Uint128 } from "@oraichain/oraidex-contracts-sdk";
import { ExecuteMsg as OraiswapRouterExecuteMsg } from "@oraichain/oraidex-contracts-sdk/build/OraiswapRouter.types";
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";

export type AssetData = {
  info: AssetInfo;
  symbol: string;
  image: string;
  name: string;
};

export type BasicTxData = {
  txhash: string;
  timestamp: string;
};

export type SwapOperationData = BasicTxData & {
  offerDenom: string;
  offerAmount: string;
  askDenom: string;
  returnAmount: string;
  taxAmount: number;
  commissionAmount: number;
  spreadAmount: number;
};

export type AccountTx = {
  accountAddress: string;
  txhash: string;
};

export type LiquidityOpType = "provide" | "withdraw";

export type ProvideLiquidityOperationData = BasicTxData & {
  firstTokenAmount: number;
  firstTokenDenom: string;
  secondTokenAmount: number;
  secondTokenDenom: string;
  txCreator: string;
  opType: LiquidityOpType;
};

export type WithdrawLiquidityOperationData = ProvideLiquidityOperationData;

export type TxAnlysisResult = {
  // transactions: Tx[];
  swapOpsData: SwapOperationData[];
  accountTxs: AccountTx[];
  provideLiquidityOpsData: ProvideLiquidityOperationData[];
  withdrawLiquidityOpsData: WithdrawLiquidityOperationData[];
};

export type MsgExecuteContractWithLogs = MsgExecuteContract & {
  logs: Log;
};

export type ModifiedMsgExecuteContract = Omit<MsgExecuteContractWithLogs, "msg"> & {
  msg: MsgType;
};

export type MsgType =
  | {
      provide_liquidity: {
        assets: [Asset, Asset];
        receiver?: Addr | null;
        slippage_tolerance?: Decimal | null;
      };
    }
  | OraiswapRouterExecuteMsg
  | {
      send: {
        amount: Uint128;
        contract: string;
        msg: Binary;
      };
    }
  | OraiswapRouterCw20HookMsg
  | OraiswapPairCw20HookMsg;

export type OraiswapRouterCw20HookMsg = {
  execute_swap_operations: {
    minimum_receive?: Uint128 | null;
    operations: SwapOperation[];
    to?: Addr | null;
  };
};

export type OraiswapPairCw20HookMsg = {
  withdraw_liquidity: {};
};
export type PairMapping = {
  asset_infos: [AssetInfo, AssetInfo];
};
