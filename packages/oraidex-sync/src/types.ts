import { BlockHeader } from "@cosmjs/stargate";
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
  timestamp: string;
  txhash: string;
  txheight: number;
};

export type SwapOperationData = {
  askDenom: string;
  commissionAmount: number;
  offerAmount: number;
  offerDenom: string;
  returnAmount: number;
  spreadAmount: number;
  taxAmount: number;
} & BasicTxData;

export type VolumeData = {
  [k: string]: number;
};

export type TokenVolumeData = {
  offerDenom: string;
  askDenom: string;
  volume: VolumeData;
};

export type PairInfoData = {
  firstAssetInfo: string;
  secondAssetInfo: string;
  commissionRate: string;
  pairAddr: string;
  liquidityAddr: string;
  oracleAddr: string;
};

export type PriceInfo = {
  txheight: number;
  timestamp: string;
  assetInfo: string;
  price: number;
};

export type AccountTx = {
  accountAddress: string;
  txhash: string;
};

export type LiquidityOpType = "provide" | "withdraw";

export type ProvideLiquidityOperationData = {
  firstTokenAmount: number;
  firstTokenDenom: string;
  firstTokenLp: number;
  secondTokenAmount: number;
  secondTokenDenom: string;
  secondTokenLp: number;
  opType: LiquidityOpType;
  txCreator: string;
} & BasicTxData;

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
  symbols: [string, string];
};

export type InitialData = {
  tokenPrices: Asset[];
  blockHeader: BlockHeader;
};

export type PrefixSumHandlingData = {
  denom: string;
  amount: number;
};

export type TickerInfo = {
  base_currency: string;
  target_currency: string;
  last_price: string;
  base_volume: string;
  target_volume: string;
  ticker_id: string;
  base: string;
  target: string;
  pool_id: string;
};

export type TotalLiquidity = {
  time: string;
  liquidity: number;
};
