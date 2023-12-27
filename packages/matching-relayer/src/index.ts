import { ExecuteResult, SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { OraiswapLimitOrderQueryClient, OraiswapLimitOrderTypes } from "@oraichain/oraidex-contracts-sdk";

const minimumOraiBalance = 1000000; // 1 ORAI;

const runMatchingEngine = async (
  client: SigningCosmWasmClient,
  senderAddress: string,
  contractAddr: string,
  pair: any
) => {
  const start = new Date();
  console.log("execute_pair:", JSON.stringify(pair));
  try {
    const tx = await client.executeMultiple(
      senderAddress,
      pair.map((pair) => ({ contractAddress: contractAddr, msg: pair, funds: [] })),
      "auto"
    );
    const end = new Date();
    console.log(`matching time: ${end.getTime() - start.getTime()}ms`);
    console.log("matching done - txHash:", tx.transactionHash);
    return tx;
  } catch (error) {
    console.error(error);
  }
};

export const delay = (milliseconds: number) => {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

export async function matchingOrders(
  client: SigningCosmWasmClient,
  senderAddress: string,
  contractAddr: string,
  limit = 30,
  denom = "orai"
): Promise<ExecuteResult> {
  const orderbook = new OraiswapLimitOrderQueryClient(client, contractAddr);
  const query_pairs = await orderbook.orderBooks({});

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
  if (parseInt(amount) <= minimumOraiBalance) {
    throw new Error(`Balance(${amount}) of ${senderAddress} must be greater than 1 ORAI`);
  }
  return runMatchingEngine(client, senderAddress, contractAddr, execute_pairs);
}
