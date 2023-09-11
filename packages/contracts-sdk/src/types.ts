export type Uint128 = string;
export type Binary = string;
export type Addr = string;
export type Decimal = string;
export interface Coin {
  amount: Uint128;
  denom: string;
}
export type Timestamp = Uint64;
export type Uint64 = string;
export { CosmWasmClient, SigningCosmWasmClient, ExecuteResult } from "@cosmjs/cosmwasm-stargate";