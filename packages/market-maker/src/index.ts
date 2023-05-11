import 'dotenv/config';
import { SimulateCosmWasmClient } from '@terran-one/cw-simulate';
import { coin, coins } from '@cosmjs/amino';
import { atomic, deployOrderbook, deployToken, getCoingeckoPrice, getRandomPercentage, getSpreadPrice, getRandomRange, ownerAddress, buyerAddress, sellerAddress, toDecimals, cancelOrder } from './common';
import { Addr, OraiswapLimitOrderTypes, OrderDirection } from '@oraichain/orderbook-contracts-sdk';
import { toBinary } from '@cosmjs/cosmwasm-stargate';
import { delay, matchingOrder } from '@oraichain/orderbook-matching-relayer';

const totalOrders = 10;
const cancelPercentage = 0.15;
const [orderIntervalMin, orderIntervalMax] = [2000, 3000];
const [spreadMin, spreadMax] = [0.003, 0.006];
const [volumeMin, volumeMax] = [100000, 150000];
const buyPercentage = 0.55;
const maxRepeat = 2;

const client = new SimulateCosmWasmClient({
  chainId: 'Oraichain',
  bech32Prefix: 'orai'
});

client.app.bank.setBalance(ownerAddress, [coin(toDecimals(1000), 'orai')]);

const getRandomSpread = (min: number, max: number) => {
  return getRandomRange(min * atomic, max * atomic) / atomic;
};

const generateOrderMsg = (oraiPrice: number, usdtContractAddress: Addr): OraiswapLimitOrderTypes.ExecuteMsg => {
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

(async () => {
  const usdtToken = await deployToken(client, {
    symbol: 'USDT',
    name: 'USDT token',
    initial_balances: [{ address: buyerAddress, amount: toDecimals(10000) }]
  });
  // set orai balance
  client.app.bank.setBalance(sellerAddress, [coin(toDecimals(5000), 'orai')]);

  const assetInfos = [{ native_token: { denom: 'orai' } }, { token: { contract_addr: usdtToken.contractAddress } }];

  // deploy orderbook and create pair
  const orderbook = await deployOrderbook(client);
  await orderbook.createOrderBookPair(
    {
      baseCoinInfo: assetInfos[0],
      quoteCoinInfo: assetInfos[1],
      spread: '0.5',
      minQuoteCoinAmount: '10'
    },
    'auto',
    ''
  );
  let timer: NodeJS.Timer;
  let processInd = 0;

  while (processInd < maxRepeat) {
    // get price from coingecko
    const oraiPrice = await getCoingeckoPrice('oraichain-token');

    for (let i = 0; i < totalOrders; ++i) {
      const msg = generateOrderMsg(oraiPrice, usdtToken.contractAddress);

      if ('submit_order' in msg) {
        const submitOrderMsg = msg.submit_order;
        const [base, quote] = submitOrderMsg.assets;
        if (submitOrderMsg.direction === 'sell') {
          orderbook.sender = sellerAddress;
          await orderbook.submitOrder(submitOrderMsg, 'auto', undefined, coins(base.amount, 'orai'));
        } else {
          usdtToken.sender = buyerAddress;
          await usdtToken.send({
            amount: quote.amount,
            contract: orderbook.contractAddress,
            msg: toBinary(msg)
          });
        }
      }
    }

    // process matching
    await matchingOrder(client, ownerAddress, orderbook.contractAddress);
    const cancelLimit = Math.round(totalOrders * cancelPercentage);
    await cancelOrder(orderbook, sellerAddress, assetInfos, cancelLimit);
    await cancelOrder(orderbook, buyerAddress, assetInfos, cancelLimit);
    console.log('buyer balance', await usdtToken.balance({ address: buyerAddress }), 'seller balance', await usdtToken.balance({ address: sellerAddress }));

    // waiting for interval then re call again
    const interval = getRandomRange(orderIntervalMin, orderIntervalMax);
    await delay(interval);
    processInd++;
  }
})();
