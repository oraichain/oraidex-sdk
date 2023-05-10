import path from 'path';

const contractDir = path.join(path.dirname(module.filename), 'data');

export const getContractDir = (name: 'oraiswap_token' | 'oraiswap_limit_order') => {
  return path.join(contractDir, name + '.wasm');
};
