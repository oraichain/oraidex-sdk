import { SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { readFileSync } from 'fs';
import path from 'path';

const contractDir = path.join(path.dirname(module.filename), 'data');

export type ContractName = 'oraiswap_token' | 'oraiswap_limit_order' | 'oraiswap_pair' | 'oraiswap_oracle' | 'oraiswap_converter' | 'oraiswap_factory' | 'oraiswap_rewarder' | 'oraiswap_router' | 'oraiswap_staking';

export const getContractDir = (name: ContractName = 'oraiswap_limit_order') => {
  return path.join(contractDir, name + '.wasm');
};

export const deployContract = async <T>(client: SigningCosmWasmClient, senderAddress: string, msg: T, label: string, contractName?: ContractName) => {
  // upload and instantiate the contract
  const wasmBytecode = readFileSync(getContractDir(contractName));
  const uploadRes = await client.upload(senderAddress, wasmBytecode, 'auto');
  const initRes = await client.instantiate(senderAddress, uploadRes.codeId, msg, label, 'auto');
  return { ...uploadRes, ...initRes };
};

export const migrateContract = async <T>(client: SigningCosmWasmClient, senderAddress: string, contractAddress: string, msg: T, contractName?: ContractName) => {
  // upload and instantiate the contract
  const wasmBytecode = readFileSync(getContractDir(contractName));
  const uploadRes = await client.upload(senderAddress, wasmBytecode, 'auto');
  const migrateRes = await client.migrate(senderAddress, contractAddress, uploadRes.codeId, msg, 'auto');
  return { ...uploadRes, ...migrateRes };
};
