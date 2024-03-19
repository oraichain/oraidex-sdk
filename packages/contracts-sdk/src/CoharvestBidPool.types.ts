import {AssetInfo, Addr, Uint128, Decimal, Binary, Cw20ReceiveMsg} from "./types";
export interface InstantiateMsg {
  bidding_duration: number;
  distribution_token: AssetInfo;
  max_slot: number;
  min_deposit_amount: Uint128;
  owner: Addr;
  premium_rate_per_slot: Decimal;
  treasury: Addr;
  underlying_token: AssetInfo;
}
export type ExecuteMsg = {
  receive: Cw20ReceiveMsg;
} | {
  update_config: {
    bidding_duration?: number | null;
    distribution_token?: AssetInfo | null;
    max_slot?: number | null;
    min_deposit_amount?: Uint128 | null;
    owner?: Addr | null;
    premium_rate_per_slot?: Decimal | null;
    treasury?: Addr | null;
    underlying_token?: AssetInfo | null;
  };
} | {
  create_new_round: {
    end_time: number;
    start_time: number;
    total_distribution: Uint128;
  };
} | {
  finalize_bidding_round_result: {
    exchange_rate: Decimal;
    round: number;
  };
} | {
  distribute: {
    limit?: number | null;
    round: number;
    start_after?: number | null;
  };
} | {
  submit_bid: {
    premium_slot: number;
    round: number;
  };
} | {
  create_new_round_from_treasury: {};
} | {
  update_round: {
    end_time?: number | null;
    idx: number;
    start_time?: number | null;
    total_distribution?: Uint128 | null;
  };
};
export type QueryMsg = {
  config: {};
} | {
  bid: {
    idx: number;
  };
} | {
  bidding_info: {
    round: number;
  };
} | {
  last_round_id: {};
} | {
  bid_pool: {
    round: number;
    slot: number;
  };
} | {
  all_bid_pool_in_round: {
    round: number;
  };
} | {
  all_bid_in_round: {
    limit?: number | null;
    order_by?: number | null;
    round: number;
    start_after?: number | null;
  };
} | {
  bids_idx_by_user: {
    round: number;
    user: Addr;
  };
} | {
  bids_by_user: {
    round: number;
    user: Addr;
  };
} | {
  estimate_amount_receive_of_bid: {
    exchange_rate: Decimal;
    idx: number;
    round: number;
  };
} | {
  estimate_amount_receive: {
    bid_amount: Uint128;
    exchange_rate: Decimal;
    round: number;
    slot: number;
  };
} | {
  numbers_bid_in_round: {
    round: number;
  };
};
export interface MigrateMsg {
  bidding_duration: number;
  distribution_token: AssetInfo;
  max_slot: number;
  min_deposit_amount: Uint128;
  owner: Addr;
  premium_rate_per_slot: Decimal;
  treasury: Addr;
  underlying_token: AssetInfo;
}
export type ArrayOfBid = Bid[];
export interface Bid {
  amount: Uint128;
  amount_received: Uint128;
  bidder: Addr;
  idx: number;
  is_distributed: boolean;
  premium_slot: number;
  residue_bid: Uint128;
  round: number;
  timestamp: number;
}
export type ArrayOfBidPool = BidPool[];
export interface BidPool {
  index_snapshot: Decimal;
  premium_rate: Decimal;
  received_per_token: Decimal;
  slot: number;
  total_bid_amount: Uint128;
}
export interface BiddingInfoResponse {
  bid_info: BiddingInfo;
  distribution_info: DistributionInfo;
}
export interface BiddingInfo {
  end_time: number;
  round: number;
  start_time: number;
  total_bid_amount: Uint128;
  total_bid_matched: Uint128;
}
export interface DistributionInfo {
  actual_distributed: Uint128;
  exchange_rate: Decimal;
  is_released: boolean;
  num_bids_distributed: number;
  total_distribution: Uint128;
}
export type ArrayOfUint64 = number[];
export interface Config {
  bidding_duration: number;
  distribution_token: AssetInfo;
  max_slot: number;
  min_deposit_amount: Uint128;
  owner: Addr;
  premium_rate_per_slot: Decimal;
  treasury: Addr;
  underlying_token: AssetInfo;
}
export interface EstimateAmountReceiveOfBidResponse {
  receive: Uint128;
  residue_bid: Uint128;
}
export type Uint64 = number;