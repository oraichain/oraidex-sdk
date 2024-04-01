import {AssetInfo, Addr, SwapOperation, Uint128} from "./types";
export interface InstantiateMsg {
  owner: string;
  router_addr: string;
}
export type ExecuteMsg = {
  update_config: {
    new_owner?: string | null;
    new_router?: string | null;
  };
} | {
  set_route: {
    input_info: AssetInfo;
    output_info: AssetInfo;
    pool_route: SwapOperation[];
  };
} | {
  delete_route: {
    input_info: AssetInfo;
    output_info: AssetInfo;
    route_index: number;
  };
};
export type QueryMsg = {
  config: {};
} | {
  get_routes: {
    input_info: AssetInfo;
    output_info: AssetInfo;
  };
} | {
  get_route: {
    input_info: AssetInfo;
    output_info: AssetInfo;
    route_index: number;
  };
} | {
  get_smart_route: {
    input_info: AssetInfo;
    offer_amount: Uint128;
    output_info: AssetInfo;
    route_mode?: SmartRouteMode | null;
  };
};
export type SmartRouteMode = "max_minimum_receive";
export interface MigrateMsg {}
export interface GetConfigResponse {
  owner: string;
  router: string;
}
export interface GetRouteResponse {
  pool_route: SwapOperation[];
}
export interface GetRoutesResponse {
  pool_routes: SwapOperation[][];
}
export interface GetSmartRouteResponse {
  actual_minimum_receive: Uint128;
  swap_ops: SwapOperation[];
}