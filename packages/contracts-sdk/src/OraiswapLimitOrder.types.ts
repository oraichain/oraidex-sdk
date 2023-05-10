import {Addr, Uint128, Binary, AssetInfo, Decimal, OrderDirection, Cw20ReceiveMsg, Asset, OrderFilter} from "./types";
export interface InstantiateMsg {
  admin?: Addr | null;
  name?: string | null;
  version?: string | null;
}
export type ExecuteMsg = {
  receive: Cw20ReceiveMsg;
} | {
  update_admin: {
    admin: Addr;
  };
} | {
  create_order_book_pair: {
    base_coin_info: AssetInfo;
    min_quote_coin_amount: Uint128;
    quote_coin_info: AssetInfo;
    spread?: Decimal | null;
  };
} | {
  submit_order: {
    assets: [Asset, Asset];
    direction: OrderDirection;
  };
} | {
  cancel_order: {
    asset_infos: [AssetInfo, AssetInfo];
    order_id: number;
  };
} | {
  execute_order_book_pair: {
    asset_infos: [AssetInfo, AssetInfo];
    limit?: number | null;
  };
} | {
  remove_order_book_pair: {
    asset_infos: [AssetInfo, AssetInfo];
  };
};
export type QueryMsg = {
  contract_info: {};
} | {
  order_book: {
    asset_infos: [AssetInfo, AssetInfo];
  };
} | {
  order_books: {
    limit?: number | null;
    order_by?: number | null;
    start_after?: number[] | null;
  };
} | {
  order: {
    asset_infos: [AssetInfo, AssetInfo];
    order_id: number;
  };
} | {
  orders: {
    asset_infos: [AssetInfo, AssetInfo];
    direction?: OrderDirection | null;
    filter: OrderFilter;
    limit?: number | null;
    order_by?: number | null;
    start_after?: number | null;
  };
} | {
  tick: {
    asset_infos: [AssetInfo, AssetInfo];
    direction: OrderDirection;
    price: Decimal;
  };
} | {
  ticks: {
    asset_infos: [AssetInfo, AssetInfo];
    direction: OrderDirection;
    limit?: number | null;
    order_by?: number | null;
    start_after?: Decimal | null;
  };
} | {
  last_order_id: {};
} | {
  order_book_matchable: {
    asset_infos: [AssetInfo, AssetInfo];
  };
};
export interface MigrateMsg {}
export interface ContractInfoResponse {
  admin: Addr;
  name: string;
  version: string;
}
export interface LastOrderIdResponse {
  last_order_id: number;
}
export interface OrderResponse {
  ask_asset: Asset;
  bidder_addr: string;
  direction: OrderDirection;
  filled_ask_amount: Uint128;
  filled_offer_amount: Uint128;
  offer_asset: Asset;
  order_id: number;
}
export interface OrderBookResponse {
  base_coin_info: AssetInfo;
  min_quote_coin_amount: Uint128;
  quote_coin_info: AssetInfo;
  spread?: Decimal | null;
}
export interface OrderBookMatchableResponse {
  is_matchable: boolean;
}
export interface OrderBooksResponse {
  order_books: OrderBookResponse[];
}
export interface OrdersResponse {
  orders: OrderResponse[];
}
export interface TickResponse {
  price: Decimal;
  total_orders: number;
}
export interface TicksResponse {
  ticks: TickResponse[];
}