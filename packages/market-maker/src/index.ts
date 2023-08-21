import { toBinary } from '@cosmjs/cosmwasm-stargate';
import { Addr, AssetInfo, OraiswapLimitOrderTypes, OraiswapTokenTypes, OrderDirection } from '@oraichain/oraidex-contracts-sdk';
import { matchingOrders } from '@oraichain/orderbook-matching-relayer';
import { UserWallet, atomic, cancelOutofSpreadOrder, getRandomPercentage, getRandomRange, getSpreadPrice } from './common';
import { ExecuteInstruction } from '@cosmjs/cosmwasm-stargate';

export type MakeOrderConfig = {
  makeProfit?: boolean;
  buyPercentage: number;
  cancelPercentage: number;
  sellDepth: number;
  buyDepth: number;
  oraiThreshold: number;
  usdtThreshold: number;
  spreadMatch: number;
  spreadCancel: number;
};

const getRandomSpread = (min: number, max: number) => {
  return getRandomRange(min * atomic, max * atomic) / atomic;
};

const generateMatchOrders = async (oraiPrice: number, usdtContractAddress: Addr, orderbookAddress: Addr, sender: UserWallet, spread: number, assetInfos: AssetInfo[], direction: OrderDirection, limit: 10, { buyPercentage, sellDepth, buyDepth }: MakeOrderConfig): Promise<OraiswapLimitOrderTypes.ExecuteMsg[]> => {
  const upperPriceLimit = oraiPrice * (1 + spread);
  const lowerPriceLimit = oraiPrice * (1 - spread);

  let queryTicks = await sender.client.queryContractSmart(orderbookAddress, {
    ticks: {
      asset_infos: assetInfos,
      order_by: direction === "buy" ? 1 : 2,
      direction: direction === "buy" ? "sell" : "buy",
      limit,
    }
  } as OraiswapLimitOrderTypes.QueryMsg);
  console.log("ticks:");
  console.dir(queryTicks, { depth: 4 });

  let multipleSubmitMsg: OraiswapLimitOrderTypes.ExecuteMsg[] = [];

  for (const tick of queryTicks.ticks) {
    let tick_price = parseFloat(tick.price);
    let mmVolumebyPrice = 0;
    let mmAskVolumebyPrice = 0;

    if (tick_price >= lowerPriceLimit && tick_price <= upperPriceLimit) {
      const ordersbyPrice = await sender.client.queryContractSmart(orderbookAddress, {
        orders: {
          asset_infos: assetInfos,
          order_by: 1,
          limit: tick.total_orders,
          filter: {
            price: tick.price
          }
        }
      } as OraiswapLimitOrderTypes.QueryMsg);
      
      
      for (const order of ordersbyPrice.orders) {
        console.log({order});
        if (order.bidder_addr === sender.address) {
          continue;
        }
        const lef_offer_amount = Number(order.offer_asset.amount) - Number(order.filled_offer_amount);
        console.log({trader_lef_amount: lef_offer_amount});
        mmAskVolumebyPrice += lef_offer_amount;
      }

      if (mmAskVolumebyPrice > 0) {
        if (direction === "buy") {
          if (mmAskVolumebyPrice >= buyPercentage * buyDepth/tick_price) {
            mmAskVolumebyPrice = Math.round(buyPercentage * buyDepth/tick_price);
          }
          mmVolumebyPrice = Math.round(mmAskVolumebyPrice * tick_price);
        }
        else if (direction === "sell") {
          if (mmAskVolumebyPrice >= (buyPercentage * sellDepth)) {
            mmAskVolumebyPrice = Math.round(buyPercentage * sellDepth);
          }
          mmVolumebyPrice = Math.round(mmAskVolumebyPrice / tick_price);
        }
        mmVolumebyPrice += 1;

        console.log({mmVolumebyPrice}, {mmAskVolumebyPrice});
        console.log("trader price: ", tick.price);
        console.log("mm price:", direction === "buy" ? Number(mmVolumebyPrice/mmAskVolumebyPrice) : Number(mmAskVolumebyPrice/mmVolumebyPrice));

        const submitMsg: OraiswapLimitOrderTypes.ExecuteMsg = {
          submit_order: {
            assets: [
              {
                info: {
                  native_token: { denom: 'orai' }
                },
                amount: direction === "buy" ? mmAskVolumebyPrice.toString() : mmVolumebyPrice.toString(),
              },
              {
                info: {
                  token: { contract_addr: usdtContractAddress }
                },
                amount: direction === "buy" ? mmVolumebyPrice.toString() : mmAskVolumebyPrice.toString(),
              }
            ],
            direction
          }
        };
        multipleSubmitMsg.push(submitMsg);
      }
    }
  }
  return multipleSubmitMsg;
};

