import { EncodeObject, coin } from "@cosmjs/proto-signing";
import {
  Amount,
  CwIcs20LatestClient,
  CwIcs20LatestReadOnlyInterface,
  CwIcs20LatestQueryClient,
  Uint128
} from "@oraichain/common-contracts-sdk";
import { MsgTransfer } from "cosmjs-types/ibc/applications/transfer/v1/tx";
import { AssetInfo, OraiswapTokenQueryClient, OraiswapTokenReadOnlyInterface } from "@oraichain/oraidex-contracts-sdk";
import { ExecuteInstruction, toBinary } from "@cosmjs/cosmwasm-stargate";
import { TransferBackMsg } from "@oraichain/common-contracts-sdk/build/CwIcs20Latest.types";
import {
  TokenItemType,
  NetworkChainId,
  UniversalSwapType,
  IBCInfo,
  calculateTimeoutTimestamp,
  generateError,
  getEncodedExecuteContractMsgs,
  toDisplay,
  toAmount,
  buildMultipleExecuteMessages,
  parseTokenInfo,
  calculateMinReceive,
  handleSentFunds,
  tronToEthAddress,
  ibcInfos,
  ORAI_BRIDGE_EVM_TRON_DENOM_PREFIX,
  oraichain2oraib,
  CosmosChainId,
  IBC_WASM_CONTRACT,
  getTokensFromNetwork,
  oraichainNetwork,
  findToTokenOnOraiBridge,
  PAIRS,
  ORAI_INFO,
  getTokenOnSpecificChainId,
  CosmosWallet,
  EvmWallet,
  EvmChainId,
  swapEvmRoutes,
  proxyContractInfo,
  getTokenOnOraichain,
  isEvmNetworkNativeSwapSupported,
  UNISWAP_ROUTER_DEADLINE,
  gravityContracts,
  Bridge__factory,
  IUniswapV2Router02__factory,
  CoinGeckoId,
  ethToTronAddress
} from "@oraichain/oraidex-common";
import { SwapOperation } from "@oraichain/oraidex-contracts-sdk/build/OraiswapRouter.types";
import { isEqual } from "lodash";
import ethers, { Signer } from "ethers";

export enum SwapDirection {
  From,
  To
}

export interface SimulateResponse {
  amount: Uint128;
  displayAmount: number;
}

export interface SwapData {
  metamaskAddress?: string;
  tronAddress?: string;
}

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

export class UniversalSwapHandler {
  public toTokenInOrai: TokenItemType;
  public readonly oraichainTokens: TokenItemType[] = getTokensFromNetwork(oraichainNetwork);
  constructor(
    public swapData: {
      readonly sender: string;
      readonly originalFromToken: TokenItemType;
      readonly originalToToken: TokenItemType;
      readonly fromAmount: number;
      readonly simulateAmount: string;
      readonly userSlippage: number;
      readonly simulateAverage: string;
    },
    public config: {
      readonly cosmosWallet: CosmosWallet;
      readonly evmWallet: EvmWallet;
      readonly cwIcs20LatestClient?: CwIcs20LatestClient | CwIcs20LatestReadOnlyInterface;
    }
  ) {}

  private static buildSwapRouterKey(fromContractAddr: string, toContractAddr: string) {
    return `${fromContractAddr}-${toContractAddr}`;
  }

  static getEvmSwapRoute(chainId: string, fromContractAddr?: string, toContractAddr?: string): string[] | undefined {
    if (!isEvmNetworkNativeSwapSupported(chainId as EvmChainId)) return undefined;
    if (!fromContractAddr && !toContractAddr) return undefined;
    const chainRoutes = swapEvmRoutes[chainId];
    const fromAddr = fromContractAddr || proxyContractInfo()[chainId].wrapNativeAddr;
    const toAddr = toContractAddr || proxyContractInfo()[chainId].wrapNativeAddr;

    // in case from / to contract addr is empty aka native eth or bnb without contract addr then we fallback to swap route with wrapped token
    // because uniswap & pancakeswap do not support simulating with native directly
    let route: string[] | undefined = chainRoutes[this.buildSwapRouterKey(fromAddr, toContractAddr)];
    if (route) return route;
    // because the route can go both ways. Eg: WBNB->AIRI, if we want to swap AIRI->WBNB, then first we find route WBNB->AIRI, then we reverse the route
    route = chainRoutes[this.buildSwapRouterKey(toAddr, fromContractAddr)];
    if (route) {
      return [].concat(route).reverse();
    }
    return undefined;
  }

