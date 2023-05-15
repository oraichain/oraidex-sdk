import { ExecuteResult, SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { OraiswapLimitOrderTypes } from '@oraichain/orderbook-contracts-sdk';

const runMatchingEngine = async (client: SigningCosmWasmClient, senderAddress: string, contractAddr: string, pair: any) => {
  const pair_is_matchable: OraiswapLimitOrderTypes.QueryMsg = {
    order_book_matchable: {
      asset_infos: pair.execute_order_book_pair.asset_infos
    }
  };

  const query_matchable = await client.queryContractSmart(contractAddr!, pair_is_matchable);

  if (query_matchable.is_matchable === true) {
    const start = new Date();
    console.log('execute_pair: ', JSON.stringify(pair));
    try {
      const tx = await client.execute(senderAddress, contractAddr!, pair, 'auto');
      const end = new Date();
      console.log(`matching time: ${end.getTime() - start.getTime()}ms`);
      console.log('matching done - txHash: ', tx.transactionHash);
      return tx;
    } catch (error) {
      console.error(error);
    }
  }
};

export const delay = (milliseconds: number) => {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

export async function matchingOrders(client: SigningCosmWasmClient, senderAddress: string, contractAddr: string, limit = 30, denom = 'orai'): Promise<ExecuteResult[]> {
  const allPair: OraiswapLimitOrderTypes.QueryMsg = {
    order_books: {}
  };

  const query_pairs = await client.queryContractSmart(contractAddr, allPair);

  console.log(`Excecuting orderbook contract ${contractAddr}`);

  let execute_pairs: any[] = [];
  for (let pair in query_pairs.order_books) {
    let orderbook_pair = query_pairs.order_books[pair];
    let ex_pair: OraiswapLimitOrderTypes.ExecuteMsg = {
      execute_order_book_pair: {
        asset_infos: [orderbook_pair.base_coin_info, orderbook_pair.quote_coin_info],
        limit
      }
    };

    execute_pairs.push(ex_pair);
  }

  const { amount } = await client.getBalance(senderAddress, denom);
  console.log(`balance of ${senderAddress} is ${amount}`);
  const promiseAll = execute_pairs.map((item) => runMatchingEngine(client, senderAddress, contractAddr, item));
  return (await Promise.all(promiseAll)).filter(Boolean);
}
