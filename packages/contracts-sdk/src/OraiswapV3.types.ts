export type Percentage = number;
export interface InstantiateMsg {
  protocol_fee: Percentage;
}
export type ExecuteMsg = {
  change_admin: {
    new_admin: Addr;
  };
} | {
  withdraw_protocol_fee: {
    pool_key: PoolKey;
  };
} | {
  change_protocol_fee: {
    protocol_fee: Percentage;
  };
} | {
  change_fee_receiver: {
    fee_receiver: Addr;
    pool_key: PoolKey;
  };
} | {
  create_position: {
    liquidity_delta: Liquidity;
    lower_tick: number;
    pool_key: PoolKey;
    slippage_limit_lower: SqrtPrice;
    slippage_limit_upper: SqrtPrice;
    upper_tick: number;
  };
} | {
  swap: {
    amount: TokenAmount;
    by_amount_in: boolean;
    pool_key: PoolKey;
    sqrt_price_limit: SqrtPrice;
    x_to_y: boolean;
  };
} | {
  swap_route: {
    amount_in: TokenAmount;
    expected_amount_out: TokenAmount;
    slippage: Percentage;
    swaps: SwapHop[];
  };
} | {
  transfer_position: {
    index: number;
    receiver: string;
  };
} | {
  claim_fee: {
    index: number;
  };
} | {
  remove_position: {
    index: number;
  };
} | {
  create_pool: {
    fee_tier: FeeTier;
    init_sqrt_price: SqrtPrice;
    init_tick: number;
    token_0: string;
    token_1: string;
  };
} | {
  add_fee_tier: {
    fee_tier: FeeTier;
  };
} | {
  remove_fee_tier: {
    fee_tier: FeeTier;
  };
} | {
  transfer_nft: {
    recipient: Addr;
    token_id: number;
  };
} | {
  mint: {
    extension: NftExtensionMsg;
  };
} | {
  burn: {
    token_id: number;
  };
} | {
  send_nft: {
    contract: Addr;
    msg?: Binary | null;
    token_id: number;
  };
} | {
  approve: {
    expires?: Expiration | null;
    spender: Addr;
    token_id: number;
  };
} | {
  revoke: {
    spender: Addr;
    token_id: number;
  };
} | {
  approve_all: {
    expires?: Expiration | null;
    operator: Addr;
  };
} | {
  revoke_all: {
    operator: Addr;
  };
} | {
  create_incentive: {
    pool_key: PoolKey;
    reward_per_sec: TokenAmount;
    reward_token: AssetInfo;
    start_timestamp?: number | null;
    total_reward?: TokenAmount | null;
  };
} | {
  update_incentive: {
    incentive_id: number;
    pool_key: PoolKey;
    remaining_reward?: TokenAmount | null;
    reward_per_sec?: TokenAmount | null;
    start_timestamp?: number | null;
  };
} | {
  claim_incentive: {
    index: number;
  };
};
export type Addr = string;
export type Liquidity = string;
export type SqrtPrice = string;
export type TokenAmount = string;
export type Binary = string;
export type Expiration = {
  at_height: number;
} | {
  at_time: Timestamp;
} | {
  never: {};
};
export type Timestamp = Uint64;
export type Uint64 = string;
export type AssetInfo = {
  token: {
    contract_addr: Addr;
  };
} | {
  native_token: {
    denom: string;
  };
};
export interface PoolKey {
  fee_tier: FeeTier;
  token_x: string;
  token_y: string;
}
export interface FeeTier {
  fee: Percentage;
  tick_spacing: number;
}
export interface SwapHop {
  pool_key: PoolKey;
  x_to_y: boolean;
}
export interface NftExtensionMsg {
  liquidity_delta: Liquidity;
  lower_tick: number;
  pool_key: PoolKey;
  slippage_limit_lower: SqrtPrice;
  slippage_limit_upper: SqrtPrice;
  upper_tick: number;
}
export type QueryMsg = {
  admin: {};
} | {
  protocol_fee: {};
} | {
  position: {
    index: number;
    owner_id: Addr;
  };
} | {
  positions: {
    limit?: number | null;
    offset?: number | null;
    owner_id: Addr;
  };
} | {
  all_position: {
    limit?: number | null;
    start_after?: Binary | null;
  };
} | {
  fee_tier_exist: {
    fee_tier: FeeTier;
  };
} | {
  pool: {
    fee_tier: FeeTier;
    token_0: string;
    token_1: string;
  };
} | {
  pools: {
    limit?: number | null;
    start_after?: PoolKey | null;
  };
} | {
  tick: {
    index: number;
    key: PoolKey;
  };
} | {
  is_tick_initialized: {
    index: number;
    key: PoolKey;
  };
} | {
  fee_tiers: {};
} | {
  position_ticks: {
    offset: number;
    owner: Addr;
  };
} | {
  user_position_amount: {
    owner: Addr;
  };
} | {
  tick_map: {
    lower_tick_index: number;
    pool_key: PoolKey;
    upper_tick_index: number;
    x_to_y: boolean;
  };
} | {
  liquidity_ticks: {
    pool_key: PoolKey;
    tick_indexes: number[];
  };
} | {
  liquidity_ticks_amount: {
    lower_tick: number;
    pool_key: PoolKey;
    upper_tick: number;
  };
} | {
  pools_for_pair: {
    token_0: string;
    token_1: string;
  };
} | {
  quote: {
    amount: TokenAmount;
    by_amount_in: boolean;
    pool_key: PoolKey;
    sqrt_price_limit: SqrtPrice;
    x_to_y: boolean;
  };
} | {
  quote_route: {
    amount_in: TokenAmount;
    swaps: SwapHop[];
  };
} | {
  num_tokens: {};
} | {
  owner_of: {
    include_expired?: boolean | null;
    token_id: number;
  };
} | {
  approved_for_all: {
    include_expired?: boolean | null;
    limit?: number | null;
    owner: Addr;
    start_after?: Addr | null;
  };
} | {
  nft_info: {
    token_id: number;
  };
} | {
  all_nft_info: {
    include_expired?: boolean | null;
    token_id: number;
  };
} | {
  tokens: {
    limit?: number | null;
    owner: Addr;
    start_after?: number | null;
  };
} | {
  all_tokens: {
    limit?: number | null;
    start_after?: number | null;
  };
} | {
  position_incentives: {
    index: number;
    owner_id: Addr;
  };
} | {
  pools_by_pool_keys: {
    pool_keys: PoolKey[];
  };
};
export interface MigrateMsg {}
export type FeeGrowth = string;
export interface AllNftInfoResponse {
  access: OwnerOfResponse;
  info: NftInfoResponse;
}
export interface OwnerOfResponse {
  approvals: Approval[];
  owner: Addr;
}
export interface Approval {
  expires: Expiration;
  spender: Addr;
}
export interface NftInfoResponse {
  extension: Position;
}
export interface Position {
  approvals?: Approval[];
  fee_growth_inside_x: FeeGrowth;
  fee_growth_inside_y: FeeGrowth;
  incentives?: PositionIncentives[];
  last_block_number: number;
  liquidity: Liquidity;
  lower_tick_index: number;
  pool_key: PoolKey;
  token_id?: number;
  tokens_owed_x: TokenAmount;
  tokens_owed_y: TokenAmount;
  upper_tick_index: number;
}
export interface PositionIncentives {
  incentive_growth_inside: FeeGrowth;
  incentive_id: number;
  pending_rewards: TokenAmount;
}
export type ArrayOfPosition = Position[];
export interface TokensResponse {
  tokens: number[];
}
export interface ApprovedForAllResponse {
  operators: Approval[];
}
export type Boolean = boolean;
export type ArrayOfFeeTier = FeeTier[];
export type ArrayOfLiquidityTick = LiquidityTick[];
export interface LiquidityTick {
  index: number;
  liquidity_change: Liquidity;
  sign: boolean;
}
export type Uint32 = number;
export interface NumTokensResponse {
  count: number;
}
export interface Pool {
  current_tick_index: number;
  fee_growth_global_x: FeeGrowth;
  fee_growth_global_y: FeeGrowth;
  fee_protocol_token_x: TokenAmount;
  fee_protocol_token_y: TokenAmount;
  fee_receiver: string;
  incentives?: IncentiveRecord[];
  last_timestamp: number;
  liquidity: Liquidity;
  sqrt_price: SqrtPrice;
  start_timestamp: number;
}
export interface IncentiveRecord {
  id: number;
  incentive_growth_global: FeeGrowth;
  last_updated: number;
  remaining: TokenAmount;
  reward_per_sec: TokenAmount;
  reward_token: AssetInfo;
  start_timestamp: number;
}
export type ArrayOfPoolWithPoolKey = PoolWithPoolKey[];
export interface PoolWithPoolKey {
  pool: Pool;
  pool_key: PoolKey;
}
export type Uint128 = string;
export type ArrayOfAsset = Asset[];
export interface Asset {
  amount: Uint128;
  info: AssetInfo;
}
export type ArrayOfPositionTick = PositionTick[];
export interface PositionTick {
  fee_growth_outside_x: FeeGrowth;
  fee_growth_outside_y: FeeGrowth;
  index: number;
  seconds_outside: number;
}
export interface QuoteResult {
  amount_in: TokenAmount;
  amount_out: TokenAmount;
  target_sqrt_price: SqrtPrice;
  ticks: Tick[];
}
export interface Tick {
  fee_growth_outside_x: FeeGrowth;
  fee_growth_outside_y: FeeGrowth;
  incentives?: TickIncentive[];
  index: number;
  liquidity_change: Liquidity;
  liquidity_gross: Liquidity;
  seconds_outside: number;
  sign: boolean;
  sqrt_price: SqrtPrice;
}
export interface TickIncentive {
  incentive_growth_outside: FeeGrowth;
  incentive_id: number;
}
export type ArrayOfTupleOfUint16AndUint64 = [number, number][];