import { Cw20Coin, OraiswapLimitOrderClient, OraiswapTokenClient, OraiswapTokenTypes, OraiswapLimitOrderTypes } from '@oraichain/orderbook-contracts-sdk';
import { SimulateCosmWasmClient } from '@terran-one/cw-simulate/src';
import { getContractDir } from '@oraichain/orderbook-contracts-build';

export const bobAddress = 'orai18cgmaec32hgmd8ls8w44hjn25qzjwhannd9kpj';
export const aliceAddress = 'orai1hz4kkphvt0smw4wd9uusuxjwkp604u7m4akyzv';
export const senderAddress = 'orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g';

export const deployToken = async (client: SimulateCosmWasmClient, { symbol, name, decimals = 6, initial_balances }: { symbol: string; name: string; decimals?: number; initial_balances?: Cw20Coin[] }): Promise<OraiswapTokenClient> => {
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
          initial_balances: [{ address: senderAddress, amount: '1000000000' }, ...initial_balances]
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

export const getRandomRange = (min: number, max: number): number => {
  return ((Math.random() * (max - min + 1)) << 0) + min;
};

export const getCoingeckoPrice = async (token: 'oraichain-token' | 'airight'): Promise<number> => {
  const res = await fetch(`https://price.market.orai.io/simple/price?ids=${token}&vs_currencies=usd`).then((res) => res.json());
  return res[token].usd;
};

const truncDecimals = 6;
export const atomic = 10 ** truncDecimals;

export const validateNumber = (amount: number | string): number => {
  if (typeof amount === 'string') return validateNumber(Number(amount));
  if (Number.isNaN(amount) || !Number.isFinite(amount)) return 0;
  return amount;
};

export const toDecimals = (num: number, decimals: number = 9): string => {
  return (num * 10 ** decimals).toFixed();
};

// decimals always >= 6
export const toAmount = (amount: number, decimals = 6): bigint => {
  const validatedAmount = validateNumber(amount);
  return BigInt(Math.trunc(validatedAmount * atomic)) * BigInt(10 ** (decimals - truncDecimals));
};

export const toDecimal = (numerator: bigint, denominator: bigint): number => {
  if (denominator === BigInt(0)) return 0;
  return toDisplay((numerator * BigInt(atomic)) / denominator, truncDecimals);
};

export const toDisplay = (amount: string | bigint, sourceDecimals = 6, desDecimals = 6): number => {
  if (!amount) return 0;
  if (typeof amount === 'string' && amount.indexOf('.') !== -1) amount = amount.split('.')[0];
  try {
    // guarding conditions to prevent crashing
    const validatedAmount = typeof amount === 'string' ? BigInt(amount || '0') : amount;
    const displayDecimals = Math.min(truncDecimals, desDecimals);
    const returnAmount = validatedAmount / BigInt(10 ** (sourceDecimals - displayDecimals));
    // save calculation by using cached atomic
    return Number(returnAmount) / (displayDecimals === truncDecimals ? atomic : 10 ** displayDecimals);
  } catch {
    return 0;
  }
};

export const getSpreadPrice = (price: number, spreadDecimal: number, desDecimals = 6) => {
  return Number((price * (1 + spreadDecimal)).toFixed(desDecimals));
};

/**
 *
 * @returns percentage between 0 and 100
 */
export const getRandomPercentage = () => {
  return Math.round(Math.random() * 99) + 1;
};
