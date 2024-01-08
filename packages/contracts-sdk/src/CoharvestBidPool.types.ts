import { Addr, AssetInfo, Decimal, Uint128 } from "./types";

export interface InstantiateMsg {
  distribution_token: AssetInfo;
  max_slot: number;
  min_deposit_amount: Uint128;
  owner: Addr;
  premium_rate_per_slot: Decimal;
  underlying_token: AssetInfo;
}
export type ExecuteMsg =
  | {
      receive: Cw20ReceiveMsg;
    }
  | {
      update_config: {
        distribution_token?: AssetInfo | null;
        max_slot?: number | null;
        min_deposit_amount?: Uint128 | null;
        owner?: Addr | null;
        premium_rate_per_slot?: Decimal | null;
        underlying_token?: AssetInfo | null;
      };
    }
  | {
      create_new_round: {
        end_time: number;
        start_time: number;
        total_bid_threshold: Uint128;
        total_distribution: Uint128;
      };
    }
  | {
      release_distribution_info: {
        exchange_rate: Decimal;
        round: number;
      };
    }
  | {
      distribute: {
        limit?: number | null;
        round: number;
        start_after?: number | null;
      };
    }
  | {
      submit_bid: {
        premium_slot: number;
        round: number;
      };
    };
export type Binary = string;
export interface Cw20ReceiveMsg {
  amount: Uint128;
  msg: Binary;
  sender: string;
}
export type QueryMsg =
  | {
      config: {};
    }
  | {
      bid: {
        idx: number;
      };
    }
  | {
      bidding_info: {
        round: number;
      };
    }
  | {
      last_round_id: {};
    }
  | {
      bid_pool: {
        round: number;
        slot: number;
      };
    }
  | {
      all_bid_pool_in_round: {
        round: number;
      };
    }
  | {
      all_bid_in_round: {
        limit?: number | null;
        round: number;
        start_after?: number | null;
      };
    }
  | {
      bids_idx_by_user: {
        round: number;
        user: Addr;
      };
    }
  | {
      bids_by_user: {
        round: number;
        user: Addr;
      };
    }
  | {
      estimate_amount_receive_of_bid: {
        exchange_rate: Decimal;
        idx: number;
        round: number;
      };
    }
  | {
      estimate_amount_receive: {
        bid_amount: Uint128;
        exchange_rate: Decimal;
        round: number;
        slot: number;
      };
    };
export interface MigrateMsg {}
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
  total_distribution: Uint128;
}
export type ArrayOfUint64 = number[];
export interface Config {
  distribution_token: AssetInfo;
  max_slot: number;
  min_deposit_amount: Uint128;
  owner: Addr;
  premium_rate_per_slot: Decimal;
  underlying_token: AssetInfo;
}
export interface EstimateAmountReceiveOfBidResponse {
  receive: Uint128;
  residue_bid: Uint128;
}
export type Uint64 = number;
