/**
* This file was automatically generated by @oraichain/ts-codegen@0.35.9.
* DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
* and run the @oraichain/ts-codegen generate command to regenerate this file.
*/

import { CosmWasmClient, SigningCosmWasmClient, ExecuteResult } from "@cosmjs/cosmwasm-stargate";
import { StdFee } from "@cosmjs/amino";
import {Addr, Decimal, Uint128} from "./types";
import {InstantiateMsg, ExecuteMsg, QueryMsg, OracleTreasuryQuery, OracleExchangeQuery, OracleContractQuery, MigrateMsg, ContractInfoResponse, ExchangeRateResponse, ExchangeRateItem, ExchangeRatesResponse, Coin, TaxCapResponse, TaxRateResponse} from "./OraiswapOracle.types";
export interface OraiswapOracleReadOnlyInterface {
  contractAddress: string;
  treasury: (oracleTreasuryQuery: OracleTreasuryQuery) => Promise<TreasuryResponse>;
  exchange: (oracleExchangeQuery: OracleExchangeQuery) => Promise<ExchangeResponse>;
  contract: (oracleContractQuery: OracleContractQuery) => Promise<ContractResponse>;
}
export class OraiswapOracleQueryClient implements OraiswapOracleReadOnlyInterface {
  client: CosmWasmClient;
  contractAddress: string;

  constructor(client: CosmWasmClient, contractAddress: string) {
    this.client = client;
    this.contractAddress = contractAddress;
    this.treasury = this.treasury.bind(this);
    this.exchange = this.exchange.bind(this);
    this.contract = this.contract.bind(this);
  }

  treasury = async (oracleTreasuryQuery: OracleTreasuryQuery): Promise<TreasuryResponse> => {
    return this.client.queryContractSmart(this.contractAddress, {
      treasury: oracleTreasuryQuery
    });
  };
  exchange = async (oracleExchangeQuery: OracleExchangeQuery): Promise<ExchangeResponse> => {
    return this.client.queryContractSmart(this.contractAddress, {
      exchange: oracleExchangeQuery
    });
  };
  contract = async (oracleContractQuery: OracleContractQuery): Promise<ContractResponse> => {
    return this.client.queryContractSmart(this.contractAddress, {
      contract: oracleContractQuery
    });
  };
}
export interface OraiswapOracleInterface extends OraiswapOracleReadOnlyInterface {
  contractAddress: string;
  sender: string;
  updateAdmin: ({
    admin
  }: {
    admin: Addr;
  }, _fee?: number | StdFee | "auto", _memo?: string, _funds?: Coin[]) => Promise<ExecuteResult>;
  updateExchangeRate: ({
    denom,
    exchangeRate
  }: {
    denom: string;
    exchangeRate: Decimal;
  }, _fee?: number | StdFee | "auto", _memo?: string, _funds?: Coin[]) => Promise<ExecuteResult>;
  deleteExchangeRate: ({
    denom
  }: {
    denom: string;
  }, _fee?: number | StdFee | "auto", _memo?: string, _funds?: Coin[]) => Promise<ExecuteResult>;
  updateTaxCap: ({
    cap,
    denom
  }: {
    cap: Uint128;
    denom: string;
  }, _fee?: number | StdFee | "auto", _memo?: string, _funds?: Coin[]) => Promise<ExecuteResult>;
  updateTaxRate: ({
    rate
  }: {
    rate: Decimal;
  }, _fee?: number | StdFee | "auto", _memo?: string, _funds?: Coin[]) => Promise<ExecuteResult>;
}
export class OraiswapOracleClient extends OraiswapOracleQueryClient implements OraiswapOracleInterface {
  client: SigningCosmWasmClient;
  sender: string;
  contractAddress: string;

  constructor(client: SigningCosmWasmClient, sender: string, contractAddress: string) {
    super(client, contractAddress);
    this.client = client;
    this.sender = sender;
    this.contractAddress = contractAddress;
    this.updateAdmin = this.updateAdmin.bind(this);
    this.updateExchangeRate = this.updateExchangeRate.bind(this);
    this.deleteExchangeRate = this.deleteExchangeRate.bind(this);
    this.updateTaxCap = this.updateTaxCap.bind(this);
    this.updateTaxRate = this.updateTaxRate.bind(this);
  }

  updateAdmin = async ({
    admin
  }: {
    admin: Addr;
  }, _fee: number | StdFee | "auto" = "auto", _memo?: string, _funds?: Coin[]): Promise<ExecuteResult> => {
    return await this.client.execute(this.sender, this.contractAddress, {
      update_admin: {
        admin
      }
    }, _fee, _memo, _funds);
  };
  updateExchangeRate = async ({
    denom,
    exchangeRate
  }: {
    denom: string;
    exchangeRate: Decimal;
  }, _fee: number | StdFee | "auto" = "auto", _memo?: string, _funds?: Coin[]): Promise<ExecuteResult> => {
    return await this.client.execute(this.sender, this.contractAddress, {
      update_exchange_rate: {
        denom,
        exchange_rate: exchangeRate
      }
    }, _fee, _memo, _funds);
  };
  deleteExchangeRate = async ({
    denom
  }: {
    denom: string;
  }, _fee: number | StdFee | "auto" = "auto", _memo?: string, _funds?: Coin[]): Promise<ExecuteResult> => {
    return await this.client.execute(this.sender, this.contractAddress, {
      delete_exchange_rate: {
        denom
      }
    }, _fee, _memo, _funds);
  };
  updateTaxCap = async ({
    cap,
    denom
  }: {
    cap: Uint128;
    denom: string;
  }, _fee: number | StdFee | "auto" = "auto", _memo?: string, _funds?: Coin[]): Promise<ExecuteResult> => {
    return await this.client.execute(this.sender, this.contractAddress, {
      update_tax_cap: {
        cap,
        denom
      }
    }, _fee, _memo, _funds);
  };
  updateTaxRate = async ({
    rate
  }: {
    rate: Decimal;
  }, _fee: number | StdFee | "auto" = "auto", _memo?: string, _funds?: Coin[]): Promise<ExecuteResult> => {
    return await this.client.execute(this.sender, this.contractAddress, {
      update_tax_rate: {
        rate
      }
    }, _fee, _memo, _funds);
  };
}