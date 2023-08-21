import { toBinary } from '@cosmjs/cosmwasm-stargate';
import { Addr, AssetInfo, OraiswapLimitOrderTypes, OraiswapTokenTypes, OrderDirection } from '@oraichain/oraidex-contracts-sdk';
import { matchingOrders } from '@oraichain/orderbook-matching-relayer';
import { UserWallet, atomic, cancelAllOrder, cancelAllOrderbyDirection, cancelOutofSpreadOrder, getRandomPercentage, getRandomRange, getSpreadPrice } from './common';
import { ExecuteInstruction } from '@cosmjs/cosmwasm-stargate';

export type MakeOrderConfig = {
  makeProfit?: boolean;
  createDepth?: boolean;
  buyPercentage: number;
  spreadMin: number;
  spreadMax: number;
  sellDepth: number;
  buyDepth: number;
  oraiThreshold: number;
  usdtThreshold: number;
  spreadMatch: number;
  spreadCancel: number;
  totalOrders: number;
};

const getRandomSpread = (min: number, max: number) => {
  return getRandomRange(min * atomic, max * atomic) / atomic;
};

const generateOrders = async (
  oraiPrice: number,
  usdtContractAddress: Addr,
  orderbookAddress: Addr,
  sender: UserWallet,
  assetInfos: AssetInfo[],
  direction: OrderDirection,
  { spreadMin, spreadMax, totalOrders, sellDepth, buyDepth, makeProfit }: MakeOrderConfig
): Promise<OraiswapLimitOrderTypes.ExecuteMsg[]> => {
  const minUsdtAmount = 10000;
  const spread = getRandomSpread(spreadMin, spreadMax);
  
  // if make profit then buy lower, sell higher than market
  const oraiPriceEntry = getSpreadPrice(oraiPrice, spread * (direction === 'buy' ? 1 : -1) * (makeProfit ? -1 : 1));
  console.log({oraiPriceEntry});

  let total_lef_mm_volume = 0;
  let total_lef_mm_ask_volume = 0;

  console.log({buyDepth}, {sellDepth});

  let multipleSubmitMsg: OraiswapLimitOrderTypes.ExecuteMsg[] = [];

  const mmOrders = await sender.client.queryContractSmart(orderbookAddress, {
    orders: {
      asset_infos: assetInfos,
      order_by: 1,
      limit: 100,
      filter: {
        bidder: sender.address
      },
      direction
    }
  } as OraiswapLimitOrderTypes.QueryMsg);

  console.dir(mmOrders, { depth: 4 });
  
  for (const order of mmOrders.orders) {
    if (order.bidder_addr === sender.address) {
      const lef_offer_amount = Number(order.offer_asset.amount) - Number(order.filled_offer_amount);
      total_lef_mm_volume += lef_offer_amount;
      if (Number(order.ask_asset.amount) > Number(order.filled_ask_amount)) {
        const lef_ask_amount = Number(order.ask_asset.amount) - Number(order.filled_ask_amount);
        console.log(`order_id: ${order.order_id}`, {lef_offer_amount}, {lef_ask_amount});
        total_lef_mm_ask_volume += lef_ask_amount;
      }
    }
  }
  console.log({total_lef_mm_volume}, {total_lef_mm_ask_volume});
  
  for (let i = 0; i < totalOrders; ++i) {
    let lef_usdt_volume = 0;
    if (direction === "buy") {
      if (total_lef_mm_volume + minUsdtAmount < buyDepth) {
        lef_usdt_volume = buyDepth - total_lef_mm_volume;
      } else if (total_lef_mm_volume > buyDepth) {
        try {
          const cancel_all_tx = await cancelAllOrderbyDirection(orderbookAddress, sender, assetInfos, direction);
          console.log("over buyDepth - cancel all buy orders - tx: " + cancel_all_tx);
          lef_usdt_volume = buyDepth;
        } catch (error) {
          console.log({error});
        }
      }
    } else if (direction === "sell") {
      if (total_lef_mm_ask_volume + minUsdtAmount < sellDepth) {
        lef_usdt_volume = sellDepth - total_lef_mm_ask_volume;
      } else if (total_lef_mm_ask_volume > sellDepth) {
        try {
          const cancel_all_tx = await cancelAllOrderbyDirection(orderbookAddress, sender, assetInfos, direction);
          console.log("over sellDepth - cancel all sell orders - tx: " + cancel_all_tx);
          lef_usdt_volume = sellDepth;
        } catch (error) {
          console.log({error});
        }
      }
    }
    console.log({lef_usdt_volume});
    if (lef_usdt_volume > 0) {
      const volumeMax = lef_usdt_volume/totalOrders;
      const volumeMin = lef_usdt_volume*0.995/totalOrders;

      const usdtVolume = Math.round(getRandomRange(volumeMin, volumeMax));
      const oraiVolume = Math.round(usdtVolume / oraiPriceEntry);

      console.log({oraiVolume}, {usdtVolume});
      
      const submitMsg: OraiswapLimitOrderTypes.ExecuteMsg = {
        submit_order: {
          assets: [
            {
              info: {
                native_token: { denom: 'orai' }
              },
              amount: oraiVolume.toString(),
            },
            {
              info: {
                token: { contract_addr: usdtContractAddress }
              },
              amount: usdtVolume.toString(),
            }
          ],
          direction
        }
      };
      multipleSubmitMsg.push(submitMsg);
    }
  }

  return multipleSubmitMsg;
};