  // static functions
  static isEvmSwappable(data: {
    fromChainId: string;
    toChainId: string;
    fromContractAddr?: string;
    toContractAddr?: string;
  }): boolean {
    const { fromChainId, fromContractAddr, toChainId, toContractAddr } = data;
    // cant swap if they are not on the same evm chain
    if (fromChainId !== toChainId) return false;
    // cant swap on evm if chain id is not eth or bsc
    if (fromChainId !== "0x01" && fromChainId !== "0x38") return false;
    // if the tokens do not have contract addresses then we skip
    // if (!fromContractAddr || !toContractAddr) return false;
    // only swappable if there's a route to swap from -> to
    if (!this.getEvmSwapRoute(fromChainId, fromContractAddr, toContractAddr)) return false;
    return true;
  }

  getIbcInfo(fromChainId: CosmosChainId, toChainId: NetworkChainId): IBCInfo {
    if (!ibcInfos[fromChainId]) throw generateError("Cannot find ibc info");
    return ibcInfos[fromChainId][toChainId];
  }

  buildIbcWasmPairKey(ibcPort: string, ibcChannel: string, denom: string) {
    return `${ibcPort}/${ibcChannel}/${denom}`;
  }

  async getUniversalSwapToAddress(
    toChainId: NetworkChainId,
    address: { metamaskAddress?: string; tronAddress?: string }
  ): Promise<string> {
    // evm based
    if (toChainId === "0x01" || toChainId === "0x1ae6" || toChainId === "0x38") {
      return address.metamaskAddress ?? (await this.config.evmWallet.getEthAddress());
    }
    // tron
    if (toChainId === "0x2b6653dc") {
      if (address.tronAddress) return tronToEthAddress(address.tronAddress);
      const tronWeb = this.config.evmWallet.tronWeb;
      if (tronWeb && tronWeb.defaultAddress?.base58) return tronToEthAddress(tronWeb.defaultAddress.base58);
      throw "Cannot find tron web to nor tron address to send to Tron network";
    }
    return this.config.cosmosWallet.getKeplrAddr(toChainId);
  }

  /**
   * Combine messages for universal swap token from Oraichain to Cosmos networks(Osmosis | Cosmos-hub).
   * @returns combined messages
   */
  async combineMsgCosmos(timeoutTimestamp?: string): Promise<EncodeObject[]> {
    const ibcInfo: IBCInfo = this.getIbcInfo(
      this.swapData.originalFromToken.chainId as CosmosChainId,
      this.swapData.originalToToken.chainId
    );
    const toAddress = await this.config.cosmosWallet.getKeplrAddr(this.swapData.originalToToken.chainId);
    if (!toAddress) throw generateError("Please login keplr!");

    const amount = coin(this.swapData.simulateAmount, this.toTokenInOrai.denom);
    const msgTransfer = {
      typeUrl: "/ibc.applications.transfer.v1.MsgTransfer",
      value: MsgTransfer.fromPartial({
        sourcePort: ibcInfo.source,
        sourceChannel: ibcInfo.channel,
        token: amount,
        sender: this.swapData.sender,
        receiver: toAddress,
        memo: "",
        timeoutTimestamp: timeoutTimestamp ?? calculateTimeoutTimestamp(ibcInfo.timeout)
      })
    };

    // if not same coingeckoId, swap first then transfer token that have same coingeckoid.
    if (this.swapData.originalFromToken.coinGeckoId !== this.swapData.originalToToken.coinGeckoId) {
      const msgSwap = this.generateMsgsSwap();
      const msgExecuteSwap = getEncodedExecuteContractMsgs(this.swapData.sender, msgSwap);
      return [...msgExecuteSwap, msgTransfer];
    }
    return [msgTransfer];
  }

