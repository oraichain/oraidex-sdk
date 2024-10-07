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
  USDT_ETH_CONTRACT,
  EvmChainId,
  proxyContractInfo,
  CosmosChainId,
  NetworkChainId,
  IBCInfo,
  generateError,
  ibcInfos,
  oraib2oraichain,
  KWT_BSC_CONTRACT,
  MILKY_BSC_CONTRACT,
  TokenItemType,
  parseTokenInfoRawDenom,
  getTokenOnOraichain,
  isEthAddress,
  PAIRS,
  ORAI_INFO,
  parseTokenInfo,
  toAmount,
  toDisplay,
  getTokenOnSpecificChainId,
  IUniswapV2Router02__factory,
  cosmosTokens,
  StargateMsg,
  isInPairList,
  BigDecimal,
  NEUTARO_INFO,
  USDC_INFO,
  network,
  ORAIX_ETH_CONTRACT,
  AmountDetails,
  handleSentFunds,
  tokenMap,
  oraib2oraichainTest,
  getSubAmountDetails,
  evmChains,
  getAxios,
  parseAssetInfoFromContractAddrOrDenom,
  parseAssetInfo,
  calculateTimeoutTimestamp,
  COSMOS_CHAIN_ID_COMMON
} from "@oraichain/oraidex-common";
import {
  ConvertReverse,
  ConvertType,
  OraiBridgeRouteData,
  Route,
  RouterConfigSmartRoute,
  RouterResponse,
  Routes,
  SimulateResponse,
  SmartRouteSwapOperations,
  SmartRouterResponse,
  SwapDirection,
  SwapOptions,
  SwapRoute,
  Type
} from "./types";
import {
  AssetInfo,
  OraiswapRouterQueryClient,
  OraiswapRouterReadOnlyInterface,
  OraiswapTokenQueryClient,
  SwapOperation
} from "@oraichain/oraidex-contracts-sdk";
import { isEqual } from "lodash";
import { ethers } from "ethers";
import { Amount, CwIcs20LatestQueryClient, Uint128 } from "@oraichain/common-contracts-sdk";
import { CosmWasmClient, ExecuteInstruction, toBinary } from "@cosmjs/cosmwasm-stargate";
import { swapFromTokens, swapToTokens } from "./swap-filter";
import { Coin } from "@cosmjs/proto-signing";
import { AXIOS_TIMEOUT, IBC_TRANSFER_TIMEOUT } from "@oraichain/common";
import { TransferBackMsg } from "@oraichain/common-contracts-sdk/build/CwIcs20Latest.types";
import { buildUniversalSwapMemo } from "./proto/universal-swap-memo-proto-handler";
import { Affiliate } from "@oraichain/oraidex-contracts-sdk/build/OraiswapMixedRouter.types";
import { generateMemoSwap, generateMsgSwap } from "./msg/msgs";
import { fromBech32, toBech32 } from "@cosmjs/encoding";

const caseSwapNativeAndWrapNative = (fromCoingecko, toCoingecko) => {
  const arr = ["ethereum", "weth"];
  return arr.includes(fromCoingecko) && arr.includes(toCoingecko);
};

const splitOnce = (s: string, seperator: string) => {
  const i = s.indexOf(seperator);
  // cannot find seperator then return string
  if (i === -1) return [s];
  return [s.slice(0, i), s.slice(i + 1)];
};

export class UniversalSwapHelper {
  // evm swap helpers
  static isSupportedNoPoolSwapEvm = (coingeckoId: CoinGeckoId) => {
    switch (coingeckoId) {
      case "wbnb":
      case "binancecoin":
      case "ethereum":
        return true;
      default:
        return false;
    }
  };

  static isEvmNetworkNativeSwapSupported = (chainId: NetworkChainId) => {
    switch (chainId) {
      case "0x01":
      case "0x38":
        return true;
      default:
        return false;
    }
  };

