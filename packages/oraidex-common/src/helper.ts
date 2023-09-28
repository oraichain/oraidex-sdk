import { ExecuteInstruction } from "@cosmjs/cosmwasm-stargate";
import { Coin, EncodeObject } from "@cosmjs/proto-signing";
import { toUtf8 } from "@cosmjs/encoding";
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";
import Long from "long";
import bech32 from "bech32";
import {
  AmountDetails,
  FormatNumberDecimal,
  TokenInfo,
  TokenItemType,
  cosmosTokens,
  flattenTokens,
  oraichainTokens
} from "./token";
import { TokenInfoResponse } from "@oraichain/oraidex-contracts-sdk/build/OraiswapToken.types";
import { AssetInfo, Uint128 } from "@oraichain/oraidex-contracts-sdk";
import { WRAP_BNB_CONTRACT, WRAP_ETH_CONTRACT, atomic, truncDecimals } from "./constant";
import ethers from "ethers";
import { CoinGeckoId, NetworkChainId } from "./network";

export const checkRegex = (str: string, regex?: RegExp) => {
  const re = regex ?? /^[a-zA-Z\-]{3,12}$/;
  return re.test(str);
};

export const getEvmAddress = (bech32Address: string) => {
  if (!bech32Address) return;
  const decoded = bech32.decode(bech32Address);
  const evmAddress = "0x" + Buffer.from(bech32.fromWords(decoded.words)).toString("hex");
  return evmAddress;
};

export const tronToEthAddress = (base58: string) =>
  "0x" + Buffer.from(ethers.utils.base58.decode(base58)).subarray(1, -4).toString("hex");

export const ethToTronAddress = (address: string) => {
  const evmAddress = "0x41" + address.substring(2);
  const hash = ethers.utils.sha256(ethers.utils.sha256(evmAddress));
  const checkSum = hash.substring(2, 10);
  return ethers.utils.base58.encode(evmAddress + checkSum);
};

export const validateAddressCosmos = (bech32Address: string, prefix?: string): boolean => {
  try {
    const { prefix: decodedPrefix } = bech32.decode(bech32Address);
    return prefix && prefix === decodedPrefix;
  } catch (error) {
    return false;
  }
};

export const validateNumber = (amount: number | string): number => {
  if (typeof amount === "string") return validateNumber(Number(amount));
  if (Number.isNaN(amount) || !Number.isFinite(amount)) return 0;
  return amount;
};

// decimals always >= 6
export const toAmount = (amount: number | string, decimals = 6): bigint => {
  const validatedAmount = validateNumber(amount);
  return BigInt(Math.trunc(validatedAmount * atomic)) * BigInt(10 ** (decimals - truncDecimals));
};

/**
 * Converts a fraction to its equivalent decimal value as a number.
 *
 * @param {bigint} numerator - The numerator of the fraction
 * @param {bigint} denominator - The denominator of the fraction
 * @return {number} - The decimal value equivalent to the input fraction, returned as a number.
 */
export const toDecimal = (numerator: bigint, denominator: bigint): number => {
  if (denominator === BigInt(0)) return 0;
  return toDisplay((numerator * BigInt(10 ** 6)) / denominator, 6);
};

/**
 * Convert the amount to be displayed on the user interface.
 *
 * @param {string|bigint} amount - The amount to be converted.
 * @param {number} sourceDecimals - The number of decimal places in the original `amount`.
 * @param {number} desDecimals - The number of decimal places in the `amount` after conversion.
 * @return {number} The value of `amount` after conversion.
 */
export const toDisplay = (amount: string | bigint, sourceDecimals: number = 6, desDecimals: number = 6): number => {
  if (!amount) return 0;
  // guarding conditions to prevent crashing
  const validatedAmount = typeof amount === "string" ? BigInt(amount || "0") : amount;
  const displayDecimals = Math.min(truncDecimals, desDecimals);
  const returnAmount = validatedAmount / BigInt(10 ** (sourceDecimals - displayDecimals));
  // save calculation by using cached atomic
  return Number(returnAmount) / (displayDecimals === truncDecimals ? atomic : 10 ** displayDecimals);
};

export const getSubAmountDetails = (amounts: AmountDetails, tokenInfo: TokenItemType): AmountDetails => {
  if (!tokenInfo.evmDenoms) return {};
  return Object.fromEntries(
    tokenInfo.evmDenoms.map((denom) => {
      return [denom, amounts[denom]];
    })
  );
};

/**
 * Returns a shortened string by replacing characters in between with '...'.
 * @param str The input string.
 * @param from The position of the character to be kept as-is in the resulting string.
 * @param end The number of characters to be kept as-is at the end of the resulting string.
 * @returns The shortened string, or '-' if the input string is null or undefined.
 */
export const reduceString = (str: string, from: number, end: number) => {
  return str ? str.substring(0, from) + "..." + str.substring(str.length - end) : "-";
};

export const toTokenInfo = (token: TokenItemType, info?: TokenInfoResponse): TokenInfo => {
  const data = (info as any)?.token_info_response ?? info;
  return {
    ...token,
    symbol: token.name,
    verified: !token.contractAddress,
    ...data
  };
};

export const toAssetInfo = (token: TokenInfo): AssetInfo => {
  return token.contractAddress
    ? {
        token: {
          contract_addr: token.contractAddress
        }
      }
    : { native_token: { denom: token.denom } };
};

export const formateNumberDecimals = (price: number | bigint, decimals = 2) => {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: decimals
  }).format(price);
};

