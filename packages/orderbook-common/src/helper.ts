import { ExecuteInstruction, SigningCosmWasmClient, toBinary } from "@cosmjs/cosmwasm-stargate";
import { CosmosChainId, CosmosWallet, truncDecimals } from "@oraichain/oraidex-common";
import {
  Asset,
  AssetInfo,
  OraiswapLimitOrderQueryClient,
  OraiswapLimitOrderTypes
} from "@oraichain/oraidex-contracts-sdk";
import {
  OrderDirection,
  OrderResponse,
  TickResponse
} from "@oraichain/oraidex-contracts-sdk/build/OraiswapLimitOrder.types";
import { AbstractOrderbookClientHelper } from "./abstract-helper";
import { ORDERBOOK_CONTRACT_ADDRESS } from "./constant";

export class OraichainOrderbookClientHelper extends AbstractOrderbookClientHelper {
  private orderbookAddress = ORDERBOOK_CONTRACT_ADDRESS;
  constructor(
    public readonly wallet: CosmosWallet,
    public readonly rpc: string,
    public readonly chainId: CosmosChainId,
    public assetInfos: [AssetInfo, AssetInfo],
    orderbookAddress?: string
  ) {
    super(wallet, rpc, chainId, assetInfos);
    if (orderbookAddress) this.orderbookAddress = orderbookAddress;
  }

  async queryAllTicks(direction: OrderDirection, orderBy: number, limit?: number): Promise<TickResponse[]> {
    let totalTicks: TickResponse[] = [];
    let tickQuery = {
      assetInfos: this.assetInfos,
      orderBy,
      limit: limit ?? 100,
      direction
    };
    const client = await this.getCosmWasmClient(false);
    const orderbookClient = new OraiswapLimitOrderQueryClient(client, this.orderbookAddress);
    while (true) {
      try {
        const ticks = (await orderbookClient.ticks(tickQuery)).ticks;
        if (ticks.length === 0) break;
        totalTicks = totalTicks.concat(ticks);
        const lastTick = totalTicks.slice(-1)[0].price;
        tickQuery["startAfter"] = lastTick;
      } catch (error) {}
    }
    return totalTicks;
  }

  // query best buy tick / sell tick
  async queryBestTick(direction: OrderDirection): Promise<number> {
    let tickQuery = {
      assetInfos: this.assetInfos,
      orderBy: direction === "buy" ? 2 : 1,
      limit: 1,
      direction
    };
    const client = await this.getCosmWasmClient(false);
    const orderbookClient = new OraiswapLimitOrderQueryClient(client, this.orderbookAddress);
    const ticks = await orderbookClient.ticks(tickQuery);
    if (!ticks || ticks.ticks.length === 0) return -1;
    return +ticks.ticks[0].price;
  }

  async queryAllOrdersWithDirectionAndTick(
    direction: OrderDirection,
    tickPrice: string,
    limit?: number
  ): Promise<OrderResponse[]> {
    let totalOrders: OrderResponse[] = [];
    let orderQuery = {
      assetInfos: this.assetInfos,
      limit: limit ?? 100,
      filter: {
        price: tickPrice
      },
      direction
    };
    const cosmwasmClient = await this.getCosmWasmClient(false);
    const orderbookClient = new OraiswapLimitOrderQueryClient(cosmwasmClient, this.orderbookAddress);
    while (true) {
      try {
        const mmOrders = await orderbookClient.orders(orderQuery);
        if (mmOrders.orders.length === 0) break;
        totalOrders = totalOrders.concat(mmOrders.orders);
        const lastOrderId = mmOrders.orders[mmOrders.orders.length - 1].order_id;
        orderQuery["startAfter"] = lastOrderId;
      } catch (error) {
        // do nothing, it will retry in the next loop
      }
    }
    return totalOrders;
  }

  async queryOrdersWithDirectionAndTicks(direction: OrderDirection, ticks: string[]): Promise<OrderResponse[]> {
    const ordersAllSettled = await Promise.allSettled(
      ticks.map((tick) => this.queryAllOrdersWithDirectionAndTick(direction, tick))
    );
    return ordersAllSettled
      .map((order) => {
        if (order.status === "fulfilled") return order.value;
        return undefined;
      })
      .filter((order) => order)
      .flat();
  }

  getOrderbookPrice = async () => {
    const cosmwasmClient = await this.getCosmWasmClient(false);
    const orderbookClient = new OraiswapLimitOrderQueryClient(cosmwasmClient, this.orderbookAddress);
    const price = await orderbookClient.midPrice({
      assetInfos: this.assetInfos
    });
    return Number(price);
  };

  buildLimitOrder(
    offerAmount: string,
    askAmount: string,
    direction: OrderDirection
  ): OraiswapLimitOrderTypes.ExecuteMsg {
    const baseAmount = direction === "buy" ? askAmount : offerAmount;
    const quoteAmount = direction === "buy" ? offerAmount : askAmount;
    return {
      submit_order: {
        assets: [
          {
            info: this.assetInfos[0], // we are assuming the first asset info element is base, the other is quote
            amount: baseAmount
          },
          {
            info: this.assetInfos[1],
            amount: quoteAmount
          }
        ],
        direction
      }
    };
  }

