import {Addr, Binary, Call, CallOptional, AggregateResult, CallResult, BlockAggregateResult, ContractVersion} from "./types";
export interface InstantiateMsg {}
export type ExecuteMsg = string;
export type QueryMsg = {
  contract_version: {};
} | {
  aggregate: {
    queries: Call[];
  };
} | {
  try_aggregate: {
    include_cause?: boolean | null;
    queries: Call[];
    require_success?: boolean | null;
  };
} | {
  try_aggregate_optional: {
    include_cause?: boolean | null;
    queries: CallOptional[];
  };
} | {
  block_aggregate: {
    queries: Call[];
  };
} | {
  block_try_aggregate: {
    include_cause?: boolean | null;
    queries: Call[];
    require_success?: boolean | null;
  };
} | {
  block_try_aggregate_optional: {
    include_cause?: boolean | null;
    queries: CallOptional[];
  };
};
export interface MigrateMsg {}