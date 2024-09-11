import {
  Addr,
  Uint128,
  Binary,
  AssetInfo,
  Decimal,
  Cw20ReceiveMsg,
  Asset,
  RewardMsg,
  RewardInfoResponseItem
} from "./types";
export interface InstantiateMsg {
  owner?: Addr | null;
  rewarder: Addr;
  withdraw_fee_receiver: Addr;
}
export type ExecuteMsg =
  | {
      receive: Cw20ReceiveMsg;
    }
  | {
      update_config: {
        owner?: Addr | null;
        rewarder?: Addr | null;
        withdraw_fee_receiver?: Addr | null;
      };
    }
  | {
      update_unbonding_period: {
        staking_token: Addr;
        unbonding_period: number;
      };
    }
  | {
      register_asset: {
        staking_token: Addr;
        unbonding_period?: number | null;
      };
    }
  | {
      update_rewards_per_sec: {
        assets: Asset[];
        staking_token: Addr;
      };
    }
  | {
      deposit_reward: {
        rewards: RewardMsg[];
      };
    }
  | {
      unbond: {
        amount: Uint128;
        staking_token: Addr;
        unbond_period?: number | null;
      };
    }
  | {
      withdraw: {
        staking_token?: Addr | null;
      };
    }
  | {
      withdraw_others: {
        staker_addrs: Addr[];
        staking_token?: Addr | null;
      };
    }
  | {
      restake: {
        staking_token: Addr;
      };
    }
  | {
      update_unbond_option: {
        fee: Decimal;
        period: number;
        staking_token: Addr;
      };
    }
  | {
      remove_unbond_option: {
        period: number;
        staking_token: Addr;
      };
    };
export type QueryMsg =
  | {
      config: {};
    }
  | {
      pool_info: {
        staking_token: Addr;
      };
    }
  | {
      rewards_per_sec: {
        staking_token: Addr;
      };
    }
  | {
      reward_info: {
        staker_addr: Addr;
        staking_token?: Addr | null;
      };
    }
  | {
      reward_infos: {
        limit?: number | null;
        order?: number | null;
        staking_token: Addr;
        start_after?: Addr | null;
      };
    }
  | {
      get_pools_information: {};
    }
  | {
      lock_infos: {
        limit?: number | null;
        order?: number | null;
        staker_addr: Addr;
        staking_token: Addr;
        start_after?: number | null;
      };
    }
  | {
      staked_balance_at_height: {
        address: string;
        asset_key: Addr;
        height?: number | null;
      };
    }
  | {
      total_staked_at_height: {
        asset_key: Addr;
        height?: number | null;
      };
    }
  | {
      unbond_fee: {
        period: number;
        staking_token: Addr;
      };
    }
  | {
      unbond_options: {
        staking_token: Addr;
      };
    };
export interface MigrateMsg {
  owner: Addr;
  rewarder: Addr;
  withdraw_fee_receiver: Addr;
}
export interface ConfigResponse {
  owner: Addr;
  rewarder: Addr;
  withdraw_fee_receiver: Addr;
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
  unbonding_period?: number | null;
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
export type ArrayOfRewardInfoResponse = RewardInfoResponse[];
export interface RewardsPerSecResponse {
  assets: Asset[];
}
export interface StakedBalanceAtHeightResponse {
  balance: Uint128;
  height: number;
}
export interface TotalStakedAtHeightResponse {
  height: number;
  total: Uint128;
}
export type ArrayOfUnbondOptionResponse = UnbondOptionResponse[];
export interface UnbondOptionResponse {
  fee: Decimal;
  period: number;
}
