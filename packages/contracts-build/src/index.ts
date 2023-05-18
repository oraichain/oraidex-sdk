import { OraiswapTokenTypes, OraiswapRouterTypes, OraiswapStakingTypes, OraiswapLimitOrderTypes, OraiswapOracleTypes, OraiswapFactoryTypes, OraiswapRewarderTypes, OraiswapPairTypes } from '@oraichain/oraidex-contracts-sdk';
import { SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { readFileSync } from 'fs';
import path from 'path';

export type ContractName = 'oraiswap_token' | 'oraiswap_limit_order' | 'oraiswap_pair' | 'oraiswap_oracle' | 'oraiswap_converter' | 'oraiswap_factory' | 'oraiswap_rewarder' | 'oraiswap_router' | 'oraiswap_staking';

export type InstantiateMsg =
  | OraiswapTokenTypes.InstantiateMsg
  | OraiswapLimitOrderTypes.InstantiateMsg
  | OraiswapPairTypes.InstantiateMsg
  | OraiswapOracleTypes.InstantiateMsg
  | OraiswapFactoryTypes.InstantiateMsg
  | OraiswapRewarderTypes.InstantiateMsg
  | OraiswapRouterTypes.InstantiateMsg
  | OraiswapStakingTypes.InstantiateMsg;

export type MigrateMsg = OraiswapStakingTypes.MigrateMsg;

const contractDir = path.join(path.dirname(module.filename), '..', 'data');

export const getContractDir = (name: ContractName = 'oraiswap_limit_order') => {
  return path.join(contractDir, name + '.wasm');
};

export const deployContract = async (client: SigningCosmWasmClient, senderAddress: string, msg: InstantiateMsg, label: string, contractName?: ContractName) => {
  // upload and instantiate the contract
  const wasmBytecode = readFileSync(getContractDir(contractName));
  const uploadRes = await client.upload(senderAddress, wasmBytecode, 'auto');
  const initRes = await client.instantiate(senderAddress, uploadRes.codeId, msg, label, 'auto');
  return { ...uploadRes, ...initRes };
};

export const migrateContract = async (client: SigningCosmWasmClient, senderAddress: string, contractAddress: string, msg: MigrateMsg, contractName?: ContractName) => {
  // upload and instantiate the contract
  const wasmBytecode = readFileSync(getContractDir(contractName));
  const uploadRes = await client.upload(senderAddress, wasmBytecode, 'auto');
  const migrateRes = await client.migrate(senderAddress, contractAddress, uploadRes.codeId, msg, 'auto');
  return { ...uploadRes, ...migrateRes };
};
