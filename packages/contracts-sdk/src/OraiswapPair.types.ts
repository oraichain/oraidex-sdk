import {AssetInfo, Addr, Uint128, Binary, Decimal, Cw20ReceiveMsg, Asset, PairInfo} from "./types";
export interface InstantiateMsg {
  asset_infos: [AssetInfo, AssetInfo];
  commission_rate?: string | null;
  oracle_addr: Addr;
  token_code_id: number;
}
export type ExecuteMsg = {
  receive: Cw20ReceiveMsg;
} | {
  provide_liquidity: {
    assets: [Asset, Asset];
    receiver?: Addr | null;
    slippage_tolerance?: Decimal | null;
  };
} | {
  swap: {
    belief_price?: Decimal | null;
    max_spread?: Decimal | null;
    offer_asset: Asset;
    to?: Addr | null;
  };
};
export type QueryMsg = {
  pair: {};
} | {
  pool: {};
} | {
  simulation: {
    offer_asset: Asset;
  };
} | {
  reverse_simulation: {
    ask_asset: Asset;
  };
};
export interface MigrateMsg {}
export interface PairResponse {
  info: PairInfo;
}
export interface PoolResponse {
  assets: [Asset, Asset];
  total_share: Uint128;
}
export interface ReverseSimulationResponse {
  commission_amount: Uint128;
  offer_amount: Uint128;
  spread_amount: Uint128;
}
export interface SimulationResponse {
  commission_amount: Uint128;
  return_amount: Uint128;
  spread_amount: Uint128;
}