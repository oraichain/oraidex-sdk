import { Cw20Coin, OraiswapLimitOrderClient, OraiswapTokenClient, OraiswapTokenTypes, OraiswapLimitOrderTypes } from '@oraichain/orderbook-contracts-sdk';
import { SimulateCosmWasmClient } from '@terran-one/cw-simulate/src';
import { getContractDir } from '@oraichain/orderbook-contracts-build';

export const senderAddress = 'orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g';

export const deployToken = async (
  client: SimulateCosmWasmClient,
  { symbol, name, decimals = 6, initial_balances = [{ address: senderAddress, amount: '1000000000' }] }: { symbol: string; name: string; decimals?: number; initial_balances?: Cw20Coin[] }
): Promise<OraiswapTokenClient> => {
  return new OraiswapTokenClient(
    client,
    senderAddress,
    (
      await client.deploy<OraiswapTokenTypes.InstantiateMsg>(
        senderAddress,
        getContractDir('oraiswap_token'),
        {
          decimals,
          symbol,
          name,
          mint: { minter: senderAddress },
          initial_balances
        },
        'token',
        'auto'
      )
    ).contractAddress
  );
};

export const deployOrderbook = async (client: SimulateCosmWasmClient): Promise<OraiswapLimitOrderClient> => {
  return new OraiswapLimitOrderClient(
    client,
    senderAddress,
    (
      await client.deploy<OraiswapLimitOrderTypes.InstantiateMsg>(
        senderAddress,
        getContractDir('oraiswap_limit_order'),
        {
          admin: senderAddress,
          version: '0.0.1',
          name: 'Orderbook'
        },
        'limit_order',
        'auto'
      )
    ).contractAddress
  );
};
