import 'dotenv/config';
import { delay } from '@oraichain/orderbook-matching-relayer';
import { MakeOrderConfig, makeOrders, getCoingeckoPrice, getRandomRange, decrypt, setupWallet } from './index';
import { OraiswapLimitOrderClient, OraiswapTokenClient } from '@oraichain/orderbook-contracts-sdk';
import { SimulateCosmWasmClient } from '@terran-one/cw-simulate/src';

const cancelPercentage = Number(process.env.CANCEL_PERCENTAGE || 1); // 100% cancel
const [volumeMin, volumeMax] = process.env.VOLUME_RANGE ? process.env.VOLUME_RANGE.split(',').map(Number) : [100000, 150000];
const buyPercentage = Number(process.env.BUY_PERCENTAGE || 0.55);
const [spreadMin, spreadMax] = process.env.SPREAD_RANGE ? process.env.SPREAD_RANGE.split(',').map(Number) : [0.003, 0.006];
const orderBookContractAddr = process.env.ORDERBOOK_CONTRACT;
const usdtContractAddr = process.env.USDT_CONTRACT;

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

const getBuyerAndSeller = async () => {
  // for simulating
  if ((process.env.NODE_ENV = 'test')) {
    const client = new SimulateCosmWasmClient({
      chainId: 'Oraichain',
      bech32Prefix: 'orai'
    });
    return [
      { client, address: 'orai1hz4kkphvt0smw4wd9uusuxjwkp604u7m4akyzv' },
      { client, address: 'orai18cgmaec32hgmd8ls8w44hjn25qzjwhannd9kpj' }
    ];
  }
  const buyerMnemonic = decrypt(process.env.BUYER_MNEMONIC_PASS, process.env.BUYER_MNEMONIC_ENCRYPTED);
  const buyerWallet = await setupWallet(buyerMnemonic);
  const sellerMnemonic = decrypt(process.env.SELLER_MNEMONIC_PASS, process.env.SELLER_MNEMONIC_ENCRYPTED);
  const sellerWallet = await setupWallet(sellerMnemonic);

  return [buyerWallet, sellerWallet];
};

(async () => {
  const [buyerWallet, sellerWallet] = await getBuyerAndSeller();
  console.log('buyerWallet address: ', buyerWallet.address, 'sellerWallet address: ', sellerWallet.address);

  const usdtToken = new OraiswapTokenClient(null, null, usdtContractAddr);
  const orderBook = new OraiswapLimitOrderClient(null, null, orderBookContractAddr);

  // get price from coingecko
  const oraiPrice = await getCoingeckoPrice('oraichain-token');

  let processInd = 0;
  while (processInd < maxRepeat) {
    await makeOrders(buyerWallet, sellerWallet, usdtToken, orderBook, oraiPrice, totalOrders, orderConfig);

    console.log('Balance after matching:');
    console.log({
      buyer: await buyerWallet.client.getBalance(buyerWallet.address, 'orai').then((b) => b.amount + 'orai'),
      seller: await usdtToken.balance({ address: sellerWallet.address }).then((b) => b.balance + 'usdt')
    });

    // waiting for interval then re call again
    const interval = getRandomRange(orderIntervalMin, orderIntervalMax);
    await delay(interval);
    processInd++;
  }
})();
