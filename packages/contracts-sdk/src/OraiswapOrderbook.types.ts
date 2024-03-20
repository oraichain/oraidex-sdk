import {Uint128, Binary, Addr, AssetInfo, Decimal, Cw20ReceiveMsg, Asset} from "./types";
export interface InstantiateMsg {
  admin?: string | null;
  commission_rate?: string | null;
  name?: string | null;
  operator?: string | null;
  reward_address: string;
  version?: string | null;
}
export type ExecuteMsg = {
  receive: Cw20ReceiveMsg;
} | {
  pause: {};
} | {
  unpause: {};
} | {
  update_admin: {
    admin: Addr;
  };
} | {
  update_config: {
    commission_rate?: string | null;
    reward_address?: Addr | null;
  };
} | {
  update_operator: {
    operator?: string | null;
  };
} | {
  create_order_book_pair: {
    base_coin_info: AssetInfo;
    min_quote_coin_amount: Uint128;
    quote_coin_info: AssetInfo;
    refund_threshold?: Uint128 | null;
    spread?: Decimal | null;
  };
} | {
  update_orderbook_pair: {
    asset_infos: [AssetInfo, AssetInfo];
    min_quote_coin_amount?: Uint128 | null;
    refund_threshold?: Uint128 | null;
    spread?: Decimal | null;
  };
} | {
  submit_order: {
    assets: [Asset, Asset];
    direction: OrderDirection;
  };
} | {
  submit_market_order: {
    asset_infos: [AssetInfo, AssetInfo];
    direction: OrderDirection;
    slippage?: Decimal | null;
  };
} | {
  cancel_order: {
    asset_infos: [AssetInfo, AssetInfo];
    order_id: number;
  };
} | {
  remove_order_book_pair: {
    asset_infos: [AssetInfo, AssetInfo];
  };
} | {
  withdraw_token: {
    asset: Asset;
  };
};
export type OrderDirection = "buy" | "sell";
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
    end?: Decimal | null;
    limit?: number | null;
    order_by?: number | null;
    start_after?: Decimal | null;
  };
} | {
  last_order_id: {};
} | {
  mid_price: {
    asset_infos: [AssetInfo, AssetInfo];
  };
} | {
  simulate_market_order: {
    asset_infos: [AssetInfo, AssetInfo];
    direction: OrderDirection;
    offer_amount: Uint128;
    slippage?: Decimal | null;
  };
};
export type OrderFilter = ("tick" | "none") | {
  bidder: string;
} | {
  price: Decimal;
};
export interface MigrateMsg {}
export interface ContractInfoResponse {
  admin: Addr;
  commission_rate: string;
  is_paused: boolean;
  name: string;
  operator?: Addr | null;
  reward_address: Addr;
  version: string;
}
export interface LastOrderIdResponse {
  last_order_id: number;
}
export type OrderStatus = "open" | "partial_filled" | "fulfilled" | "cancel";
export interface OrderResponse {
  ask_asset: Asset;
  bidder_addr: string;
  direction: OrderDirection;
  filled_ask_amount: Uint128;
  filled_offer_amount: Uint128;
  offer_asset: Asset;
  order_id: number;
  status: OrderStatus;
}
export interface OrderBookResponse {
  base_coin_info: AssetInfo;
  min_quote_coin_amount: Uint128;
  quote_coin_info: AssetInfo;
  refund_threshold: Uint128;
  spread?: Decimal | null;
}
export interface OrderBooksResponse {
  order_books: OrderBookResponse[];
}
export interface OrdersResponse {
  orders: OrderResponse[];
}
export interface SimulateMarketOrderResponse {
  receive: Uint128;
  refunds: Uint128;
}
export interface TickResponse {
  price: Decimal;
  total_orders: number;
}
export interface TicksResponse {
  ticks: TickResponse[];
}