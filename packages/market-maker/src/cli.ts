import 'dotenv/config';
import { coin } from '@cosmjs/amino';
import { delay } from '@oraichain/orderbook-matching-relayer';
import { SimulateCosmWasmClient } from '@terran-one/cw-simulate';
import { MakeOrderConfig, makeOrders, buyerAddress, deployOrderbook, deployToken, getCoingeckoPrice, getRandomRange, ownerAddress, sellerAddress, toDecimals } from './index';

const cancelPercentage = Number(process.env.CANCEL_PERCENTAGE || 1); // 100% cancel
const [volumeMin, volumeMax] = process.env.VOLUME_RANGE ? process.env.VOLUME_RANGE.split(',').map(Number) : [100000, 150000];
const buyPercentage = Number(process.env.BUY_PERCENTAGE || 0.55);
const [spreadMin, spreadMax] = process.env.SPREAD_RANGE ? process.env.SPREAD_RANGE.split(',').map(Number) : [0.003, 0.006];
const orderConfig: MakeOrderConfig = {
  cancelPercentage,
  volumeMin,
  volumeMax,
  buyPercentage,
  spreadMax,
  spreadMin
};
const [orderIntervalMin, orderIntervalMax] = process.env.ORDER_INTERVAL_RANGE ? process.env.ORDER_INTERVAL_RANGE.split(',').map(Number) : [50, 100];
const maxRepeat = 5;
const totalOrders = 10;

const client = new SimulateCosmWasmClient({
  chainId: 'Oraichain',
  bech32Prefix: 'orai'
});

client.app.bank.setBalance(ownerAddress, [coin(toDecimals(1000), 'orai')]);

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
  // get price from coingecko
  const oraiPrice = await getCoingeckoPrice('oraichain-token');

  let processInd = 0;
  while (processInd < maxRepeat) {
    await makeOrders(usdtToken, orderbook, oraiPrice, totalOrders, orderConfig);

    console.log('Balance after matching:');
    console.log({ buyer: await client.getBalance(buyerAddress, 'orai').then((b) => b.amount + 'orai'), seller: await usdtToken.balance({ address: sellerAddress }).then((b) => b.balance + 'usdt') });

    // waiting for interval then re call again
    const interval = getRandomRange(orderIntervalMin, orderIntervalMax);
    await delay(interval);
    processInd++;
  }
})();