  static swapEvmRoutes: {
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
      [`${WRAP_ETH_CONTRACT}-${ORAI_ETH_CONTRACT}`]: [WRAP_ETH_CONTRACT, ORAI_ETH_CONTRACT],
      [`${WRAP_ETH_CONTRACT}-${USDT_ETH_CONTRACT}`]: [WRAP_ETH_CONTRACT, USDT_ETH_CONTRACT],
      // TODO: hardcode fix eth -> weth (oraichain)
      [`${WRAP_ETH_CONTRACT}-${WRAP_ETH_CONTRACT}`]: [WRAP_ETH_CONTRACT, WRAP_ETH_CONTRACT],
      [`${USDC_ETH_CONTRACT}-${USDT_ETH_CONTRACT}`]: [USDC_ETH_CONTRACT, USDT_ETH_CONTRACT],
      [`${USDC_ETH_CONTRACT}-${ORAI_ETH_CONTRACT}`]: [USDC_ETH_CONTRACT, WRAP_ETH_CONTRACT, ORAI_ETH_CONTRACT],
      [`${USDT_ETH_CONTRACT}-${ORAI_ETH_CONTRACT}`]: [USDT_ETH_CONTRACT, WRAP_ETH_CONTRACT, ORAI_ETH_CONTRACT]

      // [`${WRAP_ETH_CONTRACT}-${ORAIX_ETH_CONTRACT}`]: [WRAP_ETH_CONTRACT, ORAIX_ETH_CONTRACT]
      // [`${ORAIX_ETH_CONTRACT}-${ORAI_ETH_CONTRACT}`]: [ORAIX_ETH_CONTRACT, WRAP_ETH_CONTRACT, ORAI_ETH_CONTRACT],
      // [`${ORAIX_ETH_CONTRACT}-${USDC_ETH_CONTRACT}`]: [ORAIX_ETH_CONTRACT, WRAP_ETH_CONTRACT, USDC_ETH_CONTRACT],
      // [`${ORAIX_ETH_CONTRACT}-${USDT_ETH_CONTRACT}`]: [ORAIX_ETH_CONTRACT, WRAP_ETH_CONTRACT, USDT_ETH_CONTRACT]
    }
  };

  static buildSwapRouterKey = (fromContractAddr: string, toContractAddr: string) => {
    return `${fromContractAddr}-${toContractAddr}`;
  };

  static getEvmSwapRoute = (
    chainId: string,
    fromContractAddr?: string,
    toContractAddr?: string
  ): string[] | undefined => {
    if (!UniversalSwapHelper.isEvmNetworkNativeSwapSupported(chainId as EvmChainId)) return undefined;
    if (!fromContractAddr && !toContractAddr) return undefined;
    const chainRoutes = UniversalSwapHelper.swapEvmRoutes[chainId];
    const fromAddr = fromContractAddr || proxyContractInfo[chainId].wrapNativeAddr;
    const toAddr = toContractAddr || proxyContractInfo[chainId].wrapNativeAddr;

    // in case from / to contract addr is empty aka native eth or bnb without contract addr then we fallback to swap route with wrapped token
    // because uniswap & pancakeswap do not support simulating with native directly
    let route: string[] | undefined = chainRoutes[UniversalSwapHelper.buildSwapRouterKey(fromAddr, toContractAddr)];
    if (route) return route;
    // because the route can go both ways. Eg: WBNB->AIRI, if we want to swap AIRI->WBNB, then first we find route WBNB->AIRI, then we reverse the route
    route = chainRoutes[UniversalSwapHelper.buildSwapRouterKey(toAddr, fromContractAddr)];
    if (route) {
      return [].concat(route).reverse();
    }
    return undefined;
  };

  // static functions
  static isEvmSwappable = (data: {
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
    if (!UniversalSwapHelper.getEvmSwapRoute(fromChainId, fromContractAddr, toContractAddr)) return false;
    return true;
  };

  // ibc helpers
  static getIbcInfo = (fromChainId: CosmosChainId, toChainId: NetworkChainId): IBCInfo => {
    if (!ibcInfos[fromChainId]) throw generateError("Cannot find ibc info");
    const ibcInfo = ibcInfos[fromChainId][toChainId];
    if (!ibcInfo) throw generateError(`Cannot find ibc info from ${fromChainId} to ${toChainId}`);
    return ibcInfo;
  };

  static buildIbcWasmPairKey = (ibcPort: string, ibcChannel: string, denom: string) => {
    return `${ibcPort}/${ibcChannel}/${denom}`;
  };

  /**
   * This function converts the destination address (from BSC / ETH -> Oraichain) to an appropriate format based on the BSC / ETH token contract address
   * @param oraiAddress - receiver address on Oraichain
   * @param contractAddress - BSC / ETH token contract address
   * @returns converted receiver address
   */
  static getSourceReceiver = (
    oraiAddress: string,
    contractAddress?: string,
    isSourceReceiverTest?: boolean
  ): string => {
    let sourceReceiver = `${oraib2oraichain}/${oraiAddress}`;
    // TODO: test retire v2 (change structure memo evm -> oraichain)
    if (isSourceReceiverTest) {
      sourceReceiver = `${oraib2oraichainTest}/${oraiAddress}`;
    }

    // we only support the old oraibridge ibc channel <--> Oraichain for MILKY & KWT
    if (contractAddress === KWT_BSC_CONTRACT || contractAddress === MILKY_BSC_CONTRACT) {
      sourceReceiver = oraiAddress;
    }
    return sourceReceiver;
  };

  /**
   * This function receives fromToken and toToken as parameters to generate the destination memo for the receiver address
   * @param from - from token
   * @param to - to token
   * @param destReceiver - destination destReceiver
   * @returns destination in the format <dest-channel>/<dest-destReceiver>:<dest-denom>
   */
  static getRoute = (fromToken?: TokenItemType, toToken?: TokenItemType, destReceiver?: string): SwapRoute => {
    if (!fromToken || !toToken || !destReceiver)
      return { swapRoute: "", universalSwapType: "other-networks-to-oraichain", isSmartRouter: false };
    // this is the simplest case. Both tokens on the same Oraichain network => simple swap with to token denom
    if (fromToken.chainId === "Oraichain" && toToken.chainId === "Oraichain") {
      return { swapRoute: "", universalSwapType: "oraichain-to-oraichain", isSmartRouter: false };
    }
    // we dont need to have any swapRoute for this case
    if (fromToken.chainId === "Oraichain") {
      if (cosmosTokens.some((t) => t.chainId === toToken.chainId))
        return { swapRoute: "", universalSwapType: "oraichain-to-cosmos", isSmartRouter: false };
      return { swapRoute: "", universalSwapType: "oraichain-to-evm", isSmartRouter: false };
    }
    // TODO: support 1-step swap for kwt
    if (fromToken.chainId === "kawaii_6886-1" || fromToken.chainId === "0x1ae6") {
      throw new Error(`chain id ${fromToken.chainId} is currently not supported in universal swap`);
    }

    // let receiverPrefix = "";
    // if (isEthAddress(destReceiver)) receiverPrefix = toToken.prefix;
    // const toDenom = receiverPrefix + parseTokenInfoRawDenom(toToken);
    // const finalDestReceiver = receiverPrefix + destReceiver;
    // // we get ibc channel that transfers toToken from Oraichain to the toToken chain
    // const dstChannel = toToken.chainId == "Oraichain" ? "" : ibcInfos["Oraichain"][toToken.chainId].channel;

    // cosmos to others case where from token is a cosmos token
    // we have 2 cases: 1) Cosmos to Oraichain, 2) Cosmos to cosmos or evm
    // TODO: support swap from cosmos to oraichain through ibc hooks

    if (cosmosTokens.some((t) => t.chainId === fromToken.chainId)) {
      return { swapRoute: "", universalSwapType: "cosmos-to-others", isSmartRouter: true };
      // let swapRoute = parseToIbcHookMemo(receiverOnOrai, finalDestReceiver, dstChannel, toDenom);
      // // if from chain is noble, use ibc wasm instead of ibc hooks
      // if (fromToken.chainId == "noble-1") swapRoute = parseToIbcWasmMemo(finalDestReceiver, dstChannel, toDenom);
      // return { swapRoute, universalSwapType: "cosmos-to-others" };
    }

    if (toToken.chainId === "Oraichain") {
      // if from token is 0x38 & to token chain id is Oraichain & from token is kawaii or milky
      if (["0x38"].includes(fromToken.chainId) && ["milky-token", "kawaii-islands"].includes(fromToken.coinGeckoId))
        return { swapRoute: "", universalSwapType: "other-networks-to-oraichain", isSmartRouter: false };

      // if from token is native evm & to token chain id is Oraichain
      if (!fromToken.contractAddress && !fromToken.cosmosBased)
        return { swapRoute: "", universalSwapType: "other-networks-to-oraichain", isSmartRouter: false };

      // if to token chain id is Oraichain, then we dont need to care about ibc msg case
      // first case, two tokens are the same, only different in network => simple swap
      // if (fromToken.coinGeckoId === toToken.coinGeckoId)
      //   return {
      //     swapRoute: "",
      //     universalSwapType: "other-networks-to-oraichain",
      //     isSmartRouter: false
      //   };
      // if they are not the same then we set dest denom
      return {
        swapRoute: "",
        universalSwapType: "other-networks-to-oraichain",
        isSmartRouter: true
      };
    }

    if (["0x38", "0x01"].includes(fromToken.chainId) && fromToken.chainId === toToken.chainId) {
      return { swapRoute: "", universalSwapType: "other-networks-to-oraichain", isSmartRouter: false };
    }
    // the remaining cases where we have to process ibc msg
    return { swapRoute: "", universalSwapType: "other-networks-to-oraichain", isSmartRouter: true };
  };

  static getAddress = (prefix: string, { address60, address118 }, coinType: number = 118) => {
    const approve = {
      118: address118,
      60: address60
    };
    const { data } = fromBech32(approve[coinType]);
    return toBech32(prefix, data);
  };

  static addOraiBridgeRoute = async (
    addresses: { obridgeAddress?: string; sourceReceiver: string; injAddress?: string },
    fromToken: TokenItemType,
    toToken: TokenItemType,
    minimumReceive: string,
    destReceiver?: string,
    swapOption?: {
      isSourceReceiverTest?: boolean;
      isIbcWasm?: boolean;
      ibcInfoTestMode?: boolean;
      isAlphaIbcWasm?: boolean;
    },
    alphaSmartRoute?: RouterResponse
  ): Promise<SwapRoute> => {
    // TODO: recheck cosmos address undefined (other-chain -> oraichain)
    if (!addresses.sourceReceiver) throw generateError(`Cannot get source if the sourceReceiver is empty!`);
    const source = UniversalSwapHelper.getSourceReceiver(
      addresses.sourceReceiver,
      fromToken.contractAddress,
      swapOption?.isSourceReceiverTest
    );

    let { swapRoute, universalSwapType, isSmartRouter } = UniversalSwapHelper.getRoute(
      fromToken,
      toToken,
      destReceiver
    );

    if (isSmartRouter && swapOption.isIbcWasm) {
      if (!alphaSmartRoute && fromToken.coinGeckoId !== toToken.coinGeckoId) throw generateError(`Missing router !`);

      swapRoute = await UniversalSwapHelper.getRouteV2(
        {
          minimumReceive,
          recoveryAddr: addresses.sourceReceiver,
          destReceiver,
          remoteAddressObridge: addresses.obridgeAddress
        },
        {
          ...alphaSmartRoute,
          destAsset: parseTokenInfoRawDenom(toToken),
          destChainId: toToken.chainId,
          destTokenPrefix: toToken.prefix
        },
        swapOption.ibcInfoTestMode
      );
    }

    /**
     * useAlphaIbcWasm case: (evm -> oraichain -> osmosis -> inj/tia not using wasm)
     */
    if (swapOption.isAlphaIbcWasm) {
      if (!alphaSmartRoute) throw generateError(`Missing router with alpha ibc wasm!`);
      const routes = alphaSmartRoute.routes;
      const alphaRoutes = routes[0];

      if (alphaSmartRoute.routes.length > 1) throw generateError(`Missing router with alpha ibc wasm max length!`);

      const paths = alphaRoutes.paths.filter((_, index) => index > 0);

      const receiverAddresses = {
        [COSMOS_CHAIN_ID_COMMON.ORAICHAIN_CHAIN_ID]: addresses.sourceReceiver,
        [COSMOS_CHAIN_ID_COMMON.COSMOSHUB_CHAIN_ID]: this.getAddress("cosmos", {
          address60: addresses.injAddress,
          address118: addresses.obridgeAddress
        }),
        [COSMOS_CHAIN_ID_COMMON.OSMOSIS_CHAIN_ID]: this.getAddress("osmo", {
          address60: addresses.injAddress,
          address118: addresses.obridgeAddress
        }),
        [COSMOS_CHAIN_ID_COMMON.INJECTVE_CHAIN_ID]: addresses.injAddress,
        [COSMOS_CHAIN_ID_COMMON.CELESTIA_CHAIN_ID]: this.getAddress("celestia", {
          address60: addresses.injAddress,
          address118: addresses.obridgeAddress
        })
      };

      const { memo } = generateMemoSwap(
        {
          ...alphaRoutes,
          paths: paths
        },
        0.01,
        receiverAddresses,
        alphaRoutes.paths[0].chainId
      );

      swapRoute = memo;
    }

    if (swapRoute.length > 0) return { swapRoute: `${source}:${swapRoute}`, universalSwapType, isSmartRouter };
    return { swapRoute: source, universalSwapType, isSmartRouter };
  };

  /**
   * // TODO: add test cases
   * Complex swap routes that require a backend router to maximize return amounts.
   * @param basic
   * @param userSwap
   * @returns
   */
  static getRouteV2 = (
    basic: {
      minimumReceive: string;
      recoveryAddr: string; // source receiver also is recoveryAddr
      destReceiver?: string;
      remoteAddressObridge?: string; // add with oraibridge
    },
    userSwap: RouterResponse & { destTokenPrefix: string; destAsset: string; destChainId: string },
    ibcInfoTestMode?: boolean
  ) => {
    const { destReceiver, remoteAddressObridge } = basic;
    let receiverPrefix = "";
    let finalDestReceiver = "";
    let dstChannel = "";
    let dstDenom = "";
    const ibcInfoDestChain = ibcInfos["Oraichain"][userSwap.destChainId];
    const ibcInfo = ibcInfoTestMode ? ibcInfoDestChain.testInfo ?? ibcInfoDestChain : ibcInfoDestChain;

    if (destReceiver) {
      if (isEthAddress(destReceiver)) receiverPrefix = userSwap.destTokenPrefix;
      dstDenom = receiverPrefix + userSwap.destAsset;
      finalDestReceiver = receiverPrefix + destReceiver;
      // we get ibc channel that transfers toToken from Oraichain to the toToken chain
      dstChannel = userSwap.destChainId == "Oraichain" ? "" : ibcInfo.channel;
    }

    const destChainIdIsNoble = userSwap.destChainId === "noble-1";
    const useIbcWasm = evmChains.some((evm) => evm.chainId === userSwap.destChainId) || destChainIdIsNoble;

    return buildUniversalSwapMemo(
      basic,
      userSwap,
      // only use ibc wasm bridge when the dst chain id is OraiBridge
      finalDestReceiver && dstChannel && useIbcWasm
        ? {
            localChannelId: dstChannel,
            remoteDenom: dstDenom,
            remoteAddress: destChainIdIsNoble ? finalDestReceiver : remoteAddressObridge,
            timeout: +calculateTimeoutTimestamp(IBC_TRANSFER_TIMEOUT, Date.now()),
            memo: destChainIdIsNoble ? "" : finalDestReceiver
          }
        : undefined,
      undefined,
      // for other chains, we use ibc transfer
      finalDestReceiver && dstChannel && !useIbcWasm
        ? {
            memo: "",
            receiver: finalDestReceiver,
            sourceChannel: dstChannel,
            sourcePort: ibcInfo.source,
            recoverAddress: basic.recoveryAddr
          }
        : undefined,
      userSwap.destChainId == "Oraichain" ? { toAddress: basic.recoveryAddr } : undefined
    );
  };

  /**
   * cases:
   * <oraibridge-destination>/<orai-receiver>:<end-destination>
   * <orai-receiver>:<end-destination>
   * <first-destination>
   * <first-destination>:<final-destination-channel>/<final-receiver>:<token-identifier-on-oraichain>
   * <first-destination>:<final-receiver>
   * <first-destination>:<final-receiver>:<token-identifier-on-oraichain>
   * */
  static unmarshalOraiBridgeRoute = (destination: string) => {
    const routeData: OraiBridgeRouteData = {
      oraiBridgeChannel: "",
      oraiReceiver: "",
      finalDestinationChannel: "",
      finalReceiver: "",
      tokenIdentifier: ""
    };
    const splittedDestination = splitOnce(destination, ":");
    if (splittedDestination.length === 0 || splittedDestination.length > 2)
      throw generateError(`The destination data is malformed: ${destination}`);
    const firstDestination = splittedDestination[0].split("/");
    if (firstDestination.length === 2) {
      routeData.oraiBridgeChannel = firstDestination[0];
      routeData.oraiReceiver = firstDestination[1];
    } else if (firstDestination.length === 1) {
      routeData.oraiReceiver = firstDestination[0];
    } else throw generateError(`First destination ${JSON.stringify(firstDestination)} of ${destination} is malformed`);
    // there's nothing we need to parse anymore
    if (splittedDestination.length === 1) return routeData;
    const finalDestinationData = splittedDestination[1].split(":");
    if (finalDestinationData.length === 1) routeData.finalReceiver = finalDestinationData[0];
    else if (finalDestinationData.length === 2) {
      routeData.tokenIdentifier = finalDestinationData[1];
      const splittedFinalDestinationData = finalDestinationData[0].split("/");
      if (splittedFinalDestinationData.length === 1) routeData.finalReceiver = splittedFinalDestinationData[0];
      else if (splittedFinalDestinationData.length === 2) {
        routeData.finalDestinationChannel = splittedFinalDestinationData[0];
        routeData.finalReceiver = splittedFinalDestinationData[1];
      } else
        throw generateError(
          `splitted final destination data ${JSON.stringify(splittedFinalDestinationData)} is malformed`
        );
    } else throw generateError(`Final destination data ${JSON.stringify(finalDestinationData)} is malformed`);
    return routeData;
  };

  /**
   * @deprecated. Use UniversalSwapHelper.generateMsgsSmartRouterV2withV3
   */
  static generateSwapRoute = (offerAsset: AssetInfo, askAsset: AssetInfo, swapRoute: AssetInfo[]) => {
    const swaps = [];
    if (swapRoute.length === 0) {
      swaps.push({
        orai_swap: {
          offer_asset_info: offerAsset,
          ask_asset_info: askAsset
        }
      });
    } else {
      swaps.push({
        orai_swap: {
          offer_asset_info: offerAsset,
          ask_asset_info: swapRoute[0]
        }
      });
      for (let i = 0; i < swapRoute.length - 1; i++) {
        swaps.push({
          orai_swap: {
            offer_asset_info: swapRoute[i],
            ask_asset_info: swapRoute[i + 1]
          }
        });
      }
      swaps.push({
        orai_swap: {
          offer_asset_info: swapRoute[swapRoute.length - 1],
          ask_asset_info: askAsset
        }
      });
    }
    return swaps;
  };

  /**
   * @deprecated. Use UniversalSwapHelper.generateMsgsSmartRouterV2withV3
   */
  static generateSwapOperationMsgs = (offerInfo: AssetInfo, askInfo: AssetInfo): SwapOperation[] => {
    const pairExist = PAIRS.some((pair) => {
      const assetInfos = pair.asset_infos;
      return (
        (isEqual(assetInfos[0], offerInfo) && isEqual(assetInfos[1], askInfo)) ||
        (isEqual(assetInfos[1], offerInfo) && isEqual(assetInfos[0], askInfo))
      );
    });

    if (pairExist) return UniversalSwapHelper.generateSwapRoute(offerInfo, askInfo, []);
    // TODO: hardcode NTMPI -> USDC -> ORAI -> X
    if (isEqual(offerInfo, NEUTARO_INFO)) {
      const swapRoute = isEqual(askInfo, ORAI_INFO) ? [USDC_INFO] : [USDC_INFO, ORAI_INFO];
      return UniversalSwapHelper.generateSwapRoute(offerInfo, askInfo, swapRoute);
    }

    // TODO: X -> ORAI -> USDC -> NTMPI
    if (isEqual(askInfo, NEUTARO_INFO)) {
      const swapRoute = isEqual(offerInfo, ORAI_INFO) ? [USDC_INFO] : [ORAI_INFO, USDC_INFO];
      return UniversalSwapHelper.generateSwapRoute(offerInfo, askInfo, swapRoute);
    }

    // Default case: ORAI_INFO
    return UniversalSwapHelper.generateSwapRoute(offerInfo, askInfo, [ORAI_INFO]);
  };

  static querySmartRoute = async (
    offerInfo: AssetInfo,
    offerChainId: string,
    askInfo: AssetInfo,
    askChainId: string,
    offerAmount: string,
    routerConfig: RouterConfigSmartRoute
  ): Promise<SmartRouterResponse> => {
    const { axios } = await getAxios(routerConfig.url);
    const data = {
      sourceAsset: parseAssetInfo(offerInfo),
      sourceChainId: offerChainId,
      destAsset: parseAssetInfo(askInfo),
      destChainId: askChainId,
      offerAmount: offerAmount,
      swapOptions: {
        protocols: routerConfig.protocols,
        maxSplits: routerConfig.maxSplits,
        swapConfig: {
          dontAlowSwapAfter: routerConfig.dontAllowSwapAfter
        }
      }
    };
    const res: {
      data: SmartRouterResponse;
    } = await axios.post(routerConfig.path, data);
    return {
      swapAmount: res.data.swapAmount,
      returnAmount: res.data.returnAmount,
      routes: res.data.routes
    };
  };

  static generateSmartRouteForSwap = async (
    offerInfo: AssetInfo,
    offerChainId: string,
    askInfo: AssetInfo,
    askChainId: string,
    offerAmount: string,
    routerConfig: RouterConfigSmartRoute = {
      url: "https://osor.oraidex.io",
      path: "/smart-router",
      protocols: ["Oraidex", "OraidexV3"],
      dontAllowSwapAfter: ["Oraidex", "OraidexV3"],
      maxSplits: 10
    }
  ): Promise<SmartRouterResponse> => {
    const { returnAmount, routes } = await UniversalSwapHelper.querySmartRoute(
      offerInfo,
      offerChainId,
      askInfo,
      askChainId,
      offerAmount,
      routerConfig
    );

    return {
      swapAmount: offerAmount,
      returnAmount,
      routes
    };
  };

  /**
   * @deprecated. Use UniversalSwapHelper.handleSimulateSwap
   */
  static simulateSwap = async (query: {
    fromInfo: TokenItemType;
    toInfo: TokenItemType;
    amount: string;
    routerClient: OraiswapRouterReadOnlyInterface;
  }): Promise<{ amount: Uint128 }> => {
    const { amount, fromInfo, toInfo, routerClient } = query;

    // check for universal-swap 2 tokens that have same coingeckoId, should return simulate data with average ratio 1-1.
    if (fromInfo.coinGeckoId === toInfo.coinGeckoId) {
      return {
        amount
      };
    }

    // check if they have pairs. If not then we go through ORAI
    const { info: offerInfo } = parseTokenInfo(fromInfo, amount);
    const { info: askInfo } = parseTokenInfo(toInfo);
    const operations = UniversalSwapHelper.generateSwapOperationMsgs(offerInfo, askInfo);
    console.log("operations: ", operations);
    try {
      let finalAmount = amount;
      const data = await routerClient.simulateSwapOperations({
        offerAmount: finalAmount,
        operations
      });
      return data;
    } catch (error) {
      throw new Error(`Error when trying to simulate swap using router v2: ${JSON.stringify(error)}`);
    }
  };

  // simulate swap functions
  static simulateSwapUsingSmartRoute = async (query: {
    fromInfo: TokenItemType;
    toInfo: TokenItemType;
    amount: string;
    routerConfig?: RouterConfigSmartRoute;
  }): Promise<SmartRouterResponse> => {
    const { amount, fromInfo, toInfo, routerConfig } = query;
    // check for universal-swap 2 tokens that have same coingeckoId, should return simulate data with average ratio 1-1.
    if (fromInfo.chainId === toInfo.chainId && fromInfo.coinGeckoId === toInfo.coinGeckoId) {
      return {
        swapAmount: amount,
        returnAmount: amount,
        routes: []
      };
    }

    // check if they have pairs. If not then we go through ORAI
    const { info: offerInfo } = parseTokenInfo(fromInfo, amount);
    const { info: askInfo } = parseTokenInfo(toInfo);
    try {
      return await UniversalSwapHelper.generateSmartRouteForSwap(
        offerInfo,
        fromInfo.chainId,
        askInfo,
        toInfo.chainId,
        amount,
        routerConfig
      );
    } catch (error) {
      console.log(`Error when trying to simulate swap using smart router: ${JSON.stringify(error)}`);
      // throw new Error(`Error when trying to simulate swap using smart router: ${JSON.stringify(error)}`);
      return {
        swapAmount: "0",
        returnAmount: "0",
        routes: []
      };
    }
  };

  static simulateSwapEvm = async (query: {
    fromInfo: TokenItemType;
    toInfo: TokenItemType;
    amount: string;
  }): Promise<SimulateResponse> => {
    const { amount, fromInfo, toInfo } = query;
    // check swap native and wrap native
    const isCheckSwapNativeAndWrapNative = caseSwapNativeAndWrapNative(fromInfo.coinGeckoId, toInfo.coinGeckoId);

    // check for universal-swap 2 tokens that have same coingeckoId, should return simulate data with average ratio 1-1.
    if (fromInfo.coinGeckoId === toInfo.coinGeckoId || isCheckSwapNativeAndWrapNative) {
      return {
        // amount: toDisplay(amount, fromInfo.decimals, toInfo.decimals).toString(),
        amount: new BigDecimal(amount)
          .mul(10n ** BigInt(toInfo.decimals))
          .div(10n ** BigInt(fromInfo.decimals))
          .toString(),
        displayAmount: toDisplay(amount, fromInfo.decimals)
      };
    }
    try {
      // get proxy contract object so that we can query the corresponding router address
      const provider = new ethers.providers.JsonRpcProvider(fromInfo.rpc);
      const toTokenInfoOnSameChainId = getTokenOnSpecificChainId(toInfo.coinGeckoId, fromInfo.chainId);
      const swapRouterV2 = IUniswapV2Router02__factory.connect(
        proxyContractInfo[fromInfo.chainId].routerAddr,
        provider
      );
      const route = UniversalSwapHelper.getEvmSwapRoute(
        fromInfo.chainId,
        fromInfo.contractAddress,
        toTokenInfoOnSameChainId.contractAddress
      );
      const outs = await swapRouterV2.getAmountsOut(amount, route);
      if (outs.length === 0) throw new Error("There is no output amounts after simulating evm swap");
      const simulateAmount = outs.slice(-1)[0].toString();
      return {
        // to display to reset the simulate amount to correct display type (swap simulate from -> same chain id to, so we use same chain id toToken decimals)
        // then toAmount with actual toInfo decimals so that it has the same decimals as other tokens displayed
        amount: simulateAmount,
        displayAmount: toDisplay(simulateAmount, toTokenInfoOnSameChainId.decimals) // get the final out amount, which is the token out amount we want
      };
    } catch (ex) {
      console.log("error simulating evm: ", ex);
    }
  };

  static handleSimulateSwap = async (query: {
    originalFromInfo: TokenItemType;
    originalToInfo: TokenItemType;
    originalAmount: number;
    routerClient: OraiswapRouterReadOnlyInterface;
    routerOption?: {
      useAlphaSmartRoute?: boolean;
      useIbcWasm?: boolean;
      useAlphaIbcWasm?: boolean;
    };
    routerConfig?: RouterConfigSmartRoute;
  }): Promise<SimulateResponse> => {
    // if the from token info is on bsc or eth, then we simulate using uniswap / pancake router
    // otherwise, simulate like normal
    if (
      UniversalSwapHelper.isSupportedNoPoolSwapEvm(query.originalFromInfo.coinGeckoId) ||
      UniversalSwapHelper.isEvmSwappable({
        fromChainId: query.originalFromInfo.chainId,
        toChainId: query.originalToInfo.chainId,
        fromContractAddr: query.originalFromInfo.contractAddress,
        toContractAddr: query.originalToInfo.contractAddress
      })
    ) {
      // reset previous amount calculation since now we need to deal with original from & to info, not oraichain token info
      const { amount, displayAmount } = await UniversalSwapHelper.simulateSwapEvm({
        fromInfo: query.originalFromInfo,
        toInfo: query.originalToInfo,
        amount: toAmount(query.originalAmount, query.originalFromInfo.decimals).toString()
      });
      console.log("amount, display amount: ", { amount, displayAmount });
      return { amount, displayAmount };
    }

    const routerConfigDefault = {
      url: query?.routerConfig?.url ?? "https://osor.oraidex.io",
      path: query?.routerConfig?.path ?? "/smart-router/alpha-router",
      protocols: query?.routerConfig?.protocols ?? ["Oraidex", "OraidexV3"],
      dontAllowSwapAfter: query?.routerConfig?.dontAllowSwapAfter ?? ["Oraidex", "OraidexV3"],
      maxSplits: query?.routerConfig?.maxSplits ?? 10
    };

    let fromInfo = getTokenOnOraichain(query.originalFromInfo.coinGeckoId);
    let toInfo = getTokenOnOraichain(query.originalToInfo.coinGeckoId);

    /**
     * useAlphaIbcWasm case: (evm -> oraichain -> osmosis -> inj not using wasm)
     * useIbcWasm case: (evm -> cosmos)
     */
    if (!query?.routerOption?.useIbcWasm || query?.routerOption?.useAlphaIbcWasm) {
      fromInfo = query.originalFromInfo;
      toInfo = query.originalToInfo;
    }

    if (!fromInfo || !toInfo)
      throw new Error(`Cannot find token on Oraichain for token ${fromInfo.coinGeckoId} and ${toInfo.coinGeckoId}`);

    const simulateRes: SmartRouterResponse = await UniversalSwapHelper.simulateSwapUsingSmartRoute({
      fromInfo,
      toInfo,
      amount: toAmount(query.originalAmount, fromInfo.decimals).toString(),
      routerConfig: routerConfigDefault
    });

    const amount = simulateRes.returnAmount;
    const routes = simulateRes;
    return {
      amount,
      displayAmount: toDisplay(amount, toInfo.decimals),
      routes
    };
  };

  static checkFeeRelayer = async (query: {
    originalFromToken: TokenItemType;
    relayerFee: {
      relayerAmount: string;
      relayerDecimals: number;
    };
    fromAmount: number;
    routerClient: OraiswapRouterReadOnlyInterface;
  }): Promise<boolean> => {
    const { originalFromToken, relayerFee, fromAmount, routerClient } = query;
    if (!relayerFee || !parseInt(relayerFee.relayerAmount)) return true;
    const relayerDisplay = toDisplay(relayerFee.relayerAmount, relayerFee.relayerDecimals);

    // From Token is orai
    if (originalFromToken.coinGeckoId === "oraichain-token") {
      if (relayerDisplay >= fromAmount) return false;
      return true;
    }

    return UniversalSwapHelper.checkFeeRelayerNotOrai({
      fromTokenInOrai: getTokenOnOraichain(originalFromToken.coinGeckoId),
      fromAmount,
      relayerAmount: relayerFee.relayerAmount,
      routerClient
    });
  };

  static checkFeeRelayerNotOrai = async (query: {
    fromTokenInOrai: TokenItemType;
    fromAmount: number;
    relayerAmount: string;
    routerClient: OraiswapRouterReadOnlyInterface;
  }): Promise<boolean> => {
    const { fromTokenInOrai, fromAmount, routerClient, relayerAmount } = query;
    if (!fromTokenInOrai) return true;
    if (fromTokenInOrai.chainId !== "Oraichain")
      throw generateError(
        "From token on Oraichain is not on Oraichain. The developers have made a mistake. Please notify them!"
      );
    // estimate exchange token when From Token not orai. Only need to swap & check if it is swappable with ORAI. Otherwise, we ignore the fees
    if (isInPairList(fromTokenInOrai.denom) || isInPairList(fromTokenInOrai.contractAddress)) {
      const oraiToken = getTokenOnOraichain("oraichain-token");
      const { amount } = await UniversalSwapHelper.simulateSwap({
        fromInfo: fromTokenInOrai,
        toInfo: oraiToken,
        amount: toAmount(fromAmount, fromTokenInOrai.decimals).toString(),
        routerClient: routerClient
      });
      const amountDisplay = toDisplay(amount, fromTokenInOrai.decimals);
      const relayerAmountDisplay = toDisplay(relayerAmount);
      if (relayerAmountDisplay > amountDisplay) return false;
      return true;
    }
    return true;
  };

  // verify balance
  static checkBalanceChannelIbc = async (
    ibcInfo: IBCInfo,
    fromToken: TokenItemType,
    toToken: TokenItemType,
    toSimulateAmount: string,
    client: CosmWasmClient,
    ibcWasmContract: string
  ) => {
    try {
      let pairKey = UniversalSwapHelper.buildIbcWasmPairKey(ibcInfo.source, ibcInfo.channel, toToken.denom);
      if (toToken.prefix && toToken.contractAddress) {
        pairKey = UniversalSwapHelper.buildIbcWasmPairKey(
          ibcInfo.source,
          ibcInfo.channel,
          `${toToken.prefix}${toToken.contractAddress}`
        );
      }
      const ics20Client = new CwIcs20LatestQueryClient(client, ibcWasmContract);
      let balance: Amount;
      try {
        const { balance: channelBalance } = await ics20Client.channelWithKey({
          channelId: ibcInfo.channel,
          denom: pairKey
        });
        balance = channelBalance;
      } catch (error) {
        // do nothing because the given channel and key doesnt exist
        // console.log("error querying channel with key: ", error);
        return;
      }

      if ("native" in balance) {
        const pairMapping = await ics20Client.pairMapping({ key: pairKey });
        // @ts-ignore
        if (pairMapping.pair_mapping?.is_mint_burn) return;
        const trueBalance = toDisplay(balance.native.amount, pairMapping.pair_mapping.remote_decimals);
        let _toAmount = toDisplay(toSimulateAmount, toToken.decimals);
        if (fromToken.coinGeckoId !== toToken.coinGeckoId) {
          const fromTokenInfo = getTokenOnOraichain(fromToken.coinGeckoId);
          const toTokenInfo = getTokenOnOraichain(toToken.coinGeckoId);
          const routerClient = new OraiswapRouterQueryClient(client, network.mixer_router);
          if (!fromTokenInfo || !toTokenInfo)
            throw generateError(
              `Error in checking balance channel ibc: cannot simulate from: ${fromToken.coinGeckoId} to: ${toToken.coinGeckoId}`
            );
          const { amount } = await UniversalSwapHelper.simulateSwap({
            fromInfo: fromTokenInfo,
            toInfo: toTokenInfo,
            amount: toAmount(_toAmount, fromTokenInfo.decimals).toString(),
            routerClient
          });
          _toAmount = toDisplay(amount, fromTokenInfo.decimals);
        }
        if (trueBalance < _toAmount) throw generateError(`pair key is not enough balance!`);
      }
    } catch (error) {
      throw generateError(`Error in checking balance channel ibc: ${JSON.stringify(error)}`);
    }
  };

  static getBalanceIBCOraichain = async (token: TokenItemType, client: CosmWasmClient, ibcWasmContract: string) => {
    if (!token) return { balance: 0 };
    if (token.contractAddress) {
      const cw20Token = new OraiswapTokenQueryClient(client, token.contractAddress);
      const { balance } = await cw20Token.balance({ address: ibcWasmContract });
      return { balance: toDisplay(balance, token.decimals) };
    }
    const { amount } = await client.getBalance(ibcWasmContract, token.denom);
    return { balance: toDisplay(amount, token.decimals) };
  };

  // ORAI ( ETH ) -> check ORAI (ORAICHAIN - compare from amount with cw20 / native amount) (fromAmount) -> check AIRI - compare to amount with channel balance (ORAICHAIN) (toAmount) -> AIRI (BSC)
  // ORAI ( ETH ) -> check ORAI (ORAICHAIN) - compare from amount with cw20 / native amount) (fromAmount) -> check wTRX - compare to amount with channel balance (ORAICHAIN) (toAmount) -> wTRX (TRON)
  static checkBalanceIBCOraichain = async (
    to: TokenItemType,
    from: TokenItemType,
    fromAmount: number,
    toSimulateAmount: string,
    client: CosmWasmClient,
    ibcWasmContract: string
  ) => {
    // ORAI ( ETH ) -> check ORAI (ORAICHAIN) -> ORAI (BSC)
    // no need to check this case because users will swap directly. This case should be impossible because it is only called when transferring from evm to other networks
    if (from.chainId === "Oraichain" && to.chainId === from.chainId) return;
    // always check from token in ibc wasm should have enough tokens to swap / send to destination
    const token = getTokenOnOraichain(from.coinGeckoId);
    if (!token) return;

    // hardcode if is token factory ( mint) then return
    if (
      token.denom &&
      token.denom.includes("factory/orai1wuvhex9xqs3r539mvc6mtm7n20fcj3qr2m0y9khx6n5vtlngfzes3k0rq9")
    ) {
      return;
    }

    let ibcWasmContractAddr = ibcWasmContract;
    // TODO: check balance with kawaii token and milky token
    if (["kawaii-islands", "milky-token"].includes(from.coinGeckoId) && ["0x38"].includes(from.chainId)) {
      ibcWasmContractAddr = network.converter;
    }

    const { balance } = await UniversalSwapHelper.getBalanceIBCOraichain(token, client, ibcWasmContractAddr);
    if (balance < fromAmount) {
      throw generateError(
        `The bridge contract does not have enough balance to process this bridge transaction. Wanted ${fromAmount}, have ${balance}`
      );
    }
    // if to token is evm, then we need to evaluate channel state balance of ibc wasm
    if (to.chainId === "0x01" || to.chainId === "0x38" || to.chainId === "0x2b6653dc") {
      const ibcInfo: IBCInfo | undefined = UniversalSwapHelper.getIbcInfo("Oraichain", to.chainId);
      if (!ibcInfo) throw generateError("IBC Info error when checking ibc balance");
      await UniversalSwapHelper.checkBalanceChannelIbc(ibcInfo, from, to, toSimulateAmount, client, ibcWasmContract);
    }
  };

  static filterNonPoolEvmTokens = (
    chainId: string,
    coingeckoId: CoinGeckoId,
    denom: string,
    searchTokenName: string,
    direction: SwapDirection // direction = to means we are filtering to tokens
  ) => {
    // basic filter. Dont include itself & only collect tokens with searched letters
    const listTokens = direction === SwapDirection.From ? swapFromTokens : swapToTokens;
    let filteredToTokens = listTokens.filter(
      (token) => token.denom !== denom && token.name.toLowerCase().includes(searchTokenName.toLowerCase())
    );
    // special case for tokens not having a pool on Oraichain
    if (UniversalSwapHelper.isSupportedNoPoolSwapEvm(coingeckoId)) {
      const swappableTokens = Object.keys(UniversalSwapHelper.swapEvmRoutes[chainId]).map((key) => key.split("-")[1]);
      const filteredTokens = filteredToTokens.filter((token) => swappableTokens.includes(token.contractAddress));

      // tokens that dont have a pool on Oraichain like WETH or WBNB cannot be swapped from a token on Oraichain
      if (direction === SwapDirection.To)
        return [
          ...new Set(filteredTokens.concat(filteredTokens.map((token) => getTokenOnOraichain(token.coinGeckoId))))
        ];
      filteredToTokens = filteredTokens;
    }
    // special case filter. Tokens on networks other than supported evm cannot swap to tokens, so we need to remove them
    if (!UniversalSwapHelper.isEvmNetworkNativeSwapSupported(chainId as NetworkChainId))
      return filteredToTokens.filter((t) => {
        // one-directional swap. non-pool tokens of evm network can swap be swapped with tokens on Oraichain, but not vice versa
        const isSupported = UniversalSwapHelper.isSupportedNoPoolSwapEvm(t.coinGeckoId);
        if (direction === SwapDirection.To) return !isSupported;
        if (isSupported) {
          // if we cannot find any matched token then we dont include it in the list since it cannot be swapped
          const sameChainId = getTokenOnSpecificChainId(coingeckoId, t.chainId as NetworkChainId);
          if (!sameChainId) return false;
          return true;
        }
        return true;
      });
    return filteredToTokens.filter((t) => {
      // filter out to tokens that are on a different network & with no pool because we are not ready to support them yet. TODO: support
      if (UniversalSwapHelper.isSupportedNoPoolSwapEvm(t.coinGeckoId)) return t.chainId === chainId;
      return true;
    });
  };

  static generateConvertErc20Cw20Message = (
    amounts: AmountDetails,
    tokenInfo: TokenItemType,
    sender?: string
  ): ExecuteInstruction[] => {
    if (!tokenInfo.evmDenoms) return [];
    const subAmounts = getSubAmountDetails(amounts, tokenInfo);
    // we convert all mapped tokens to cw20 to unify the token
    for (const denom in subAmounts) {
      const balance = BigInt(subAmounts[denom] ?? "0");
      // reset so we convert using native first
      const erc20TokenInfo = tokenMap[denom];
      if (balance > 0) {
        const msgConvert: ExecuteInstruction = UniversalSwapHelper.generateConvertMsgs({
          type: Type.CONVERT_TOKEN,
          sender,
          inputAmount: balance.toString(),
          inputToken: erc20TokenInfo
        });
        return [msgConvert];
      }
    }
    return [];
  };

  static generateConvertCw20Erc20Message = (
    amounts: AmountDetails,
    tokenInfo: TokenItemType,
    sender: string,
    sendCoin: Coin
  ): ExecuteInstruction[] => {
    if (!tokenInfo.evmDenoms) return [];
    // we convert all mapped tokens to cw20 to unify the token
    for (const denom of tokenInfo.evmDenoms) {
      // optimize. Only convert if not enough balance & match denom
      if (denom !== sendCoin.denom) continue;

      // if this wallet already has enough native ibc bridge balance => no need to convert reverse
      if (+amounts[sendCoin.denom] >= +sendCoin.amount) break;

      const balance = amounts[tokenInfo.denom];
      const evmToken = tokenMap[denom];

      if (balance) {
        const outputToken: TokenItemType = {
          ...tokenInfo,
          denom: evmToken.denom,
          contractAddress: undefined,
          decimals: evmToken.decimals
        };
        const msgConvert = UniversalSwapHelper.generateConvertMsgs({
          type: Type.CONVERT_TOKEN_REVERSE,
          sender,
          inputAmount: balance,
          inputToken: tokenInfo,
          outputToken
        });
        return [msgConvert];
      }
    }
    return [];
  };

  static generateConvertMsgs = (data: ConvertType): ExecuteInstruction => {
    const { type, sender, inputToken, inputAmount } = data;
    let funds: Coin[] | null;
    // for withdraw & provide liquidity methods, we need to interact with the oraiswap pair contract
    let contractAddr = network.converter;
    let input: any;
    switch (type) {
      case Type.CONVERT_TOKEN: {
        // currently only support cw20 token pool
        const { info: assetInfo, fund } = parseTokenInfo(inputToken, inputAmount);
        // native case
        if ("native_token" in assetInfo) {
          input = {
            convert: {}
          };
          funds = handleSentFunds(fund);
        } else {
          // cw20 case
          input = {
            send: {
              contract: network.converter,
              amount: inputAmount,
              msg: toBinary({
                convert: {}
              })
            }
          };
          contractAddr = assetInfo.token.contract_addr;
        }
        break;
      }
      case Type.CONVERT_TOKEN_REVERSE: {
        const { outputToken } = data as ConvertReverse;

        // currently only support cw20 token pool
        const { info: assetInfo, fund } = parseTokenInfo(inputToken, inputAmount);
        const { info: outputAssetInfo } = parseTokenInfo(outputToken, "0");
        // native case
        if ("native_token" in assetInfo) {
          input = {
            convert_reverse: {
              from_asset: outputAssetInfo
            }
          };
          funds = handleSentFunds(fund);
        } else {
          // cw20 case
          input = {
            send: {
              contract: network.converter,
              amount: inputAmount,
              msg: toBinary({
                convert_reverse: {
                  from: outputAssetInfo
                }
              })
            }
          };
          contractAddr = assetInfo.token.contract_addr;
        }
        break;
      }
      default:
        break;
    }

    const msg: ExecuteInstruction = {
      contractAddress: contractAddr,
      msg: input,
      funds
    };

    return msg;
  };

  /**
   * Generate message swap token in Oraichain of smart route (pool v2 + v3)
   * @param routes
   * @param offerInfo
   * @returns
   */
  static generateMsgsSmartRouterV2withV3(routes, offerInfo) {
    return routes.map((route) => {
      let ops = [];
      let currTokenIn = offerInfo;
      for (let swap of route.swapInfo) {
        const [tokenX, tokenY, fee, tickSpacing] = swap.poolId.split("-");
        let tokenOut = parseAssetInfoFromContractAddrOrDenom(swap.tokenOut);
        if (tokenX && tokenY && fee && tickSpacing) {
          ops.push({
            swap_v3: {
              pool_key: {
                token_x: tokenX,
                token_y: tokenY,
                fee_tier: {
                  fee: Number(fee),
                  tick_spacing: Number(tickSpacing)
                }
              },
              x_to_y: tokenY === swap.tokenOut
            }
          });
        } else {
          ops.push({
            orai_swap: {
              offer_asset_info: currTokenIn,
              ask_asset_info: tokenOut
            }
          });
        }
        currTokenIn = tokenOut;
      }
      return {
        swapAmount: route.tokenInAmount,
        returnAmount: route.tokenOutAmount,
        swapOps: ops
      };
    });
  }

  /**
   * flatten arr route of smart router
   * @param routers
   * @returns
   */
  static flattenSmartRouters(routers: Route[]): Routes[] {
    let routesFlatten = [];
    routers.forEach((routes, i) => {
      routes.paths.forEach((path, pathIndex, pathsArray) => {
        const isLastPath = pathsArray.length === pathIndex + 1;
        const isInOraichain = path.chainId === "Oraichain";

        let objActionSwap = {
          type: "Swap",
          swapInfo: [],
          tokenIn: path.tokenIn,
          tokenOut: path.tokenOut,
          tokenInAmount: path.tokenInAmount,
          tokenOutAmount: path.tokenOutAmount
        };

        const pathsSwapInOraichain = path.actions.filter((item) => item.type === "Swap" && isInOraichain);

        path.actions.forEach((action, actionIndex, actionArray) => {
          const isLastAction = !actionArray[actionIndex + 1];
          const isSwapType = action.type === "Swap";
          const isSwapInOraichain = isSwapType && isInOraichain;

          const actionsPath = {
            ...action,
            path: i,
            chainId: path.chainId,
            isLastPath: isLastPath && isLastAction
          };

          if (isSwapInOraichain) {
            objActionSwap = {
              ...actionsPath,
              ...objActionSwap,
              tokenOutAmount: action.tokenOutAmount,
              swapInfo: [...objActionSwap.swapInfo, ...action.swapInfo]
            };

            // count type swap in oraichain
            if (
              (pathsSwapInOraichain.length > 1 && pathsSwapInOraichain.length - 1 === actionIndex) ||
              pathsSwapInOraichain.length === 1
            )
              routesFlatten.push(objActionSwap);
          } else {
            routesFlatten.push(actionsPath);
          }
        });
      });
    });
    return routesFlatten;
  }

  /**
   * Generate message and binary msg of smart route
   * @param routes
   * @param fromTokenOnOrai
   * @param to
   * @param routerContract
   * @param userSlippage
   * @param affiliates
   * @returns
   */

  static buildSwapMsgsFromSmartRoute(
    routes: SmartRouteSwapOperations[],
    fromTokenOnOrai: TokenItemType,
    to: string,
    routerContract: string,
    userSlippage: number,
    affiliates?: Affiliate[]
  ): ExecuteInstruction[] {
    const msgs: ExecuteInstruction[] = routes.map((route) => {
      const minimumReceive = Math.trunc(
        new BigDecimal(route.returnAmount).mul((100 - userSlippage) / 100).toNumber()
      ).toString();

      const swapOps = {
        execute_swap_operations: {
          operations: route.swapOps,
          minimum_receive: minimumReceive,
          to,
          affiliates
        }
      };

      // if cw20 => has to send through cw20 contract
      if (!fromTokenOnOrai.contractAddress) {
        return {
          contractAddress: routerContract,
          msg: swapOps,
          funds: handleSentFunds(parseTokenInfo(fromTokenOnOrai, route.swapAmount).fund)
        };
      } else {
        return {
          contractAddress: fromTokenOnOrai.contractAddress,
          msg: {
            send: {
              contract: routerContract,
              amount: route.swapAmount,
              msg: toBinary(swapOps)
            }
          },
          funds: []
        };
      }
    });

    return msgs;
  }
}

