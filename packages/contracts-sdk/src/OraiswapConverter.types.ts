import {Uint128, Binary, Addr, AssetInfo, Cw20ReceiveMsg, Decimal} from "./types";
export interface InstantiateMsg {}
export type ExecuteMsg = {
  receive: Cw20ReceiveMsg;
} | {
  update_config: {
    owner: Addr;
  };
} | {
  convert: {};
} | {
  update_pair: {
    from: TokenInfo;
    to: TokenInfo;
  };
} | {
  unregister_pair: {
    from: TokenInfo;
  };
} | {
  convert_reverse: {
    from_asset: AssetInfo;
  };
} | {
  withdraw_tokens: {
    asset_infos: AssetInfo[];
  };
};
export interface TokenInfo {
  decimals: number;
  info: AssetInfo;
}
export type QueryMsg = {
  config: {};
} | {
  convert_info: {
    asset_info: AssetInfo;
  };
};
export interface MigrateMsg {}
export interface ConfigResponse {
  owner: Addr;
}
export interface ConvertInfoResponse {
  token_ratio: TokenRatio;
}
export interface TokenRatio {
  info: AssetInfo;
  ratio: Decimal;
}