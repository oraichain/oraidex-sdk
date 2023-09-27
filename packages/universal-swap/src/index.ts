import { EncodeObject, coin } from "@cosmjs/proto-signing";
import {
  Amount,
  CwIcs20LatestClient,
  CwIcs20LatestReadOnlyInterface,
  CwIcs20LatestQueryClient,
  Uint128
} from "@oraichain/common-contracts-sdk";
import { MsgTransfer } from "cosmjs-types/ibc/applications/transfer/v1/tx";
import { OraiswapTokenReadOnlyInterface } from "@oraichain/oraidex-contracts-sdk";
import { ExecuteInstruction, toBinary } from "@cosmjs/cosmwasm-stargate";
import { GasPrice } from "@cosmjs/stargate";
import { TransferBackMsg } from "@oraichain/common-contracts-sdk/build/CwIcs20Latest.types";
import {
  TokenItemType,
  NetworkChainId,
  UniversalSwapType,
  IBCInfo,
  IBCInfoMap,
  calculateTimeoutTimestamp,
  generateError,
  getEncodedExecuteContractMsgs,
  toDisplay,
  ORAI,
  toAmount,
  buildMultipleExecuteMessages,
  parseTokenInfo,
  calculateMinReceive,
  handleSentFunds
} from "@oraichain/oraidex-common";

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

export class UniversalSwapHandler {
  public toTokenInOrai: TokenItemType;
  constructor(
    public data: {
      sender: string;
      originalFromToken: TokenItemType;
      originalToToken: TokenItemType;
      fromAmount: number;
      simulateAmount: string;
      userSlippage: number;
      simulateAverage: string;
      ibcInfos: IBCInfoMap;
      wallet: UniversalWallet;
      cwIcs20LatestClient?: CwIcs20LatestClient | CwIcs20LatestReadOnlyInterface;
    }
  ) {}

  // async getUniversalSwapToAddress(
  //   toChainId: NetworkChainId,
  //   address: { metamaskAddress?: string; tronAddress?: string }
  // ): Promise<string> {
  //   // evm based
  //   if (toChainId === "0x01" || toChainId === "0x1ae6" || toChainId === "0x38") {
  //     return address.metamaskAddress ?? (await window.Metamask.getEthAddress());
  //   }
  //   // tron
  //   if (toChainId === "0x2b6653dc") {
  //     if (address.tronAddress) return tronToEthAddress(address.tronAddress);
  //     if (window.tronLink && window.tronWeb && window.tronWeb.defaultAddress?.base58)
  //       return tronToEthAddress(window.tronWeb.defaultAddress.base58);
  //     throw "Cannot find tron web to nor tron address to send to Tron network";
  //   }
  //   return window.Keplr.getKeplrAddr(toChainId);
  // }

  /**
   * Combine messages for universal swap token from Oraichain to Cosmos networks(Osmosis | Cosmos-hub).
   * @returns combined messages
   */
  async combineMsgCosmos(timeoutTimestamp?: string): Promise<EncodeObject[]> {
    const ibcInfo: IBCInfo = this.ibcInfos[this.originalFromToken.chainId][this.originalToToken.chainId];
    const toAddress = await window.Keplr.getKeplrAddr(this.originalToToken.chainId);
    if (!toAddress) throw generateError("Please login keplr!");

    const amount = coin(this.simulateAmount, this.toTokenInOrai.denom);
    const msgTransfer = {
      typeUrl: "/ibc.applications.transfer.v1.MsgTransfer",
      value: MsgTransfer.fromPartial({
        sourcePort: ibcInfo.source,
        sourceChannel: ibcInfo.channel,
        token: amount,
        sender: this.sender,
        receiver: toAddress,
        memo: "",
        timeoutTimestamp: timeoutTimestamp ?? calculateTimeoutTimestamp(ibcInfo.timeout)
      })
    };

    // if not same coingeckoId, swap first then transfer token that have same coingeckoid.
    if (this.originalFromToken.coinGeckoId !== this.originalToToken.coinGeckoId) {
      const msgSwap = this.generateMsgsSwap();
      const msgExecuteSwap = getEncodedExecuteContractMsgs(this.sender, msgSwap);
      return [...msgExecuteSwap, msgTransfer];
    }
    return [msgTransfer];
  }

