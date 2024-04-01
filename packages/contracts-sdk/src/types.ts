export type AssetInfo = {
  token: {
    contract_addr: Addr;
  };
} | {
  native_token: {
    denom: string;
  };
};
export type Addr = string;
export type Uint128 = string;
export type Decimal = string;
export type Binary = string;
export interface Cw20ReceiveMsg {
  amount: Uint128;
  msg: Binary;
  sender: string;
}
export interface Asset {
  amount: Uint128;
  info: AssetInfo;
}
export interface RewardMsg {
  staking_token: Addr;
  total_accumulation_amount: Uint128;
}
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
export interface PairInfo {
  asset_infos: [AssetInfo, AssetInfo];
  commission_rate: string;
  contract_addr: Addr;
  liquidity_token: Addr;
  oracle_addr: Addr;
}
export type SwapOperation = {
  orai_swap: {
    ask_asset_info: AssetInfo;
    offer_asset_info: AssetInfo;
  };
};
export interface RewardInfoResponseItem {
  bond_amount: Uint128;
  pending_reward: Uint128;
  pending_withdraw: Asset[];
  staking_token: Addr;
}