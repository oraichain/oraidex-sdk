import {Addr, Decimal, Uint128} from "./types";
export interface InstantiateMsg {
  admin?: Addr | null;
  max_rate?: Decimal | null;
  min_rate?: Decimal | null;
  name?: string | null;
  version?: string | null;
}
export type ExecuteMsg = {
  update_admin: {
    admin: Addr;
  };
} | {
  update_exchange_rate: {
    denom: string;
    exchange_rate: Decimal;
  };
} | {
  delete_exchange_rate: {
    denom: string;
  };
} | {
  update_tax_cap: {
    cap: Uint128;
    denom: string;
  };
} | {
  update_tax_rate: {
    rate: Decimal;
  };
};
export type QueryMsg = {
  treasury: OracleTreasuryQuery;
} | {
  exchange: OracleExchangeQuery;
} | {
  contract: OracleContractQuery;
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
export interface MigrateMsg {}
export interface ContractInfoResponse {
  admin: Addr;
  creator: Addr;
  max_rate: Decimal;
  min_rate: Decimal;
  name: string;
  version: string;
}
export interface ExchangeRateResponse {
  base_denom: string;
  item: ExchangeRateItem;
}
export interface ExchangeRateItem {
  exchange_rate: Decimal;
  quote_denom: string;
}
export interface ExchangeRatesResponse {
  base_denom: string;
  items: ExchangeRateItem[];
}
export interface Coin {
  amount: Uint128;
  denom: string;
}
export interface TaxCapResponse {
  cap: Uint128;
}
export interface TaxRateResponse {
  rate: Decimal;
}