import { coins } from '@cosmjs/amino';
import { toBinary } from '@cosmjs/cosmwasm-stargate';
import { Addr, OraiswapLimitOrderClient, OraiswapLimitOrderTypes, OraiswapTokenClient, OrderDirection } from '@oraichain/orderbook-contracts-sdk';
import { matchingOrders } from '@oraichain/orderbook-matching-relayer';
import { UserWallet, atomic, cancelOrder, getRandomPercentage, getRandomRange, getSpreadPrice } from './common';
import { ExecuteInstruction } from '@cosmjs/cosmwasm-stargate';

export type MakeOrderConfig = {
  spreadMin: number;
  spreadMax: number;
  buyPercentage: number;
  cancelPercentage: number;
  volumeMin: number;
  volumeMax: number;
};

const getRandomSpread = (min: number, max: number) => {
  return getRandomRange(min * atomic, max * atomic) / atomic;
};

const generateOrderMsg = (oraiPrice: number, usdtContractAddress: Addr, { spreadMin, spreadMax, buyPercentage, volumeMin, volumeMax }: MakeOrderConfig): OraiswapLimitOrderTypes.ExecuteMsg => {
  const spread = getRandomSpread(spreadMin, spreadMax);
  // buy percentage is 55%
  const direction: OrderDirection = getRandomPercentage() < buyPercentage * 100 ? 'buy' : 'sell';

  const oraiPriceEntry = getSpreadPrice(oraiPrice, spread * (direction === 'buy' ? 1 : -1));

  const oraiVolume = getRandomRange(volumeMin, volumeMax); // between 0.1 and 0.15 orai
  const usdtVolume = (oraiPriceEntry * oraiVolume).toFixed(0);

  return {
    submit_order: {
      assets: [
        {
          info: {
            native_token: { denom: 'orai' }
          },
          amount: oraiVolume.toString()
        },
        {
          info: {
            token: { contract_addr: usdtContractAddress }
          },
          amount: usdtVolume
        }
      ],
      direction
    }
  };
};

export async function makeOrders(buyer: UserWallet, seller: UserWallet, usdtToken: OraiswapTokenClient, orderBook: OraiswapLimitOrderClient, oraiPrice: number, totalOrders: number, config: MakeOrderConfig, limit = 30, denom = 'orai') {
  const assetInfos = [{ native_token: { denom } }, { token: { contract_addr: usdtToken.contractAddress } }];
  const multipleBuyMsg: ExecuteInstruction[] = [];
  const multipleSellMsg: ExecuteInstruction[] = [];
  for (let i = 0; i < totalOrders; ++i) {
    const msg = generateOrderMsg(oraiPrice, usdtToken.contractAddress, config);

    if ('submit_order' in msg) {
      const submitOrderMsg = msg.submit_order;
      const [base, quote] = submitOrderMsg.assets;
      const buyerBalance = await usdtToken.balance({ address: buyer.address }).then((b) => BigInt(b.balance));
      const sellerBalance = await seller.client.getBalance(seller.address, 'orai').then((b) => BigInt(b.amount));
      if (submitOrderMsg.direction === 'sell') {
        if (sellerBalance < BigInt(base.amount)) {
          continue;
        }
        const sellMsg: ExecuteInstruction = {
          contractAddress: orderBook.contractAddress,
          msg: msg,
          funds: [{ amount: base.amount, denom: 'orai' }]
        };

        multipleSellMsg.push(sellMsg);
        console.log({ seller: sellerBalance.toString() + 'orai' });
        orderBook.client = seller.client;
        orderBook.sender = seller.address;
        // console.dir(submitOrderMsg, { depth: null });
      } else {
        if (buyerBalance < BigInt(quote.amount)) {
          continue;
        }
        console.log({ buyer: buyerBalance.toString() + 'usdt' });
        usdtToken.client = buyer.client;
        usdtToken.sender = buyer.address;
        const buyMsg: ExecuteInstruction = {
          contractAddress: usdtToken.contractAddress,
          msg: {
            send: {
              amount: quote.amount,
              contract: orderBook.contractAddress,
              msg: toBinary(msg)
            }
          }
        };

        multipleBuyMsg.push(buyMsg);
      }
    }
  }
  console.log('multipleBuyOrders: ');
  console.dir(multipleBuyMsg, { depth: 4 });
  console.log('multipleSellOrders: ');
  console.dir(multipleSellMsg, { depth: 4 });
  if (multipleBuyMsg.length > 0) {
    const buyResult = await buyer.client.executeMultiple(buyer.address, multipleBuyMsg, 'auto');
    console.log('buyResult:', buyResult);
    multipleBuyMsg.splice(0, multipleBuyMsg.length);
  }
  if (multipleSellMsg.length > 0) {
    const sellResult = await seller.client.executeMultiple(seller.address, multipleSellMsg, 'auto');
    console.log('sellResult:', sellResult);
    multipleSellMsg.splice(0, multipleSellMsg.length);
  }

  // process matching, use buyer to get orai faster to switch
  await matchingOrders(buyer.client, buyer.address, orderBook.contractAddress, limit, denom);
  const cancelLimit = Math.round(totalOrders * config.cancelPercentage);
  // console.log(orderbook.contractAddress, await client.getBalance(orderbook.contractAddress, 'orai'));
  await cancelOrder(orderBook, seller, assetInfos, cancelLimit);
  // console.log(orderbook.contractAddress, await client.getBalance(orderbook.contractAddress, 'orai'));
  await cancelOrder(orderBook, buyer, assetInfos, cancelLimit);
}

export * from './common';
