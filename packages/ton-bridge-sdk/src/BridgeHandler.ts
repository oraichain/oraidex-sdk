import {
  ExecuteResult,
  SigningCosmWasmClient,
  SigningCosmWasmClientOptions,
  toBinary
} from "@cosmjs/cosmwasm-stargate";
import { coins, OfflineSigner } from "@cosmjs/proto-signing";
import { GasPrice } from "@cosmjs/stargate";
import { BridgeAdapter, JettonMinter, JettonWallet, ValueOps } from "@oraichain/ton-bridge-contracts";
import { TonbridgeBridgeClient, TonbridgeBridgeTypes } from "@oraichain/tonbridge-contracts-sdk";
import { Address, beginCell, OpenedContract, Sender, toNano } from "@ton/core";
import { TonClient, TonClientParameters } from "@ton/ton";
import { isNative, parseAssetInfo } from "@oraichain/oraidex-common";
import * as packageJson from "../package.json";
import { Cw20BaseTypes } from "@oraichain/common-contracts-sdk";

export type JettonMasterAddress = string;

export type TonDenom = "ton" | JettonMasterAddress;

export const TonNative = "ton";

export interface CreateTonBridgeHandlerParams {
  wasmBridge: string;
  tonBridge: string;
  tonSender: Sender;
  offlineSigner: OfflineSigner;
  cosmosRpc: string;
  tonClientParameters?: TonClientParameters;
  signingCosmwasmClientOpts?: SigningCosmWasmClientOptions;
  tonClient?: TonClient;
  cosmosSingerClient?: SigningCosmWasmClient;
}

export interface TonBridgeHandlerArgs {
  tonBridge: OpenedContract<BridgeAdapter>;
  wasmBridge: TonbridgeBridgeClient;
  tonClient: TonClient;
  cosmosSignerClient: SigningCosmWasmClient;
  tonSender: Sender;
  cosmosSigner: OfflineSigner;
}

export class TonBridgeHandler {
  tonBridge: OpenedContract<BridgeAdapter>;
  wasmBridge: TonbridgeBridgeClient;
  tonClient: TonClient;
  cosmosSignerClient: SigningCosmWasmClient;
  tonSender: Sender;
  cosmosSigner: OfflineSigner;

  private constructor(args: TonBridgeHandlerArgs) {
    this.tonSender = args.tonSender;
    this.cosmosSigner = args.cosmosSigner;
    this.tonClient = args.tonClient;
    this.tonBridge = args.tonBridge;
    this.wasmBridge = args.wasmBridge;
    this.cosmosSignerClient = args.cosmosSignerClient;
  }

  static async create(params: CreateTonBridgeHandlerParams): Promise<TonBridgeHandler> {
    let tonClient: TonClient | null, cosmosSignerClient: SigningCosmWasmClient | null;
    if (!params.tonClient && !params.tonClientParameters) {
      throw new Error("Either tonClient or tonClientParameters must be provided");
    }
    if (!params.signingCosmwasmClientOpts && !params.cosmosSingerClient) {
      throw new Error("Either signingCosmwasmClientOpts or cosmosSingerClient must be provided");
    }
    if (!params.wasmBridge || !params.tonBridge || !params.tonSender || !params.offlineSigner || !params.cosmosRpc) {
      throw new Error("wasmBridge, tonBridge, tonSender, offlineSigner, and cosmosRpc must be provided");
    }

    if (params.tonClient) {
      tonClient = params.tonClient;
    } else {
      tonClient = new TonClient(params.tonClientParameters);
    }

    if (params.cosmosSingerClient) {
      cosmosSignerClient = params.cosmosSingerClient;
    } else {
      cosmosSignerClient = await SigningCosmWasmClient.connectWithSigner(
        params.cosmosRpc,
        params.offlineSigner,
        params.signingCosmwasmClientOpts
      );
    }
    const cosmosSender = params.offlineSigner.getAccounts()[0];
    const tonBridge = tonClient.open(BridgeAdapter.createFromAddress(Address.parse(params.tonBridge)));
    const wasmBridge = new TonbridgeBridgeClient(cosmosSignerClient, cosmosSender, params.wasmBridge);
    if (!tonBridge || !wasmBridge) {
    }
    const tonHandlerArgs: TonBridgeHandlerArgs = {
      tonBridge,
      wasmBridge,
      tonClient,
      cosmosSignerClient,
      tonSender: params.tonSender,
      cosmosSigner: params.offlineSigner
    };
    return new TonBridgeHandler(tonHandlerArgs);
  }
  // currently, TonBridge have only supported Oraichain
  async switchCosmosWallet(offlineSigner: OfflineSigner, gasPrice: GasPrice, endpoint: string = "https://rpc.orai.io") {
    this.cosmosSigner = offlineSigner;
    const [sender, cosmosSignerClient] = await Promise.all([
      offlineSigner.getAccounts()[0],
      SigningCosmWasmClient.connectWithSigner(endpoint, offlineSigner, {
        broadcastPollIntervalMs: this.cosmosSignerClient.broadcastPollIntervalMs,
        broadcastTimeoutMs: this.cosmosSignerClient.broadcastTimeoutMs,
        gasPrice
      })
    ]);
    this.cosmosSignerClient = cosmosSignerClient;
    this.wasmBridge = new TonbridgeBridgeClient(this.cosmosSignerClient, sender, this.wasmBridge.contractAddress);
  }