  getTranferAddress(metamaskAddress: string, tronAddress: string, ibcInfo: IBCInfo) {
    let transferAddress = metamaskAddress;
    // check tron network and convert address
    if (this.originalToToken.prefix === ORAI_BRIDGE_EVM_TRON_DENOM_PREFIX) {
      transferAddress = tronToEthAddress(tronAddress);
    }
    // only allow transferring back to ethereum / bsc only if there's metamask address and when the metamask address is used, which is in the ibcMemo variable
    if (!transferAddress && (this.toTokenInOrai.evmDenoms || ibcInfo.channel === oraichain2oraib)) {
      throw generateError("Please login metamask / tronlink!");
    }
    return transferAddress;
  }

  getIbcMemo(transferAddress: string) {
    return this.originalToToken.chainId === "oraibridge-subnet-2" ? this.originalToToken.prefix + transferAddress : "";
  }

  /**
   * Combine messages for universal swap token from Oraichain to EVM networks(BSC | Ethereum | Tron).
   * @returns combined messages
   */
  async combineMsgEvm(metamaskAddress: string, tronAddress: string) {
    let msgExecuteSwap: EncodeObject[] = [];
    // if from and to dont't have same coingeckoId, create swap msg to combine with bridge msg
    if (this.originalFromToken.coinGeckoId !== this.originalToToken.coinGeckoId) {
      const msgSwap = this.generateMsgsSwap();
      msgExecuteSwap = getEncodedExecuteContractMsgs(this.sender, msgSwap);
    }

    // then find new _toToken in Oraibridge that have same coingeckoId with originalToToken.
    this.originalToToken = findToTokenOnOraiBridge(this.toTokenInOrai, this.originalToToken.chainId);

    const toAddress = await window.Keplr.getKeplrAddr(this.originalToToken.chainId);
    if (!toAddress) throw generateError("Please login keplr!");

    const { ibcInfo, ibcMemo } = this.getIbcInfoIbcMemo(metamaskAddress, tronAddress);

    // create bridge msg
    const msgTransfer = this.generateMsgsTransferOraiToEvm(ibcInfo, toAddress, ibcMemo);
    const msgExecuteTransfer = getEncodedExecuteContractMsgs(this.sender, msgTransfer);
    return [...msgExecuteSwap, ...msgExecuteTransfer];
  }

  getIbcInfoIbcMemo(metamaskAddress: string, tronAddress: string) {
    if (!this.ibcInfos[this.originalFromToken.chainId]) throw generateError("Cannot find ibc info");
    const ibcInfo: IBCInfo = this.ibcInfos[this.originalFromToken.chainId][this.originalToToken.chainId];
    const transferAddress = this.getTranferAddress(metamaskAddress, tronAddress, ibcInfo);
    const ibcMemo = this.getIbcMemo(transferAddress);
    return {
      ibcInfo,
      ibcMemo
    };
  }

  buildIbcWasmPairKey(ibcPort: string, ibcChannel: string, denom: string) {
    return `${ibcPort}/${ibcChannel}/${denom}`;
  }

