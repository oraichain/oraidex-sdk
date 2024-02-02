import * as oraidexArtifacts from "@oraichain/oraidex-contracts-build";
import { SimulateCosmWasmClient } from "@oraichain/cw-simulate";

import {
  OraiswapLimitOrderClient,
  OraiswapLimitOrderTypes,
  OraiswapTokenClient
} from "@oraichain/oraidex-contracts-sdk";
import { readFileSync } from "fs";
import { Cw20Coin } from "@oraichain/oraidex-contracts-sdk/build/OraiswapToken.types";

export const senderAddress = "orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g";

export const deployToken = async (
  client: SimulateCosmWasmClient,
  {
    symbol,
    name,
    decimals = 6,
    initial_balances = [{ address: senderAddress, amount: "1000000000" }]
  }: { symbol: string; name: string; decimals?: number; initial_balances?: Cw20Coin[] }
): Promise<OraiswapTokenClient> => {
  return new OraiswapTokenClient(
    client,
    senderAddress,
    await oraidexArtifacts
      .deployContract(
        client,
        senderAddress,
        {
          decimals,
          symbol,
          name,
          mint: { minter: senderAddress },
          initial_balances
        },
        "oraiswap token",
        "oraiswap_token"
      )
      .then((res) => res.contractAddress)
  );
};

export const deployOrderbook = async (client: SimulateCosmWasmClient): Promise<OraiswapLimitOrderClient> => {
  const { codeId } = await client.upload(
    senderAddress,
    readFileSync(process.env.ORAISWAP_LIMIT_ORDER || oraidexArtifacts.getContractDir("oraiswap_limit_order")),
    "auto"
  );
  const { contractAddress } = await client.instantiate(
    senderAddress,
    codeId,
    {
      admin: senderAddress,
      version: "0.0.1",
      name: "Orderbook"
    },
    "oraiswap_limit_order",
    "auto"
  );

  return new OraiswapLimitOrderClient(client, senderAddress, contractAddress);
};

export const printOrders = (title: string, orders: OraiswapLimitOrderTypes.OrderResponse[]) => {
  console.log(title);
  console.table(
    orders.reduce((map, { order_id, status, direction, bidder_addr, filled_ask_amount, filled_offer_amount }) => {
      map[order_id] = {
        status,
        direction,
        bidder_addr,
        filled_ask_amount,
        filled_offer_amount
      };
      return map;
    }, {})
  );
};
