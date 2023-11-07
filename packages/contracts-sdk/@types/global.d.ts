import { Coin } from "@cosmjs/amino";
import {
  ContractInfoResponse,
  ExchangeRateResponse,
  ExchangeRatesResponse,
  TaxCapResponse,
  TaxRateResponse
} from "./src/OraiswapOracle.types";

declare global {
  type TreasuryResponse = TaxRateResponse | TaxCapResponse;
  type ContractResponse = ContractInfoResponse | Coin;
  type ExchangeResponse = ExchangeRateResponse | ExchangeRatesResponse;
}
