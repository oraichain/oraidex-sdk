import {
  CosmWasmClient,
  ExecuteInstruction,
  ExecuteResult,
  SigningCosmWasmClient,
  toBinary
} from "@cosmjs/cosmwasm-stargate";
import { EncodeObject } from "@cosmjs/proto-signing";
import { DeliverTxResponse, GasPrice } from "@cosmjs/stargate";
import { CosmosChainId, CosmosWallet, ORAI, parseAssetInfo } from "@oraichain/oraidex-common";
import { Asset, AssetInfo, OraiswapTokenQueryClient } from "@oraichain/oraidex-contracts-sdk";
import { OrderDirection } from "@oraichain/oraidex-contracts-sdk/build/OraiswapLimitOrder.types";
import { gasPrices } from "./constant";

export abstract class AbstractOrderbookClientHelper {
  protected client: CosmWasmClient;
  protected signingClient: SigningCosmWasmClient;
  constructor(
    public readonly wallet: CosmosWallet,
    public readonly rpc: string,
    public readonly chainId: CosmosChainId,
    public assetInfos: [AssetInfo, AssetInfo]
  ) {}

  // eg: ORAI/USDT.
  // Buy ORAI then offer USDT, ask ORAI. if 1 ORAI = 2 USDT then offer 20 USDT, ask 10 ORAI.
  // Sell ORAI then offer ORAI, ask USDT => offer 10 ORAI, ask 20 USDT, 20 / 10 = 2 order price
  static calculateOrderPrice = (offerAmount: string, askAmount: string, orderDirection: OrderDirection): number => {
    if (orderDirection === "buy") return Number(offerAmount) / Number(askAmount);
    return Number(askAmount) / Number(offerAmount);
  };

  static buildExecuteInstruction = (
    contractAddress: string, // can be orderbook addr or cw20 token address
    msg: any,
    asset: Asset
  ) => {
    if ("native_token" in asset.info) {
      return {
        contractAddress: contractAddress,
        msg,
        funds: [{ amount: asset.amount, denom: asset.info.native_token.denom }]
      } as ExecuteInstruction;
    }
    return {
      contractAddress: asset.info.token.contract_addr,
      msg: {
        send: {
          amount: asset.amount,
          contract: contractAddress,
          msg: toBinary(msg)
        }
      }
    };
  };

  withCosmWasmClient(client: CosmWasmClient) {
    this.client = client;
    return this;
  }
  withSigningCosmWasmClient(client: SigningCosmWasmClient) {
    this.signingClient = client;
    return this;
  }

  async getCosmWasmClient(signing: boolean, gasPrice?: GasPrice): Promise<SigningCosmWasmClient | CosmWasmClient> {
    if (signing) {
      const signingClient =
        this.signingClient && !gasPrice // if client passes a different gas price then we initiate a new signing cosmwasm client
          ? this.signingClient
          : (
              await this.wallet.getCosmWasmClient(
                { rpc: this.rpc, chainId: this.chainId },
                { gasPrice: gasPrice ?? GasPrice.fromString(`${gasPrices}${ORAI}`) }
              )
            ).client;
      this.signingClient = signingClient;
      return signingClient;
    }
    const client = this.client ?? (await CosmWasmClient.connect(this.rpc));
    this.client = client;
    return client;
  }

  async getBalance(tokenIndex: 0 | 1, _address?: string): Promise<bigint> {
    const assetInfo = this.assetInfos[tokenIndex];
    const assetInfoRaw = parseAssetInfo(assetInfo);
    const client = await this.getCosmWasmClient(false);
    const address = _address ?? (await this.wallet.getKeplrAddr(this.chainId));
    if ("native_token" in this.assetInfos[tokenIndex]) {
      const balance = await client.getBalance(address, assetInfoRaw);
      return BigInt(balance.amount);
    }
    const oraiswapToken = new OraiswapTokenQueryClient(client, assetInfoRaw);
    const { balance } = await oraiswapToken.balance({ address });
    return BigInt(balance);
  }

  cancelAllOrders = async (direction?: any, limit?: number, memo?: string): Promise<string> => {
    const orders = direction
      ? await this.queryAllOrdersOfBidderWithDirection(direction, limit)
      : await this.queryAllOrdersOfBidder();
    const result = await this.cancelOrders(orders, memo);
    return result;
  };

  async signAndBroadcast(encodedObjects: EncodeObject[], _sender?: string, memo?: string, gasPrices?: GasPrice) {
    const client = (await this.getCosmWasmClient(true, gasPrices)) as SigningCosmWasmClient;
    const sender = _sender ?? (await this.wallet.getKeplrAddr(this.chainId));
    return client.signAndBroadcast(sender, encodedObjects, "auto", memo);
  }

  async executeMultiple(instructions: ExecuteInstruction[], _sender?: string, memo?: string, gasPrices?: GasPrice) {
    const client = (await this.getCosmWasmClient(true, gasPrices)) as SigningCosmWasmClient;
    const sender = _sender ?? (await this.wallet.getKeplrAddr(this.chainId));
    return client.executeMultiple(sender, instructions, "auto", memo);
  }

  abstract queryAllTicks(direction: unknown, orderBy: number, limit?: number): Promise<unknown[]>;

  // query best buy tick / sell tick
  abstract queryBestTick(direction: unknown): Promise<number>;

  abstract queryAllOrdersWithDirectionAndTick(
    direction: unknown,
    tickPrice: string,
    limit?: number
  ): Promise<unknown[]>;

  abstract queryOrdersWithDirectionAndTicks(direction: unknown, ticks: string[]): Promise<unknown[]>;

  abstract getOrderbookPrice(): Promise<number>;

  abstract buildLimitOrder(offerAmount: string, askAmount: string, direction: unknown): unknown;

  abstract buildMarketOrder(direction: unknown, slippage: number): unknown;

  abstract buildOrderbookExecuteInstructions(
    contractAddress: string,
    executeMsgs: unknown[],
    sendAmount?: string
  ): unknown[];

  abstract submitLimitOrder(
    offerAmount: string,
    askAmount: string,
    direction: unknown
  ): Promise<DeliverTxResponse | ExecuteResult>;

  abstract queryAllOrdersOfBidder(limit?: number): Promise<unknown[]>;

  abstract queryAllOrdersOfBidderWithDirection(
    direction: unknown,
    limit?: number,
    orderBy?: number
  ): Promise<unknown[]>;

  abstract cancelOrders(orders: unknown[], memo?: string): Promise<string>;
}
