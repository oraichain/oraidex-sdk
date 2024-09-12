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
    asset_in: Asset;
    minimum_liquidity?: Liquidity | null;
    pool_key: PoolKey;
    routes: Route[];
    tick_lower_index: number;
    tick_upper_index: number;
  };
} | {
  zap_out_liquidity: {
    position_index: number;
    routes: Route[];
  };
} | {
  register_protocol_fee: {
    fee_receiver: Addr;
    percent: Decimal;
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
export type Liquidity = string;
export type Percentage = number;
export type SwapOperation = {
  orai_swap: {
    ask_asset_info: AssetInfo2;
    offer_asset_info: AssetInfo2;
  };
} | {
  swap_v3: {
    pool_key: PoolKey;
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
export type Decimal = string;
export interface Asset {
  amount: Uint128;
  info: AssetInfo;
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
export interface Route {
  minimum_receive?: Uint128 | null;
  offer_amount: Uint128;
  operations: SwapOperation[];
  token_in: string;
}
export type QueryMsg = {
  config: {};
} | {
  protocol_fee: {};
};
export interface MigrateMsg {}
export interface Config {
  admin: Addr;
  dex_v3: Addr;
  mixed_router: Addr;
}
export interface ProtocolFee {
  fee_receiver: Addr;
  percent: Decimal;
}