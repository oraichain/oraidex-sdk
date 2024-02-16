import { CosmWasmClient, ExecuteResult, SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { EncodeObject } from "@cosmjs/proto-signing";
import { DeliverTxResponse, GasPrice } from "@cosmjs/stargate";
import { CosmosChainId, CosmosWallet, parseAssetInfo } from "@oraichain/oraidex-common";
import { AssetInfo, OraiswapTokenQueryClient } from "@oraichain/oraidex-contracts-sdk";

export abstract class AbstractOrderbookClientHelper {
  protected client: CosmWasmClient;
  protected signingClient: SigningCosmWasmClient;
  constructor(
    public readonly wallet: CosmosWallet,
    public readonly rpc: string,
    public readonly chainId: CosmosChainId,
    public assetInfos: [AssetInfo, AssetInfo]
  ) {}

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
      return (
        this.signingClient ??
        (await this.wallet.getCosmWasmClient({ rpc: this.rpc, chainId: this.chainId }, { gasPrice })).client
      );
    }
    return this.client ?? CosmWasmClient.connect(this.rpc);
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

  async signAndBroadcast(encodedObjects: EncodeObject[], _sender?: string, memo?: string) {
    const client = (await this.getCosmWasmClient(true)) as SigningCosmWasmClient;
    const sender = _sender ?? (await this.wallet.getKeplrAddr(this.chainId));
    return client.signAndBroadcast(sender, encodedObjects, "auto", memo);
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

  abstract buildMarketOrder(offerAmount: string, askAmount: string, direction: unknown, slippage: number): unknown;

  abstract buildOrderbookExecuteInstructions(contractAddress: string, executeMsgs: unknown[]): unknown[];

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
