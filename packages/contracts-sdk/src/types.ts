export type Uint128 = string;
export type Binary = string;
export type Addr = string;
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
export interface TokenInfo {
  decimals: number;
  info: AssetInfo;
}
export type Decimal = string;
export interface TokenRatio {
  info: AssetInfo;
  ratio: Decimal;
}
export interface PairInfo {
  asset_infos: [AssetInfo, AssetInfo];
  commission_rate: string;
  contract_addr: Addr;
  liquidity_token: Addr;
  oracle_addr: Addr;
}
export type OrderDirection = "buy" | "sell";
export interface Asset {
  amount: Uint128;
  info: AssetInfo;
}
export type OrderFilter = ("tick" | "none") | {
  bidder: string;
} | {
  price: Decimal;
} | {
  status: OrderStatus;
};
export type OrderStatus = "open" | "partial_filled" | "fulfilled" | "cancel";
export type OracleTreasuryQuery = {
  tax_rate: {};
} | {
  tax_cap: {
    denom: string;
  };
};
export type OracleExchangeQuery = {
  exchange_rate: {
    base_denom?: string | null;
    quote_denom: string;
  };
} | {
  exchange_rates: {
    base_denom?: string | null;
    quote_denoms: string[];
  };
};
export type OracleContractQuery = {
  contract_info: {};
} | {
  reward_pool: {
    denom: string;
  };
};
export interface ExchangeRateItem {
  exchange_rate: Decimal;
  quote_denom: string;
}
export interface Coin {
  amount: Uint128;
  denom: string;
}
export type SwapOperation = {
  orai_swap: {
    ask_asset_info: AssetInfo;
    offer_asset_info: AssetInfo;
  };
};
export type Logo = {
  url: string;
} | {
  embedded: EmbeddedLogo;
};
export type EmbeddedLogo = {
  svg: Binary;
} | {
  png: Binary;
};
export interface Cw20Coin {
  address: string;
  amount: Uint128;
}
export interface InstantiateMarketingInfo {
  description?: string | null;
  logo?: Logo | null;
  marketing?: string | null;
  project?: string | null;
}
export type Expiration = {
  at_height: number;
} | {
  at_time: Timestamp;
} | {
  never: {};
};
export type Timestamp = Uint64;
export type Uint64 = string;
export interface AllowanceInfo {
  allowance: Uint128;
  expires: Expiration;
  spender: string;
}
export interface SpenderAllowanceInfo {
  allowance: Uint128;
  expires: Expiration;
  owner: string;
}
export type LogoInfo = {
  url: string;
} | "embedded";
export { CosmWasmClient, SigningCosmWasmClient, ExecuteResult } from "@cosmjs/cosmwasm-stargate";