// evm swap helpers
/**
 * @deprecated. Use UniversalSwapHelper.isSupportedNoPoolSwapEvm
 */
export const isSupportedNoPoolSwapEvm = UniversalSwapHelper.isSupportedNoPoolSwapEvm;

/**
 * @deprecated.
 */
export const isEvmNetworkNativeSwapSupported = UniversalSwapHelper.isEvmNetworkNativeSwapSupported;

/**
 * @deprecated.
 */
export const swapEvmRoutes: {
  [network: string]: {
    [pair: string]: string[];
  };
} = UniversalSwapHelper.swapEvmRoutes;

/**
 * @deprecated.
 */
export const buildSwapRouterKey = UniversalSwapHelper.buildSwapRouterKey;

/**
 * @deprecated.
 */
export const getEvmSwapRoute = UniversalSwapHelper.getEvmSwapRoute;

// static functions
/**
 * @deprecated.
 */
export const isEvmSwappable = UniversalSwapHelper.isEvmSwappable;

// ibc helpers
/**
 * @deprecated.
 */
export const getIbcInfo = UniversalSwapHelper.getIbcInfo;

/**
 * @deprecated.
 */
export const buildIbcWasmPairKey = UniversalSwapHelper.buildIbcWasmPairKey;

/**
 * This function converts the destination address (from BSC / ETH -> Oraichain) to an appropriate format based on the BSC / ETH token contract address
 * @param oraiAddress - receiver address on Oraichain
 * @param contractAddress - BSC / ETH token contract address
 * @returns converted receiver address
 * @deprecated use UniversalSwapHelper.getSourceReceiver instead
 */