  async switchAccount(offlineSigner: OfflineSigner) {
    const sender = await offlineSigner.getAccounts()[0];
    this.wasmBridge = new TonbridgeBridgeClient(this.cosmosSignerClient, sender, this.wasmBridge.contractAddress);
  }

  async sendToCosmos(cosmosRecipient: string, amount: bigint, timeout: bigint, denom: TonDenom, opts: ValueOps) {
    if (denom === TonNative) {
      return this._sendTonToCosmos(cosmosRecipient, amount, timeout, opts);
    }
    return this._sendJettonToCosmos(cosmosRecipient, amount, timeout, denom, opts);
  }

  private async _sendJettonToCosmos(
    cosmosRecipient: string,
    amount: bigint,
    timeout: bigint,
    denom: string,
    opts: ValueOps
  ) {
    const jettonMinter = this.tonClient.open(JettonMinter.createFromAddress(Address.parse(denom)));
    const userJettonWalletAddress = await jettonMinter.getWalletAddress(this.tonSender.address);
    const jettonWallet = this.tonClient.open(JettonWallet.createFromAddress(userJettonWalletAddress));
    await jettonWallet.sendTransfer(
      this.tonSender,
      {
        toAddress: this.tonBridge.address,
        jettonAmount: amount,
        fwdAmount: toNano(0.15),
        remoteReceiver: cosmosRecipient,
        jettonMaster: jettonMinter.address,
        timeout,
        // TODO: update memo for universal swap msg
        memo: beginCell().endCell()
      },
      opts
    );
  }

  private async _sendTonToCosmos(cosmosRecipient: string, amount: bigint, timeout: bigint, opts: ValueOps) {
    await this.tonBridge.sendBridgeTon(
      this.tonSender,
      {
        amount,
        timeout: timeout,
        memo: beginCell().endCell(),
        remoteReceiver: cosmosRecipient
      },
      opts
    );
  }

  async sendToTon(tonRecipient: string, amount: bigint, timeout: bigint, remoteDenom: string) {
    let pair;
    try {
      pair = await this.wasmBridge.pairMapping({ key: remoteDenom });
    } catch (error) {
      throw new Error("Pair mapping not found");
    }
    const localDenom = parseAssetInfo(pair.pair_mapping.asset_info);
    if (!isNative(localDenom)) {
      return this._sendCw20ToTon(tonRecipient, amount, timeout, localDenom, remoteDenom);
    }
    return this._sendNativeToTon(tonRecipient, amount, timeout, localDenom, remoteDenom);
  }

  private async _sendNativeToTon(
    tonRecipient: string,
    amount: bigint,
    timeout: bigint,
    localDenom: string,
    remoteDenom: string
  ) {
    return await this.wasmBridge.bridgeToTon(
      {
        denom: remoteDenom,
        to: tonRecipient,
        timeout: Number(timeout)
      },
      "auto",
      `TonBridgeHandler ${packageJson.version} sendNativeToTon`,
      coins(amount.toString(), localDenom)
    );
  }

  private async _sendCw20ToTon(
    tonRecipient: string,
    amount: bigint,
    timeout: bigint,
    localDenom: string,
    remoteDenom: string
  ): Promise<ExecuteResult> {
    const sender = (await this.cosmosSigner.getAccounts())[0];
    return await this.cosmosSignerClient.execute(
      sender.address,
      localDenom,
      {
        send: {
          amount: amount.toString(),
          contract: this.wasmBridge.contractAddress,
          msg: toBinary({
            bridge_to_ton: {
              denom: remoteDenom,
              timeout: Number(timeout),
              to: tonRecipient
            }
          } as TonbridgeBridgeTypes.ExecuteMsg)
        }
      } as Cw20BaseTypes.ExecuteMsg,
      "auto",
      `TonBridgeHandler ${packageJson.version} sendCw20ToTon`
    );
  }
}
