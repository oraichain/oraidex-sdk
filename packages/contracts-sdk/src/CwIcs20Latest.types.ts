import {AllowMsg, Uint128, Binary, AssetInfo, Addr, Cw20ReceiveMsg, TransferMsg, TransferBackMsg, UpdatePairMsg, DeletePairMsg, RelayerFee, Ratio, Amount, Coin, Cw20Coin, ChannelInfo, IbcEndpoint, AllowedInfo, PairQuery, MappingMetadata, ArrayOfPairQuery} from "./types";
export interface InstantiateMsg {
  allowlist: AllowMsg[];
  default_gas_limit?: number | null;
  default_timeout: number;
  gov_contract: string;
  swap_router_contract: string;
}
export type ExecuteMsg = {
  receive: Cw20ReceiveMsg;
} | {
  transfer: TransferMsg;
} | {
  transfer_to_remote: TransferBackMsg;
} | {
  update_mapping_pair: UpdatePairMsg;
} | {
  delete_mapping_pair: DeletePairMsg;
} | {
  allow: AllowMsg;
} | {
  update_config: {
    admin?: string | null;
    default_gas_limit?: number | null;
    default_timeout?: number | null;
    fee_denom?: string | null;
    relayer_fee?: RelayerFee | null;
    swap_router_contract?: string | null;
  };
} | {
  transfer_fee: {};
};
export type QueryMsg = {
  port: {};
} | {
  list_channels: {};
} | {
  channel: {
    forward?: boolean | null;
    id: string;
  };
} | {
  config: {};
} | {
  admin: {};
} | {
  allowed: {
    contract: string;
  };
} | {
  list_allowed: {
    limit?: number | null;
    order?: number | null;
    start_after?: string | null;
  };
} | {
  pair_mappings: {
    limit?: number | null;
    order?: number | null;
    start_after?: string | null;
  };
} | {
  pair_mapping: {
    key: string;
  };
} | {
  pair_mappings_from_asset_info: {
    asset_info: AssetInfo;
  };
};
export interface AdminResponse {
  admin?: string | null;
}
export interface AllowedResponse {
  gas_limit?: number | null;
  is_allowed: boolean;
}
export interface ChannelResponse {
  balances: Amount[];
  info: ChannelInfo;
  total_sent: Amount[];
}
export interface ConfigResponse {
  default_gas_limit?: number | null;
  default_timeout: number;
  fee_denom: string;
  gov_contract: string;
  swap_router_contract: string;
}
export interface ListAllowedResponse {
  allow: AllowedInfo[];
}
export interface ListChannelsResponse {
  channels: ChannelInfo[];
}
export interface PortResponse {
  port_id: string;
}