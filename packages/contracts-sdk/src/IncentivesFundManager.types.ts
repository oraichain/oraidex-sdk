export type Addr = string;
export interface InstantiateMsg {
  oraiswap_v3: Addr;
  owner?: Addr | null;
}
export type ExecuteMsg = {
  update_config: {
    oraiswap_v3?: Addr | null;
    owner?: Addr | null;
  };
} | {
  send_fund: {
    asset: Asset;
    receiver: Addr;
  };
};
export type Uint128 = string;
export type AssetInfo = {
  token: {
    contract_addr: Addr;
  };
} | {
  native_token: {
    denom: string;
  };
};
export interface Asset {
  amount: Uint128;
  info: AssetInfo;
}
export type QueryMsg = {
  config: {};
};
export interface MigrateMsg {}
export interface ConfigResponse {
  oraiswap_v3: Addr;
  owner: Addr;
}