  getTranferAddress(metamaskAddress: string, tronAddress: string, channel: string) {
    let transferAddress = metamaskAddress;
    // check tron network and convert address
    if (this.swapData.originalToToken.prefix === ORAI_BRIDGE_EVM_TRON_DENOM_PREFIX) {
      transferAddress = tronToEthAddress(tronAddress);
    }
    // only allow transferring back to ethereum / bsc only if there's metamask address and when the metamask address is used, which is in the ibcMemo variable
    if (!transferAddress && (this.toTokenInOrai.evmDenoms || channel === oraichain2oraib)) {
      throw generateError("Please login metamask / tronlink!");
    }
    return transferAddress;
  }

  getIbcMemo(
    metamaskAddress: string,
    tronAddress: string,
    channel: string,
    toToken: { chainId: string; prefix: string }
  ) {
    const transferAddress = this.getTranferAddress(metamaskAddress, tronAddress, channel);
    return toToken.chainId === "oraibridge-subnet-2" ? toToken.prefix + transferAddress : "";
  }

  /**
   * Combine messages for universal swap token from Oraichain to EVM networks(BSC | Ethereum | Tron).
   * @returns combined messages
   */
  async combineMsgEvm(metamaskAddress: string, tronAddress: string) {
    let msgExecuteSwap: EncodeObject[] = [];
    // if from and to dont't have same coingeckoId, create swap msg to combine with bridge msg
    if (this.swapData.originalFromToken.coinGeckoId !== this.swapData.originalToToken.coinGeckoId) {
      const msgSwap = this.generateMsgsSwap();
      msgExecuteSwap = getEncodedExecuteContractMsgs(this.swapData.sender, msgSwap);
    }

    // then find new _toToken in Oraibridge that have same coingeckoId with originalToToken.
    const newToToken = findToTokenOnOraiBridge(this.toTokenInOrai, this.swapData.originalToToken.chainId);
    // this.swapData.originalToToken = findToTokenOnOraiBridge(this.toTokenInOrai, this.swapData.originalToToken.chainId);

    const toAddress = await this.config.cosmosWallet.getKeplrAddr(newToToken.chainId);
    if (!toAddress) throw generateError("Please login keplr!");

    const ibcInfo = this.getIbcInfo(this.swapData.originalFromToken.chainId as CosmosChainId, newToToken.chainId);
    const ibcMemo = this.getIbcMemo(metamaskAddress, tronAddress, ibcInfo.channel, {
      chainId: newToToken.chainId,
      prefix: newToToken.prefix
    });

    // create bridge msg
    const msgTransfer = this.generateMsgsTransferOraiToEvm(ibcInfo, toAddress, newToToken.denom, ibcMemo);
    const msgExecuteTransfer = getEncodedExecuteContractMsgs(this.swapData.sender, msgTransfer);
    return [...msgExecuteSwap, ...msgExecuteTransfer];
  }