  async checkBalanceChannelIbc(ibcInfo: IBCInfo, toToken: TokenItemType) {
    const ics20Contract =
      this.cwIcs20LatestClient ?? new CwIcs20LatestQueryClient(window.client, process.env.REACT_APP_IBC_WASM_CONTRACT);

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
        const _toAmount = toDisplay(this.simulateAmount, toToken.decimals);
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
    const { balance } = await getBalanceIBCOraichain(token, tokenQueryClient);
    if (balance < amount.fromAmount) {
      throw generateError(
        `The bridge contract does not have enough balance to process this bridge transaction. Wanted ${amount.fromAmount}, have ${balance}`
      );
    }
    // if to token is evm, then we need to evaluate channel state balance of ibc wasm
    if (to.chainId === "0x01" || to.chainId === "0x38" || to.chainId === "0x2b6653dc") {
      const ibcInfo: IBCInfo | undefined = this.ibcInfos["Oraichain"][to.chainId];
      if (!ibcInfo) throw generateError("IBC Info error when checking ibc balance");
      await this.checkBalanceChannelIbc(ibcInfo, this.originalToToken);
    }
  }

  async swap(): Promise<any> {
    const messages = this.generateMsgsSwap();
    const result = await CosmJs.executeMultiple({
      prefix: ORAI,
      walletAddr: this.sender,
      msgs: messages,
      gasAmount: { denom: ORAI, amount: "0" }
    });
    return result;
  }

  async combineMsgs(metamaskAddress: string, tronAddress: string): Promise<EncodeObject[]> {
    if (this.originalToToken.chainId === "cosmoshub-4" || this.originalToToken.chainId === "osmosis-1")
      return this.combineMsgCosmos();
    return this.combineMsgEvm(metamaskAddress, tronAddress);
  }

  // Universal swap from Oraichain to cosmos-hub | osmosis | EVM networks.
  async swapAndTransfer({ metamaskAddress, tronAddress }: SwapData): Promise<any> {
    // find to token in Oraichain to swap first and use this.toTokenInOrai as originalFromToken in bridge message.
    this.toTokenInOrai = oraichainTokens.find((t) => t.coinGeckoId === this.originalToToken.coinGeckoId);

    const combinedMsgs = await this.combineMsgs(metamaskAddress, tronAddress);
    const { ibcInfo } = this.getIbcInfoIbcMemo(metamaskAddress, tronAddress);
    await this.checkBalanceChannelIbc(ibcInfo, this.originalToToken);

    // handle sign and broadcast transactions
    const wallet = await collectWallet(this.originalFromToken.chainId);
    const { client } = await getCosmWasmClient(
      { rpc: this.originalFromToken.rpc, signer: wallet },
      {
        gasPrice: GasPrice.fromString(`${await getNetworkGasPrice()}${network.denom}`)
      }
    );
    const result = await client.signAndBroadcast(this.sender, combinedMsgs, "auto");
    return result;
  }

  // transfer evm to ibc
  async transferAndSwap(combinedReceiver: string, metamaskAddress?: string, tronAddress?: string): Promise<any> {
    if (!metamaskAddress && !tronAddress) throw Error("Cannot call evm swap if the evm address is empty");

    await this.checkBalanceIBCOraichain(this.originalToToken, this.originalFromToken, {
      fromAmount: this.fromAmount,
      toAmount: this.simulateAmount
    });

    // normal case, we will transfer evm to ibc like normal when two tokens can not be swapped on evm
    // first case: BNB (bsc) <-> USDT (bsc), then swappable
    // 2nd case: BNB (bsc) -> USDT (oraichain), then find USDT on bsc. We have that and also have route => swappable
    // 3rd case: USDT (bsc) -> ORAI (bsc / Oraichain), both have pools on Oraichain, but we currently dont have the pool route on evm => not swappable => transfer to cosmos like normal
    let swappableData = {
      fromChainId: this.originalFromToken.chainId,
      toChainId: this.originalToToken.chainId,
      fromContractAddr: this.originalFromToken.contractAddress,
      toContractAddr: this.originalToToken.contractAddress
    };
    let evmSwapData = {
      fromToken: this.originalFromToken,
      toTokenContractAddr: this.originalToToken.contractAddress,
      address: { metamaskAddress, tronAddress },
      fromAmount: this.fromAmount,
      slippage: this.userSlippage,
      destination: "", // if to token already on same net with from token then no destination is needed.
      simulateAverage: this.simulateAverage
    };
    // has to switch network to the correct chain id on evm since users can swap between network tokens
    if (!window.Metamask.isTron(this.originalFromToken.chainId))
      await window.Metamask.switchNetwork(this.originalFromToken.chainId);
    if (isEvmSwappable(swappableData)) return window.Metamask.evmSwap(evmSwapData);

    const toTokenSameFromChainId = getTokenOnSpecificChainId(
      this.originalToToken.coinGeckoId,
      this.originalFromToken.chainId
    );
    if (toTokenSameFromChainId) {
      swappableData.toChainId = toTokenSameFromChainId.chainId;
      swappableData.toContractAddr = toTokenSameFromChainId.contractAddress;
      evmSwapData.toTokenContractAddr = toTokenSameFromChainId.contractAddress;
      // if to token already on same net with from token then no destination is needed
      evmSwapData.destination = toTokenSameFromChainId.chainId === this.originalToToken.chainId ? "" : combinedReceiver;
    }

    // special case for tokens not having a pool on Oraichain. We need to swap on evm instead then transfer to Oraichain
    if (isEvmSwappable(swappableData) && isSupportedNoPoolSwapEvm(this.originalFromToken.coinGeckoId)) {
      return window.Metamask.evmSwap(evmSwapData);
    }
    return transferEvmToIBC(
      this.originalFromToken,
      this.fromAmount,
      { metamaskAddress, tronAddress },
      combinedReceiver
    );
  }

