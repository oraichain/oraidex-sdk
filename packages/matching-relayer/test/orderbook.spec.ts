import { toBinary } from "@cosmjs/cosmwasm-stargate";
import { coin, Coin, coins } from "@cosmjs/stargate";
import { SimulateCosmWasmClient } from "@oraichain/cw-simulate";
import {
  OraiswapLimitOrderClient,
  OraiswapLimitOrderTypes,
  OraiswapTokenClient
} from "@oraichain/oraidex-contracts-sdk";

import { deployOrderbook, deployToken, printOrders, senderAddress } from "./common";
import { OrderDirection } from "@oraichain/oraidex-contracts-sdk/build/OraiswapLimitOrder.types";
import { Asset, AssetInfo } from "@oraichain/oraidex-contracts-sdk";

const client = new SimulateCosmWasmClient({
  chainId: "Oraichain",
  bech32Prefix: "orai",
  metering: process.env.METERING === "true"
});

const LISTEN_EVENTS = {
  EXECUTE_ORDERBOOK_PAIR: "execute_orderbook_pair",
  SUBMIT_ORDER: "submit_order",
  CANCEl_ORDER: "cancel_order"
};

const assetInfo = (denom: string, native = true): AssetInfo => {
  return native ? { native_token: { denom } } : { token: { contract_addr: denom } };
};

const asset = (amount: string, denom: string, native?: boolean): Asset => {
  return {
    info: assetInfo(denom, native),
    amount
  };
};