  async checkBalanceChannelIbc(ibcInfo: IBCInfo, toToken: TokenItemType) {
    const { client } = await this.config.cosmosWallet.getCosmWasmClient({ chainId: "Oraichain" });
    const ics20Contract = this.config.cwIcs20LatestClient ?? new CwIcs20LatestQueryClient(client, IBC_WASM_CONTRACT);

    try {
      let pairKey = this.buildIbcWasmPairKey(ibcInfo.source, ibcInfo.channel, toToken.denom);
      if (toToken.prefix && toToken.contractAddress) {
        pairKey = this.buildIbcWasmPairKey(
          ibcInfo.source,
          ibcInfo.channel,
          `${toToken.prefix}${toToken.contractAddress}`
        );
      }
      let balance: Amount;
      try {
        const { balance: channelBalance } = await ics20Contract.channelWithKey({
          channelId: ibcInfo.channel,
          denom: pairKey
        });
        balance = channelBalance;
      } catch (error) {
        // do nothing because the given channel and key doesnt exist
        console.log("error querying channel with key: ", error);
        return;
      }

      if ("native" in balance) {
        const pairMapping = await ics20Contract.pairMapping({ key: pairKey });
        const trueBalance = toDisplay(balance.native.amount, pairMapping.pair_mapping.remote_decimals);
        const _toAmount = toDisplay(this.swapData.simulateAmount, toToken.decimals);
        if (trueBalance < _toAmount) {
          throw generateError(`pair key is not enough balance!`);
        }
      }
    } catch (error) {
      console.log({ CheckBalanceChannelIbcErrors: error });
      throw generateError(
        `Error in checking balance channel ibc: ${{
          CheckBalanceChannelIbcErrors: error
        }}`
      );
    }
  }

  getBalanceIBCOraichain = async (token: TokenItemType, tokenQueryClient?: OraiswapTokenReadOnlyInterface) => {
    const { client } = await this.config.cosmosWallet.getCosmWasmClient({ chainId: "Oraichain" });
    if (!token) return { balance: 0 };
    if (token.contractAddress) {
      const cw20Token = tokenQueryClient ?? new OraiswapTokenQueryClient(client, token.contractAddress);
      const { balance } = await cw20Token.balance({ address: IBC_WASM_CONTRACT });
      return { balance: toDisplay(balance, token.decimals) };
    }
    const { amount } = await client.getBalance(IBC_WASM_CONTRACT, token.denom);
    return { balance: toDisplay(amount, token.decimals) };
  };

  // ORAI ( ETH ) -> check ORAI (ORAICHAIN - compare from amount with cw20 / native amount) (fromAmount) -> check AIRI - compare to amount with channel balance (ORAICHAIN) (toAmount) -> AIRI (BSC)
  // ORAI ( ETH ) -> check ORAI (ORAICHAIN) - compare from amount with cw20 / native amount) (fromAmount) -> check wTRX - compare to amount with channel balance (ORAICHAIN) (toAmount) -> wTRX (TRON)
  async checkBalanceIBCOraichain(
    to: TokenItemType,
    from: TokenItemType,
    amount: {
      toAmount: string;
      fromAmount: number;
    },
    tokenQueryClient?: OraiswapTokenReadOnlyInterface
  ) {
    // ORAI ( ETH ) -> check ORAI (ORAICHAIN) -> ORAI (BSC)
    // no need to check this case because users will swap directly. This case should be impossible because it is only called when transferring from evm to other networks
    if (from.chainId === "Oraichain" && to.chainId === from.chainId) return;
    // always check from token in ibc wasm should have enough tokens to swap / send to destination
    const token = getTokenOnOraichain(from.coinGeckoId);
    if (!token) return;
    const { balance } = await this.getBalanceIBCOraichain(token, tokenQueryClient);
    if (balance < amount.fromAmount) {
      throw generateError(
        `The bridge contract does not have enough balance to process this bridge transaction. Wanted ${amount.fromAmount}, have ${balance}`
      );
    }
    // if to token is evm, then we need to evaluate channel state balance of ibc wasm
    if (to.chainId === "0x01" || to.chainId === "0x38" || to.chainId === "0x2b6653dc") {
      const ibcInfo: IBCInfo | undefined = this.getIbcInfo("Oraichain", to.chainId);
      if (!ibcInfo) throw generateError("IBC Info error when checking ibc balance");
      await this.checkBalanceChannelIbc(ibcInfo, this.swapData.originalToToken);
    }
  }

  async swap(): Promise<any> {
    const messages = this.generateMsgsSwap();
    const { client } = await this.config.cosmosWallet.getCosmWasmClient({ chainId: "Oraichain" });
    const result = await client.executeMultiple(this.swapData.sender, messages, "auto");
    return result;
  }

