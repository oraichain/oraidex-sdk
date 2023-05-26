export type Addr = string;
export type Binary = string;
export interface Call {
  address: Addr;
  data: Binary;
}
export interface CallOptional {
  address: Addr;
  data: Binary;
  require_success: boolean;
}
export interface AggregateResult {
  return_data: CallResult[];
}
export interface CallResult {
  data: Binary;
  success: boolean;
}
export interface BlockAggregateResult {
  block: number;
  return_data: CallResult[];
}
export interface ContractVersion {
  contract: string;
  version: string;
}
export interface AllowMsg {
  contract: string;
  gas_limit?: number | null;
}
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
export interface Cw20ReceiveMsg {
  amount: Uint128;
  msg: Binary;
  sender: string;
}
export interface TransferMsg {
  channel: string;
  memo?: string | null;
  remote_address: string;
  timeout?: number | null;
}
export interface TransferBackMsg {
  local_channel_id: string;
  memo?: string | null;
  remote_address: string;
  remote_denom: string;
  timeout?: number | null;
}
export interface UpdatePairMsg {
  asset_info: AssetInfo;
  asset_info_decimals: number;
  denom: string;
  local_channel_id: string;
  remote_decimals: number;
}
export interface DeletePairMsg {
  denom: string;
  local_channel_id: string;
}
export interface RelayerFee {
  chain: string;
  ratio: Ratio;
}
export interface Ratio {
  denominator: number;
  nominator: number;
}
export type Amount = {
  native: Coin;
} | {
  cw20: Cw20Coin;
};
export interface Coin {
  amount: Uint128;
  denom: string;
}
export interface Cw20Coin {
  address: string;
  amount: Uint128;
}
export interface ChannelInfo {
  connection_id: string;
  counterparty_endpoint: IbcEndpoint;
  id: string;
}
export interface IbcEndpoint {
  channel_id: string;
  port_id: string;
}
export interface AllowedInfo {
  contract: string;
  gas_limit?: number | null;
}
export interface PairQuery {
  key: string;
  pair_mapping: MappingMetadata;
}
export interface MappingMetadata {
  asset_info: AssetInfo;
  asset_info_decimals: number;
  remote_decimals: number;
}
export type ArrayOfPairQuery = PairQuery[];
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
};
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