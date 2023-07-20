import {Addr, AssetInfo, Binary, PairInfo} from "./types";
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
} | {
  migrate_contract: {
    contract_addr: string;
    msg: Binary;
    new_code_id: number;
  };
};
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