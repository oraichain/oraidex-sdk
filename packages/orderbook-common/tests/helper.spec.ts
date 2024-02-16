import { coins } from "@cosmjs/amino";
import { ExecuteInstruction, toBinary } from "@cosmjs/cosmwasm-stargate";
import { DirectSecp256k1HdWallet, OfflineSigner } from "@cosmjs/proto-signing";
import { SimulateCosmWasmClient } from "@oraichain/cw-simulate";
import {
  CosmosWallet,
  NetworkChainId,
  ORAI,
  USDT_CONTRACT,
  USDT_CONTRACT as USDT_CONTRACT_ADDRESS,
  toAmount
} from "@oraichain/oraidex-common";
import { getContractDir } from "@oraichain/oraidex-contracts-build";
import { Asset, AssetInfo, OraiswapTokenClient } from "@oraichain/oraidex-contracts-sdk";
import { OrderDirection } from "@oraichain/oraidex-contracts-sdk/build/OraiswapLimitOrder.types";
import fs from "fs";
import { ORDERBOOK_CONTRACT_ADDRESS } from "../src/constant";
import { OraichainOrderbookClientHelper } from "../src/helper";
import { loadState, loadStateData } from "./helper";

describe("test-orderbook-helper", () => {
  let client: SimulateCosmWasmClient;
  let helper: OraichainOrderbookClientHelper;
  const initialOrderbookOraiAmount = "100000000000";
  const senderAddress = "orai1gqew39xtnshrrt8nmk0qy4gqkup5yhmnaryfp7";
  const adminAddress = "orai1fs25usz65tsryf0f8d5cpfmqgr0xwup4kjqpa0";
  const assetInfos: [AssetInfo, AssetInfo] = [
    { native_token: { denom: "orai" } },
    { token: { contract_addr: USDT_CONTRACT_ADDRESS } }
  ];

  const usdtData = loadStateData(USDT_CONTRACT_ADDRESS);
  const orderbookData = loadStateData(ORDERBOOK_CONTRACT_ADDRESS);

  class StubCosmosWallet extends CosmosWallet {
    getKeplrAddr(chainId?: NetworkChainId | undefined): Promise<string> {
      return new Promise((resolve) => resolve(senderAddress));
    }
    createCosmosSigner(chainId: string): Promise<OfflineSigner> {
      return DirectSecp256k1HdWallet.generate();
    }
  }

  beforeEach(async () => {
    const wallet = new StubCosmosWallet();
    client = new SimulateCosmWasmClient({
      chainId: "Oraichain",
      bech32Prefix: "orai"
    });
    client.app.bank.setBalance(ORDERBOOK_CONTRACT_ADDRESS, coins(initialOrderbookOraiAmount, "orai"));
    client.app.bank.setBalance(ORDERBOOK_CONTRACT_ADDRESS, coins(initialOrderbookOraiAmount, ORAI));
    client.app.bank.setBalance(senderAddress, coins(initialOrderbookOraiAmount, ORAI));
    client.app.bank.setBalance(adminAddress, coins(initialOrderbookOraiAmount, ORAI));

    await loadState(client, senderAddress, USDT_CONTRACT, "cw20 usdt", usdtData);
    await loadState(
      client,
      senderAddress,
      ORDERBOOK_CONTRACT_ADDRESS,
      "orderbook",
      orderbookData,
      fs.readFileSync(getContractDir("oraiswap_limit_order"))
    );
    helper = new OraichainOrderbookClientHelper(wallet, ORDERBOOK_CONTRACT_ADDRESS, "Oraichain", assetInfos);
    helper.withCosmWasmClient(client);
    helper.withSigningCosmWasmClient(client);

    const cw20Client = new OraiswapTokenClient(client, adminAddress, USDT_CONTRACT);
    await cw20Client.mint({ amount: initialOrderbookOraiAmount, recipient: senderAddress });
    await cw20Client.mint({ amount: initialOrderbookOraiAmount, recipient: adminAddress });
    await cw20Client.mint({ amount: initialOrderbookOraiAmount, recipient: ORDERBOOK_CONTRACT_ADDRESS });

    // init limit orders for testing
    const limitAmount = toAmount(1).toString();
    for (let i = 1; i < 9; i++) {
      await helper.submitLimitOrder(limitAmount, limitAmount, "buy");
      await helper.submitLimitOrder(limitAmount, limitAmount, "sell");
    }
  });

  it("test-mm-helper-cancelAllOrders-should-cancel-all-orders", async () => {
    let orders = await helper.queryAllOrdersOfBidder();
    expect(orders.length).toBeGreaterThan(0);
    await helper.cancelAllOrders();
    orders = await helper.queryAllOrdersOfBidder();
    expect(orders.length).toEqual(0);
  });

  it("test-mm-helper-cancelAllOrders-with-direction-should-only-cancel-given-orders-with-direction", async () => {
    // query list orders. Should have 308 orders in total
    let buyOrders = await helper.queryAllOrdersOfBidderWithDirection("buy");
    expect(buyOrders.length).toEqual(8);
    await helper.cancelAllOrders("buy");
    buyOrders = await helper.queryAllOrdersOfBidderWithDirection("buy");
    expect(buyOrders.length).toEqual(0);

    let sellOrders = await helper.queryAllOrdersOfBidderWithDirection("sell");
    expect(sellOrders.length).toEqual(8);
    await helper.cancelAllOrders("sell");
    sellOrders = await helper.queryAllOrdersOfBidderWithDirection("sell");
    expect(sellOrders.length).toEqual(0);
  });

  it("test-queryAllOrdersOfBidder-with-direction", async () => {
    const buyOrders = await helper.queryAllOrdersOfBidderWithDirection("buy", 1);
    expect(buyOrders.length).toEqual(8);
    const sellOrders = await helper.queryAllOrdersOfBidderWithDirection("sell", 1);
    expect(sellOrders.length).toEqual(8);
  });

  it("test-queryAllOrdersOfBidder-should-return-all-orders-in-both-direction", async () => {
    const allOrders = await helper.queryAllOrdersOfBidder();
    const buyOrders = await helper.queryAllOrdersOfBidderWithDirection("buy");
    const sellOrders = await helper.queryAllOrdersOfBidderWithDirection("sell");
    expect(allOrders.length).toEqual(buyOrders.length + sellOrders.length);
  });

  it("test-mm-helper-queryAllTicks-should-query-all-ticks", async () => {
    const buyTicks = await helper.queryAllTicks("buy", 1, 1);
    // console.log({ buyTicks });

    expect(buyTicks.length).toEqual(28);

    const sellTicks = await helper.queryAllTicks("sell", 1, 1);
    expect(sellTicks.length).toEqual(90);
  });

  it("test-queryBestPrice", async () => {
    const highestBuyPrice = await helper.queryBestTick("buy");
    const lowestSellPrice = await helper.queryBestTick("sell");
    console.log({ highestBuyPrice, lowestSellPrice });
    expect(highestBuyPrice).toEqual(6.801);
    expect(lowestSellPrice).toEqual(6.73299);
  });

  it.each<[string, string, OrderDirection, number]>([
    ["2", "1", "buy", 2],
    ["1", "2", "sell", 2]
  ])("test-calculateOrderPrice", (offerAmount, askAmount, direction, expectedPrice) => {
    const result = OraichainOrderbookClientHelper.calculateOrderPrice(offerAmount, askAmount, direction);
    expect(result).toEqual(expectedPrice);
  });

  it("test-buildExecuteInstruction-native-token-should-return-instruction-with-sent-funds", () => {
    const result = helper.buildOrderbookExecuteInstruction(
      ORDERBOOK_CONTRACT_ADDRESS,
      {},
      { info: assetInfos[0], amount: "1" }
    );
    expect(result).toEqual({
      contractAddress: ORDERBOOK_CONTRACT_ADDRESS,
      msg: {},
      funds: [{ denom: (assetInfos[0] as any).native_token.denom, amount: "1" }]
    } as ExecuteInstruction);
  });

  it("test-buildExecuteInstruction-cw20-token-should-return-instruction-with-cw20-send", () => {
    const result = helper.buildOrderbookExecuteInstruction(
      ORDERBOOK_CONTRACT_ADDRESS,
      {},
      { info: assetInfos[1], amount: "1" }
    );
    expect(result).toMatchObject({
      contractAddress: (assetInfos[1] as any).token.contract_addr,
      msg: {
        send: {
          amount: "1",
          contract: ORDERBOOK_CONTRACT_ADDRESS,
          msg: toBinary({})
        }
      }
    } as ExecuteInstruction);
  });

  it.each<[string, string, OrderDirection]>([["1", "1", "buy"]])("test-buildLimitOrder", (offer, ask, direction) => {
    const result = helper.buildLimitOrder(offer, ask, direction);
    expect(result).toMatchObject({
      submit_order: {
        direction: direction,
        assets: [
          { info: assetInfos[0], amount: direction === "buy" ? ask : offer },
          { info: assetInfos[1], amount: direction === "buy" ? offer : ask }
        ] as Asset[]
      }
    });
  });
});
