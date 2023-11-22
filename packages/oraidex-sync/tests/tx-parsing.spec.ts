import * as parse from "../src/tx-parsing";
import { Tx } from "@oraichain/cosmos-rpc-sync";
import { parseTxToMsgExecuteContractMsgs } from "../src/tx-parsing";
import { Tx as CosmosTx } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { DuckDb, ORAI, SwapDirection, SwapOperationData, oraiInfo, usdtCw20Address, usdtInfo } from "../src";
import * as poolHelper from "../src/pool-helper";
import { PoolResponse } from "@oraichain/oraidex-contracts-sdk/build/OraiswapPair.types";
import { AssetInfo } from "@oraichain/oraidex-contracts-sdk";

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

  it.each<[string, string[]]>([
    ["foo", []],
    ["2591orai", ["2591", "orai"]]
  ])("test-parseClaimNativeAsset", (assets, expectedParsing) => {
    // act
    const result = parse.parseClaimNativeAsset(assets);
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

  it.each([
    ["Sell" as SwapDirection, 2n, -1n],
    ["Buy" as SwapDirection, -1n, 2n]
  ])("test-getBaseQuoteAmountFromSwapOps", (direction: SwapDirection, expectedBaseAmount, expectedQuoteAmount) => {
    // setup
    const swapOp: SwapOperationData = {
      offerAmount: 2,
      returnAmount: 1,
      offerDenom: ORAI,
      askDenom: usdtCw20Address,
      direction,
      uniqueKey: "1",
      timestamp: 1,
      txhash: "a",
      txheight: 1,
      spreadAmount: 1,
      taxAmount: 1,
      commissionAmount: 1
    };

    // act
    const [baseAmount, quoteAmount] = parse.getBaseQuoteAmountFromSwapOps(swapOp);

    // assertion
    expect(Number(baseAmount)).toEqual(Number(expectedBaseAmount));
    expect(Number(quoteAmount)).toEqual(Number(expectedQuoteAmount));
  });

  it.each([
    ["Sell" as SwapDirection, 2n, -1n],
    ["Buy" as SwapDirection, -1n, 2n]
  ])("test-getPoolFromSwapDenom", (direction: SwapDirection, expectedBaseAmount, expectedQuoteAmount) => {
    // setup
    const swapOp: SwapOperationData = {
      offerAmount: 2,
      returnAmount: 1,
      offerDenom: ORAI,
      askDenom: usdtCw20Address,
      direction,
      uniqueKey: "1",
      timestamp: 1,
      txhash: "a",
      txheight: 1,
      spreadAmount: 1,
      taxAmount: 1,
      commissionAmount: 1
    };

    const poolInfos: PoolResponse[] = [
      {
        assets: [
          {
            amount: "1",
            info: oraiInfo
          },
          {
            amount: "1",
            info: usdtInfo
          }
        ],
        total_share: "1"
      }
    ];

    // act
    const pool = parse.getPoolFromSwapDenom(swapOp, poolInfos);

    // assertion
    expect(pool).toBeDefined();
    expect(pool?.total_share).toBe("1");
  });

  it("test-calculateSwapOpsWithPoolAmount-with-empty-array-swap-ops-should-return-empty-array", async () => {
    const result = await parse.calculateSwapOpsWithPoolAmount([]);
    expect(result.length).toEqual(0);
  });

  it("test-calculateSwapOpsWithPoolAmount", async () => {
    // setup
    const swapOps: SwapOperationData[] = [
      {
        offerAmount: 2,
        returnAmount: 1,
        offerDenom: usdtCw20Address,
        askDenom: ORAI,
        direction: "Buy",
        uniqueKey: "1",
        timestamp: 1,
        txhash: "a",
        txheight: 1,
        spreadAmount: 1,
        taxAmount: 1,
        commissionAmount: 1
      }
    ];

    // mock queryPairInfos
    const pairAddr = "orai1c5s03c3l336dgesne7dylnmhszw8554tsyy9yt";
    const pairInfos = [
      {
        firstAssetInfo: JSON.stringify({ native_token: { denom: ORAI } } as AssetInfo),
        secondAssetInfo: JSON.stringify({ token: { contract_addr: usdtCw20Address } } as AssetInfo),
        commissionRate: "1",
        pairAddr,
        liquidityAddr: "1",
        oracleAddr: "1",
        symbols: "1",
        fromIconUrl: "1",
        toIconUrl: "1"
      }
    ];
    const duckDb = await DuckDb.create(":memory:");
    jest.spyOn(duckDb, "queryPairInfos").mockResolvedValue(pairInfos);
    jest.spyOn(duckDb, "getPoolByAssetInfos").mockResolvedValue(pairInfos[0]);

    // mock poolInfos
    const poolInfos: PoolResponse[] = [
      {
        assets: [
          {
            amount: "100", // base pool amount
            info: oraiInfo
          },
          {
            amount: "200", // quote pool amount
            info: usdtInfo
          }
        ],
        total_share: "1"
      }
    ];
    jest.spyOn(poolHelper, "getPoolInfos").mockResolvedValue(poolInfos);

    // act
    const updatedSwapOps = await parse.calculateSwapOpsWithPoolAmount(swapOps);

    // assertion
    expect(updatedSwapOps[0].basePoolAmount).toEqual(99n); // 100n - 1n
    expect(updatedSwapOps[0].quotePoolAmount).toEqual(202n); // 200n + 2n
  });
});
