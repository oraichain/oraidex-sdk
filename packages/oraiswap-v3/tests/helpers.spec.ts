import { PoolWithPoolKey } from "@oraichain/oraidex-contracts-sdk/build/OraiswapV3.types";
import {
  PoolSnapshot,
  PoolStatsData,
  PositionLiquidInfo,
  VirtualRange,
  calculateLiquidityForPair,
  calculateLiquidityForRanges,
  extractAddress,
  getGlobalFee,
  getUsdValue24,
  getVolume,
  getX,
  getY,
  onlySnaps,
  parse,
  parsePoolKey,
  poolKeyToString,
  sliceSnaps
} from "../src";
import { LiquidityTick, PoolKey } from "../src/wasm/oraiswap_v3_wasm";
import { expect, describe, it } from "vitest";
import { TokenItemType } from "@oraichain/oraidex-common";

describe("test oraiswap-v3 helper functions", () => {
  it.each<[PoolWithPoolKey, number]>([
    [
      {
        pool: {
          liquidity: "872318433599957",
          sqrt_price: "2621000184602367837078723",
          current_tick_index: 19200,
          fee_growth_global_x: "3308698066132688338641848",
          fee_growth_global_y: "15770768117376311911427233",
          fee_protocol_token_x: "145238",
          fee_protocol_token_y: "577197",
          start_timestamp: 1719473735455,
          last_timestamp: 1720551218949,
          fee_receiver: "orai1wn0qfdhn7xfn7fvsx6fme96x4mcuzrm9wm3mvlunp5e737rpgt4qndmfv8"
        },
        pool_key: {
          token_x: "orai",
          token_y: "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh",
          fee_tier: { fee: 3000000000, tick_spacing: 100 }
        }
      },
      250000000000
    ]
  ])("getVolume", (pool, protocolFee) => {
    const { volumeX, volumeY } = getVolume(pool, protocolFee);
    expect(volumeX).toBeDefined();
    expect(volumeY).toBeDefined();
    // TODO: add more expect
  });

  it.each<[PoolWithPoolKey, number]>([
    [
      {
        pool: {
          liquidity: "872318433599957",
          sqrt_price: "2621000184602367837078723",
          current_tick_index: 19200,
          fee_growth_global_x: "3308698066132688338641848",
          fee_growth_global_y: "15770768117376311911427233",
          fee_protocol_token_x: "145238",
          fee_protocol_token_y: "577197",
          start_timestamp: 1719473735455,
          last_timestamp: 1720551218949,
          fee_receiver: "orai1wn0qfdhn7xfn7fvsx6fme96x4mcuzrm9wm3mvlunp5e737rpgt4qndmfv8"
        },
        pool_key: {
          token_x: "orai",
          token_y: "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh",
          fee_tier: { fee: 3000000000, tick_spacing: 100 }
        }
      },
      250000000000
    ]
  ])("getGlobalFee", (pool, protocolFee) => {
    const { feeX, feeY } = getGlobalFee(pool, protocolFee);
    expect(feeX).toBeDefined();
    expect(feeY).toBeDefined();
    // TODO: add more expect
  });

  it.each<[LiquidityTick[], VirtualRange[]]>([
    [
      [
        { index: -221800, liquidity_change: 837989679325238n, sign: true },
        { index: 18900, liquidity_change: 34328754274719n, sign: true },
        { index: 19500, liquidity_change: 169798728326789n, sign: true },
        { index: 20100, liquidity_change: 2019104723199900n, sign: true },
        { index: 20500, liquidity_change: 18700044794514n, sign: true },
        { index: 21100, liquidity_change: 26572713179726n, sign: false },
        { index: 21600, liquidity_change: 170947872827301n, sign: true },
        { index: 21700, liquidity_change: 11485796206921n, sign: true },
        { index: 22100, liquidity_change: 2019104723199900n, sign: false },
        { index: 22500, liquidity_change: 18700044794514n, sign: false },
        { index: 22700, liquidity_change: 11485796206921n, sign: false },
        { index: 23100, liquidity_change: 7756041094993n, sign: false },
        { index: 23700, liquidity_change: 130277738450799n, sign: false },
        { index: 23900, liquidity_change: 12576992714774n, sign: false },
        { index: 24800, liquidity_change: 169798728326789n, sign: false },
        { index: 28400, liquidity_change: 28093141661728n, sign: false },
        { index: 221800, liquidity_change: 837989679325238n, sign: false }
      ],
      [
        { lowerTick: -221800, upperTick: 18900 },
        { lowerTick: 18900, upperTick: 19500 },
        { lowerTick: 19500, upperTick: 20100 },
        { lowerTick: 20100, upperTick: 20500 },
        { lowerTick: 20500, upperTick: 21100 },
        { lowerTick: 21100, upperTick: 21600 },
        { lowerTick: 21600, upperTick: 21700 },
        { lowerTick: 21700, upperTick: 22100 },
        { lowerTick: 22100, upperTick: 22500 },
        { lowerTick: 22500, upperTick: 22700 },
        { lowerTick: 22700, upperTick: 23100 },
        { lowerTick: 23100, upperTick: 23700 },
        { lowerTick: 23700, upperTick: 23900 },
        { lowerTick: 23900, upperTick: 24800 },
        { lowerTick: 24800, upperTick: 28400 },
        { lowerTick: 28400, upperTick: 221800 }
      ]
    ]
  ])("calculateLiquidityForRanges", (liquidityChanges, tickRanges) => {
    const liquidity = calculateLiquidityForRanges(liquidityChanges, tickRanges);
    expect(liquidity.length).toBeGreaterThan(0);
    // TODO: add more expect
  });

  it.each<[any]>([
    [true],
    [123456],
    [[1, 2, 3, 4, 5]],
    [{ a: 1, b: 2, c: 3 }],
    [{ a: [1, 2, 3], b: true, c: { d: 1, e: 2 } }],
    [{ a: 1n, b: "2", c: [1n, 2n] }]
  ])("parse", (data) => {
    const result = parse(data);
    expect(result).toBeDefined();
  });

  it.each<[bigint, bigint, bigint, bigint]>([
    [837989679325238n, 2572691823370000000000000n, 2621000184602367837078723n, 15272671000000000000n],
    [872318433599957n, 2651037977538000000000000n, 2621000184602367837078723n, 2572691823370000000000000n],
    [1042117161926746n, 2731770006227000000000000n, 2621000184602367837078723n, 2651037977538000000000000n],
    [3061221885126646n, 2786952634213000000000000n, 2621000184602367837078723n, 2731770006227000000000000n],
    [3079921929921160n, 2871823670360000000000000n, 2621000184602367837078723n, 2786952634213000000000000n],
    [3053349216741434n, 2944520552269000000000000n, 2621000184602367837078723n, 2871823670360000000000000n],
    [3224297089568735n, 2959279283182000000000000n, 2621000184602367837078723n, 2944520552269000000000000n],
  ])("getX getY", (liquidity, upperSqrtPrice, currentSqrtPrice, lowerSqrtPrice) => {
    const x = getX(liquidity, upperSqrtPrice, currentSqrtPrice, lowerSqrtPrice);
    const y = getY(liquidity, upperSqrtPrice, currentSqrtPrice, lowerSqrtPrice);
    expect(x).toBeDefined();
    expect(y).toBeDefined();
    // TODO: add more expect
  });

  it.each<[string, PoolKey]>([
    [
      "orai-orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh-3000000000-100",
      {
        token_x: "orai",
        token_y: "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh",
        fee_tier: { fee: 3000000000, tick_spacing: 100 }
      }
    ],
    [
      "orai-orai1lus0f0rhx8s03gdllx2n6vhkmf0536dv57wfge-100000000-1",
      {
        token_x: "orai",
        token_y: "orai1lus0f0rhx8s03gdllx2n6vhkmf0536dv57wfge",
        fee_tier: { fee: 100000000, tick_spacing: 1 }
      }
    ],
    [
      "factory/3ERD/ton-orai1lus0f0rhx8s03gdllx2n6vhkmf0536dv57wfge-100000000-1",
      {
        token_x: "factory/3ERD/ton",
        token_y: "orai1lus0f0rhx8s03gdllx2n6vhkmf0536dv57wfge",
        fee_tier: { fee: 100000000, tick_spacing: 1 }
      }
    ]
  ])("parsePoolKey", (poolKeyStr, poolKey) => {
    const res = parsePoolKey(poolKeyStr);
    expect(res).toEqual(poolKey);
  });

  it.each<[PositionLiquidInfo[], bigint]>([
    [
      [
        {
          lower_tick_index: -1000,
          upper_tick_index: -100,
          liquidity: 3075774941172n
        },
        {
          lower_tick_index: -100,
          upper_tick_index: 0,
          liquidity: 36733811146238n
        },
        {
          lower_tick_index: 0,
          upper_tick_index: 800,
          liquidity: 536635881069730n
        },
        {
          lower_tick_index: 800,
          upper_tick_index: 1000,
          liquidity: 748875541017270n
        },
        {
          lower_tick_index: 1000,
          upper_tick_index: 1800,
          liquidity: 745799766076098n
        },
        {
          lower_tick_index: 1800,
          upper_tick_index: 1900,
          liquidity: 245897696152606n
        },
        {
          lower_tick_index: 1900,
          upper_tick_index: 2800,
          liquidity: 212239659947540n
        }
      ],
      1150264328504946397081085n
    ]
  ])("calculateLiquidityForPair", async (positions, sqrt_price) => {
    const liquidity = await calculateLiquidityForPair(positions, sqrt_price);
    expect(liquidity).toBeDefined();
    // TODO: add more expect
  });

  it.each<[PoolKey]>([
    [
      {
        token_x: "orai",
        token_y: "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh",
        fee_tier: { fee: 3000000000, tick_spacing: 100 }
      }
    ]
  ])("poolKeyToString", (poolKey) => {
    const res = poolKeyToString(poolKey);
    expect(res).toEqual(
      `${poolKey.token_x}-${poolKey.token_y}-${poolKey.fee_tier.fee}-${poolKey.fee_tier.tick_spacing}`
    );
  });

  it.each<[Record<string, PoolStatsData>]>([
    [
      {
        "orai-orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh-3000000000-100": {
          snapshots: [
            {
              timestamp: 1720612800000,
              volumeX: {
                tokenBNFromBeginning: "193650666",
                usdValue24: 1386.534
              },
              volumeY: {
                tokenBNFromBeginning: "769596000",
                usdValue24: 770.3696
              },
              liquidityX: {
                tokenBNFromBeginning: "414803878",
                usdValue24: 2969.9680000000003
              },
              liquidityY: {
                tokenBNFromBeginning: "2198016670",
                usdValue24: 2200.21802
              },
              feeX: { tokenBNFromBeginning: "580952", usdValue24: 4.1528 },
              feeY: {
                tokenBNFromBeginning: "2308788",
                usdValue24: 2.3123099999999996
              }
            },
            {
              timestamp: 1720612800000,
              volumeX: { tokenBNFromBeginning: "193650666", usdValue24: 0 },
              volumeY: { tokenBNFromBeginning: "769596000", usdValue24: 0 },
              liquidityX: {
                tokenBNFromBeginning: "414803878",
                usdValue24: 2969.9680000000003
              },
              liquidityY: {
                tokenBNFromBeginning: "2198016670",
                usdValue24: 2200.21802
              },
              feeX: { tokenBNFromBeginning: "580952", usdValue24: 0 },
              feeY: { tokenBNFromBeginning: "2308788", usdValue24: 0 }
            },
            {
              timestamp: 1720612800000,
              volumeX: { tokenBNFromBeginning: "193650666", usdValue24: 0 },
              volumeY: { tokenBNFromBeginning: "769596000", usdValue24: 0 },
              liquidityX: {
                tokenBNFromBeginning: "414803878",
                usdValue24: 2969.9680000000003
              },
              liquidityY: {
                tokenBNFromBeginning: "2198016670",
                usdValue24: 2200.21802
              },
              feeX: { tokenBNFromBeginning: "580952", usdValue24: 0 },
              feeY: { tokenBNFromBeginning: "2308788", usdValue24: 0 }
            },
            {
              timestamp: 1720612800000,
              volumeX: { tokenBNFromBeginning: "193650666", usdValue24: 0 },
              volumeY: { tokenBNFromBeginning: "769596000", usdValue24: 0 },
              liquidityX: {
                tokenBNFromBeginning: "414803878",
                usdValue24: 2969.9680000000003
              },
              liquidityY: {
                tokenBNFromBeginning: "2198016670",
                usdValue24: 2200.21802
              },
              feeX: { tokenBNFromBeginning: "580952", usdValue24: 0 },
              feeY: { tokenBNFromBeginning: "2308788", usdValue24: 0 }
            }
          ],
          tokenX: { address: "orai", decimals: 6 },
          tokenY: {
            address: "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh",
            decimals: 6
          }
        },
        "orai-orai1lus0f0rhx8s03gdllx2n6vhkmf0536dv57wfge-100000000-1": {
          snapshots: [
            {
              timestamp: 1720612800000,
              volumeX: { tokenBNFromBeginning: "0", usdValue24: 0 },
              volumeY: { tokenBNFromBeginning: "0", usdValue24: 0 },
              liquidityX: { tokenBNFromBeginning: "0", usdValue24: 0 },
              liquidityY: { tokenBNFromBeginning: "0", usdValue24: 0 },
              feeX: { tokenBNFromBeginning: "0", usdValue24: 0 },
              feeY: { tokenBNFromBeginning: "0", usdValue24: 0 }
            },
            {
              timestamp: 1720612800000,
              volumeX: { tokenBNFromBeginning: "0", usdValue24: 0 },
              volumeY: { tokenBNFromBeginning: "0", usdValue24: 0 },
              liquidityX: { tokenBNFromBeginning: "0", usdValue24: 0 },
              liquidityY: { tokenBNFromBeginning: "0", usdValue24: 0 },
              feeX: { tokenBNFromBeginning: "0", usdValue24: 0 },
              feeY: { tokenBNFromBeginning: "0", usdValue24: 0 }
            },
            {
              timestamp: 1720612800000,
              volumeX: { tokenBNFromBeginning: "0", usdValue24: 0 },
              volumeY: { tokenBNFromBeginning: "0", usdValue24: 0 },
              liquidityX: { tokenBNFromBeginning: "0", usdValue24: 0 },
              liquidityY: { tokenBNFromBeginning: "0", usdValue24: 0 },
              feeX: { tokenBNFromBeginning: "0", usdValue24: 0 },
              feeY: { tokenBNFromBeginning: "0", usdValue24: 0 }
            },
            {
              timestamp: 1720612800000,
              volumeX: { tokenBNFromBeginning: "0", usdValue24: 0 },
              volumeY: { tokenBNFromBeginning: "0", usdValue24: 0 },
              liquidityX: { tokenBNFromBeginning: "0", usdValue24: 0 },
              liquidityY: { tokenBNFromBeginning: "0", usdValue24: 0 },
              feeX: { tokenBNFromBeginning: "0", usdValue24: 0 },
              feeY: { tokenBNFromBeginning: "0", usdValue24: 0 }
            }
          ],
          tokenX: { address: "orai", decimals: 6 },
          tokenY: {
            address: "orai1lus0f0rhx8s03gdllx2n6vhkmf0536dv57wfge",
            decimals: 6
          }
        }
      }
    ]
  ])("onlySnaps", (record) => {
    const res = onlySnaps(record);
    expect(res).toBeDefined();
    // TODO: add more expect
  });

  it.each<[Record<string, PoolSnapshot[]>, number | undefined, number | undefined]>([
    [
      {
        "orai-orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh-3000000000-100": [
          {
            timestamp: 1720612800000,
            volumeX: {
              tokenBNFromBeginning: "193650666",
              usdValue24: 1386.534
            },
            volumeY: {
              tokenBNFromBeginning: "769596000",
              usdValue24: 770.3696
            },
            liquidityX: {
              tokenBNFromBeginning: "414803878",
              usdValue24: 2969.9680000000003
            },
            liquidityY: {
              tokenBNFromBeginning: "2198016670",
              usdValue24: 2200.21802
            },
            feeX: { tokenBNFromBeginning: "580952", usdValue24: 4.1528 },
            feeY: {
              tokenBNFromBeginning: "2308788",
              usdValue24: 2.3123099999999996
            }
          },
          {
            timestamp: 1720612800000,
            volumeX: { tokenBNFromBeginning: "193650666", usdValue24: 0 },
            volumeY: { tokenBNFromBeginning: "769596000", usdValue24: 0 },
            liquidityX: {
              tokenBNFromBeginning: "414803878",
              usdValue24: 2969.9680000000003
            },
            liquidityY: {
              tokenBNFromBeginning: "2198016670",
              usdValue24: 2200.21802
            },
            feeX: { tokenBNFromBeginning: "580952", usdValue24: 0 },
            feeY: { tokenBNFromBeginning: "2308788", usdValue24: 0 }
          },
          {
            timestamp: 1720612800000,
            volumeX: { tokenBNFromBeginning: "193650666", usdValue24: 0 },
            volumeY: { tokenBNFromBeginning: "769596000", usdValue24: 0 },
            liquidityX: {
              tokenBNFromBeginning: "414803878",
              usdValue24: 2969.9680000000003
            },
            liquidityY: {
              tokenBNFromBeginning: "2198016670",
              usdValue24: 2200.21802
            },
            feeX: { tokenBNFromBeginning: "580952", usdValue24: 0 },
            feeY: { tokenBNFromBeginning: "2308788", usdValue24: 0 }
          },
          {
            timestamp: 1720612800000,
            volumeX: { tokenBNFromBeginning: "193650666", usdValue24: 0 },
            volumeY: { tokenBNFromBeginning: "769596000", usdValue24: 0 },
            liquidityX: {
              tokenBNFromBeginning: "414803878",
              usdValue24: 2969.9680000000003
            },
            liquidityY: {
              tokenBNFromBeginning: "2198016670",
              usdValue24: 2200.21802
            },
            feeX: { tokenBNFromBeginning: "580952", usdValue24: 0 },
            feeY: { tokenBNFromBeginning: "2308788", usdValue24: 0 }
          }
        ],
        "orai-orai1lus0f0rhx8s03gdllx2n6vhkmf0536dv57wfge-100000000-1": [
          {
            timestamp: 1720612800000,
            volumeX: { tokenBNFromBeginning: "0", usdValue24: 0 },
            volumeY: { tokenBNFromBeginning: "0", usdValue24: 0 },
            liquidityX: { tokenBNFromBeginning: "0", usdValue24: 0 },
            liquidityY: { tokenBNFromBeginning: "0", usdValue24: 0 },
            feeX: { tokenBNFromBeginning: "0", usdValue24: 0 },
            feeY: { tokenBNFromBeginning: "0", usdValue24: 0 }
          },
          {
            timestamp: 1720612800000,
            volumeX: { tokenBNFromBeginning: "0", usdValue24: 0 },
            volumeY: { tokenBNFromBeginning: "0", usdValue24: 0 },
            liquidityX: { tokenBNFromBeginning: "0", usdValue24: 0 },
            liquidityY: { tokenBNFromBeginning: "0", usdValue24: 0 },
            feeX: { tokenBNFromBeginning: "0", usdValue24: 0 },
            feeY: { tokenBNFromBeginning: "0", usdValue24: 0 }
          },
          {
            timestamp: 1720612800000,
            volumeX: { tokenBNFromBeginning: "0", usdValue24: 0 },
            volumeY: { tokenBNFromBeginning: "0", usdValue24: 0 },
            liquidityX: { tokenBNFromBeginning: "0", usdValue24: 0 },
            liquidityY: { tokenBNFromBeginning: "0", usdValue24: 0 },
            feeX: { tokenBNFromBeginning: "0", usdValue24: 0 },
            feeY: { tokenBNFromBeginning: "0", usdValue24: 0 }
          },
          {
            timestamp: 1720612800000,
            volumeX: { tokenBNFromBeginning: "0", usdValue24: 0 },
            volumeY: { tokenBNFromBeginning: "0", usdValue24: 0 },
            liquidityX: { tokenBNFromBeginning: "0", usdValue24: 0 },
            liquidityY: { tokenBNFromBeginning: "0", usdValue24: 0 },
            feeX: { tokenBNFromBeginning: "0", usdValue24: 0 },
            feeY: { tokenBNFromBeginning: "0", usdValue24: 0 }
          }
        ]
      },
      undefined,
      undefined
    ]
  ])("sliceSnaps", (data, limit, skip) => {
    const res = sliceSnaps(data, limit, skip);
    expect(res).toBeDefined();
    // TODO: add more expect
  });

  it.each<[bigint, number, number, bigint]>([
    [193650666n, 6, 7.16, 193650666n],
    [769596000n, 6, 1.001, 769596000n],
    [414803878n, 6, 0.45, 0n],
    [2198016670n, 6, 0.45, 10000n]
  ])("getUsdValue24", (total, decimals, price, lastTotal) => {
    const res = getUsdValue24(total, decimals, price, lastTotal);
    console.log(res);
    expect(res).toBeDefined();
    // TODO: add more expect
  });

  it.each<[TokenItemType]>([
    [
      {
        name: "ORAI",
        org: "Oraichain",
        coinType: 118,
        contractAddress: undefined,
        prefix: "orai",
        coinGeckoId: "oraichain-token",
        denom: "orai",
        bridgeNetworkIdentifier: undefined,
        decimals: 6,
        bridgeTo: ["0x38", "0x01", "injective-1"],
        chainId: "Oraichain",
        rpc: "https://rpc.orai.io",
        cosmosBased: true,
        maxGas: 140,
        gasPriceStep: { low: 0.003, average: 0.005, high: 0.007 },
        minAmountSwap: undefined,
        evmDenoms: undefined,
        Icon: undefined,
        IconLight: undefined
      }
    ],
    [
      {
        name: "ATOM",
        org: "Oraichain",
        coinType: 118,
        contractAddress: undefined,
        prefix: "orai",
        coinGeckoId: "cosmos",
        denom: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
        bridgeNetworkIdentifier: undefined,
        decimals: 6,
        bridgeTo: ["cosmoshub-4"],
        chainId: "Oraichain",
        rpc: "https://rpc.orai.io",
        cosmosBased: true,
        maxGas: 140,
        gasPriceStep: undefined,
        minAmountSwap: undefined,
        evmDenoms: undefined,
        Icon: undefined,
        IconLight: undefined
      }
    ],
    [
      {
        name: "AIRI",
        org: "Oraichain",
        coinType: 118,
        contractAddress: "orai10ldgzued6zjp0mkqwsv2mux3ml50l97c74x8sg",
        prefix: "orai",
        coinGeckoId: "airight",
        denom: "airi",
        bridgeNetworkIdentifier: undefined,
        decimals: 6,
        bridgeTo: ["0x38"],
        chainId: "Oraichain",
        rpc: "https://rpc.orai.io",
        cosmosBased: true,
        maxGas: 140,
        gasPriceStep: undefined,
        minAmountSwap: undefined,
        evmDenoms: undefined,
        Icon: undefined,
        IconLight: undefined
      }
    ],
    [
      {
        name: "TON",
        org: "Oraichain",
        coinType: 118,
        contractAddress: undefined,
        prefix: "orai",
        coinGeckoId: "the-open-network" as any,
        denom: "factory/orai1wuvhex9xqs3r539mvc6mtm7n20fcj3qr2m0y9khx6n5vtlngfzes3k0rq9/ton",
        bridgeNetworkIdentifier: undefined,
        decimals: 9,
        bridgeTo: undefined,
        chainId: "Oraichain",
        rpc: "https://rpc.orai.io",
        cosmosBased: true,
        maxGas: 140,
        gasPriceStep: undefined,
        minAmountSwap: undefined,
        evmDenoms: undefined,
        Icon: undefined,
        IconLight: undefined
      }
    ]
  ])("extractAddress", (data) => {
    const res = extractAddress(data);
    expect(res).equal(data.contractAddress ? data.contractAddress : data.denom);
  });
});