  buildMarketOrder(
    offerAmount: string,
    askAmount: string,
    direction: OrderDirection,
    slippage: number
  ): OraiswapLimitOrderTypes.ExecuteMsg {
    const baseAmount = direction === "buy" ? askAmount : offerAmount;
    const quoteAmount = direction === "buy" ? offerAmount : askAmount;
    return {
      submit_market_order: {
        asset_infos: this.assetInfos,
        base_amount: baseAmount,
        quote_amount: quoteAmount,
        direction,
        slippage: Math.abs(slippage).toFixed(truncDecimals) // since we use price impact of amm which can be negative, we need to make sure slippage is always positive
      }
    };
  }

  buildOrderbookExecuteInstructions = (
    contractAddress: string,
    executeMsgs: OraiswapLimitOrderTypes.ExecuteMsg[]
  ): ExecuteInstruction[] => {
    let instructions: ExecuteInstruction[] = [];
    if (executeMsgs.length === 0) return [];
    for (const msg of executeMsgs) {
      if ("submit_order" in msg) {
        const { assets } = msg.submit_order;

        // when buying, we send quote amount, and want to receive base amount => compare quote balance
        if (msg.submit_order.direction === "buy") {
          // otherwise we create a new execute instruction
          instructions.push(this.buildOrderbookExecuteInstruction(contractAddress, msg, assets[1]));
          continue;
        }
        // sell case, compare base amount
        instructions.push(this.buildOrderbookExecuteInstruction(contractAddress, msg, assets[0]));
      }
      if ("submit_market_order" in msg) {
        const { asset_infos, base_amount, quote_amount } = msg.submit_market_order;

        // when buying, we send quote amount, and want to receive base amount => compare quote balance
        if (msg.submit_market_order.direction === "buy") {
          // otherwise we create a new execute instruction
          instructions.push(
            this.buildOrderbookExecuteInstruction(contractAddress, msg, { info: asset_infos[1], amount: quote_amount })
          );
          continue;
        }
        // sell case, compare base amount
        instructions.push(
          this.buildOrderbookExecuteInstruction(contractAddress, msg, { info: asset_infos[0], amount: base_amount })
        );
      }
    }
    return instructions;
  };

  buildOrderbookExecuteInstruction = (
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

  async submitLimitOrder(offerAmount: string, askAmount: string, direction: OrderDirection) {
    const order = this.buildLimitOrder(offerAmount, askAmount, direction);
    const instructions = this.buildOrderbookExecuteInstructions(this.orderbookAddress, [order]);
    const sender = await this.wallet.getKeplrAddr(this.chainId);
    const client = (await this.getCosmWasmClient(true)) as SigningCosmWasmClient;
    return client.executeMultiple(sender, instructions, "auto");
  }

  // return the last order id canceled
  private cancelOrder = (orders: OrderResponse[]) => {
    const multipleCancelMsgs: ExecuteInstruction[] = orders.map((order) => ({
      contractAddress: this.orderbookAddress,
      msg: {
        cancel_order: {
          asset_infos: this.assetInfos,
          order_id: order.order_id
        }
      }
    }));
    return multipleCancelMsgs;
  };

  cancelOrders = async (orders: OrderResponse[], memo?: string): Promise<string> => {
    const multipleCancelMsgs: ExecuteInstruction[] = this.cancelOrder(orders);
    if (multipleCancelMsgs.length > 0) {
      const sender = await this.wallet.getKeplrAddr();
      const client = (await this.getCosmWasmClient(true)) as SigningCosmWasmClient;
      const cancelResult = await client.executeMultiple(sender, multipleCancelMsgs, "auto", memo);
      if (cancelResult) {
        console.log("cancel orders - txHash:", cancelResult.transactionHash);
        return cancelResult.transactionHash;
      }
    }
    return "";
  };

  async queryAllOrdersOfBidder(limit?: number): Promise<OrderResponse[]> {
    const results = await Promise.all([
      this.queryAllOrdersOfBidderWithDirection("buy", limit),
      this.queryAllOrdersOfBidderWithDirection("sell", limit)
    ]);
    const tempOrders = [...results[0], ...results[1]];
    const key = "order_id";
    const ordersMap = new Set();
    return tempOrders.filter((order) => {
      if (!ordersMap.has(order[key])) {
        ordersMap.add(order[key]);
        return true;
      }
      return false;
    });
  }

  async queryAllOrdersOfBidderWithDirection(
    direction: OrderDirection,
    limit?: number,
    orderBy?: number
  ): Promise<OrderResponse[]> {
    let totalOrders: OrderResponse[] = [];
    const sender = await this.wallet.getKeplrAddr(this.chainId);
    let orderQuery = {
      assetInfos: this.assetInfos,
      orderBy: orderBy ?? 1,
      limit: limit ?? 100,
      filter: {
        bidder: sender
      },
      direction
    };
    const cosmwasmClient = await this.getCosmWasmClient(false);
    const orderbookClient = new OraiswapLimitOrderQueryClient(cosmwasmClient, this.orderbookAddress);
    while (true) {
      try {
        const mmOrders = await orderbookClient.orders(orderQuery);
        if (mmOrders.orders.length === 0) break;
        totalOrders = totalOrders.concat(mmOrders.orders);
        const lastOrderId = mmOrders.orders[mmOrders.orders.length - 1].order_id;
        orderQuery["startAfter"] = lastOrderId;
      } catch (error) {
        // do nothing, it will retry in the next loop
      }
    }
    return totalOrders;
  }
}
