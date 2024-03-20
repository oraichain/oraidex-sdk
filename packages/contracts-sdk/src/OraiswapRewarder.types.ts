import {Addr, Uint128} from "./types";
export interface InstantiateMsg {
  distribution_interval?: number | null;
  staking_contract: Addr;
}
export type ExecuteMsg = {
  update_config: {
    distribution_interval?: number | null;
    owner?: Addr | null;
    staking_contract?: Addr | null;
  };
} | {
  distribute: {
    staking_tokens: Addr[];
  };
};
export type QueryMsg = {
  config: {};
} | {
  distribution_info: {
    staking_token: Addr;
  };
} | {
  reward_amount_per_sec: {
    staking_token: Addr;
  };
};
export interface MigrateMsg {}
export interface ConfigResponse {
  distribution_interval: number;
  owner: Addr;
  staking_contract: Addr;
}
export interface DistributionInfoResponse {
  last_distributed: number;
}
export interface RewardAmountPerSecondResponse {
  reward_amount: Uint128;
}