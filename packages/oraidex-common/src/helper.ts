import { ExecuteInstruction, JsonObject, fromBinary, toBinary, wasmTypes } from "@cosmjs/cosmwasm-stargate";
import { fromAscii, toUtf8 } from "@cosmjs/encoding";
import { Coin, EncodeObject, Registry, decodeTxRaw } from "@cosmjs/proto-signing";
import { Event, Attribute } from "@cosmjs/tendermint-rpc/build/tendermint37";
import { AssetInfo, Uint128 } from "@oraichain/oraidex-contracts-sdk";
import { TokenInfoResponse } from "@oraichain/oraidex-contracts-sdk/build/OraiswapToken.types";
import bech32 from "bech32";
import { Tx as CosmosTx } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";
import { ethers } from "ethers";
import Long from "long";
import {
  AVERAGE_COSMOS_GAS_PRICE,
  WRAP_BNB_CONTRACT,
  WRAP_ETH_CONTRACT,
  atomic,
  truncDecimals,
  GAS_ESTIMATION_BRIDGE_DEFAULT,
  MULTIPLIER,
  CW20_DECIMALS
} from "./constant";
import { CoinGeckoId, NetworkChainId, cosmosChains } from "./network";
import {
  AmountDetails,
  TokenInfo,
  TokenItemType,
  cosmosTokens,
  flattenTokens,
  oraichainTokens,
  CoinGeckoPrices,
  tokenMap
} from "./token";
import { StargateMsg, Tx } from "./tx";
import { BigDecimal } from "./bigdecimal";
import { TextProposal } from "cosmjs-types/cosmos/gov/v1beta1/gov";
import { defaultRegistryTypes as defaultStargateTypes, IndexedTx, logs, StargateClient } from "@cosmjs/stargate";
import TronWeb from "tronweb";

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

export const tronToEthAddress = (base58: string) => {
  const buffer = Buffer.from(ethers.utils.base58.decode(base58)).subarray(1, -4);
  const hexString = Array.prototype.map.call(buffer, (byte) => ("0" + byte.toString(16)).slice(-2)).join("");
  return "0x" + hexString;
};

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
      return [denom, amounts?.[denom]];
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
  mainMsg?: ExecuteInstruction[],
  ...preMessages: ExecuteInstruction[]
): ExecuteInstruction[] => {
  try {
    var messages: ExecuteInstruction[] = mainMsg ? mainMsg : [];
    messages.unshift(...preMessages.flat(1));
    return messages;
  } catch (error) {
    console.log("error in buildMultipleExecuteMessages", error);
  }
};

export const marshalEncodeObjsToStargateMsgs = (messages: EncodeObject[]): StargateMsg[] => {
  return messages.map((msg) => ({ stargate: { type_url: msg.typeUrl, value: toBinary(msg.value) } }));
};

export const calculateMinReceive = (
  simulateAverage: string,
  fromAmount: string,
  userSlippage: number,
  decimals: number
): Uint128 => {
  return Math.trunc(
    new BigDecimal(simulateAverage)
      .mul(fromAmount)
      .mul((100 - userSlippage) / 100)
      .div(10n ** BigInt(decimals))
      .toNumber()
  ).toString();
};

