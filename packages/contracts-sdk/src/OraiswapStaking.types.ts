import {Addr, Uint128, Binary, AssetInfo, Decimal, Cw20ReceiveMsg, Asset, RewardMsg, RewardInfoResponseItem} from "./types";
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
    migrate_store_status?: boolean | null;
    owner?: Addr | null;
    rewarder?: Addr | null;
  };
} | {
  register_asset: {
    staking_token: Addr;
  };
} | {
  deprecate_staking_token: {
    new_staking_token: Addr;
    staking_token: Addr;
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
  query_old_store: {
    store_type: OldStoreType;
  };
};
export type OldStoreType = {
  pools: {};
} | {
  stakers: {
    asset_info: AssetInfo;
  };
} | {
  rewards: {
    staker: string;
  };
} | {
  is_migrated: {
    staker: string;
  };
} | {
  rewards_per_sec: {};
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
  migration_deprecated_staking_token?: Addr | null;
  migration_index_snapshot?: Decimal | null;
  pending_reward: Uint128;
  reward_index: Decimal;
  staking_token: Addr;
  total_bond_amount: Uint128;
}
export interface RewardInfoResponse {
  reward_infos: RewardInfoResponseItem[];
  staker_addr: Addr;
}
export type ArrayOfRewardInfoResponse = RewardInfoResponse[];
export interface RewardsPerSecResponse {
  assets: Asset[];
}