export const getSourceReceiver = UniversalSwapHelper.getSourceReceiver;

/**
 * This function receives fromToken and toToken as parameters to generate the destination memo for the receiver address
 * @param from - from token
 * @param to - to token
 * @param destReceiver - destination destReceiver
 * @returns destination in the format <dest-channel>/<dest-destReceiver>:<dest-denom>
 * @deprecated use UniversalSwapHelper.getRoute instead
 */
export const getRoute = UniversalSwapHelper.getRoute;

/**
 * @deprecated
 */
export const addOraiBridgeRoute = UniversalSwapHelper.addOraiBridgeRoute;

/**
 * cases:
 * <oraibridge-destination>/<orai-receiver>:<end-destination>
 * <orai-receiver>:<end-destination>
 * <first-destination>
 * <first-destination>:<final-destination-channel>/<final-receiver>:<token-identifier-on-oraichain>
 * <first-destination>:<final-receiver>
 * <first-destination>:<final-receiver>:<token-identifier-on-oraichain>
 * @deprecated
 * */
export const unmarshalOraiBridgeRoute = UniversalSwapHelper.unmarshalOraiBridgeRoute;

/**
 * @deprecated
 */
export const generateSwapRoute = UniversalSwapHelper.generateSwapRoute;

// generate messages
/**
 * @deprecated
 */
