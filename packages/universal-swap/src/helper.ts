import {
  CoinGeckoId,
  WRAP_BNB_CONTRACT,
  USDT_BSC_CONTRACT,
  USDT_TRON_CONTRACT,
  ORAI_ETH_CONTRACT,
  ORAI_BSC_CONTRACT,
  AIRI_BSC_CONTRACT,
  WRAP_ETH_CONTRACT,
  USDC_ETH_CONTRACT,
  EvmChainId,
  proxyContractInfo,
  CosmosChainId,
  NetworkChainId,
  IBCInfo,
  generateError,
  ibcInfos
} from "@oraichain/oraidex-common";

// evm swap helpers
export const isSupportedNoPoolSwapEvm = (coingeckoId: CoinGeckoId) => {
  switch (coingeckoId) {
    case "wbnb":
    case "weth":
    case "binancecoin":
    case "ethereum":
      return true;
    default:
      return false;
  }
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

export const swapEvmRoutes: {
  [network: string]: {
    [pair: string]: string[];
  };
} = {
  "0x38": {
    [`${WRAP_BNB_CONTRACT}-${USDT_BSC_CONTRACT}`]: [WRAP_BNB_CONTRACT, USDT_BSC_CONTRACT],
    [`${WRAP_BNB_CONTRACT}-${USDT_TRON_CONTRACT}`]: [WRAP_BNB_CONTRACT, USDT_BSC_CONTRACT],
    [`${WRAP_BNB_CONTRACT}-${ORAI_ETH_CONTRACT}`]: [WRAP_BNB_CONTRACT, ORAI_BSC_CONTRACT],
    [`${WRAP_BNB_CONTRACT}-${ORAI_BSC_CONTRACT}`]: [WRAP_BNB_CONTRACT, ORAI_BSC_CONTRACT],
    [`${WRAP_BNB_CONTRACT}-${AIRI_BSC_CONTRACT}`]: [WRAP_BNB_CONTRACT, AIRI_BSC_CONTRACT],
    [`${USDT_BSC_CONTRACT}-${AIRI_BSC_CONTRACT}`]: [USDT_BSC_CONTRACT, WRAP_BNB_CONTRACT, AIRI_BSC_CONTRACT],
    [`${USDT_BSC_CONTRACT}-${ORAI_BSC_CONTRACT}`]: [USDT_BSC_CONTRACT, WRAP_BNB_CONTRACT, ORAI_BSC_CONTRACT],
    [`${ORAI_BSC_CONTRACT}-${AIRI_BSC_CONTRACT}`]: [ORAI_BSC_CONTRACT, WRAP_BNB_CONTRACT, AIRI_BSC_CONTRACT]
  },
  "0x01": {
    [`${WRAP_ETH_CONTRACT}-${USDC_ETH_CONTRACT}`]: [WRAP_ETH_CONTRACT, USDC_ETH_CONTRACT],
    [`${WRAP_ETH_CONTRACT}-${ORAI_ETH_CONTRACT}`]: [WRAP_ETH_CONTRACT, ORAI_ETH_CONTRACT]
  }
};

export const buildSwapRouterKey = (fromContractAddr: string, toContractAddr: string) => {
  return `${fromContractAddr}-${toContractAddr}`;
};

export const getEvmSwapRoute = (
  chainId: string,
  fromContractAddr?: string,
  toContractAddr?: string
): string[] | undefined => {
  if (!isEvmNetworkNativeSwapSupported(chainId as EvmChainId)) return undefined;
  if (!fromContractAddr && !toContractAddr) return undefined;
  const chainRoutes = swapEvmRoutes[chainId];
  const fromAddr = fromContractAddr || proxyContractInfo()[chainId].wrapNativeAddr;
  const toAddr = toContractAddr || proxyContractInfo()[chainId].wrapNativeAddr;

  // in case from / to contract addr is empty aka native eth or bnb without contract addr then we fallback to swap route with wrapped token
  // because uniswap & pancakeswap do not support simulating with native directly
  let route: string[] | undefined = chainRoutes[buildSwapRouterKey(fromAddr, toContractAddr)];
  if (route) return route;
  // because the route can go both ways. Eg: WBNB->AIRI, if we want to swap AIRI->WBNB, then first we find route WBNB->AIRI, then we reverse the route
  route = chainRoutes[buildSwapRouterKey(toAddr, fromContractAddr)];
  if (route) {
    return [].concat(route).reverse();
  }
  return undefined;
};

// static functions
export const isEvmSwappable = (data: {
  fromChainId: string;
  toChainId: string;
  fromContractAddr?: string;
  toContractAddr?: string;
}): boolean => {
  const { fromChainId, fromContractAddr, toChainId, toContractAddr } = data;
  // cant swap if they are not on the same evm chain
  if (fromChainId !== toChainId) return false;
  // cant swap on evm if chain id is not eth or bsc
  if (fromChainId !== "0x01" && fromChainId !== "0x38") return false;
  // if the tokens do not have contract addresses then we skip
  // if (!fromContractAddr || !toContractAddr) return false;
  // only swappable if there's a route to swap from -> to
  if (!getEvmSwapRoute(fromChainId, fromContractAddr, toContractAddr)) return false;
  return true;
};

// ibc helpers
export const getIbcInfo = (fromChainId: CosmosChainId, toChainId: NetworkChainId): IBCInfo => {
  if (!ibcInfos[fromChainId]) throw generateError("Cannot find ibc info");
  return ibcInfos[fromChainId][toChainId];
};

export const buildIbcWasmPairKey = (ibcPort: string, ibcChannel: string, denom: string) => {
  return `${ibcPort}/${ibcChannel}/${denom}`;
};
