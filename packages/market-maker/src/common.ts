import { ExecuteInstruction, SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { stringToPath } from "@cosmjs/crypto";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { GasPrice } from "@cosmjs/stargate";
import { deployContract } from "@oraichain/oraidex-contracts-build";
import {
  Addr,
  AssetInfo,
  Cw20Coin,
  OraiswapLimitOrderClient,
  OraiswapLimitOrderTypes,
  OraiswapTokenClient
} from "@oraichain/oraidex-contracts-sdk";
import crypto from "crypto";

export const encrypt = (password: string, val: string) => {
  const hashedPassword = crypto.createHash("sha256").update(password).digest();
  const IV = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", hashedPassword, IV);
  return Buffer.concat([IV, cipher.update(val), cipher.final()]).toString("base64");
};

export const decrypt = (password: string, val: string) => {
  const hashedPassword = crypto.createHash("sha256").update(password).digest();
  const encryptedText = Buffer.from(val, "base64");
  const IV = encryptedText.subarray(0, 16);
  const encrypted = encryptedText.subarray(16);
  const decipher = crypto.createDecipheriv("aes-256-cbc", hashedPassword, IV);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString();
};

export type UserWallet = { address: string; client: SigningCosmWasmClient };

export async function setupWallet(mnemonic: string): Promise<UserWallet> {
  const prefix = "orai";
  if (!mnemonic || mnemonic.length < 48) {
    throw new Error("Must set MNEMONIC to a 12 word phrase");
  }
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
    hdPaths: [stringToPath(process.env.HD_PATH || "m/44'/118'/0'/0/0")],
    prefix
  });
  const [firstAccount] = await wallet.getAccounts();
  const address = firstAccount.address;
  const client = await SigningCosmWasmClient.connectWithSigner(process.env.RPC_URL!, wallet, {
    gasPrice: GasPrice.fromString("0.002orai")
  });

  return { address, client };
}

export const getRandomRange = (min: number, max: number): number => {
  return ((Math.random() * (max - min + 1)) << 0) + min;
};

export const getCoingeckoPrice = async (token: "oraichain-token" | "airight"): Promise<number> => {
  const res = await fetch(`https://price.market.orai.io/simple/price?ids=${token}&vs_currencies=usd`).then((res) =>
    res.json()
  );
  return res[token].usd;
};

const truncDecimals = 6;
export const atomic = 10 ** truncDecimals;

export const validateNumber = (amount: number | string): number => {
  if (typeof amount === "string") return validateNumber(Number(amount));
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
  if (typeof amount === "string" && amount.indexOf(".") !== -1) amount = amount.split(".")[0];
  try {
    // guarding conditions to prevent crashing
    const validatedAmount = typeof amount === "string" ? BigInt(amount || "0") : amount;
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
  {
    symbol,
    name,
    decimals = 6,
    initial_balances = []
  }: {
    symbol: string;
    name: string;
    decimals?: number;
    initial_balances?: Cw20Coin[];
  }
): Promise<OraiswapTokenClient> => {
  return new OraiswapTokenClient(
    client,
    senderAddress,
    (
      await deployContract(client, senderAddress, "oraiswap_token", {
        decimals,
        symbol,
        name,
        mint: { minter: senderAddress },
        initial_balances: [{ address: senderAddress, amount: "1000000000" }, ...initial_balances]
      })
    ).contractAddress
  );
};

export const deployOrderbook = async (
  client: SigningCosmWasmClient,
  senderAddress: string
): Promise<OraiswapLimitOrderClient> => {
  return new OraiswapLimitOrderClient(
    client,
    senderAddress,
    (
      await deployContract(client, senderAddress, "oraiswap_limit_order", {
        admin: senderAddress,
        version: "0.0.1",
        name: "Orderbook"
      })
    ).contractAddress
  );
};

export const cancelOrder = async (
  orderbookAddress: Addr,
  sender: UserWallet,
  assetInfos: AssetInfo[],
  limit: number
) => {
  const queryAll = await sender.client.queryContractSmart(orderbookAddress, {
    orders: {
      asset_infos: assetInfos,
      order_by: 1,
      limit,
      filter: {
        bidder: sender.address
      }
    }
  } as OraiswapLimitOrderTypes.QueryMsg);

  const multipleCancelMsg: ExecuteInstruction[] = [];
  for (const order of queryAll.orders) {
    const cancelMsg: ExecuteInstruction = {
      contractAddress: orderbookAddress,
      msg: {
        cancel_order: {
          asset_infos: assetInfos,
          order_id: order.order_id
        }
      }
    };
    multipleCancelMsg.push(cancelMsg);
  }
  if (multipleCancelMsg.length > 0) {
    const cancelResult = await sender.client.executeMultiple(sender.address, multipleCancelMsg, "auto");
    console.log("cancel orders - txHash:", cancelResult.transactionHash);
  }
};
