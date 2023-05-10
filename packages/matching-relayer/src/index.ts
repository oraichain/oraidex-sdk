import 'dotenv/config';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import * as cosmwasm from '@cosmjs/cosmwasm-stargate';
import { stringToPath } from '@cosmjs/crypto';
import { GasPrice } from '@cosmjs/stargate';
import {OraiswapLimitOrderTypes} from '@oraichain/orderbook-contracts-sdk';

const gas_price = "0.002orai"

const runMatchingEngine = async (client: cosmwasm.SigningCosmWasmClient,
  senderAddress: string,
  contractAddr: string,
  pair: any) => {
  try {
    const pair_is_matchable: OraiswapLimitOrderTypes.QueryMsg = {
      order_book_matchable: {
        asset_infos: pair.execute_order_book_pair.asset_infos
      }
    };

    const query_matchable = await client.queryContractSmart(
      contractAddr!,
      pair_is_matchable
    );

    if (query_matchable.is_matchable === true) {
      console.log('execute_pair: ', JSON.stringify(pair));
      const tx = await client.execute(senderAddress, contractAddr!, pair, 'auto',);
      console.log('matching done - txHash: ', tx.transactionHash);
      return tx;
    }
  } catch (error) {
    console.error(error);
    return error
  }
}

async function main(): Promise<void> {
  const mnemonic =  process.env["MNEMONIC"];
  if (!mnemonic || mnemonic.length < 48) {
    throw new Error("Must set MNEMONIC to a 12 word phrase");
  }

  const contractAddr = process.env.CONTRACT;
  const prefix = 'orai';
  const denom = process.env.DENOM || 'orai';
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
    hdPaths: [stringToPath(process.env.HD_PATH || "m/44'/118'/0'/0/0")],
    prefix
  });
  const [firstAccount] = await wallet.getAccounts();
  const client = await cosmwasm.SigningCosmWasmClient.connectWithSigner(process.env.RPC_URL!, wallet, {
    gasPrice: GasPrice.fromString(gas_price),
    prefix
  });

  const allPair: OraiswapLimitOrderTypes.QueryMsg = {
    order_books: {}
  };

  const query_pairs = await client.queryContractSmart(
    contractAddr,
    allPair
  );

  console.log(`Excecuting orderbook contract ${contractAddr}`);

  let execute_pairs: any[] = [];
  for (let pair in query_pairs.order_books) {
    let orderbook_pair = query_pairs.order_books[pair];
    let ex_pair: OraiswapLimitOrderTypes.ExecuteMsg = {
      execute_order_book_pair: {
        asset_infos: [
          orderbook_pair.base_coin_info,
          orderbook_pair.quote_coin_info
        ],
        limit: 30
      }
    }

    execute_pairs.push(ex_pair);
  }

  while (1) {
    let { amount } = await client.getBalance(firstAccount.address, denom);
    console.log(`balance of ${firstAccount.address} is ${amount}`);
    console.log({ contractAddr: contractAddr, });
    const start = new Date();
    try {
      let promiseAll: any[] = [];
      execute_pairs.map(item => {
        promiseAll.push(runMatchingEngine(client, firstAccount.address, contractAddr, item));
      })
      const result = await Promise.all(promiseAll);
    } catch (error) {
    }
    const end = new Date();
    console.log(`matching time: ${end.getTime() - start.getTime()}ms`);
  }
}

main().then(
  () => {
    process.exit(0);
  },
  (error) => {
    console.error(error);
    process.exit(1);
  }
);