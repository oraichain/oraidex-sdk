import "dotenv/config";
import { CosmosWalletImpl } from "../src/universal-demos/offline-wallet";
import { UniversalSwapHandler } from "../src/handler";
import {
  CoinGeckoId,
  KWT_BSC_CONTRACT,
  NetworkChainId,
  ORAI,
  USDC_CONTRACT,
  cosmosTokens,
  flattenTokens,
  generateError,
  getTokenOnOraichain,
  toAmount
} from "@oraichain/oraidex-common";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { GasPrice, SigningStargateClient } from "@cosmjs/stargate";
import fs from "fs";
// configuration
import HttpRequestMock from "http-request-mock";
import { mockAccountInfo, mockStatus, mockResponse, mockTxSearch, mockSimulate } from "./test-common";
const mocker = HttpRequestMock.setupForFetch();

describe("test-nock", () => {
  it("test-mock-rpc-post", async () => {
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(process.env.MNEMONIC as any, { prefix: ORAI });
    const accounts = await wallet.getAccounts();
    const stargate = await SigningStargateClient.connectWithSigner("http://rpc.orai.io", wallet, {
      gasPrice: GasPrice.fromString("0.001orai")
    });
    mocker.mock({
      url: "http://rpc.orai.io",
      method: "POST",
      response: async (requestInfo) => {
        console.log("original request info: ", requestInfo);
        switch (requestInfo.body.method) {
          case "abci_query":
            const path = requestInfo.body.params.path;
            if (path === "/cosmos.auth.v1beta1.Query/Account") {
              console.log("return mock account info!");
              return mockAccountInfo;
            }
            if (path === "/cosmos.tx.v1beta1.Service/Simulate") {
              console.log("return mock simulate!");
              return mockSimulate;
            }
            break;
          case "status":
            console.log("return mock status!");
            return mockStatus;
          case "broadcast_tx_sync":
            console.log("return mock broadcast!");
            return mockResponse;
          case "tx_search":
            console.log("return mock tx search!");
            return mockTxSearch;
          default:
            break;
        }
        // by default we do original call and return its response
        const res = await requestInfo.doOriginalCall();
        // 3. and do something again.
        console.log("original response:", JSON.stringify(res.responseJson));
        return res.responseJson;
      }
    });
    const result = await stargate.sendTokens(
      accounts[0].address,
      accounts[0].address,
      [{ amount: "1", denom: ORAI }],
      "auto"
    );
    console.log({ result });
  }, 50000);
});
