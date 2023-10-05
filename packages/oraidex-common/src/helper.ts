import { ExecuteInstruction } from "@cosmjs/cosmwasm-stargate";
import { Coin, EncodeObject } from "@cosmjs/proto-signing";
import { toUtf8 } from "@cosmjs/encoding";
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";
import Long from "long";
import bech32 from "bech32";
import { AmountDetails, TokenInfo, TokenItemType, cosmosTokens, flattenTokens, oraichainTokens } from "./token";
import { TokenInfoResponse } from "@oraichain/oraidex-contracts-sdk/build/OraiswapToken.types";
import { AssetInfo, Uint128 } from "@oraichain/oraidex-contracts-sdk";
import { WRAP_BNB_CONTRACT, WRAP_ETH_CONTRACT, atomic, truncDecimals } from "./constant";
import { ethers } from "ethers";
import { CoinGeckoId, NetworkChainId } from "./network";

export const getEvmAddress = (bech32Address: string) => {
  if (!bech32Address) throw new Error("bech32 address is empty");
  try {
    const decoded = bech32.decode(bech32Address);
    const evmAddress = "0x" + Buffer.from(bech32.fromWords(decoded.words)).toString("hex");
    return evmAddress;
  } catch (error) {
    throw new Error(
      "Cannot decode the bech32 address to evm address with the given error: " + JSON.stringify({ error })
    );
  }
};

export const tronToEthAddress = (base58: string) =>
  "0x" + Buffer.from(ethers.utils.base58.decode(base58)).subarray(1, -4).toString("hex");

export const ethToTronAddress = (address: string) => {
  const evmAddress = "0x41" + address.substring(2);
  const hash = ethers.utils.sha256(ethers.utils.sha256(evmAddress));
  const checkSum = hash.substring(2, 10);
  return ethers.utils.base58.encode(evmAddress + checkSum);
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

export const toTokenInfo = (token: TokenItemType, info?: TokenInfoResponse): TokenInfo => {
  return {
    ...token,
    symbol: token.name,
    verified: !token.contractAddress,
    ...info
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

export const calculateTimeoutTimestamp = (timeout: number, dateNow?: number): string => {
  return Long.fromNumber(Math.floor((dateNow ?? Date.now()) / 1000) + timeout)
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

export const parseTokenInfo = (tokenInfo: TokenItemType, amount?: string): { fund?: Coin; info: AssetInfo } => {
  if (!tokenInfo.contractAddress) {
    return {
      fund: amount ? { denom: tokenInfo.denom, amount } : undefined,
      info: { native_token: { denom: tokenInfo.denom } }
    };
  }
  return { info: { token: { contract_addr: tokenInfo.contractAddress } } };
};

export const handleSentFunds = (...funds: (Coin | undefined)[]): Coin[] | null => {
  let sent_funds: Coin[] = [];
  for (let fund of funds) {
    if (fund) sent_funds.push(fund);
  }
  if (sent_funds.length === 0) return null;
  sent_funds.sort((a, b) => a.denom.localeCompare(b.denom));
  return sent_funds;
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

export const isEvmNetworkNativeSwapSupported = (chainId: NetworkChainId) => {
  switch (chainId) {
    case "0x01":
    case "0x38":
      return true;
    default:
      return false;
  }
};

export const parseTokenInfoRawDenom = (tokenInfo: TokenItemType) => {
  if (tokenInfo.contractAddress) return tokenInfo.contractAddress;
  return tokenInfo.denom;
};
