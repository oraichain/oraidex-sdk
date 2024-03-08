import {Addr, Uint128} from "./types";
export interface InstantiateMsg {
  asset_key: Addr;
  owner?: Addr | null;
  staking_contract: Addr;
}
export type ExecuteMsg = {
  update_config: {
    asset_key?: Addr | null;
    owner?: Addr | null;
    staking_contract?: Addr | null;
  };
};
export type QueryMsg = {
  get_config: {};
} | {
  config: {};
} | {
  staked_balance_at_height: {
    address: string;
    height?: number | null;
  };
} | {
  total_staked_at_height: {
    height?: number | null;
  };
};
export interface MigrateMsg {}
export interface ConfigResponse {
  asset_key: Addr;
  owner: Addr;
  staking_contract: Addr;
}
export type Duration = {
  height: number;
} | {
  time: number;
};
export interface ConfigTokenStakingResponse {
  token_address: Addr;
  unstaking_duration?: Duration | null;
}
export interface StakedBalanceAtHeightResponse {
  balance: Uint128;
  height: number;
}
export interface TotalStakedAtHeightResponse {
  height: number;
  total: Uint128;
}