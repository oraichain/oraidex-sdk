import * as parse from "../src/tx-parsing";
import { Tx } from "@oraichain/cosmos-rpc-sync";
import { parseTxToMsgExecuteContractMsgs } from "../src/tx-parsing";
import { Tx as CosmosTx } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { DuckDb, usdtCw20Address } from "../src";
import * as helper from "../src/helper";
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
    const result = parse.parseWithdrawLiquidityAssets(assets);
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

  it.each<[string, string, number]>([
    ["invalid-staking-asset-denom-should-return-0", "invalid-staking-asset-denom", 0],
    ["valid-staking-asset-denom-should-return-correctly-price", usdtCw20Address, 5]
  ])("test-calculateLpPrice-WITH-%p", async (_caseName, stakingAssetDenom, expectedResult) => {
    // setup
    const MOCK_TOTAL_SHARE = "2";
    const MOCK_PAIR_LIQUIDITY = 10.5;
    const duckDb = await DuckDb.create(":memory:");
    jest.spyOn(duckDb, "getLatestLpPoolAmount").mockResolvedValue({
      timestamp: 1,
      height: 1,
      pairAddr: "1",
      uniqueKey: "1",
      totalShare: MOCK_TOTAL_SHARE,
      offerPoolAmount: 1n,
      askPoolAmount: 1n
    });
    jest.spyOn(duckDb, "getPoolByAssetInfos").mockResolvedValue({
      firstAssetInfo: "1",
      secondAssetInfo: "1",
      commissionRate: "1",
      pairAddr: "1",
      liquidityAddr: "1",
      oracleAddr: "1",
      symbols: "1",
      fromIconUrl: "1",
      toIconUrl: "1"
    });
    jest.spyOn(helper, "getPairLiquidity").mockResolvedValue(MOCK_PAIR_LIQUIDITY);

    // act
    const LPPrice = await parse.calculateLpPrice(stakingAssetDenom);

    // assertion
    expect(LPPrice).toEqual(expectedResult);
  });
});
