import {Uint128, AssetInfo, Addr, Logo, EmbeddedLogo, Binary, Cw20Coin, Asset, InstantiateMarketingInfo} from "./types";
export interface InstantiateMsg {
  cw20_code_id: number;
  factory_addr: string;
}
export type ExecuteMsg = {
  list_token: ListTokenMsg;
};
export interface ListTokenMsg {
  cw20_admin?: string | null;
  initial_balances?: Cw20Coin[] | null;
  label?: string | null;
  liquidity_pool_reward_assets: Asset[];
  marketing?: InstantiateMarketingInfo | null;
  mint?: MinterResponse | null;
  name?: string | null;
  pair_asset_info: AssetInfo;
  symbol?: string | null;
  targeted_asset_info?: AssetInfo | null;
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