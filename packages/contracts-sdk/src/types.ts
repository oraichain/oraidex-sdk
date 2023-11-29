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
export type Decimal = string;
export interface PairInfo {
  asset_infos: [AssetInfo, AssetInfo];
  commission_rate: string;
  contract_addr: Addr;
  liquidity_token: Addr;
  oracle_addr: Addr;
}
export interface Asset {
  amount: Uint128;
  info: AssetInfo;
}