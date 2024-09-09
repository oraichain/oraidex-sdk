export type Addr = string;
export interface InstantiateMsg {
  admin: Addr;
  dex_v3: Addr;
  mixed_router: Addr;
}
export type ExecuteMsg = {
  update_config: {
    admin?: Addr | null;
    dex_v3?: Addr | null;
    mixed_router?: Addr | null;
  };
} | {
  zap_in_liquidity: {
    amount_to_x: Uint128;
    amount_to_y: Uint128;
    asset_in: Asset;
    minimum_receive_x?: Uint128 | null;
    minimum_receive_y?: Uint128 | null;
    operation_to_x?: SwapOperation[] | null;
    operation_to_y?: SwapOperation[] | null;
    pool_key: PoolKey;
    tick_lower_index: number;
    tick_upper_index: number;
  };
} | {
  zap_out_liquidity: {
    minimum_receive_x?: Uint128 | null;
    minimum_receive_y?: Uint128 | null;
    operation_from_x?: SwapOperation[] | null;
    operation_from_y?: SwapOperation[] | null;
    position_index: number;
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
export type SwapOperation = {
  orai_swap: {
    ask_asset_info: AssetInfo2;
    offer_asset_info: AssetInfo2;
  };
} | {
  swap_v3: {
    pool_key: PoolKey2;
    x_to_y: boolean;
  };
};
export type AssetInfo2 = {
  token: {
    contract_addr: Addr;
  };
} | {
  native_token: {
    denom: string;
  };
};
export type Percentage2 = number;
export type Percentage = number;
export interface Asset {
  amount: Uint128;
  info: AssetInfo;
}
export interface PoolKey2 {
  fee_tier: FeeTier2;
  token_x: string;
  token_y: string;
}
export interface FeeTier2 {
  fee: Percentage2;
  tick_spacing: number;
}
export interface PoolKey {
  fee_tier: FeeTier;
  token_x: string;
  token_y: string;
}
export interface FeeTier {
  fee: Percentage;
  tick_spacing: number;
}
export type QueryMsg = {
  config: {};
};
export interface MigrateMsg {}
export interface Config {
  admin: Addr;
  dex_v3: Addr;
  mixed_router: Addr;
}