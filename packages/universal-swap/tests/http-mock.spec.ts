import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { GasPrice, SigningStargateClient } from "@cosmjs/stargate";
import { ORAI, mockJsonRpcServer } from "@oraichain/oraidex-common";
import "dotenv/config";
// configuration

describe("test-nock", () => {
  it("test-mock-rpc-post", async () => {
    const server = await mockJsonRpcServer();

    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(process.env.MNEMONIC as any, { prefix: ORAI });
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
    console.log({ result });
    expect(result.transactionHash).toEqual("2F59A5318ED6350976244EAD25CB78ACFEBC1B9C9A96809269A793EDFB529065");
    expect(result.height).toEqual(1);
  });
});
