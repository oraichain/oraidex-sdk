import { Log } from "@cosmjs/stargate/build/logs";
import { Addr, Asset, AssetInfo, Binary, Decimal, Uint128 } from "@oraichain/oraidex-contracts-sdk";
import { SwapOperation } from "@oraichain/oraidex-contracts-sdk/build/OraiswapRouter.types";
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
  basePoolAmount?: number | bigint;
  quotePoolAmount?: number | bigint;
} & BasicTxData;

export type EarningOperationData = {
  uniqueKey: string; // concat of txheight, stakeAmount, stakerAddress, and stakeAssetDenom => should be unique
  stakerAddress: string;
  rewardAssetDenom: string;
  earnAmount: bigint;
  earnAmountInUsdt: number;
  stakingAssetPrice: number;
  stakingAssetDenom: string;
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
  symbols: string;
  fromIconUrl: string;
  toIconUrl: string;
};

export type PairInfoDataResponse = PairInfoData & {
  apr: number;
  totalLiquidity: number;
  volume24Hour: string;
  fee7Days: string;
  offerPoolAmount: bigint;
  askPoolAmount: bigint;
  totalSupply: string;
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
  baseTokenAmount: bigint;
  baseTokenDenom: string; // eg: orai, orai1234...
  quoteTokenAmount: bigint;
  quoteTokenDenom: string;
  opType: LiquidityOpType;
  uniqueKey: string; // concat of first, second denom, amount, and timestamp => should be unique. unique key is used to override duplication only.
  txCreator: string;
  taxRate: number | bigint;
} & BasicTxData;

export type WithdrawLiquidityOperationData = ProvideLiquidityOperationData;

export type OraiDexType =
  | SwapOperationData
  | ProvideLiquidityOperationData
  | WithdrawLiquidityOperationData
  | Ohlcv
  | EarningOperationData;

export type LpOpsData = {
  baseTokenAmount: bigint;
  baseTokenDenom: string; // eg: orai, orai1234...
  quoteTokenAmount: bigint;
  quoteTokenDenom: string;
  opType?: LiquidityOpType;
  direction?: SwapDirection;
  height: number;
  timestamp: number;
};

export type TxAnlysisResult = {
  // transactions: Tx[];
  swapOpsData: SwapOperationData[];
  ohlcv: Ohlcv[];
  accountTxs: AccountTx[];
  provideLiquidityOpsData: ProvideLiquidityOperationData[];
  withdrawLiquidityOpsData: WithdrawLiquidityOperationData[];
  claimOpsData: EarningOperationData[];
  poolAmountHistories: PoolAmountHistory[];
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
  | OraiswapPairCw20HookMsg
  | {
      withdraw: {
        staking_token: Addr;
      };
    };
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
  lp_token: string;
  symbols: [string, string];
  factoryV1?: boolean;
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

export type SummaryInfo = {
  base_currency: string;
  quote_currency: string;
  last_price: number;
  base_volume: number;
  quote_volume: number;
  trading_pairs: string;
  lowest_ask: number;
  highest_bid: number;
  price_change_percent_24h: number;
  highest_price_24h: number;
  lowest_price_24h: number;
};

export type TotalLiquidity = {
  time: string;
  liquidity: number;
  height: number;
};

export type Env = {
  PORT: number;
  RPC_URL: string;
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

export type GetPriceAssetByUsdt = {
  denom?: string;
  contractAddress?: string;
};

export type GetFeeSwap = {
  offerDenom: string;
  askDenom: string;
  startTime: number;
  endTime: number;
};

export type GetVolumeQuery = Omit<GetCandlesQuery, "tf">;

export type PoolInfo = {
  offerPoolAmount: bigint;
  askPoolAmount: bigint;
};

export type PoolAmountHistory = {
  timestamp: number;
  height: number;
  pairAddr: string;
  uniqueKey: string;
  totalShare: string;
} & PoolInfo;

export type PoolApr = {
  uniqueKey: string;
  pairAddr: string;
  height: number;
  totalSupply: string;
  totalBondAmount: string;
  rewardPerSec: string;
  apr: number;
  timestamp: number;
};

export type GetPricePairQuery = {
  base_denom: string;
  quote_denom: string;
  tf?: number;
};

export type GetStakedByUserQuery = {
  stakerAddress: string;
  tf?: number;
  pairDenoms?: string;
};

export type GetPoolDetailQuery = {
  pairDenoms: string;
};

export type StakeByUserResponse = Pick<EarningOperationData, "stakingAssetDenom" | "earnAmountInUsdt">;
