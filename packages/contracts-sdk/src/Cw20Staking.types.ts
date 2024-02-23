export type Addr = string;
export interface InstantiateMsg {
  base_denom?: string | null;
  factory_addr: Addr;
  minter?: Addr | null;
  oracle_addr: Addr;
  owner?: Addr | null;
  rewarder: Addr;
}
export type ExecuteMsg = {
  receive: Cw20ReceiveMsg;
} | {
  update_config: {
    owner?: Addr | null;
    rewarder?: Addr | null;
  };
} | {
  register_asset: {
    staking_token: Addr;
    unbonding_period?: number | null;
  };
} | {
  update_rewards_per_sec: {
    assets: Asset[];
    staking_token: Addr;
  };
} | {
  deposit_reward: {
    rewards: RewardMsg[];
  };
} | {
  unbond: {
    amount: Uint128;
    staking_token: Addr;
  };
} | {
  withdraw: {
    staking_token?: Addr | null;
  };
} | {
  withdraw_others: {
    staker_addrs: Addr[];
    staking_token?: Addr | null;
  };
} | {
  auto_stake: {
    assets: [Asset, Asset];
    slippage_tolerance?: Decimal | null;
  };
} | {
  auto_stake_hook: {
    prev_staking_token_amount: Uint128;
    staker_addr: Addr;
    staking_token: Addr;
  };
};
export type Uint128 = string;
export type Binary = string;
export type AssetInfo = {
  token: {
    contract_addr: Addr;
  };
} | {
  native_token: {
    denom: string;
  };
};
export type Decimal = string;
export interface Cw20ReceiveMsg {
  amount: Uint128;
  msg: Binary;
  sender: string;
}
export interface Asset {
  amount: Uint128;
  info: AssetInfo;
}
export interface RewardMsg {
  staking_token: Addr;
  total_accumulation_amount: Uint128;
}
export type QueryMsg = {
  config: {};
} | {
  pool_info: {
    staking_token: Addr;
  };
} | {
  rewards_per_sec: {
    staking_token: Addr;
  };
} | {
  reward_info: {
    staker_addr: Addr;
    staking_token?: Addr | null;
  };
} | {
  reward_infos: {
    limit?: number | null;
    order?: number | null;
    staking_token: Addr;
    start_after?: Addr | null;
  };
} | {
  get_pools_information: {};
} | {
  lock_infos: {
    limit?: number | null;
    order?: number | null;
    staker_addr: Addr;
    staking_token: Addr;
    start_after?: number | null;
  };
};
export interface MigrateMsg {}
export interface ConfigResponse {
  base_denom: string;
  factory_addr: Addr;
  oracle_addr: Addr;
  owner: Addr;
  rewarder: Addr;
}
export type ArrayOfQueryPoolInfoResponse = QueryPoolInfoResponse[];
export interface QueryPoolInfoResponse {
  asset_key: string;
  pool_info: PoolInfoResponse;
}
export interface PoolInfoResponse {
  pending_reward: Uint128;
  reward_index: Decimal;
  staking_token: Addr;
  total_bond_amount: Uint128;
}
export interface LockInfosResponse {
  lock_infos: LockInfoResponse[];
  staker_addr: Addr;
  staking_token: Addr;
}
export interface LockInfoResponse {
  amount: Uint128;
  unlock_time: number;
}
export interface RewardInfoResponse {
  reward_infos: RewardInfoResponseItem[];
  staker_addr: Addr;
}
export interface RewardInfoResponseItem {
  bond_amount: Uint128;
  pending_reward: Uint128;
  pending_withdraw: Asset[];
  staking_token: Addr;
}
export type ArrayOfRewardInfoResponse = RewardInfoResponse[];
export interface RewardsPerSecResponse {
  assets: Asset[];
}