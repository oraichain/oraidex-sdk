import { ExecuteResult, SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { OraiswapLimitOrderQueryClient, OraiswapLimitOrderTypes } from "@oraichain/oraidex-contracts-sdk";
import { UserWallet } from "@oraichain/oraitrading-common";

const minimumOraiBalance = 1000000; // 1 ORAI;

const runMatchingEngine = async (sender: UserWallet, contractAddr: string, pair: any) => {
  console.time("matching engine time takes");
  if (pair.length === 0) return;
  console.log("execute_pair:", JSON.stringify(pair));
  const tx = await sender.client.executeMultiple(
    sender.address,
    pair.map((pair) => ({ contractAddress: contractAddr, msg: pair, funds: [] })),
    "auto"
  );
  console.timeEnd("matching engine time takes");
  console.log("matching done - txHash:", tx.transactionHash);
  return tx;
};

export const delay = (milliseconds: number) => {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

/// redundant func
export async function matchingOrders(
  sender: UserWallet,
  contractAddr: string,
  limit = 100,
  denom = "orai"
): Promise<ExecuteResult> {
  const orderbook = new OraiswapLimitOrderQueryClient(sender.client, contractAddr);
  const query_pairs = await orderbook.orderBooks({});

  console.log(`Excecuting orderbook contract ${contractAddr}`);

  let execute_pairs: any[] = [];

  // for (let pair in query_pairs.order_books) {
  //   let orderbook_pair = query_pairs.order_books[pair];
  //   const matchableMsg: OraiswapLimitOrderTypes.QueryMsg = {
  //     order_book_matchable: {
  //       asset_infos: [orderbook_pair.base_coin_info, orderbook_pair.quote_coin_info]
  //     }
  //   };
  //   const isMatchable = await sender.client.queryContractSmart(contractAddr!, matchableMsg);
  //   console.dir(orderbook_pair, { depth: null });
  //   console.log({ isMatchable });
  //   if (isMatchable.is_matchable === true) {
  //     let ex_pair: OraiswapLimitOrderTypes.ExecuteMsg = {
  //       execute_order_book_pair: {
  //         asset_infos: [orderbook_pair.base_coin_info, orderbook_pair.quote_coin_info],
  //         limit
  //       }
  //     };
  //     execute_pairs.push(ex_pair);
  //   }
  // }

  const { amount } = await sender.client.getBalance(sender.address, denom);
  console.log(`balance of ${sender.address} is ${amount}`);
  if (parseInt(amount) <= minimumOraiBalance) {
    throw new Error(`Balance(${amount}) of ${sender.address} must be greater than 1 ORAI`);
  }
  return runMatchingEngine(sender, contractAddr, execute_pairs);
}