describe("limit_order", () => {
  let usdtToken: OraiswapTokenClient;
  let orderbook: OraiswapLimitOrderClient;

  beforeAll(async () => {
    client.app.bank.setBalance(senderAddress, [coin("1000000000", "orai"), coin("1000000000", "usdt")]);

    // init usdt token
    usdtToken = await deployToken(client, { symbol: "USDT", name: "USDT token" });
    orderbook = await deployOrderbook(client);

    let balanceRes = await client.getBalance(senderAddress, "usdt");
    expect(balanceRes).toEqual(coin("1000000000", "usdt"));
    balanceRes = await client.getBalance(senderAddress, "orai");
    expect(balanceRes).toEqual(coin("1000000000", "orai"));

    // create a orderbook native pair
    await orderbook.createOrderBookPair(
      {
        baseCoinInfo: assetInfo("orai"),
        quoteCoinInfo: assetInfo("usdt"),
        spread: "0.5",
        minQuoteCoinAmount: "10"
      },
      "auto",
      "",
      coins("20", "orai")
    );

    // create a cw20 orderbook pair
    await orderbook.createOrderBookPair(
      {
        baseCoinInfo: assetInfo("orai"),
        quoteCoinInfo: assetInfo(usdtToken.contractAddress, false),
        spread: "0.1",
        minQuoteCoinAmount: "1"
      },
      "auto",
      "",
      coins("20", "orai")
    );
  });

  it("balance_test", async () => {
    const balanceRes = await usdtToken.balance({ address: senderAddress });
    expect(balanceRes.balance).toBe("1000000000");
  });

  it("orderbook_admin_test", async () => {
    const info = await orderbook.contractInfo();
    expect(info.admin).toBe(senderAddress);
  });

  it("query_orderbook_pair_test", async () => {
    const pair_1 = await orderbook.orderBook({
      assetInfos: [assetInfo("orai"), assetInfo("usdt")]
    });
    const expectedPair_1: OraiswapLimitOrderTypes.OrderBookResponse = {
      base_coin_info: assetInfo("orai"),
      quote_coin_info: assetInfo("usdt"),
      spread: "0.5",
      min_quote_coin_amount: "10"
    };
    expect(pair_1).toEqual(expectedPair_1);

    const pair_2 = await orderbook.orderBook({
      assetInfos: [assetInfo("orai"), assetInfo(usdtToken.contractAddress, false)]
    });
    const expectedPair_2: OraiswapLimitOrderTypes.OrderBookResponse = {
      base_coin_info: assetInfo("orai"),
      quote_coin_info: assetInfo(usdtToken.contractAddress, false),
      spread: "0.1",
      min_quote_coin_amount: "1"
    };
    expect(pair_2).toEqual(expectedPair_2);
  });

  it("submit_native_order_test", async () => {
    const orders: [Coin, Coin, OrderDirection][] = [
      [coin("567", "orai"), coin("123", "usdt"), "buy"],
      [coin("654", "orai"), coin("111", "usdt"), "buy"],
      [coin("553", "orai"), coin("100", "usdt"), "sell"],
      [coin("632", "orai"), coin("100", "usdt"), "sell"]
    ];

    for (const [base, quote, direction] of orders) {
      const submitRes = await orderbook.submitOrder(
        {
          assets: [asset(base.amount, base.denom), asset(quote.amount, quote.denom)],
          direction
        },
        "auto",
        "",
        [direction === "sell" ? base : quote]
      );
      expect(
        submitRes.events.some((event) => event.attributes.some((attr) => attr.value === LISTEN_EVENTS.SUBMIT_ORDER))
      ).toBe(true);
    }

    let orderId = 0;
    for (const [base, quote, direction] of orders) {
      ++orderId;
      const queryOrder = await orderbook.order({
        assetInfos: [assetInfo("orai"), assetInfo("usdt")],
        orderId
      });

      // order is opposite to be filled
      const expectedQuery = {
        order_id: orderId,
        bidder_addr: senderAddress,
        offer_asset: asset(
          direction === "sell" ? base.amount : quote.amount,
          direction === "sell" ? base.denom : quote.denom
        ),
        ask_asset: asset(
          direction === "sell" ? quote.amount : base.amount,
          direction === "sell" ? quote.denom : base.denom
        ),
        direction,
        filled_ask_amount: "0",
        filled_offer_amount: "0"
      };
      expect(queryOrder).toMatchObject(expectedQuery);
    }
  });

  it("submit_native_market_order_test", async () => {
    const orders: [Coin, Coin, OrderDirection][] = [
      [coin("567", "orai"), coin("123", "usdt"), "buy"],
      [coin("654", "orai"), coin("111", "usdt"), "buy"],
      [coin("553", "orai"), coin("100", "usdt"), "sell"],
      [coin("632", "orai"), coin("100", "usdt"), "sell"]
    ];

    for (const [base, quote, direction] of orders) {
      const submitRes = await orderbook.submitOrder(
        {
          assets: [asset(base.amount, base.denom), asset(quote.amount, quote.denom)],
          direction
        },
        "auto",
        "",
        [direction === "sell" ? base : quote]
      );
      expect(
        submitRes.events.some((event) => event.attributes.some((attr) => attr.value === LISTEN_EVENTS.SUBMIT_ORDER))
      ).toBe(true);
    }

    let orderId = 0;
    for (const [base, quote, direction] of orders) {
      ++orderId;
      const queryOrder = await orderbook.order({
        assetInfos: [assetInfo("orai"), assetInfo("usdt")],
        orderId
      });

      // order is opposite to be filled
      const expectedQuery = {
        order_id: orderId,
        bidder_addr: senderAddress,
        offer_asset: asset(
          direction === "sell" ? base.amount : quote.amount,
          direction === "sell" ? base.denom : quote.denom
        ),
        ask_asset: asset(
          direction === "sell" ? quote.amount : base.amount,
          direction === "sell" ? quote.denom : base.denom
        ),
        direction,
        filled_ask_amount: "0",
        filled_offer_amount: "0"
      };
      expect(queryOrder).toMatchObject(expectedQuery);
    }
    const priceByBaseAmount = await orderbook.priceByBaseAmount({
      assetInfos: [assetInfo("orai"), assetInfo("usdt")],
      baseAmount: "100",
      direction: "sell"
    });
    console.log({ priceByBaseAmount });
    const offerAmount = Number(priceByBaseAmount.market_price) * Number(priceByBaseAmount.expected_base_amount);
    console.log({ offerAmount });

    const res = await orderbook.submitMarketOrder(
      {
        assetInfos: [assetInfo("orai"), assetInfo("usdt")],
        quoteAmount: "200",
        baseAmount: "100",
        direction: "sell"
      },
      "auto",
      "",
      [coin("100", "orai")]
    );
    console.dir(res, { depth: null });
  });

  it("submit_cw20_order", async () => {
    const submitRes = await usdtToken.send({
      amount: "7000000",
      contract: orderbook.contractAddress,
      msg: toBinary({
        submit_order: {
          direction: "buy",
          assets: [asset("2000000", "orai"), asset("7000000", usdtToken.contractAddress, false)]
        }
      } as OraiswapLimitOrderTypes.ExecuteMsg)
    });

    expect(
      submitRes.events.some((event) => event.attributes.some((attr) => attr.value === LISTEN_EVENTS.SUBMIT_ORDER))
    ).toBe(true);

    let balanceRes = await usdtToken.balance({ address: senderAddress });
    expect(balanceRes.balance).toBe("993000000");

    await usdtToken.send({
      amount: "5000000",
      contract: orderbook.contractAddress,
      msg: toBinary({
        submit_order: {
          direction: "buy",
          assets: [asset("1000000", "orai"), asset("5000000", usdtToken.contractAddress, false)]
        }
      } as OraiswapLimitOrderTypes.ExecuteMsg)
    });

    balanceRes = await usdtToken.balance({ address: senderAddress });
    expect(balanceRes.balance).toBe("988000000");

    const queryAll = await orderbook.orders({
      assetInfos: [assetInfo("orai"), assetInfo(usdtToken.contractAddress, false)],
      filter: {
        bidder: senderAddress
      }
    });
    printOrders("query All order", queryAll.orders);

    const expectedAllorders = {
      orders: [
        {
          ask_asset: asset("1000000", "orai"),
          offer_asset: asset("5000000", usdtToken.contractAddress, false),
          bidder_addr: senderAddress,
          direction: "buy",
          filled_ask_amount: "0",
          filled_offer_amount: "0",
          order_id: 11
        },
        {
          ask_asset: asset("2000000", "orai"),
          offer_asset: asset("7000000", usdtToken.contractAddress, false),
          bidder_addr: senderAddress,
          direction: "buy",
          filled_ask_amount: "0",
          filled_offer_amount: "0",
          order_id: 10
        }
      ]
    };
    expect(queryAll).toMatchObject(expectedAllorders);
  });
});