export const detectBestDecimalsDisplay = (
  price: number | bigint,
  minDecimal: number = 2,
  minPrice: number = 1,
  maxDecimal: number
) => {
  if (price && price > minPrice) return minDecimal;
  let decimals = minDecimal;
  if (price !== undefined) {
    // Find out the number of leading floating zeros via regex
    const priceSplit = price?.toString().split(".");
    if (priceSplit?.length === 2 && priceSplit[0] === "0") {
      const leadingZeros = priceSplit[1].match(/^0+/);
      decimals += leadingZeros ? leadingZeros[0]?.length + 1 : 1;
    }
  }
  if (maxDecimal && decimals > maxDecimal) decimals = maxDecimal;
  return decimals;
};

export const formateNumberDecimalsAuto = ({
  price,
  maxDecimal,
  unit,
  minDecimal,
  minPrice,
  unitPosition
}: FormatNumberDecimal) => {
  minDecimal = minDecimal ? minDecimal : 2;
  minPrice = minPrice ? minPrice : 1;
  unit = unit ? unit : "";
  const priceFormat = formateNumberDecimals(price, detectBestDecimalsDisplay(price, minDecimal, minPrice, maxDecimal));
  const res = unitPosition === "prefix" ? unit + priceFormat : priceFormat + unit;
  return res;
};

export const calculateTimeoutTimestamp = (timeout: number): string => {
  return Long.fromNumber(Math.floor(Date.now() / 1000) + timeout)
    .multiply(1000000000)
    .toString();
};

export const generateError = (message: string) => {
  return { ex: { message } };
};

export const getEncodedExecuteContractMsgs = (senderAddress: string, msgs: ExecuteInstruction[]): EncodeObject[] => {
  return msgs.map(({ msg, funds, contractAddress }) => {
    return {
      typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
      value: MsgExecuteContract.fromPartial({
        sender: senderAddress,
        contract: contractAddress,
        msg: toUtf8(JSON.stringify(msg)),
        funds: funds ? (funds as Coin[]) : []
      })
    };
  });
};

export const buildMultipleExecuteMessages = (
  mainMsg?: ExecuteInstruction,
  ...preMessages: ExecuteInstruction[]
): ExecuteInstruction[] => {
  try {
    var messages: ExecuteInstruction[] = mainMsg ? [mainMsg] : [];
    messages.unshift(...preMessages.flat(1));
    return messages;
  } catch (error) {
    console.log("error in buildMultipleExecuteMessages", error);
  }
};

export const calculateMinReceive = (
  simulateAverage: string,
  fromAmount: string,
  userSlippage: number,
  decimals: number
): Uint128 => {
  const amount = BigInt(simulateAverage) * BigInt(fromAmount);
  return ((BigInt(Math.trunc(toDisplay(amount, decimals))) * (100n - BigInt(userSlippage))) / 100n).toString();
};

export const parseTokenInfo = (tokenInfo: TokenItemType, amount?: string | number) => {
  if (!tokenInfo?.contractAddress) {
    if (amount)
      return {
        fund: { denom: tokenInfo.denom, amount: amount.toString() },
        info: { native_token: { denom: tokenInfo.denom } }
      };
    return { info: { native_token: { denom: tokenInfo.denom } } };
  }
  return { info: { token: { contract_addr: tokenInfo?.contractAddress } } };
};

export const handleSentFunds = (...funds: (Coin | undefined)[]): Coin[] | null => {
  let sent_funds = [];
  for (let fund of funds) {
    if (fund) sent_funds.push(fund);
  }
  if (sent_funds.length === 0) return null;
  sent_funds.sort((a, b) => a.denom.localeCompare(b.denom));
  return sent_funds;
};

export const findTokenCoingeckoId = (tokens: TokenItemType[], coingeckoId: CoinGeckoId): TokenItemType | undefined => {
  return tokens.find((token) => token.coinGeckoId === coingeckoId);
};

// hardcode this to improve performance
export const proxyContractInfo = (): { [x: string]: { wrapNativeAddr: string; routerAddr: string } } => {
  return {
    "0x01": {
      wrapNativeAddr: ethers.utils.getAddress(WRAP_ETH_CONTRACT),
      routerAddr: ethers.utils.getAddress("0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D") // uniswap router
    },
    "0x38": {
      wrapNativeAddr: ethers.utils.getAddress(WRAP_BNB_CONTRACT),
      routerAddr: ethers.utils.getAddress("0x10ED43C718714eb63d5aA57B78B54704E256024E") // pancakeswap router
    }
  };
};

export const findToTokenOnOraiBridge = (fromToken: TokenItemType, toNetwork: NetworkChainId) => {
  const toToken = cosmosTokens.find((t) =>
    t.chainId === "oraibridge-subnet-2" && t.coinGeckoId === fromToken.coinGeckoId && t?.bridgeNetworkIdentifier
      ? t.bridgeNetworkIdentifier === toNetwork
      : t.chainId === toNetwork
  );
  return toToken;
};

export const parseAssetInfo = (assetInfo: AssetInfo): string => {
  if ("native_token" in assetInfo) return assetInfo.native_token.denom;
  return assetInfo.token.contract_addr;
};

export const getTokenOnSpecificChainId = (
  coingeckoId: CoinGeckoId,
  chainId: NetworkChainId
): TokenItemType | undefined => {
  return flattenTokens.find((t) => t.coinGeckoId === coingeckoId && t.chainId === chainId);
};

export const getTokenOnOraichain = (coingeckoId: CoinGeckoId) => {
  if (coingeckoId === "kawaii-islands" || coingeckoId === "milky-token") {
    throw new Error("KWT and MILKY not supported in this function");
  }
  return oraichainTokens.find((token) => token.coinGeckoId === coingeckoId);
};

export function isEvmNetworkNativeSwapSupported(chainId: NetworkChainId) {
  switch (chainId) {
    case "0x01":
    case "0x38":
      return true;
    default:
      return false;
  }
}
