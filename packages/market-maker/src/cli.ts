import 'dotenv/config';
import { delay } from '@oraichain/orderbook-matching-relayer';
import { SimulateCosmWasmClient } from '@terran-one/cw-simulate';
import { MakeOrderConfig, makeOrders, getCoingeckoPrice, getRandomRange, decrypt, setupWallet } from './index';
import { OraiswapLimitOrderClient, OraiswapTokenClient } from '@oraichain/orderbook-contracts-sdk';

const cancelPercentage = Number(process.env.CANCEL_PERCENTAGE || 1); // 100% cancel
const [volumeMin, volumeMax] = process.env.VOLUME_RANGE ? process.env.VOLUME_RANGE.split(',').map(Number) : [100000, 150000];
const buyPercentage = Number(process.env.BUY_PERCENTAGE || 0.55);
const [spreadMin, spreadMax] = process.env.SPREAD_RANGE ? process.env.SPREAD_RANGE.split(',').map(Number) : [0.003, 0.006];
const orderBookContract = process.env.ORDERBOOK_CONTRACT;
const usdtContract = process.env.USDT_CONTRACT;

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

(async () => {
  const buyerMnemonic = decrypt(process.env.BUYER_MNEMONIC_PASS, process.env.BUYER_MNEMONIC_ENCRYPTED);
  const buyerWallet = setupWallet(buyerMnemonic);
  console.log('buyerWallet address: ', (await buyerWallet).address);

  const sellerMnemonic = decrypt(process.env.SELLER_MNEMONIC_PASS, process.env.SELLER_MNEMONIC_ENCRYPTED);

  const sellerWallet = setupWallet(sellerMnemonic);
  console.log('sellerWallet address: ', (await sellerWallet).address);
  const buyerusdtToken = new OraiswapTokenClient((await buyerWallet).client, (await buyerWallet).address, usdtContract);
  const sellerusdtToken = new OraiswapTokenClient((await sellerWallet).client, (await sellerWallet).address, usdtContract);
  const buyerOrderBook = new OraiswapLimitOrderClient((await buyerWallet).client, (await buyerWallet).address, orderBookContract);
  const sellerOrderBook = new OraiswapLimitOrderClient((await sellerWallet).client, (await sellerWallet).address, orderBookContract);

  // get price from coingecko
  const oraiPrice = await getCoingeckoPrice('oraichain-token');

  let processInd = 0;
  while (processInd < maxRepeat) {
    await makeOrders([buyerusdtToken, sellerusdtToken, buyerOrderBook, sellerOrderBook, (await buyerWallet).address, (await sellerWallet).address], oraiPrice, totalOrders, orderConfig);

    console.log('Balance after matching:');
    console.log({ buyer: await (await buyerWallet).client.getBalance((await buyerWallet).address, 'orai').then((b) => b.amount + 'orai'), seller: await sellerusdtToken.balance({ address: (await sellerWallet).address }).then((b) => b.balance + 'usdt') });

    // waiting for interval then re call again
    const interval = getRandomRange(orderIntervalMin, orderIntervalMax);
    await delay(interval);
    processInd++;
  }
})();