  public async evmSwap(data: {
    fromToken: TokenItemType;
    toTokenContractAddr: string;
    fromAmount: number;
    address: {
      metamaskAddress?: string;
      tronAddress?: string;
    };
    slippage: number; // from 1 to 100
    destination: string;
    simulateAverage: string;
  }) {
    const { fromToken, toTokenContractAddr, address, fromAmount, simulateAverage, slippage, destination } = data;
    const { metamaskAddress, tronAddress } = address;
    const signer = this.config.evmWallet.getSigner();
    const finalTransferAddress = this.config.evmWallet.getFinalEvmAddress(fromToken.chainId, {
      metamaskAddress,
      tronAddress
    });
    const finalFromAmount = toAmount(fromAmount, fromToken.decimals).toString();
    const gravityContractAddr = ethers.utils.getAddress(gravityContracts[fromToken.chainId]);
    const checkSumAddress = ethers.utils.getAddress(finalTransferAddress);
    const gravityContract = Bridge__factory.connect(gravityContractAddr, signer);
    const routerV2Addr = await gravityContract.swapRouter();
    const minimumReceive = BigInt(calculateMinReceive(simulateAverage, finalFromAmount, slippage, fromToken.decimals));
    let result: ethers.ContractTransaction;
    let fromTokenSpender = gravityContractAddr;
    // in this case, we wont use proxy contract but uniswap router instead because our proxy does not support swap tokens to native ETH.
    // approve uniswap router first before swapping because it will use transfer from to swap fromToken
    if (!toTokenContractAddr) fromTokenSpender = routerV2Addr;
    await this.config.evmWallet.checkOrIncreaseAllowance(
      fromToken,
      checkSumAddress,
      fromTokenSpender,
      finalFromAmount // increase allowance only take display form as input
    );

    // native bnb / eth case when from token contract addr is empty, then we bridge from native
    if (!fromToken.contractAddress) {
      result = await gravityContract.bridgeFromETH(
        ethers.utils.getAddress(toTokenContractAddr),
        minimumReceive, // use
        destination,
        { value: finalFromAmount }
      );
    } else if (!toTokenContractAddr) {
      const routerV2 = IUniswapV2Router02__factory.connect(routerV2Addr, signer);
      // the route is with weth or wbnb, then the uniswap router will automatically convert and transfer native eth / bnb back
      const evmRoute = UniversalSwapHandler.getEvmSwapRoute(
        fromToken.chainId,
        fromToken.contractAddress,
        toTokenContractAddr
      );

      result = await routerV2.swapExactTokensForETH(
        finalFromAmount,
        minimumReceive,
        evmRoute,
        checkSumAddress,
        new Date().getTime() + UNISWAP_ROUTER_DEADLINE
      );
    } else {
      result = await gravityContract.bridgeFromERC20(
        ethers.utils.getAddress(fromToken.contractAddress),
        ethers.utils.getAddress(toTokenContractAddr),
        finalFromAmount,
        minimumReceive, // use
        destination
      );
    }
    await result.wait();
    return { transactionHash: result.hash };
  }

  public async transferToGravity(
    token: TokenItemType,
    amountVal: string,
    from: string | null,
    to: string
  ): Promise<string> {
    const gravityContractAddr = gravityContracts[token.chainId] as string;
    console.log("gravity tron address: ", gravityContractAddr);
    const { evmWallet } = this.config;

    if (evmWallet.isTron(token.chainId)) {
      if (evmWallet.checkTron())
        return await evmWallet.submitTronSmartContract(
          ethToTronAddress(gravityContractAddr),
          "sendToCosmos(address,string,uint256)",
          {},
          [
            { type: "address", value: token.contractAddress },
            { type: "string", value: to },
            { type: "uint256", value: amountVal }
          ],
          tronToEthAddress(from) // we store the tron address in base58 form, so we need to convert to hex if its tron because the contracts are using the hex form as parameters
        );
    } else if (evmWallet.checkEthereum()) {
      // if you call this function on evm, you have to switch network before calling. Otherwise, unexpected errors may happen
      if (!gravityContractAddr || !from || !to) return;
      const gravityContract = Bridge__factory.connect(gravityContractAddr, evmWallet.getSigner());
      const result = await gravityContract.sendToCosmos(token.contractAddress, to, amountVal, { from });
      await result.wait();
      return result.hash;
    }
  }

