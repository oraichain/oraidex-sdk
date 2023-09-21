import {Uint128, AssetInfo, Addr, Logo, EmbeddedLogo, Binary, Asset, InstantiateMarketingInfo} from "./types";
export interface InstantiateMsg {
  cw20_code_id: number;
  factory_addr: string;
}
export type ExecuteMsg = {
  list_token: ListTokenMsg;
};
export interface ListTokenMsg {
  label?: string | null;
  liquidity_pool_reward_assets: Asset[];
  marketing?: InstantiateMarketingInfo | null;
  mint?: MinterResponse | null;
  symbol: string;
}
export interface MinterResponse {
  cap?: Uint128 | null;
  minter: string;
}
export type QueryMsg = {
  config: {};
};
export interface MigrateMsg {}
export interface Config {
  cw20_code_id: number;
  factory_addr: Addr;
  owner: Addr;
}