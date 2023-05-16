import 'dotenv/config';
import { delay } from '@oraichain/orderbook-matching-relayer';
import { MakeOrderConfig, makeOrders, getCoingeckoPrice, getRandomRange, decrypt, setupWallet, deployToken, deployOrderbook, toDecimals, UserWallet } from './index';
import { OraiswapLimitOrderClient, OraiswapTokenClient } from '@oraichain/orderbook-contracts-sdk';
import { SimulateCosmWasmClient } from '@terran-one/cw-simulate';
import { coin } from '@cosmjs/amino';

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

(async () => {
  let buyer: UserWallet, seller: UserWallet, usdtToken: OraiswapTokenClient, orderBook: OraiswapLimitOrderClient;
  // init data for test
  if (process.env.NODE_ENV === 'test') {
    const client = new SimulateCosmWasmClient({
      chainId: 'Oraichain',
      bech32Prefix: 'orai'
    });
    buyer = { client, address: 'orai1hz4kkphvt0smw4wd9uusuxjwkp604u7m4akyzv' };
    seller = { client, address: 'orai18cgmaec32hgmd8ls8w44hjn25qzjwhannd9kpj' };
    client.app.bank.setBalance(seller.address, [coin(toDecimals(1000), 'orai')]);
    usdtToken = await deployToken(buyer.client, buyer.address, {
      symbol: 'USDT',
      name: 'USDT token'
    });
    orderBook = await deployOrderbook(buyer.client, buyer.address);
    await orderBook.createOrderBookPair({
      baseCoinInfo: { native_token: { denom: 'orai' } },
      quoteCoinInfo: { token: { contract_addr: usdtToken.contractAddress } },
      spread: '0.5',
      minQuoteCoinAmount: '10'
    });
  } else {
    buyer = await setupWallet(decrypt(process.env.BUYER_MNEMONIC_PASS, process.env.BUYER_MNEMONIC_ENCRYPTED));
    seller = await setupWallet(decrypt(process.env.SELLER_MNEMONIC_PASS, process.env.SELLER_MNEMONIC_ENCRYPTED));
    usdtToken = new OraiswapTokenClient(buyer.client, buyer.address, process.env.USDT_CONTRACT);
    orderBook = new OraiswapLimitOrderClient(buyer.client, buyer.address, process.env.ORDERBOOK_CONTRACT);
  }

  console.log('buyer address: ', buyer.address, 'seller address: ', seller.address);

  // get price from coingecko
  const oraiPrice = await getCoingeckoPrice('oraichain-token');

  let processInd = 0;
  while (processInd < maxRepeat) {
    await makeOrders(buyer, seller, usdtToken.contractAddress, orderBook.contractAddress, oraiPrice, totalOrders, orderConfig);

    console.log('Balance after matching:');
    console.log({
      buyer: await buyer.client.getBalance(buyer.address, 'orai').then((b) => b.amount + 'orai'),
      seller: await usdtToken.balance({ address: seller.address }).then((b) => b.balance + 'usdt')
    });

    // waiting for interval then re call again
    // const interval = getRandomRange(orderIntervalMin, orderIntervalMax);
    // await delay(interval);
    processInd++;
  }
})();
