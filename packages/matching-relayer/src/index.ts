import 'dotenv/config';
import { SimulateCosmWasmClient } from '@terran-one/cw-simulate';
import { coin } from '@cosmjs/amino';
import { deployOrderbook, deployToken, senderAddress } from './common';

const client = new SimulateCosmWasmClient({
  chainId: 'Oraichain',
  bech32Prefix: 'orai'
});

client.app.bank.setBalance(senderAddress, [coin('1000000000', 'orai'), coin('1000000000', 'usdt')]);

(async () => {
  const usdtToken = await deployToken(client, { symbol: 'USDT', name: 'USDT token' });
  const orderbook = await deployOrderbook(client);
  const info = await orderbook.contractInfo();
  console.log(info.admin);
})();
