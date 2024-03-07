/**
* This file was automatically generated by @oraichain/ts-codegen@0.35.8.
* DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
* and run the @oraichain/ts-codegen generate command to regenerate this file.
*/

import { CosmWasmClient, SigningCosmWasmClient, ExecuteResult } from "@cosmjs/cosmwasm-stargate";
import { Coin, StdFee } from "@cosmjs/amino";
import {Addr, Uint128} from "./types";
import {InstantiateMsg, ExecuteMsg, QueryMsg, MigrateMsg, ConfigResponse, Duration, ConfigTokenStakingResponse, StakedBalanceAtHeightResponse, TotalStakedAtHeightResponse} from "./ProxySnapshot.types";
export interface ProxySnapshotReadOnlyInterface {
  contractAddress: string;
  getConfig: () => Promise<ConfigTokenStakingResponse>;
  config: () => Promise<ConfigResponse>;
  stakedBalanceAtHeight: ({
    address,
    height
  }: {
    address: string;
    height?: number;
  }) => Promise<StakedBalanceAtHeightResponse>;
  totalStakedAtHeight: ({
    height
  }: {
    height?: number;
  }) => Promise<TotalStakedAtHeightResponse>;
}
export class ProxySnapshotQueryClient implements ProxySnapshotReadOnlyInterface {
  client: CosmWasmClient;
  contractAddress: string;

  constructor(client: CosmWasmClient, contractAddress: string) {
    this.client = client;
    this.contractAddress = contractAddress;
    this.getConfig = this.getConfig.bind(this);
    this.config = this.config.bind(this);
    this.stakedBalanceAtHeight = this.stakedBalanceAtHeight.bind(this);
    this.totalStakedAtHeight = this.totalStakedAtHeight.bind(this);
  }

  getConfig = async (): Promise<ConfigTokenStakingResponse> => {
    return this.client.queryContractSmart(this.contractAddress, {
      get_config: {}
    });
  };
  config = async (): Promise<ConfigResponse> => {
    return this.client.queryContractSmart(this.contractAddress, {
      config: {}
    });
  };
  stakedBalanceAtHeight = async ({
    address,
    height
  }: {
    address: string;
    height?: number;
  }): Promise<StakedBalanceAtHeightResponse> => {
    return this.client.queryContractSmart(this.contractAddress, {
      staked_balance_at_height: {
        address,
        height
      }
    });
  };
  totalStakedAtHeight = async ({
    height
  }: {
    height?: number;
  }): Promise<TotalStakedAtHeightResponse> => {
    return this.client.queryContractSmart(this.contractAddress, {
      total_staked_at_height: {
        height
      }
    });
  };
}
export interface ProxySnapshotInterface extends ProxySnapshotReadOnlyInterface {
  contractAddress: string;
  sender: string;
  updateConfig: ({
    assetKey,
    owner,
    stakingContract
  }: {
    assetKey?: Addr;
    owner?: Addr;
    stakingContract?: Addr;
  }, _fee?: number | StdFee | "auto", _memo?: string, _funds?: Coin[]) => Promise<ExecuteResult>;
}
export class ProxySnapshotClient extends ProxySnapshotQueryClient implements ProxySnapshotInterface {
  client: SigningCosmWasmClient;
  sender: string;
  contractAddress: string;

  constructor(client: SigningCosmWasmClient, sender: string, contractAddress: string) {
    super(client, contractAddress);
    this.client = client;
    this.sender = sender;
    this.contractAddress = contractAddress;
    this.updateConfig = this.updateConfig.bind(this);
  }

  updateConfig = async ({
    assetKey,
    owner,
    stakingContract
  }: {
    assetKey?: Addr;
    owner?: Addr;
    stakingContract?: Addr;
  }, _fee: number | StdFee | "auto" = "auto", _memo?: string, _funds?: Coin[]): Promise<ExecuteResult> => {
    return await this.client.execute(this.sender, this.contractAddress, {
      update_config: {
        asset_key: assetKey,
        owner,
        staking_contract: stakingContract
      }
    }, _fee, _memo, _funds);
  };
}