export async function makeOrders(buyer: UserWallet, seller: UserWallet, usdtTokenAddress: Addr, orderBookAddress: Addr, oraiPrice: number, config: MakeOrderConfig, limit = 10, denom = 'orai') {
  const assetInfos = [{ native_token: { denom } }, { token: { contract_addr: usdtTokenAddress } }];
  const multipleBuyMsg: ExecuteInstruction[] = [];
  const multipleSellMsg: ExecuteInstruction[] = [];
  let buyerWallet: UserWallet = buyer;
  let sellerWallet: UserWallet = seller;
  
  console.log({oraiPrice});
  if (oraiPrice == 0) {
    throw new Error(`Orai's price (${oraiPrice}) = 0`);
  }
  
  try {
    const sellerOraiBalance = await sellerWallet.client.getBalance(sellerWallet.address, 'orai').then((b) => BigInt(b.amount));
    if (sellerOraiBalance < BigInt(config.oraiThreshold)) {
      throw new Error(`Seller(${sellerOraiBalance}) have not enough funds to run trading bot`);
    }
    if (sellerOraiBalance < BigInt(1000000)) {
      throw new Error('Balance of seller/buyer must be greater than 1 ORAI');
    }

    const multiple_sell = await generateMatchOrders(oraiPrice, usdtTokenAddress, orderBookAddress, seller, config.spreadMatch, assetInfos, "sell", 10, config);
    for (const msg of multiple_sell) {
      if ('submit_order' in msg) {
        const submitOrderMsg = msg.submit_order;
        const [base] = submitOrderMsg.assets;

        if (submitOrderMsg.direction === 'sell') {
          if (sellerOraiBalance < BigInt(base.amount)) {
            continue;
          }
          const sellMsg: ExecuteInstruction = {
            contractAddress: orderBookAddress,
            msg: msg,
            funds: [{ amount: base.amount, denom: 'orai' }]
          };
          multipleSellMsg.push(sellMsg);
        }
      }
    }
  } catch (error) {
    console.log({error});
  }

  try {
    const buyerUsdtBalance = await buyerWallet.client.queryContractSmart(usdtTokenAddress, { balance: { address: buyerWallet.address } } as OraiswapTokenTypes.QueryMsg).then((b) => BigInt(b.balance));
    const buyerOraiBalance = await buyerWallet.client.getBalance(buyerWallet.address, 'orai').then((b) => BigInt(b.amount));

    if (buyerUsdtBalance < BigInt(config.usdtThreshold)) {
        throw new Error(`Buyer(${buyerUsdtBalance}) have not enough funds to run trading bot`);
    }
    if (buyerOraiBalance < BigInt(1000000)) {
      throw new Error('Balance of seller/buyer must be greater than 1 ORAI');
    }

    const multiple_buy = await generateMatchOrders(oraiPrice, usdtTokenAddress, orderBookAddress, buyer, config.spreadMatch, assetInfos, "buy", 10, config);
    for (const msg of multiple_buy) {
      if ('submit_order' in msg) {
        const submitOrderMsg = msg.submit_order;
        const [, quote] = submitOrderMsg.assets;

        if (submitOrderMsg.direction === 'buy') {
          if (buyerUsdtBalance < BigInt(quote.amount)) {
            continue;
          }

          const buyMsg: ExecuteInstruction = {
            contractAddress: usdtTokenAddress,
            msg: {
              send: {
                amount: quote.amount,
                contract: orderBookAddress,
                msg: toBinary(msg)
              }
            }
          };
          multipleBuyMsg.push(buyMsg);
        }
      }
    }
  } catch (error) {
    console.log({error});
  }

  console.log('multipleBuyOrders: ');
  console.dir(multipleBuyMsg, { depth: 4 });
  console.log('multipleSellOrders: ');
  console.dir(multipleSellMsg, { depth: 4 });
  if (multipleBuyMsg.length > 0) {
    const buyResult = await buyerWallet.client.executeMultiple(buyerWallet.address, multipleBuyMsg, 'auto');
    console.log('buy orders - txHash:', buyResult.transactionHash);
  }
  if (multipleSellMsg.length > 0) {
    const sellResult = await sellerWallet.client.executeMultiple(sellerWallet.address, multipleSellMsg, 'auto');
    console.log('sell orders - txHash:', sellResult.transactionHash);
  }

  // process matching, use buyer to get orai faster to switch
  try {
    await matchingOrders(buyerWallet.client, buyerWallet.address, orderBookAddress, limit, denom);
  } catch (error) {
    console.error(error);
  }

  try {
    await cancelOutofSpreadOrder(orderBookAddress, sellerWallet, assetInfos, "sell", oraiPrice, config.spreadCancel);
  } catch (error) {
    console.error(error);
  }

  // console.log(orderBookAddress, await client.getBalance(orderBookAddress, 'orai'));
  try {
    await cancelOutofSpreadOrder(orderBookAddress, buyerWallet, assetInfos, "buy", oraiPrice, config.spreadCancel);
  } catch (error) {
    console.error(error);
  }
}

export * from './common';
