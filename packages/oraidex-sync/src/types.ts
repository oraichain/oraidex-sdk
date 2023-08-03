import { BlockHeader } from "@cosmjs/stargate";
import { Log } from "@cosmjs/stargate/build/logs";
import { Addr, Asset, AssetInfo, Binary, Decimal, SwapOperation, Uint128 } from "@oraichain/oraidex-contracts-sdk";
import { ExecuteMsg as OraiswapRouterExecuteMsg } from "@oraichain/oraidex-contracts-sdk/build/OraiswapRouter.types";
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";

export type SwapDirection = "Buy" | "Sell";

export type BasicTxData = {
  timestamp: number;
  txhash: string;
  txheight: number;
};

export type SwapOperationData = {
  askDenom: string; // eg: orai, orai1234...
  commissionAmount: number;
  direction: SwapDirection;
  offerAmount: number | bigint;
  offerDenom: string;
  uniqueKey: string; // concat of offer, ask denom, amount, and timestamp => should be unique
  returnAmount: number | bigint;
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
  timestamp: number;
  assetInfo: string;
  price: number;
};

export type AccountTx = {
  accountAddress: string;
  txhash: string;
};

export type LiquidityOpType = "provide" | "withdraw";

export type ProvideLiquidityOperationData = {
  basePrice: number;
  baseTokenAmount: number;
  baseTokenDenom: string; // eg: orai, orai1234...
  baseTokenReserve: number | bigint;
  quoteTokenAmount: number;
  quoteTokenDenom: string;
  quoteTokenReserve: number | bigint;
  opType: LiquidityOpType;
  uniqueKey: string; // concat of first, second denom, amount, and timestamp => should be unique. unique key is used to override duplication only.
  txCreator: string;
} & BasicTxData;

export type WithdrawLiquidityOperationData = ProvideLiquidityOperationData;

export type OraiDexType = SwapOperationData | ProvideLiquidityOperationData | WithdrawLiquidityOperationData | Ohlcv;

export type TxAnlysisResult = {
  // transactions: Tx[];
  swapOpsData: SwapOperationData[];
  ohlcv: Ohlcv[];
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
  height: number;
};

export type Env = {
  PORT: number;
  RPC_URL: string;
  FACTORY_CONTACT_ADDRESS_V1: string;
  FACTORY_CONTACT_ADDRESS_V2: string;
  ROUTER_CONTRACT_ADDRESS: string;
  MULTICALL_CONTRACT_ADDRESS: string;
  LIMIT: number;
  MAX_THREAD_LEVEL: number;
  DUCKDB_PROD_FILENAME: string;
  DUCKDB_FILENAME: string;
  INITIAL_SYNC_HEIGHT: number;
};

export interface Ohlcv {
  uniqueKey: string; // concat of timestamp, pair and volume. Only use to override potential duplication when inserting
  timestamp: number;
  pair: string;
  volume: bigint; // base volume
  open: number;
  close: number; // base price
  low: number;
  high: number;
}

export type VolumeRange = {
  time: string;
  pair: string;
  baseVolume: bigint;
  quoteVolume: bigint;
  basePrice: number;
};

export type GetCandlesQuery = {
  pair: string;
  tf: number;
  startTime: number;
  endTime: number;
};
