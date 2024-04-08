import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { GasPrice, SigningStargateClient } from "@cosmjs/stargate";
import { ORAI, mockJsonRpcServer } from "@oraichain/oraidex-common";
import "dotenv/config";
import * as mockttp from "mockttp";
// configuration

describe("test-nock", () => {
  let server: mockttp.Mockttp;
  beforeEach(async () => {
    server = await mockJsonRpcServer();
  });
  afterEach(async () => {
    await server.stop();
  });
  it("test-mock-rpc-post", async () => {
    const wallet = await DirectSecp256k1HdWallet.generate(12, { prefix: ORAI });
    const accounts = await wallet.getAccounts();
    const stargate = await SigningStargateClient.connectWithSigner(server.url, wallet, {
      gasPrice: GasPrice.fromString("0.001orai")
    });
    const result = await stargate.sendTokens(
      accounts[0].address,
      accounts[0].address,
      [{ amount: "1", denom: ORAI }],
      "auto"
    );
    expect(result.transactionHash).toEqual("2F59A5318ED6350976244EAD25CB78ACFEBC1B9C9A96809269A793EDFB529065");
    expect(result.height).toEqual(1);
  });

  it("test-mock-rpc-getAccount", async () => {
    const wallet = await DirectSecp256k1HdWallet.generate(12, { prefix: ORAI });
    const accounts = await wallet.getAccounts();
    const stargate = await SigningStargateClient.connectWithSigner(server.url, wallet, {
      gasPrice: GasPrice.fromString("0.001orai")
    });
    const result = await stargate.getAccount(accounts[0].address);
    expect(result.address).toEqual("orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g");
  });
});