  transferEvmToIBC = async (
    from: TokenItemType,
    fromAmount: number,
    address: {
      metamaskAddress?: string;
      tronAddress?: string;
      oraiAddress?: string;
    },
    combinedReceiver: string
  ) => {
    const { metamaskAddress, tronAddress, oraiAddress } = address;
    const finalTransferAddress = this.config.evmWallet.getFinalEvmAddress(from.chainId, {
      metamaskAddress,
      tronAddress
    });
    const oraiAddr = oraiAddress ?? (await this.config.cosmosWallet.getKeplrAddr("Oraichain"));
    if (!finalTransferAddress || !oraiAddr) throw generateError("Please login both metamask or tronlink and keplr!");
    const gravityContractAddr = gravityContracts[from!.chainId!];
    if (!gravityContractAddr || !from) {
      throw generateError("No gravity contract addr or no from token");
    }

    const finalFromAmount = toAmount(fromAmount, from.decimals).toString();
    await this.config.evmWallet.checkOrIncreaseAllowance(
      from,
      finalTransferAddress,
      gravityContractAddr,
      finalFromAmount
    );
    const result = await this.transferToGravity(from, finalFromAmount, finalTransferAddress, combinedReceiver);
    return result;
  };

  async combineMsgs(
    metamaskAddress: string,
    tronAddress: string
  ): Promise<{ encodedObjects: EncodeObject[]; type: "cosmos" | "evm" }> {
    if (
      this.swapData.originalToToken.chainId === "cosmoshub-4" ||
      this.swapData.originalToToken.chainId === "osmosis-1"
    )
      return { encodedObjects: await this.combineMsgCosmos(), type: "cosmos" };
    return { encodedObjects: await this.combineMsgEvm(metamaskAddress, tronAddress), type: "evm" };
  }

  // Universal swap from Oraichain to cosmos-hub | osmosis | EVM networks.
  async swapAndTransfer({ metamaskAddress, tronAddress }: SwapData): Promise<any> {
    // find to token in Oraichain to swap first and use this.toTokenInOrai as originalFromToken in bridge message.
    this.toTokenInOrai = this.oraichainTokens.find((t) => t.coinGeckoId === this.swapData.originalToToken.coinGeckoId);

    const { encodedObjects, type } = await this.combineMsgs(metamaskAddress, tronAddress);
    // if the msgs are meant to send to other cosmos networks, then we keep the to token as is
    // if sent to evm, then we need to convert it to the token on oraibridge so oraibridge can forward to evm
    const newToToken =
      type === "cosmos"
        ? this.swapData.originalToToken
        : findToTokenOnOraiBridge(this.toTokenInOrai, this.swapData.originalToToken.chainId);
    const ibcInfo = this.getIbcInfo(this.swapData.originalFromToken.chainId as CosmosChainId, newToToken.chainId);
    await this.checkBalanceChannelIbc(ibcInfo, newToToken);

    // handle sign and broadcast transactions
    const { client } = await this.config.cosmosWallet.getCosmWasmClient({
      chainId: "Oraichain",
      rpc: this.swapData.originalFromToken.rpc
    });
    const result = await client.signAndBroadcast(this.swapData.sender, encodedObjects, "auto");
    return result;
  }