export const parseAssetInfoFromContractAddrOrDenom = (addressOrDenomToken: string) => {
  const tokenItem = cosmosTokens.find((cosmos) => {
    if (!cosmos.contractAddress) return cosmos.denom === addressOrDenomToken;
    return cosmos.contractAddress === addressOrDenomToken;
  });
  return parseTokenInfo(tokenItem).info;
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
export const proxyContractInfo: { [x: string]: { wrapNativeAddr: string; routerAddr: string } } = {
  "0x01": {
    wrapNativeAddr: ethers.utils.getAddress(WRAP_ETH_CONTRACT),
    routerAddr: ethers.utils.getAddress("0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D") // uniswap router
  },
  "0x38": {
    wrapNativeAddr: ethers.utils.getAddress(WRAP_BNB_CONTRACT),
    routerAddr: ethers.utils.getAddress("0x10ED43C718714eb63d5aA57B78B54704E256024E") // pancakeswap router
  }
};

export const findToTokenOnOraiBridge = (fromCoingeckoId: CoinGeckoId, toNetwork: NetworkChainId) => {
  return cosmosTokens.find(
    (t) =>
      t.chainId === "oraibridge-subnet-2" &&
      t.coinGeckoId === fromCoingeckoId &&
      t.bridgeNetworkIdentifier &&
      t.bridgeNetworkIdentifier === toNetwork
  );
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

export const getTokenOnOraichain = (coingeckoId: CoinGeckoId, decimals?: number) => {
  return oraichainTokens.find(
    (token) => token.coinGeckoId === coingeckoId && token.decimals === (decimals || CW20_DECIMALS)
  );
};

export const parseTokenInfoRawDenom = (tokenInfo: TokenItemType) => {
  if (tokenInfo.contractAddress) return tokenInfo.contractAddress;
  return tokenInfo.denom;
};

export const isEthAddress = (address: string): boolean => {
  try {
    const checkSumAddress = ethers.utils.getAddress(address);
    return ethers.utils.isAddress(checkSumAddress);
  } catch (error) {
    return false;
  }
};

export const parseRpcEvents = (events: readonly Event[]): Event[] => {
  return events.map((ev) => ({
    ...ev,
    attributes: ev.attributes.map((attr) => ({
      key: Buffer.from(attr.key, "base64").toString("utf-8"),
      value: Buffer.from(attr.value, "base64").toString("utf-8")
    }))
  }));
};

export const parseTxToMsgExecuteContractMsgs = (tx: Tx): MsgExecuteContract[] => {
  if (tx.code !== 0) return [];
  const cosmosTx = CosmosTx.decode(tx.tx);
  if (!cosmosTx.body) return [];
  const msgs: MsgExecuteContract[] = [];
  for (let i = 0; i < cosmosTx.body.messages.length; i++) {
    const msg = cosmosTx.body.messages[i];
    if (msg.typeUrl === "/cosmwasm.wasm.v1.MsgExecuteContract") {
      const msgExecuteContract = MsgExecuteContract.decode(msg.value);
      // TODO: this is an assumption that the log order is the same as the message order.
      msgs.push({ ...msgExecuteContract });
    }
  }
  return msgs;
};

export const getCosmosGasPrice = (gasPriceStep?: { low: number; average: number; high: number }): number => {
  if (gasPriceStep) {
    return gasPriceStep.average;
  }
  return AVERAGE_COSMOS_GAS_PRICE;
};

export function toObject(data: any) {
  return JSON.parse(
    JSON.stringify(
      data,
      (key, value) => (typeof value === "bigint" ? value.toString() : value) // return everything else unchanged
    )
  );
}
export const AMOUNT_BALANCE_ENTRIES: [number, string, string][] = [
  [0.25, "25%", "one-quarter"],
  [0.5, "50%", "half"],
  [0.75, "75%", "three-quarters"],
  [1, "100%", "max"]
];

export type SwapType = "Swap" | "Bridge" | "Universal Swap";
export const getSwapType = ({
  fromChainId,
  toChainId,
  fromCoingeckoId,
  toCoingeckoId
}: {
  fromChainId: NetworkChainId;
  toChainId: NetworkChainId;
  fromCoingeckoId: CoinGeckoId;
  toCoingeckoId: CoinGeckoId;
}): SwapType => {
  if (fromChainId === "Oraichain" && toChainId === "Oraichain") return "Swap";

  if (fromCoingeckoId === toCoingeckoId) return "Bridge";

  return "Universal Swap";
};

export const feeEstimate = (tokenInfo: TokenItemType, gasDefault: number) => {
  if (!tokenInfo) return 0;

  return new BigDecimal(MULTIPLIER)
    .mul(tokenInfo.feeCurrencies[0].gasPriceStep.high)
    .mul(gasDefault)
    .div(10 ** tokenInfo.decimals)
    .toNumber();
};

export const calcMaxAmount = ({
  maxAmount,
  token,
  coeff,
  gas = GAS_ESTIMATION_BRIDGE_DEFAULT
}: {
  maxAmount: number;
  token: TokenItemType;
  coeff: number;
  gas?: number;
}) => {
  if (!token) return maxAmount;

  let finalAmount = maxAmount;

  const feeCurrencyOfToken = token.feeCurrencies?.find((e) => e.coinMinimalDenom === token.denom);

  if (feeCurrencyOfToken) {
    const useFeeEstimate = feeEstimate(token, gas);

    if (coeff === 1) {
      finalAmount = useFeeEstimate > finalAmount ? 0 : new BigDecimal(finalAmount).sub(useFeeEstimate).toNumber();
    } else {
      finalAmount =
        useFeeEstimate > new BigDecimal(maxAmount).sub(new BigDecimal(finalAmount).mul(coeff)).toNumber()
          ? 0
          : finalAmount;
    }
  }

  return finalAmount;
};

export const getTotalUsd = (amounts: AmountDetails, prices: CoinGeckoPrices<string>): number => {
  let usd = 0;
  for (const denom in amounts) {
    const tokenInfo = tokenMap[denom];
    if (!tokenInfo) continue;
    const amount = toDisplay(amounts[denom], tokenInfo.decimals);
    usd += amount * (prices[tokenInfo.coinGeckoId] ?? 0);
  }
  return usd;
};

export const toSubDisplay = (amounts: AmountDetails, tokenInfo: TokenItemType): number => {
  const subAmounts = getSubAmountDetails(amounts, tokenInfo);
  return toSumDisplay(subAmounts);
};

export const toSubAmount = (amounts: AmountDetails, tokenInfo: TokenItemType): bigint => {
  const displayAmount = toSubDisplay(amounts, tokenInfo);
  return toAmount(displayAmount, tokenInfo.decimals);
};

export const toSumDisplay = (amounts: AmountDetails): number => {
  // get all native balances that are from oraibridge (ibc/...)
  let amount = 0;

  for (const denom in amounts) {
    // update later
    const balance = amounts[denom];
    if (!balance) continue;
    amount += toDisplay(balance, tokenMap[denom].decimals);
  }
  return amount;
};

export type RetryOptions = {
  retry?: number;
  timeout?: number;
  callback?: (retry: number) => void;
};

export const fetchRetry = async (url: RequestInfo | URL, options: RequestInit & RetryOptions = {}) => {
  let retry = options.retry ?? 3;
  const { callback, timeout = 30000, ...init } = options;
  init.signal = AbortSignal.timeout(timeout);
  while (retry > 0) {
    try {
      return await fetch(url, init);
    } catch (e) {
      callback?.(retry);
      retry--;
      if (retry === 0) {
        throw e;
      }
    }
  }
};

/**
 * @deprecated since version 1.0.76. Use `parseAssetInfo` instead.
 */
export function parseAssetInfoOnlyDenom(info: AssetInfo): string {
  if ("native_token" in info) return info.native_token.denom;
  return info.token.contract_addr;
}

export const decodeProto = (value: JsonObject) => {
  if (!value) throw "value is not defined";

  const typeUrl = value.type_url || value.typeUrl;
  if (typeUrl) {
    const customRegistry = new Registry([...defaultStargateTypes, ...wasmTypes]);
    customRegistry.register("/cosmos.gov.v1beta1.TextProposal", TextProposal);
    // decode proto
    return decodeProto(customRegistry.decode({ typeUrl, value: value.value }));
  }

  for (const k in value) {
    if (typeof value[k] === "string") {
      try {
        value[k] = fromBinary(value[k]);
      } catch {}
    }
    if (typeof value[k] === "object") value[k] = decodeProto(value[k]);
  }
  if (value.msg instanceof Uint8Array) value.msg = JSON.parse(fromAscii(value.msg));
  return value;
};

export const parseWasmEvents = (events: readonly Event[]): { [key: string]: string }[] => {
  const wasmEvents = events.filter((e) => e.type.startsWith("wasm"));
  const attrs: { [key: string]: string }[] = [];
  for (const wasmEvent of wasmEvents) {
    let attr: { [key: string]: string };
    for (const { key, value } of wasmEvent.attributes) {
      if (key === "_contract_address") {
        if (attr) attrs.push(attr);
        attr = {};
      }
      attr[key] = value;
    }
    attrs.push(attr);
  }
  return attrs;
};

export const parseTxToMsgsAndEvents = (indexedTx: Tx, eventsParser?: (events: readonly Event[]) => Attribute[]) => {
  if (!indexedTx) return [];
  const { rawLog, tx } = indexedTx;
  const { body } = decodeTxRaw(tx);
  const messages = body.messages.map(decodeProto);
  const logs: logs.Log[] = JSON.parse(rawLog);

  return logs.map((log) => {
    const index = log.msg_index ?? 0;
    const attrs = eventsParser ? eventsParser(log.events) : parseWasmEvents(log.events);
    return { attrs, message: messages[index] };
  });
};

export const validateAndIdentifyCosmosAddress = (address: string, network: string) => {
  try {
    const cosmosAddressRegex = /^[a-z]{1,6}[0-9a-z]{0,64}$/;
    if (!cosmosAddressRegex.test(address)) {
      throw new Error("Invalid address");
    }

    const decodedAddress = bech32.decode(address);
    const prefix = decodedAddress.prefix;

    let chainInfo;
    const networkMap = cosmosChains.reduce((acc, cur) => {
      if (cur.chainId === network) chainInfo = cur;
      return {
        ...acc,
        [cur.bech32Config.bech32PrefixAccAddr]: true
      };
    }, {});

    if (chainInfo && chainInfo.bech32Config.bech32PrefixAccAddr !== prefix) {
      throw new Error("Network doesn't match");
    }

    if (networkMap.hasOwnProperty(prefix)) {
      return {
        isValid: true,
        network
      };
    } else {
      throw new Error("Unsupported address network");
    }
  } catch (error) {
    console.log("error:", error);
    return {
      isValid: false,
      error: error.message
    };
  }
};

export const validateEvmAddress = (address: string, network: string) => {
  try {
    const isEvm = ethers.utils.isAddress(address);

    if (isEvm) {
      return {
        isValid: true,
        network
      };
    }

    return {
      isValid: false
    };
  } catch (error) {
    return {
      isValid: false
    };
  }
};

export const validateTronAddress = (address: string, network: string) => {
  try {
    if (!/T[a-zA-Z0-9]{32}/.test(address)) {
      throw new Error("Invalid tron address");
    }

    return {
      isValid: true,
      network
    };

    // const tronWeb = new TronWeb({
    //   fullHost: "https://api.trongrid.io"
    // });

    // tronWeb.trx.getAccount(address).then((isValid) => {
    //   if (isValid) {
    //     return {
    //       isValid: true,
    //       network: "0x2b6653dc" //"tron"
    //     };
    //   } else {
    //     console.error("Invalid address");

    //     return {
    //       isValid: false,
    //       network: "0x2b6653dc" //"tron"
    //     };
    //   }
    // });
  } catch (error) {
    return {
      isValid: false
    };
  }
};

export const checkValidateAddressWithNetwork = (address: string, network: NetworkChainId) => {
  switch (network) {
    case "0x01":
    case "0x38":
      return validateEvmAddress(address, network);

    // tron
    case "0x2b6653dc":
      return validateTronAddress(address, network);

    default:
      return validateAndIdentifyCosmosAddress(address, network);
  }
};
