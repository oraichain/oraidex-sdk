import "../src/polyfill";
import { Tendermint34Client } from "@cosmjs/tendermint-rpc";

describe("Polyfill tendermint 34", () => {
  xit("should polyfill tendermint", async () => {
    const client = await Tendermint34Client.connect("https://rpc.orai.io");
    expect(client.status()).resolves.toStrictEqual({ nodeInfo: { network: "Oraichain", version: "" } });
  });
});
