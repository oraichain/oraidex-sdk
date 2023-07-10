import {Addr, Uint128, Binary, AssetInfo, Decimal, Cw20ReceiveMsg, Asset} from "./types";
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
    asset_info: AssetInfo;
    staking_token: Addr;
  };
} | {
  deprecate_staking_token: {
    asset_info: AssetInfo;
    new_staking_token: Addr;
  };
} | {
  update_rewards_per_sec: {
    asset_info: AssetInfo;
    assets: Asset[];
  };
} | {
  deposit_reward: {
    rewards: Asset[];
  };
} | {
  unbond: {
    amount: Uint128;
    asset_info: AssetInfo;
  };
} | {
  withdraw: {
    asset_info?: AssetInfo | null;
  };
} | {
  withdraw_others: {
    asset_info?: AssetInfo | null;
    staker_addrs: Addr[];
  };
} | {
  auto_stake: {
    assets: [Asset, Asset];
    slippage_tolerance?: Decimal | null;
  };
} | {
  auto_stake_hook: {
    asset_info: AssetInfo;
    prev_staking_token_amount: Uint128;
    staker_addr: Addr;
    staking_token: Addr;
  };
} | {
  update_list_stakers: {
    asset_info: AssetInfo;
    stakers: Addr[];
  };
};
export type QueryMsg = {
  config: {};
} | {
  pool_info: {
    asset_info: AssetInfo;
  };
} | {
  rewards_per_sec: {
    asset_info: AssetInfo;
  };
} | {
  reward_info: {
    asset_info?: AssetInfo | null;
    staker_addr: Addr;
  };
} | {
  reward_infos: {
    asset_info: AssetInfo;
    limit?: number | null;
    order?: number | null;
    start_after?: Addr | null;
  };
};
export interface MigrateMsg {
  staker_addrs: Addr[];
}
export interface ConfigResponse {
  base_denom: string;
  factory_addr: Addr;
  oracle_addr: Addr;
  owner: Addr;
  rewarder: Addr;
}
export interface PoolInfoResponse {
  asset_info: AssetInfo;
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
export interface RewardInfoResponseItem {
  asset_info: AssetInfo;
  bond_amount: Uint128;
  pending_reward: Uint128;
  pending_withdraw: Asset[];
  should_migrate?: boolean | null;
}
export type ArrayOfRewardInfoResponse = RewardInfoResponse[];
export interface RewardsPerSecResponse {
  assets: Asset[];
}