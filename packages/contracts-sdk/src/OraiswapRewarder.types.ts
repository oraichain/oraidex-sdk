import {Addr, AssetInfo, Uint128} from "./types";
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
    asset_infos: AssetInfo[];
  };
};
export type QueryMsg = {
  config: {};
} | {
  distribution_info: {
    asset_info: AssetInfo;
  };
} | {
  reward_amount_per_sec: {
    asset_info: AssetInfo;
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