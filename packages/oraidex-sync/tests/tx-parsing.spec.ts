import * as helper from "../src/tx-parsing";
import { Tx } from "@oraichain/cosmos-rpc-sync";
import { parseTxToMsgExecuteContractMsgs } from "../src/tx-parsing";
import { Tx as CosmosTx } from "cosmjs-types/cosmos/tx/v1beta1/tx";

describe("test-tx-parsing", () => {
  it.each<[string, string[]]>([
    [
      "2591orai, 773ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
      ["2591", "orai", "773", "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78"]
    ],
    ["foo", []],
    ["2591orai", []]
  ])("test-parseWithdrawLiquidityAssets", (assets, expectedParsing) => {
    // act
    const result = helper.parseWithdrawLiquidityAssets(assets);
    // assert
    expect(result).toEqual(expectedParsing);
  });

  it.each<[number, number]>([
    [1, 0],
    [0, 1]
  ])("test-parseTxToMsgExecuteContractMsgs-with-different-tx-code", (txCode, expectedMsgLength) => {
    // setup
    const cosmosTx = CosmosTx.encode(
      CosmosTx.fromPartial({ body: { messages: [{ typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract" }] } })
    ).finish();
    let tx: Tx = {
      hash: "",
      height: 1,
      code: txCode,
      txIndex: 0,
      tx: cosmosTx,
      timestamp: new Date().toISOString(),
      rawLog: JSON.stringify({ events: [] }),
      events: [],
      msgResponses: [{ typeUrl: "", value: Buffer.from("") }],
      gasUsed: 1,
      gasWanted: 1
    };
    const msgs = parseTxToMsgExecuteContractMsgs(tx);
    expect(msgs.length).toEqual(expectedMsgLength);
  });

  it.each<[Uint8Array, number]>([
    [CosmosTx.encode(CosmosTx.fromPartial({})).finish(), 0],
    [
      CosmosTx.encode(
        CosmosTx.fromPartial({ body: { messages: [{ typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract" }] } })
      ).finish(),
      1
    ]
  ])("test-parseTxToMsgExecuteContractMsgs-with-different-txBody-data", (cosmosTx, expectedMsgLength) => {
    // setup
    let tx: Tx = {
      hash: "",
      height: 1,
      code: 0,
      txIndex: 0,
      tx: cosmosTx,
      timestamp: new Date().toISOString(),
      rawLog: JSON.stringify({ events: [] }),
      events: [],
      msgResponses: [{ typeUrl: "", value: Buffer.from("") }],
      gasUsed: 1,
      gasWanted: 1
    };
    const msgs = parseTxToMsgExecuteContractMsgs(tx);
    expect(msgs.length).toEqual(expectedMsgLength);
  });

  it.each<[string, number]>([
    ["", 1],
    ["/cosmwasm.wasm.v1.MsgExecuteContract", 2]
  ])("test-parseTxToMsgExecuteContractMsgs-with-different-message-typeUrl", (typeUrl, expectedMsgLength) => {
    // setup
    const cosmosTx = CosmosTx.encode(
      CosmosTx.fromPartial({ body: { messages: [{ typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract" }, { typeUrl }] } })
    ).finish();
    let tx: Tx = {
      hash: "",
      height: 1,
      code: 0,
      txIndex: 0,
      tx: cosmosTx,
      timestamp: new Date().toISOString(),
      rawLog: JSON.stringify({ events: [] }),
      events: [],
      msgResponses: [{ typeUrl: "", value: Buffer.from("") }],
      gasUsed: 1,
      gasWanted: 1
    };
    const msgs = parseTxToMsgExecuteContractMsgs(tx);
    expect(msgs.length).toEqual(expectedMsgLength);
  });
});
