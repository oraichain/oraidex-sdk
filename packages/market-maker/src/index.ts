import { coins } from '@cosmjs/amino';
import { toBinary } from '@cosmjs/cosmwasm-stargate';
import { Addr, OraiswapLimitOrderClient, OraiswapLimitOrderTypes, OraiswapTokenClient, OrderDirection } from '@oraichain/orderbook-contracts-sdk';
import { matchingOrders } from '@oraichain/orderbook-matching-relayer';
import { atomic, buyerAddress, cancelOrder, getRandomPercentage, getRandomRange, getSpreadPrice, sellerAddress } from './common';

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

export async function makeOrders(token: OraiswapTokenClient, orderbook: OraiswapLimitOrderClient, oraiPrice: number, totalOrders: number, config: MakeOrderConfig, limit = 30, denom = 'orai') {
  const assetInfos = [{ native_token: { denom } }, { token: { contract_addr: token.contractAddress } }];

  for (let i = 0; i < totalOrders; ++i) {
    const msg = generateOrderMsg(oraiPrice, token.contractAddress, config);

    if ('submit_order' in msg) {
      const submitOrderMsg = msg.submit_order;
      const [base, quote] = submitOrderMsg.assets;
      const buyerBalance = await token.balance({ address: buyerAddress }).then((b) => BigInt(b.balance));
      const sellerBalance = await orderbook.client.getBalance(sellerAddress, 'orai').then((b) => BigInt(b.amount));
      if (submitOrderMsg.direction === 'sell') {
        if (sellerBalance < BigInt(base.amount)) {
          continue;
        }
        // console.log({ seller: sellerBalance.toString() + 'orai' });
        orderbook.sender = sellerAddress;
        // console.dir(submitOrderMsg, { depth: null });
        await orderbook.submitOrder(submitOrderMsg, 'auto', undefined, coins(base.amount, 'orai'));
      } else {
        if (buyerBalance < BigInt(quote.amount)) {
          continue;
        }
        // console.log({ buyer: buyerBalance.toString() + 'usdt' });
        token.sender = buyerAddress;
        await token.send({
          amount: quote.amount,
          contract: orderbook.contractAddress,
          msg: toBinary(msg)
        });
      }
    }
  }

  // process matching, use buyer to get orai faster to switch
  await matchingOrders(orderbook.client, buyerAddress, orderbook.contractAddress, limit, denom);
  const cancelLimit = Math.round(totalOrders * config.cancelPercentage);
  // console.log(orderbook.contractAddress, await client.getBalance(orderbook.contractAddress, 'orai'));
  await cancelOrder(orderbook, sellerAddress, assetInfos, cancelLimit);
  // console.log(orderbook.contractAddress, await client.getBalance(orderbook.contractAddress, 'orai'));
  // await cancelOrder(orderbook, buyerAddress, assetInfos, cancelLimit);
}

export * from './common';