  // transfer evm to ibc
  async transferAndSwap(combinedReceiver: string, metamaskAddress?: string, tronAddress?: string): Promise<any> {
    if (!metamaskAddress && !tronAddress) throw Error("Cannot call evm swap if the evm address is empty");

    await this.checkBalanceIBCOraichain(this.swapData.originalToToken, this.swapData.originalFromToken, {
      fromAmount: this.swapData.fromAmount,
      toAmount: this.swapData.simulateAmount
    });

    // normal case, we will transfer evm to ibc like normal when two tokens can not be swapped on evm
    // first case: BNB (bsc) <-> USDT (bsc), then swappable
    // 2nd case: BNB (bsc) -> USDT (oraichain), then find USDT on bsc. We have that and also have route => swappable
    // 3rd case: USDT (bsc) -> ORAI (bsc / Oraichain), both have pools on Oraichain, but we currently dont have the pool route on evm => not swappable => transfer to cosmos like normal
    let swappableData = {
      fromChainId: this.swapData.originalFromToken.chainId,
      toChainId: this.swapData.originalToToken.chainId,
      fromContractAddr: this.swapData.originalFromToken.contractAddress,
      toContractAddr: this.swapData.originalToToken.contractAddress
    };
    let evmSwapData = {
      fromToken: this.swapData.originalFromToken,
      toTokenContractAddr: this.swapData.originalToToken.contractAddress,
      address: { metamaskAddress, tronAddress },
      fromAmount: this.swapData.fromAmount,
      slippage: this.swapData.userSlippage,
      destination: "", // if to token already on same net with from token then no destination is needed.
      simulateAverage: this.swapData.simulateAverage
    };
    // has to switch network to the correct chain id on evm since users can swap between network tokens
    if (!this.config.evmWallet.isTron(this.swapData.originalFromToken.chainId))
      await this.config.evmWallet.switchNetwork(this.swapData.originalFromToken.chainId);
    if (UniversalSwapHandler.isEvmSwappable(swappableData)) return this.evmSwap(evmSwapData);

    const toTokenSameFromChainId = getTokenOnSpecificChainId(
      this.swapData.originalToToken.coinGeckoId,
      this.swapData.originalFromToken.chainId
    );
    if (toTokenSameFromChainId) {
      swappableData.toChainId = toTokenSameFromChainId.chainId;
      swappableData.toContractAddr = toTokenSameFromChainId.contractAddress;
      evmSwapData.toTokenContractAddr = toTokenSameFromChainId.contractAddress;
      // if to token already on same net with from token then no destination is needed
      evmSwapData.destination =
        toTokenSameFromChainId.chainId === this.swapData.originalToToken.chainId ? "" : combinedReceiver;
    }

    // special case for tokens not having a pool on Oraichain. We need to swap on evm instead then transfer to Oraichain
    if (
      UniversalSwapHandler.isEvmSwappable(swappableData) &&
      isSupportedNoPoolSwapEvm(this.swapData.originalFromToken.coinGeckoId)
    ) {
      return this.evmSwap(evmSwapData);
    }
    return this.transferEvmToIBC(
      this.swapData.originalFromToken,
      this.swapData.fromAmount,
      { metamaskAddress, tronAddress },
      combinedReceiver
    );
  }

  async processUniversalSwap(combinedReceiver: string, universalSwapType: UniversalSwapType, swapData: SwapData) {
    if (universalSwapType === "oraichain-to-oraichain") return this.swap();
    if (universalSwapType === "oraichain-to-other-networks") return this.swapAndTransfer(swapData);
    return this.transferAndSwap(combinedReceiver, swapData.metamaskAddress, swapData.tronAddress);
  }

  // generate messages
  generateSwapOperationMsgs = (offerInfo: AssetInfo, askInfo: AssetInfo): SwapOperation[] => {
    const pairExist = PAIRS.some((pair) => {
      let assetInfos = pair.asset_infos;
      return (
        (isEqual(assetInfos[0], offerInfo) && isEqual(assetInfos[1], askInfo)) ||
        (isEqual(assetInfos[1], offerInfo) && isEqual(assetInfos[0], askInfo))
      );
    });

    return pairExist
      ? [
          {
            orai_swap: {
              offer_asset_info: offerInfo,
              ask_asset_info: askInfo
            }
          }
        ]
      : [
          {
            orai_swap: {
              offer_asset_info: offerInfo,
              ask_asset_info: ORAI_INFO
            }
          },
          {
            orai_swap: {
              offer_asset_info: ORAI_INFO,
              ask_asset_info: askInfo
            }
          }
        ];
  };

