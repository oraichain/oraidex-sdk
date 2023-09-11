import {Addr} from "./types";
export interface InstantiateMsg {
  commission_rate?: string | null;
  oracle_addr: Addr;
  pair_code_id: number;
  token_code_id: number;
}
export type ExecuteMsg = {
  update_config: {
    owner?: string | null;
    pair_code_id?: number | null;
    token_code_id?: number | null;
  };
} | {
  create_pair: {
    asset_infos: [AssetInfo, AssetInfo];
    pair_admin?: string | null;
  };
} | {
  add_pair: {
    pair_info: PairInfo;
  };
};
export type AssetInfo = {
  token: {
    contract_addr: Addr;
  };
} | {
  native_token: {
    denom: string;
  };
};
export interface PairInfo {
  asset_infos: [AssetInfo, AssetInfo];
  commission_rate: string;
  contract_addr: Addr;
  liquidity_token: Addr;
  oracle_addr: Addr;
}
export type QueryMsg = {
  config: {};
} | {
  pair: {
    asset_infos: [AssetInfo, AssetInfo];
  };
} | {
  pairs: {
    limit?: number | null;
    start_after?: [AssetInfo, AssetInfo] | null;
  };
};
export interface MigrateMsg {}
export interface ConfigResponse {
  oracle_addr: Addr;
  owner: Addr;
  pair_code_id: number;
  token_code_id: number;
}
export interface PairsResponse {
  pairs: PairInfo[];
}