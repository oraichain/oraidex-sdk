import {
  calculateFee,
  calculateMaxLiquidityPerTick,
  calculateMinAmountOut,
  checkTick,
  checkTicks,
  checkTickToSqrtPriceRelationship,
  computeSwapStep,
  getDeltaX,
  getDeltaY,
  getGlobalMaxSqrtPrice,
  getLiquidityByX,
  getLiquidityByY,
  getMaxChunk,
  getMaxPoolKeysReturned,
  getMaxPoolPairsReturned,
  getMaxSqrtPrice,
  getMaxTick,
  getMaxTickCross,
  getNextSqrtPriceFromInput,
  getNextSqrtPriceFromOutput,
  getNextSqrtPriceXUp,
  getNextSqrtPriceYDown,
  getTickAtSqrtPrice,
  getTickSearchRange,
  isEnoughAmountToChangePrice,
  isTokenX,
  positionToTick
} from "../src";
import { describe, it, expect } from "vitest";

describe("wasm bind gen tests", () => {
  it.each<
    [
      {
        currentSqrtPrice: bigint;
        targetSqrtPrice: bigint;
        liquidity: bigint;
        amount: bigint;
        byAmountIn: boolean;
        fee: bigint;
      },
      {
        next_sqrt_price: bigint;
        amount_in: bigint;
        amount_out: bigint;
        fee_amount: bigint;
      }
    ]
  >([
    [
      {
        currentSqrtPrice: 10n ** 24n,
        targetSqrtPrice: 1004987562112089027021926n,
        liquidity: 2000n * 10n ** 6n,
        amount: 1n,
        byAmountIn: true,
        fee: 6n * 10n ** 4n
      },
      {
        next_sqrt_price: 10n ** 24n,
        amount_in: 0n,
        amount_out: 0n,
        fee_amount: 1n
      }
    ],
    [
      {
        currentSqrtPrice: 10n ** 24n,
        targetSqrtPrice: 1004987562112089027021926n,
        liquidity: 2000n * 10n ** 6n,
        amount: 20n,
        byAmountIn: true,
        fee: 6n * 10n ** 4n
      },
      {
        next_sqrt_price: 1004987562112089027021926n,
        amount_in: 10n,
        amount_out: 9n,
        fee_amount: 1n
      }
    ],
    [
      {
        currentSqrtPrice: 10n ** 24n,
        targetSqrtPrice: 1004987562112089027021926n,
        liquidity: 2000n * 10n ** 6n,
        amount: 20n,
        byAmountIn: false,
        fee: 6n * 10n ** 4n
      },
      {
        next_sqrt_price: 1004987562112089027021926n,
        amount_in: 10n,
        amount_out: 9n,
        fee_amount: 1n
      }
    ]
  ])("compute swap step", (input, output) => {
    const res = computeSwapStep(
      input.currentSqrtPrice,
      input.targetSqrtPrice,
      input.liquidity,
      input.amount,
      input.byAmountIn,
      input.fee
    );
    expect(res).toMatchObject(output);
  });

  it.each<
    [
      {
        sqrtPriceA: bigint;
        sqrtPriceB: bigint;
        liquidity: bigint;
        roundUp: boolean;
      },
      bigint
    ]
  >([
    [
      {
        sqrtPriceA: 10n ** 24n,
        sqrtPriceB: 10n ** 24n,
        liquidity: 0n,
        roundUp: false
      },
      0n
    ],
    [
      {
        sqrtPriceA: 10n ** 24n,
        sqrtPriceB: 2n * 10n ** 24n,
        liquidity: 2n * 10n ** 6n,
        roundUp: false
      },
      1n
    ]
  ])("get delta x", (input, output) => {
    const res = getDeltaX(input.sqrtPriceA, input.sqrtPriceB, input.liquidity, input.roundUp);
    expect(res).toEqual(output);
  });

  it.each<
    [
      {
        sqrtPriceA: bigint;
        sqrtPriceB: bigint;
        liquidity: bigint;
        roundUp: boolean;
      },
      bigint
    ]
  >([
    [
      {
        sqrtPriceA: 10n ** 24n,
        sqrtPriceB: 10n ** 24n,
        liquidity: 0n,
        roundUp: false
      },
      0n
    ],
    [
      {
        sqrtPriceA: 10n ** 24n,
        sqrtPriceB: 2n * 10n ** 24n,
        liquidity: 2n * 10n ** 6n,
        roundUp: false
      },
      2n
    ]
  ])("get delta y", (input, output) => {
    const res = getDeltaY(input.sqrtPriceA, input.sqrtPriceB, input.liquidity, input.roundUp);
    expect(res).toEqual(output);
  });

  it.each<
    [
      {
        sqrtPrice: bigint;
        liquidity: bigint;
        amount: bigint;
        xToY: boolean;
      },
      bigint
    ]
  >([
    [
      {
        sqrtPrice: 10n ** 24n,
        liquidity: 10n ** 6n,
        amount: 1n,
        xToY: true
      },
      5n * 10n ** 23n
    ]
  ])("get next sqrt price from input", (input, output) => {
    const res = getNextSqrtPriceFromInput(input.sqrtPrice, input.liquidity, input.amount, input.xToY);
    expect(res).toEqual(output);
  });

  it.each<
    [
      {
        sqrtPrice: bigint;
        liquidity: bigint;
        amount: bigint;
        xToY: boolean;
      },
      bigint
    ]
  >([
    [
      {
        sqrtPrice: 10n ** 24n,
        liquidity: 2n * 10n ** 6n,
        amount: 1n,
        xToY: true
      },
      5n * 10n ** 23n
    ]
  ])("get next sqrt price from output", (input, output) => {
    const res = getNextSqrtPriceFromOutput(input.sqrtPrice, input.liquidity, input.amount, input.xToY);
    expect(res).toEqual(output);
  });

  it.each<
    [
      {
        sqrtPrice: bigint;
        liquidity: bigint;
        amount: bigint;
        xToY: boolean;
      },
      bigint
    ]
  >([
    [
      {
        sqrtPrice: 10n ** 24n,
        liquidity: 10n ** 6n,
        amount: 1n,
        xToY: true
      },
      5n * 10n ** 23n
    ]
  ])("getNextSqrtPriceXUp", (input, output) => {
    const res = getNextSqrtPriceXUp(input.sqrtPrice, input.liquidity, input.amount, input.xToY);
    expect(res).toEqual(output);
  });

  it.each<
    [
      {
        sqrtPrice: bigint;
        liquidity: bigint;
        amount: bigint;
        xToY: boolean;
      },
      bigint
    ]
  >([
    [
      {
        sqrtPrice: 10n ** 24n,
        liquidity: 10n ** 6n,
        amount: 1n,
        xToY: true
      },
      2n * 10n ** 24n
    ]
  ])("getNextSqrtPriceYDown", (input, output) => {
    const res = getNextSqrtPriceYDown(input.sqrtPrice, input.liquidity, input.amount, input.xToY);
    expect(res).toEqual(output);
  });

  it.each<
    [
      {
        amount: bigint;
        startSqrtPrice: bigint;
        liquidity: bigint;
        fee: bigint;
        byAmountIn: boolean;
        xToY: boolean;
      },
      boolean
    ]
  >([
    [
      {
        amount: 340282366920938463463374607431768211455n,
        startSqrtPrice: 65535383934512647000000000000n,
        liquidity: 0n,
        fee: 1000000000000n,
        byAmountIn: false,
        xToY: false
      },
      true
    ]
  ])("isEnoughAmountToChangePrice", (input, output) => {
    const res = isEnoughAmountToChangePrice(
      input.amount,
      input.startSqrtPrice,
      input.liquidity,
      input.fee,
      input.byAmountIn,
      input.xToY
    );
    expect(res).toEqual(output);
  });

  it.each<[number, bigint]>([[1, 767028825190275976673213928125400n]])(
    "calculateMaxLiquidityPerTick",
    (input, output) => {
      const res = calculateMaxLiquidityPerTick(input);
      expect(res).toEqual(output);
    }
  );

  it.each<[number, number, number]>([[1, 2, 1]])("checkTicks", (tickLower, tickUpper, tickSpacing) => {
    checkTicks(tickLower, tickUpper, tickSpacing);
  });

  it.each<[number, number]>([[1, 1]])("checkTick", (tick, tickSpacing) => {
    checkTick(tick, tickSpacing);
  });

  it.each<[bigint, bigint, bigint]>([[100n, 0n, 100n]])("calculateMinAmountOut", (expected, slippage, output) => {
    const res = calculateMinAmountOut(expected, slippage);
    expect(res).toEqual(output);
  });

  it.each<[number, number, number, number]>([[0, 0, 1, -221818]])(
    "positionToTick",
    (chunk, bit, tickSpacing, output) => {
      const res = positionToTick(chunk, bit, tickSpacing);
      console.log(res);
      expect(res).toEqual(output);
    }
  );

  it("getGlobalMaxSqrtPrice", () => {
    const res = getGlobalMaxSqrtPrice();
    expect(res).toEqual(getMaxSqrtPrice(1));
  });

  it("getTickSearchRange", () => {
    const res = getTickSearchRange();
    expect(res).toEqual(256);
  });

  it.each<[number]>([[1]])("getMaxChunk", (tickSpacing) => {
    const res = getMaxChunk(tickSpacing);
    expect(res).toEqual(6931);
  });

  it("getMaxTickCross", () => {
    const res = getMaxTickCross();
    expect(res).toEqual(173);
  });

  it("getMaxPoolKeysReturned", () => {
    const res = getMaxPoolKeysReturned();
    expect(res).toEqual(220);
  });

  it("getMaxPoolPairsReturned", () => {
    const res = getMaxPoolPairsReturned();
    expect(res).toEqual(126);
  });

  it.each<
    [
      {
        lower_tick_index: number;
        lower_tick_fee_growth_outside_x: bigint;
        lower_tick_fee_growth_outside_y: bigint;
        upper_tick_index: number;
        upper_tick_fee_growth_outside_x: bigint;
        upper_tick_fee_growth_outside_y: bigint;
        pool_current_tick_index: number;
        pool_fee_growth_global_x: bigint;
        pool_fee_growth_global_y: bigint;
        position_fee_growth_inside_x: bigint;
        position_fee_growth_inside_y: bigint;
        position_liquidity: bigint;
      },
      {
        x: bigint;
        y: bigint;
      }
    ]
  >([
    [
      {
        lower_tick_index: -24300,
        lower_tick_fee_growth_outside_x: 30566305483401951213259107n,
        lower_tick_fee_growth_outside_y: 3090193022255581920240205n,
        upper_tick_index: -23900,
        upper_tick_fee_growth_outside_x: 0n,
        upper_tick_fee_growth_outside_y: 0n,
        pool_current_tick_index: -24200,
        pool_fee_growth_global_x: 34015516218039756676745948n,
        pool_fee_growth_global_y: 3360651078360214052633596n,
        position_fee_growth_inside_x: 1856777541687032563592895n,
        position_fee_growth_inside_y: 164732622916975273061067n,
        position_liquidity: 7823906503624803n
      },
      {
        x: 1245904n,
        y: 82718n
      }
    ]
  ])("calculateFee", (input, output) => {
    const res = calculateFee(
      input.lower_tick_index,
      input.lower_tick_fee_growth_outside_x,
      input.lower_tick_fee_growth_outside_y,
      input.upper_tick_index,
      input.upper_tick_fee_growth_outside_x,
      input.upper_tick_fee_growth_outside_y,
      input.pool_current_tick_index,
      input.pool_fee_growth_global_x,
      input.pool_fee_growth_global_y,
      input.position_fee_growth_inside_x,
      input.position_fee_growth_inside_y,
      input.position_liquidity
    );
    expect(res).toMatchObject(output);
  });

  it.each<[string, string, boolean]>([["orai1zyvk3n9r8sax4xvqph97pxuhduqqsqwq6dwzj2", "orai", false]])(
    "isTokenX",
    (tokenX, tokenY, expected) => {
      const res = isTokenX(tokenX, tokenY);
      expect(res).toEqual(expected);
    }
  );

  it.each<[number, number, bigint, boolean]>([])(
    "checkTickToSqrtPriceRelationship",
    (tick, tickSpacing, sqrtPrice, expected) => {
      const res = checkTickToSqrtPriceRelationship(tick, tickSpacing, sqrtPrice);
      expect(res).toEqual(expected);
    }
  );

  it.each<
    [
      {
        x: bigint;
        lower_tick: number;
        upper_tick: number;
        current_sqrt_price: bigint;
        rounding_up: boolean;
      },
      {
        amount: bigint;
        l: bigint;
      }
    ]
  >([
    [
      {
        x: 1000000n,
        lower_tick: -10,
        upper_tick: 10,
        current_sqrt_price: 10n ** 24n,
        rounding_up: true
      },
      {
        amount: 1000000n,
        l: 2000600039999999n
      }
    ]
  ])("getLiquidityByX", (input, output) => {
    const res = getLiquidityByX(
      input.x,
      input.lower_tick,
      input.upper_tick,
      input.current_sqrt_price,
      input.rounding_up
    );
    expect(res).toMatchObject(output);
  });

  it.each<
    [
      {
        x: bigint;
        lower_tick: number;
        upper_tick: number;
        current_sqrt_price: bigint;
        rounding_up: boolean;
      },
      {
        amount: bigint;
        l: bigint;
      }
    ]
  >([
    [
      {
        x: 1000000n,
        lower_tick: -10,
        upper_tick: 10,
        current_sqrt_price: 10n ** 24n,
        rounding_up: true
      },
      {
        amount: 1000000n,
        l: 2000600039969988n
      }
    ]
  ])("getLiquidityByY", (input, output) => {
    const res = getLiquidityByY(
      input.x,
      input.lower_tick,
      input.upper_tick,
      input.current_sqrt_price,
      input.rounding_up
    );
    expect(res).toMatchObject(output);
  });

  it.each<[bigint, number, number]>([
    [10n ** 24n, 1, 0],
    [10n ** 24n, 2, 0]
  ])("getTickAtSqrtPrice", (sqrtPrice, tickSpacing, output) => {
    const res = getTickAtSqrtPrice(sqrtPrice, tickSpacing);
    expect(res).toEqual(output);
  });

  it.each<[number, number, bigint, boolean]>([
    [1, 1, 10n ** 24n, false],
    [1, 1, 10n ** 24n, false]
  ])("checkTickToSqrtPriceRelationship", (tick_index, tick_spacing, sqrt_price, output) => {
    const res = checkTickToSqrtPriceRelationship(tick_index, tick_spacing, sqrt_price);
    expect(res).toEqual(output);
  })
});