  generateMsgsSwap() {
    let input: any;
    let contractAddr: string = "";
    try {
      const _fromAmount = toAmount(this.swapData.fromAmount, this.swapData.originalFromToken.decimals).toString();

      const minimumReceive = calculateMinReceive(
        this.swapData.simulateAverage,
        _fromAmount,
        this.swapData.userSlippage,
        this.swapData.originalFromToken.decimals
      );
      const { fund: offerSentFund, info: offerInfo } = parseTokenInfo(this.swapData.originalFromToken, _fromAmount);
      const { fund: askSentFund, info: askInfo } = parseTokenInfo(this.toTokenInOrai ?? this.swapData.originalToToken);
      const funds = handleSentFunds(offerSentFund, askSentFund);
      let inputTemp = {
        execute_swap_operations: {
          operations: this.generateSwapOperationMsgs(offerInfo, askInfo),
          minimum_receive: minimumReceive
        }
      };
      // if cw20 => has to send through cw20 contract
      if (!this.swapData.originalFromToken.contractAddress) {
        input = inputTemp;
      } else {
        input = {
          send: {
            contract: contractAddr,
            amount: _fromAmount,
            msg: toBinary(inputTemp)
          }
        };
        contractAddr = this.swapData.originalFromToken.contractAddress;
      }
      const msg: ExecuteInstruction = {
        contractAddress: contractAddr,
        msg: input,
        funds
      };

      return buildMultipleExecuteMessages(msg);
    } catch (error) {
      throw new Error(`Error generateMsgsSwap: ${error}`);
    }
  }

  /**
   * Generate message to transfer token from Oraichain to EVM networks.
   * Example: AIRI/Oraichain -> AIRI/BSC
   * @param ibcInfo
   * @param toAddress
   * @param ibcMemo
   * @returns
   */
  generateMsgsTransferOraiToEvm(ibcInfo: IBCInfo, toAddress: string, remoteDenom: string, ibcMemo: string) {
    try {
      const { info: assetInfo } = parseTokenInfo(this.toTokenInOrai);

      const ibcWasmContractAddress = ibcInfo.source.split(".")[1];
      if (!ibcWasmContractAddress)
        throw generateError("IBC Wasm source port is invalid. Cannot transfer to the destination chain");

      const msg: TransferBackMsg = {
        local_channel_id: ibcInfo.channel,
        remote_address: toAddress,
        remote_denom: remoteDenom,
        timeout: ibcInfo.timeout,
        memo: ibcMemo
      };

      // if asset info is native => send native way, else send cw20 way
      if (assetInfo.native_token) {
        const executeMsgSend = {
          transfer_to_remote: msg
        };

        const msgs: ExecuteInstruction = {
          contractAddress: ibcWasmContractAddress,
          msg: executeMsgSend,
          funds: [
            {
              amount: this.swapData.simulateAmount,
              denom: assetInfo.native_token.denom
            }
          ]
        };
        return buildMultipleExecuteMessages(msgs);
      }

      const executeMsgSend = {
        send: {
          contract: ibcWasmContractAddress,
          amount: this.swapData.simulateAmount,
          msg: toBinary(msg)
        }
      };

      // generate contract message for CW20 token in Oraichain.
      // Example: tranfer USDT/Oraichain -> AIRI/BSC. _toTokenInOrai is AIRI in Oraichain.
      const msgs: ExecuteInstruction = {
        contractAddress: this.toTokenInOrai.contractAddress,
        msg: executeMsgSend,
        funds: []
      };
      return buildMultipleExecuteMessages(msgs);
    } catch (error) {
      console.log({ error });
    }
  }
}