const generateMatchOrders = async (
  oraiPrice: number, 
  usdtContractAddress: Addr,
  orderbookAddress: Addr,
  sender: UserWallet,
  spread: number,
  assetInfos: AssetInfo[],
  direction: OrderDirection,
  limit: 10,
  { buyPercentage, sellDepth, buyDepth }: MakeOrderConfig
): Promise<OraiswapLimitOrderTypes.ExecuteMsg[]> => {
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
        if (order.bidder_addr === sender.address) {
          continue;
        }

        const lef_offer_amount = Number(order.offer_asset.amount) - Number(order.filled_offer_amount);
        console.log({order}, {trader_lef_amount: lef_offer_amount});
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

export async function makeOrders(buyer: UserWallet, seller: UserWallet, usdtTokenAddress: Addr, orderBookAddress: Addr, oraiPrice: number, mmConfig: MakeOrderConfig, limit = 10, denom = 'orai') {
  const assetInfos = [{ native_token: { denom } }, { token: { contract_addr: usdtTokenAddress } }];
  const multipleBuyMsg: ExecuteInstruction[] = [];
  const multipleSellMsg: ExecuteInstruction[] = [];
  let buyerWallet: UserWallet = buyer;
  let sellerWallet: UserWallet = seller;

  let multiple_sell: OraiswapLimitOrderTypes.ExecuteMsg[]
  let multiple_buy: OraiswapLimitOrderTypes.ExecuteMsg[]
  
  console.log({oraiPrice});
  if (oraiPrice == 0) {
    throw new Error(`Orai's price (${oraiPrice}) = 0`);
  }

  const buyerUsdtBalance = await buyerWallet.client.queryContractSmart(usdtTokenAddress, { balance: { address: buyerWallet.address } } as OraiswapTokenTypes.QueryMsg).then((b) => BigInt(b.balance));
  const buyerOraiBalance = await buyerWallet.client.getBalance(buyerWallet.address, 'orai').then((b) => BigInt(b.amount));
  const sellerUsdtBalance = await sellerWallet.client.queryContractSmart(usdtTokenAddress, { balance: { address: sellerWallet.address } } as OraiswapTokenTypes.QueryMsg).then((b) => BigInt(b.balance));
  const sellerOraiBalance = await sellerWallet.client.getBalance(sellerWallet.address, 'orai').then((b) => BigInt(b.amount));

  console.log("buyer's balances:", buyerOraiBalance.toString() + 'orai', buyerUsdtBalance.toString() + 'usdt');
  console.log("seller's balances:", sellerOraiBalance.toString() + 'orai', sellerUsdtBalance.toString() + 'usdt');

  if (sellerOraiBalance < BigInt(1000000) || buyerOraiBalance < BigInt(1000000)) {
    throw new Error('Balance of seller/buyer must be greater than 1 ORAI');
  }
  
  if (buyerUsdtBalance < BigInt(mmConfig.usdtThreshold) || sellerOraiBalance < BigInt(mmConfig.oraiThreshold)) {
    console.log('Switch buyer <=> seller');
    if (sellerUsdtBalance >= BigInt(mmConfig.usdtThreshold) && buyerOraiBalance >= BigInt(mmConfig.oraiThreshold)) {
      buyerWallet = seller;
      sellerWallet = buyer;
    } else {
      throw new Error(`Seller(${sellerOraiBalance}) or Buyer(${buyerUsdtBalance}) have not enough funds to run trading bot`);
    }
  }
  mmConfig.createDepth = true;
  mmConfig.makeProfit = true;

  if (mmConfig.createDepth) {
    try {
      multiple_sell = await generateOrders(oraiPrice, usdtTokenAddress, orderBookAddress, seller, assetInfos, "sell", mmConfig);
    } catch (error) {
      console.log({error});
    }

    try {
      multiple_buy = await generateOrders(oraiPrice, usdtTokenAddress, orderBookAddress, buyer, assetInfos, "buy", mmConfig);
    } catch (error) {
      console.log({error});
    }
  } else {
    try {
      multiple_sell = await generateMatchOrders(oraiPrice, usdtTokenAddress, orderBookAddress, seller, mmConfig.spreadMatch, assetInfos, "sell", 10, mmConfig);
    } catch (error) {
      console.log({error});
    }

    try {
      multiple_buy = await generateMatchOrders(oraiPrice, usdtTokenAddress, orderBookAddress, buyer, mmConfig.spreadMatch, assetInfos, "buy", 10, mmConfig);
    } catch (error) {
      console.log({error});
    }
  }

  if (multiple_sell.length > 0) {
    for (const msg of multiple_sell) {
      if ('submit_order' in msg) {
        const submitOrderMsg = msg.submit_order;
        const [base] = submitOrderMsg.assets;
  
        if (submitOrderMsg.direction === 'sell') {
          if (sellerOraiBalance < BigInt(base.amount)) {
            console.log("Out of orai balance");
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
  }

  if (multiple_buy.length > 0) {
    for (const msg of multiple_buy) {
      if ('submit_order' in msg) {
        const submitOrderMsg = msg.submit_order;
        const [, quote] = submitOrderMsg.assets;
  
        if (submitOrderMsg.direction === 'buy') {
          if (buyerUsdtBalance < BigInt(quote.amount)) {
            console.log("Out of usdt balance");
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
    await cancelOutofSpreadOrder(orderBookAddress, sellerWallet, assetInfos, "sell", oraiPrice, mmConfig.spreadCancel);
  } catch (error) {
    console.error(error);
  }

  // console.log(orderBookAddress, await client.getBalance(orderBookAddress, 'orai'));
  try {
    await cancelOutofSpreadOrder(orderBookAddress, buyerWallet, assetInfos, "buy", oraiPrice, mmConfig.spreadCancel);
  } catch (error) {
    console.error(error);
  }
}

export * from './common';
