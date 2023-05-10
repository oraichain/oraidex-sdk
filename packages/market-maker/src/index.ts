import 'dotenv/config';
import { SimulateCosmWasmClient } from '@terran-one/cw-simulate';
import { coin } from '@cosmjs/amino';
import { atomic, deployOrderbook, deployToken, getCoingeckoPrice, getRandomPercentage, getSpreadPrice, getRandomRange, senderAddress, toDecimal } from './common';
import { Addr, OraiswapLimitOrderTypes, OraiswapTokenClient, OrderDirection, Uint128 } from '@oraichain/orderbook-contracts-sdk';

const client = new SimulateCosmWasmClient({
  chainId: 'Oraichain',
  bech32Prefix: 'orai'
});

client.app.bank.setBalance(senderAddress, [coin('1000000000', 'orai'), coin('1000000000', 'usdt')]);

const getRandomSpread = (min: number, max: number) => {
  return getRandomRange(min * atomic, max * atomic) / atomic;
};

const generateOrderMsg = (oraiPrice: number, usdtContractAddress: Addr): OraiswapLimitOrderTypes.ExecuteMsg => {
  const spread = getRandomSpread(0.003, 0.006);
  // buy percentage is 55%
  const direction: OrderDirection = getRandomPercentage() < 55 ? 'buy' : 'sell';

  const oraiPriceEntry = getSpreadPrice(oraiPrice, spread * (direction === 'buy' ? 1 : -1));

  const oraiVolume = getRandomRange(100000, 150000); // between 0.1 and 0.15 orai
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
  const usdtToken = await deployToken(client, { symbol: 'USDT', name: 'USDT token' });
  //   const orderbook = await deployOrderbook(client);
  //   const info = await orderbook.contractInfo();

  //   console.log(info.admin);
  const oraiPrice = await getCoingeckoPrice('oraichain-token');

  [...new Array(100)].forEach(() => {
    const msg = generateOrderMsg(oraiPrice, usdtToken.contractAddress);

    console.dir(msg, { depth: null });
  });
})();