export const generateSwapOperationMsgs = UniversalSwapHelper.generateSwapOperationMsgs;

// simulate swap functions
/**
 * @deprecated
 */
export const simulateSwap = UniversalSwapHelper.simulateSwap;

/**
 * @deprecated
 */
export const simulateSwapEvm = UniversalSwapHelper.simulateSwapEvm;

/**
 * @deprecated
 */
export const handleSimulateSwap = UniversalSwapHelper.handleSimulateSwap;

/**
 * @deprecated
 */
export const checkFeeRelayer = UniversalSwapHelper.checkFeeRelayer;

/**
 * @deprecated
 */
export const checkFeeRelayerNotOrai = UniversalSwapHelper.checkFeeRelayerNotOrai;

// verify balance
/**
 * @deprecated
 */
export const checkBalanceChannelIbc = UniversalSwapHelper.checkBalanceChannelIbc;

/**
 * @deprecated
 */
export const getBalanceIBCOraichain = UniversalSwapHelper.getBalanceIBCOraichain;

// ORAI ( ETH ) -> check ORAI (ORAICHAIN - compare from amount with cw20 / native amount) (fromAmount) -> check AIRI - compare to amount with channel balance (ORAICHAIN) (toAmount) -> AIRI (BSC)
// ORAI ( ETH ) -> check ORAI (ORAICHAIN) - compare from amount with cw20 / native amount) (fromAmount) -> check wTRX - compare to amount with channel balance (ORAICHAIN) (toAmount) -> wTRX (TRON)
/**
 * @deprecated
 */
export const checkBalanceIBCOraichain = UniversalSwapHelper.checkBalanceIBCOraichain;

/**
 * @deprecated
 */
export const filterNonPoolEvmTokens = UniversalSwapHelper.filterNonPoolEvmTokens;

/**
 * @deprecated
 */
export const generateConvertErc20Cw20Message = UniversalSwapHelper.generateConvertErc20Cw20Message;

/**
 * @deprecated
 */
export const generateConvertCw20Erc20Message = UniversalSwapHelper.generateConvertCw20Erc20Message;

/**
 * @deprecated
 */
export const generateConvertMsgs = UniversalSwapHelper.generateConvertMsgs;
