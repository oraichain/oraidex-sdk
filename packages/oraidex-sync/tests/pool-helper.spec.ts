import { Asset, AssetInfo, OraiswapStakingTypes } from "@oraichain/oraidex-contracts-sdk";
import {
  ORAI,
  airiCw20Adress,
  atomIbcDenom,
  milkyCw20Address,
  oraiInfo,
  scAtomCw20Address,
  usdtCw20Address,
  usdtInfo
} from "../src/constants";

import * as helper from "../src/helper";
import { DuckDb, pairs } from "../src/index";
import * as poolHelper from "../src/pool-helper";
import { PairInfoData, PairMapping, PoolAmountHistory, ProvideLiquidityOperationData } from "../src/types";
import { Tx } from "@oraichain/cosmos-rpc-sync";
import { Tx as CosmosTx } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import * as txParsing from "../src/tx-parsing";
import { pairLpTokens } from "@oraichain/oraidex-common/build/pairs";
describe("test-pool-helper", () => {
  let duckDb: DuckDb;
  beforeAll(async () => {
    duckDb = await DuckDb.create(":memory:");
  });
  afterEach(jest.restoreAllMocks);

  it.each<[string, [AssetInfo, AssetInfo], boolean]>([
    [
      "has-both-native-token-that-contain-ORAI-should-return: false",
      [oraiInfo, { native_token: { denom: atomIbcDenom } }],
      false
    ],
    // [
    //   // NOTE: currently this case not exist, but in future maybe
    //   "has-both-native-token-that-NOT-contain-ORAI-should-return: true",
    //   [osmosisIbcDenom, atomIbcDenom],
    //   true
    // ],
    [
      "has-one-native-token-that-NOT-contain-ORAI-should-return: true",
      [
        { native_token: { denom: atomIbcDenom } },
        {
          token: {
            contract_addr: scAtomCw20Address
          }
        }
      ],
      true
    ],
    [
      "NOT-has-native-token-should-return-is-has-fee: false",
      [
        {
          token: {
            contract_addr: milkyCw20Address
          }
        },
        usdtInfo
      ],
      false
    ]
  ])("test-isPoolHasFee-with-pool-%s", (_caseName, assetInfos, expectIsHasFee) => {
    const result = poolHelper.isPoolHasFee(assetInfos);
    expect(result).toBe(expectIsHasFee);
  });

  it.each<[string, [AssetInfo, AssetInfo], PairMapping | undefined]>([
    [
      "assetInfos-valid-in-list-pairs",
      [usdtInfo, oraiInfo],
      {
        asset_infos: [oraiInfo, usdtInfo],
        lp_token: pairLpTokens.USDT_ORAI,
        symbols: ["ORAI", "USDT"],
        factoryV1: true
      }
    ],
    [
      "assetInfos-invalid-in-list-pairs",
      [
        {
          token: {
            contract_addr: "invalid"
          }
        },
        {
          native_token: {
            denom: atomIbcDenom
          }
        }
      ],
      undefined
    ]
  ])(
    "test-getPairByAssetInfos-with-%s-should-return-correctly-pair",
    (_caseName: string, assetInfos: [AssetInfo, AssetInfo], expectedPair: PairMapping | undefined) => {
      const result = poolHelper.getPairByAssetInfos(assetInfos);
      expect(result).toStrictEqual(expectedPair);
    }
  );

  describe("test-calculate-price-group-funcs", () => {
    // use orai/usdt in this test suite
    it("test-getPriceByAsset-when-duckdb-empty-should-return-0", async () => {
      // setup
      jest.spyOn(duckDb, "getPoolByAssetInfos").mockResolvedValue(null);

      // act & assertion
      const result = await poolHelper.getPriceByAsset([oraiInfo, usdtInfo], "base_in_quote");
      expect(result).toEqual(0);
    });

    it.each<[[AssetInfo, AssetInfo], poolHelper.RatioDirection, number]>([
      [[oraiInfo, usdtInfo], "base_in_quote", 0.5],
      [[oraiInfo, usdtInfo], "quote_in_base", 2]
    ])("test-getPriceByAsset-should-return-correctly-price", async (assetInfos, ratioDirection, expectedPrice) => {
      // setup
      const pairAddr = "orai1c5s03c3l336dgesne7dylnmhszw8554tsyy9yt";
      const pairInfoData: PairInfoData = {
        firstAssetInfo: JSON.stringify({ native_token: { denom: ORAI } } as AssetInfo),
        secondAssetInfo: JSON.stringify({ token: { contract_addr: usdtCw20Address } } as AssetInfo),
        commissionRate: "1",
        pairAddr,
        liquidityAddr: "1",
        oracleAddr: "1",
        symbols: "1",
        fromIconUrl: "1",
        toIconUrl: "1"
      };
      const poolAmountHistory: PoolAmountHistory = {
        offerPoolAmount: 1n,
        askPoolAmount: 1n,
        height: 1,
        timestamp: 1,
        pairAddr,
        uniqueKey: "1"
      };
      jest.spyOn(duckDb, "getPoolByAssetInfos").mockResolvedValue(pairInfoData);
      jest.spyOn(duckDb, "getLatestLpPoolAmount").mockResolvedValue(poolAmountHistory);
      jest.spyOn(helper, "calculatePriceByPool").mockReturnValue(0.5);

      // assert
      const result = await poolHelper.getPriceByAsset(assetInfos, ratioDirection);
      expect(result).toEqual(expectedPrice);
    });

    it.each([
      ["case-1:-asset-is-cw20-USDT", usdtInfo, 1],
      ["case-2:-asset-is-ORAI", oraiInfo, 2],
      [
        "case-3:-asset-is-MILKY-that-mapped-with-USDT",
        {
          token: {
            contract_addr: milkyCw20Address
          }
        },
        0.5
      ],
      [
        "case-4:-asset-is-pair-with-ORAI",
        {
          native_token: {
            denom: atomIbcDenom
          }
        },
        1
      ],
      [
        "case-5.1:-asset-is-NOT-pair-with-ORAI",
        {
          token: {
            contract_addr: scAtomCw20Address
          }
        },
        0.5
      ]
    ])(
      "test-getPriceAssetByUsdt-with-%p-should-return-correctly-price-of-asset-in-USDT",
      async (_caseName: string, assetInfo: AssetInfo, expectedPrice: number) => {
        // mock
        jest.spyOn(poolHelper, "getOraiPrice").mockResolvedValue(2);
        jest.spyOn(poolHelper, "getPriceByAsset").mockResolvedValue(0.5);

        // act
        const result = await poolHelper.getPriceAssetByUsdt(assetInfo);

        // assertion
        expect(result).toEqual(expectedPrice);
      }
    );
  });

  describe("test-calculate-fee-of-pools", () => {
    it.each([
      [
        "with-case-asset-is-cw20-token-should-return-null",
        {
          info: {
            token: {
              contract_addr: airiCw20Adress
            }
          },
          amount: "100"
        },
        null
      ],
      [
        "with-case-asset-is-native-token-should-return-correctly-fee",
        {
          info: {
            native_token: {
              denom: atomIbcDenom
            }
          },
          amount: "100"
        },
        {
          amount: "11.53846153846154",
          info: { native_token: { denom: atomIbcDenom } }
        }
      ]
    ])("test-calculateFeeByAsset-%s", (_caseName: string, inputAsset: Asset, expectedFee: Asset | null) => {
      const shareRatio = 0.5;
      const result = poolHelper.calculateFeeByAsset(inputAsset, shareRatio);
      expect(result).toStrictEqual(expectedFee);
    });

    it("test-calculateLiquidityFee-should-return-correctly-fee-in-USDT", async () => {
      // mock
      jest.spyOn(poolHelper, "convertFeeAssetToUsdt").mockResolvedValue(1e6);
      jest.spyOn(poolHelper, "getPoolTotalShare").mockResolvedValue({
        total_share: "1",
        assets: [
          {
            amount: "1",
            info: oraiInfo
          },
          {
            amount: "1",
            info: usdtInfo
          }
        ]
      });

      // act
      const liquidityFee = await poolHelper.calculateLiquidityFee(
        {
          firstAssetInfo: "1",
          secondAssetInfo: "1",
          commissionRate: "1",
          pairAddr: "orai1c5s03c3l336dgesne7dylnmhszw8554tsyy9yt",
          liquidityAddr: "1",
          oracleAddr: "1",
          symbols: "1",
          fromIconUrl: "1",
          toIconUrl: "1"
        },
        13344890,
        1
      );

      // assertion
      expect(liquidityFee).toEqual(2000000n);
    });

    it.each([
      ["test-convertFeeAssetToUsdt-with-asset-NULL-should-return-fee-is-0", null, 0],
      [
        "test-convertFeeAssetToUsdt-with-asset-native-should-return-correctly-fee",
        {
          info: oraiInfo,
          amount: "1"
        },
        2
      ]
    ])("%s", async (_caseName: string, assetFee: Asset | null, expectedResult: number) => {
      // mock
      jest.spyOn(poolHelper, "getPriceAssetByUsdt").mockResolvedValueOnce(2);

      // act
      const result = await poolHelper.convertFeeAssetToUsdt(assetFee);

      // assert
      expect(result).toEqual(expectedResult);
    });
  });

  it("test-calculateAprResult-should-return-correctly-APR", async () => {
    // setup
    const allLiquidities = Array(pairs.length).fill(1e6);
    const allTotalSupplies = Array(pairs.length).fill("100000");
    const allBondAmounts = Array(pairs.length).fill("1");
    const allRewardPerSec: OraiswapStakingTypes.RewardsPerSecResponse[] = Array(pairs.length).fill({
      assets: [
        {
          amount: "1",
          info: oraiInfo
        }
      ]
    });
    jest.spyOn(poolHelper, "getPriceAssetByUsdt").mockResolvedValue(1);

    // act
    const result = await poolHelper.calculateAprResult(
      allLiquidities,
      allTotalSupplies,
      allBondAmounts,
      allRewardPerSec
    );

    // assertion
    expect(result.length).toEqual(pairs.length);
    expect(result).toStrictEqual(Array(pairs.length).fill(315360000));
  });

  it("test-calculateBoostAprResult-should-return-correctly-APR", async () => {
    // setup
    jest.spyOn(poolHelper, "getPriceAssetByUsdt").mockResolvedValue(1);

    const avgLiquidities = {};
    pairs.map((p) => {
      avgLiquidities[p.lp_token] = 1e6;
      return p;
    });

    const fee7Days = pairs.map((p) => {
      return {
        assetInfos: p.asset_infos,
        fee: 1000n
      };
    });

    const expectedResult = {};
    pairs.map((p) => {
      expectedResult[p.lp_token] = 0.000005214285714285714;
      return p;
    });

    // act
    const result = await poolHelper.calculateBoostApr(avgLiquidities, fee7Days);

    // assertion
    expect(Object.keys(result).length).toEqual(pairs.length);
    expect(result).toStrictEqual(expectedResult);
  });

  it.each([
    [true, pairs.length, pairs.length],
    [false, 4, 0]
  ])(
    "test-getListAssetInfoShouldRefetchApr-with-is-isTriggerRewardPerSec-%p-shoud-return-listAssetInfosPoolShouldRefetch-length-%p-and-assetInfosTriggerRewardPerSec-length-%p",
    async (
      isTriggerRewardPerSec: boolean,
      expectedListAssetInfosPoolShouldRefetch: number,
      expectedAssetInfosTriggerRewardPerSec: number
    ) => {
      // setup
      const cosmosTx = CosmosTx.encode(
        CosmosTx.fromPartial({ body: { messages: [{ typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract" }] } })
      ).finish();
      const txs: Tx[] = [
        {
          hash: "",
          height: 1,
          code: 1,
          txIndex: 0,
          tx: cosmosTx,
          timestamp: new Date().toISOString(),
          rawLog: JSON.stringify({ events: [] }),
          events: [],
          msgResponses: [{ typeUrl: "", value: Buffer.from("") }],
          gasUsed: 1,
          gasWanted: 1
        }
      ];

      const ops: ProvideLiquidityOperationData[] = [
        {
          basePrice: 1,
          baseTokenAmount: 1,
          baseTokenDenom: ORAI,
          quoteTokenAmount: 1,
          quoteTokenDenom: usdtCw20Address,
          opType: "provide",
          uniqueKey: "1",
          timestamp: 1,
          txCreator: "a",
          txhash: "a",
          txheight: 1,
          taxRate: 1n
        },
        {
          basePrice: 1,
          baseTokenAmount: 1,
          baseTokenDenom: ORAI,
          quoteTokenAmount: 1,
          quoteTokenDenom: usdtCw20Address,
          opType: "withdraw",
          uniqueKey: "2",
          timestamp: 1,
          txCreator: "a",
          txhash: "a",
          txheight: 1,
          taxRate: 1n
        },
        {
          basePrice: 1,
          baseTokenAmount: 1,
          baseTokenDenom: ORAI,
          quoteTokenAmount: 1,
          quoteTokenDenom: atomIbcDenom,
          opType: "withdraw",
          uniqueKey: "1",
          timestamp: 1,
          txCreator: "a",
          txhash: "a",
          txheight: 1,
          taxRate: 1n
        }
      ];
      jest.spyOn(txParsing, "processEventApr").mockReturnValue({
        isTriggerRewardPerSec,
        infoTokenAssetPools: new Set<string>([pairLpTokens.AIRI_ORAI, pairLpTokens.SCATOM_ATOM])
      });

      const result = await poolHelper.getListAssetInfoShouldRefetchApr(txs, ops);
      expect(result.assetInfosTriggerTotalSupplies.length).toEqual(2);
      expect(result.assetInfosTriggerTotalBond.length).toEqual(2);
      expect(result.listAssetInfosPoolShouldRefetch.length).toEqual(expectedListAssetInfosPoolShouldRefetch);
      expect(result.assetInfosTriggerRewardPerSec.length).toEqual(expectedAssetInfosTriggerRewardPerSec);
    }
  );
});
