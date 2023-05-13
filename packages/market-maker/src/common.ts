import { Cw20Coin, OraiswapLimitOrderClient, OraiswapTokenClient, OraiswapTokenTypes, OraiswapLimitOrderTypes, AssetInfo } from '@oraichain/orderbook-contracts-sdk';
import { deployContract } from '@oraichain/orderbook-contracts-build';
import { SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { GasPrice } from '@cosmjs/stargate';
import { stringToPath } from '@cosmjs/crypto';
import crypto from 'crypto';

export const encrypt = (password: crypto.BinaryLike, val: string) => {
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  const ENC_KEY = hash.substring(0, 32);
  const IV = hash.substring(32, 16);
  let cipher = crypto.createCipheriv('aes-256-cbc', ENC_KEY, IV);
  let encrypted = cipher.update(val, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return encrypted;
};

export const decrypt = (password: crypto.BinaryLike, encrypted: string) => {
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  const ENC_KEY = hash.substring(0, 32);
  const IV = hash.substring(32, 16);
  let decipher = crypto.createDecipheriv('aes-256-cbc', ENC_KEY, IV);
  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  return decrypted + decipher.final('utf8');
};

export type UserWallet = { address: string; client: SigningCosmWasmClient };

export async function setupWallet(mnemonic: string): Promise<UserWallet> {
  const prefix = 'orai';
  if (!mnemonic || mnemonic.length < 48) {
    throw new Error('Must set MNEMONIC to a 12 word phrase');
  }
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
    hdPaths: [stringToPath(process.env.HD_PATH || "m/44'/118'/0'/0/0")],
    prefix
  });
  const [firstAccount] = await wallet.getAccounts();
  const address = firstAccount.address;
  const client = await SigningCosmWasmClient.connectWithSigner(process.env.RPC_URL!, wallet, {
    gasPrice: GasPrice.fromString('0.002orai'),
    prefix
  });

  return { address, client };
}

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

export const deployToken = async (
  client: SigningCosmWasmClient,
  senderAddress: string,
  { symbol, name, decimals = 6, initial_balances = [] }: { symbol: string; name: string; decimals?: number; initial_balances?: Cw20Coin[] }
): Promise<OraiswapTokenClient> => {
  return new OraiswapTokenClient(
    client,
    senderAddress,
    (
      await deployContract<OraiswapTokenTypes.InstantiateMsg>(
        client,
        senderAddress,
        {
          decimals,
          symbol,
          name,
          mint: { minter: senderAddress },
          initial_balances: [{ address: senderAddress, amount: '1000000000' }, ...initial_balances]
        },
        'token',
        'oraiswap_token'
      )
    ).contractAddress
  );
};

export const deployOrderbook = async (client: SigningCosmWasmClient, senderAddress: string): Promise<OraiswapLimitOrderClient> => {
  return new OraiswapLimitOrderClient(
    client,
    senderAddress,
    (
      await deployContract<OraiswapLimitOrderTypes.InstantiateMsg>(
        client,
        senderAddress,

        {
          admin: senderAddress,
          version: '0.0.1',
          name: 'Orderbook'
        },
        'limit_order',
        'oraiswap_limit_order'
      )
    ).contractAddress
  );
};

export const cancelOrder = async (orderbook: OraiswapLimitOrderClient, sender: UserWallet, assetInfos: AssetInfo[], limit: number) => {
  const queryAll = await orderbook.orders({
    assetInfos,
    orderBy: 1,
    limit,
    filter: {
      bidder: sender.address
    }
  });
  orderbook.client = sender.client;
  orderbook.sender = sender.address;
  for (const order of queryAll.orders) {
    await orderbook.cancelOrder({
      assetInfos,
      orderId: order.order_id
    });
  }
};
