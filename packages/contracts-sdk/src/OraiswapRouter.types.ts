import {Addr, Uint128, Binary} from "./types";
export interface InstantiateMsg {
  factory_addr: Addr;
  factory_addr_v2: Addr;
}
export type ExecuteMsg = {
  receive: Cw20ReceiveMsg;
} | {
  execute_swap_operations: {
    minimum_receive?: Uint128 | null;
    operations: SwapOperation[];
    to?: Addr | null;
  };
} | {
  execute_swap_operation: {
    operation: SwapOperation;
    to?: Addr | null;
  };
} | {
  assert_minimum_receive: {
    asset_info: AssetInfo;
    minimum_receive: Uint128;
    prev_balance: Uint128;
    receiver: Addr;
  };
};
export type SwapOperation = {
  orai_swap: {
    ask_asset_info: AssetInfo;
    offer_asset_info: AssetInfo;
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
export interface Cw20ReceiveMsg {
  amount: Uint128;
  msg: Binary;
  sender: string;
}
export type QueryMsg = {
  config: {};
} | {
  simulate_swap_operations: {
    offer_amount: Uint128;
    operations: SwapOperation[];
  };
};
export interface MigrateMsg {}
export interface ConfigResponse {
  factory_addr: Addr;
  factory_addr_v2: Addr;
}
export interface SimulateSwapOperationsResponse {
  amount: Uint128;
}