  async processUniversalSwap(combinedReceiver: string, universalSwapType: UniversalSwapType, swapData: SwapData) {
    if (universalSwapType === "oraichain-to-oraichain") return this.swap();
    if (universalSwapType === "oraichain-to-other-networks") return this.swapAndTransfer(swapData);
    return this.transferAndSwap(combinedReceiver, swapData.metamaskAddress, swapData.tronAddress);
  }

  generateMsgsSwap() {
    let input: any;
    let contractAddr: string = "";
    try {
      const _fromAmount = toAmount(this.fromAmount, this.originalFromToken.decimals).toString();

      const minimumReceive = calculateMinReceive(
        this.simulateAverage,
        _fromAmount,
        this.userSlippage,
        this.originalFromToken.decimals
      );
      const { fund: offerSentFund, info: offerInfo } = parseTokenInfo(this.originalFromToken, _fromAmount);
      const { fund: askSentFund, info: askInfo } = parseTokenInfo(this.toTokenInOrai ?? this.originalToToken);
      const funds = handleSentFunds(offerSentFund, askSentFund);
      let inputTemp = {
        execute_swap_operations: {
          operations: generateSwapOperationMsgs(offerInfo, askInfo),
          minimum_receive: minimumReceive
        }
      };
      // if cw20 => has to send through cw20 contract
      if (!this.originalFromToken.contractAddress) {
        input = inputTemp;
      } else {
        input = {
          send: {
            contract: contractAddr,
            amount: _fromAmount,
            msg: toBinary(inputTemp)
          }
        };
        contractAddr = this.originalFromToken.contractAddress;
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
  generateMsgsTransferOraiToEvm(ibcInfo: IBCInfo, toAddress: string, ibcMemo: string) {
    try {
      const { info: assetInfo } = parseTokenInfo(this.toTokenInOrai);

      const ibcWasmContractAddress = ibcInfo.source.split(".")[1];
      if (!ibcWasmContractAddress)
        throw generateError("IBC Wasm source port is invalid. Cannot transfer to the destination chain");

      const msg: TransferBackMsg = {
        local_channel_id: ibcInfo.channel,
        remote_address: toAddress,
        remote_denom: this.originalToToken.denom,
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
              amount: this.simulateAmount,
              denom: assetInfo.native_token.denom
            }
          ]
        };
        return buildMultipleExecuteMessages(msgs);
      }

      const executeMsgSend = {
        send: {
          contract: ibcWasmContractAddress,
          amount: this.simulateAmount,
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
