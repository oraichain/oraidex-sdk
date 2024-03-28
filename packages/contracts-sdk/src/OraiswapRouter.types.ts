import {Addr, Uint128, Binary, SwapOperation, AssetInfo, Cw20ReceiveMsg} from "./types";
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
    sender: Addr;
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