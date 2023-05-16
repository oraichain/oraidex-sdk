import { toBinary } from '@cosmjs/cosmwasm-stargate';
import { Addr, OraiswapLimitOrderTypes, OraiswapTokenTypes, OrderDirection } from '@oraichain/orderbook-contracts-sdk';
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

export async function makeOrders(buyer: UserWallet, seller: UserWallet, usdtTokenAddress: Addr, orderBookAddress: Addr, oraiPrice: number, totalOrders: number, config: MakeOrderConfig, limit = 30, denom = 'orai') {
  const assetInfos = [{ native_token: { denom } }, { token: { contract_addr: usdtTokenAddress } }];
  const multipleBuyMsg: ExecuteInstruction[] = [];
  const multipleSellMsg: ExecuteInstruction[] = [];
  for (let i = 0; i < totalOrders; ++i) {
    const msg = generateOrderMsg(oraiPrice, usdtTokenAddress, config);

    if ('submit_order' in msg) {
      const submitOrderMsg = msg.submit_order;
      const [base, quote] = submitOrderMsg.assets;
      const buyerBalance = await buyer.client.queryContractSmart(usdtTokenAddress, { balance: { address: buyer.address } } as OraiswapTokenTypes.QueryMsg).then((b) => BigInt(b.balance));
      const sellerBalance = await seller.client.getBalance(seller.address, 'orai').then((b) => BigInt(b.amount));
      if (submitOrderMsg.direction === 'sell') {
        if (sellerBalance < BigInt(base.amount)) {
          continue;
        }
        const sellMsg: ExecuteInstruction = {
          contractAddress: orderBookAddress,
          msg: msg,
          funds: [{ amount: base.amount, denom: 'orai' }]
        };

        multipleSellMsg.push(sellMsg);
        console.log({ seller: sellerBalance.toString() + 'orai' });
        // console.dir(submitOrderMsg, { depth: null });
      } else {
        if (buyerBalance < BigInt(quote.amount)) {
          continue;
        }
        console.log({ buyer: buyerBalance.toString() + 'usdt' });
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
  console.log('multipleBuyOrders: ');
  console.dir(multipleBuyMsg, { depth: 4 });
  console.log('multipleSellOrders: ');
  console.dir(multipleSellMsg, { depth: 4 });
  if (multipleBuyMsg.length > 0) {
    const buyResult = await buyer.client.executeMultiple(buyer.address, multipleBuyMsg, 'auto');
    console.log('buy orders - txHash:', buyResult.transactionHash);
  }
  if (multipleSellMsg.length > 0) {
    const sellResult = await seller.client.executeMultiple(seller.address, multipleSellMsg, 'auto');
    console.log('sell orders - txHash:', sellResult.transactionHash);
  }

  // process matching, use buyer to get orai faster to switch
  try {
    await matchingOrders(buyer.client, buyer.address, orderBookAddress, limit, denom);
  } catch (error) {
    console.error(error);
  }
  const cancelLimit = Math.round(totalOrders * config.cancelPercentage);
  // console.log(orderBookAddress, await client.getBalance(orderBookAddress, 'orai'));

  try {
    await cancelOrder(orderBookAddress, seller, assetInfos, cancelLimit);
  } catch (error) {
    console.error(error);
  }
  
  // console.log(orderBookAddress, await client.getBalance(orderBookAddress, 'orai'));

  try {
    await cancelOrder(orderBookAddress, buyer, assetInfos, cancelLimit);
  } catch (error) {
    console.error(error);
  }
}

export * from './common';
