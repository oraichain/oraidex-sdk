import { BigDecimal, oraichainTokens, parseAssetInfo, TokenItemType } from "@oraichain/oraidex-common";
import { OraiswapV3Handler } from "./handler";
import {
  ActionRoute,
  LiquidityTick,
  PoolKey,
  SmartRouteConfig,
  SmartRouteResponse,
  Tickmap,
  ZapConfig,
  ZapInLiquidityResponse,
  ZapInResult,
  ZapOutLiquidityResponse,
  ZapOutResult
} from "./types";
import {
  getLiquidityByX,
  getLiquidityByY,
  getMaxSqrtPrice,
  getMaxTick,
  getMinSqrtPrice,
  getMinTick,
  getTickAtSqrtPrice,
  positionToTick,
  simulateSwap
} from "./wasm/oraiswap_v3_wasm";
import {
  calculateTokenAmounts,
  extractAddress,
  generateMessageSwapOperation,
  getFeeRate,
  getPriceImpactAfterSwap,
  parseAsset,
  poolKeyToString,
  shiftDecimal
} from "./helpers";
import { CHUNK_SIZE } from "./const";
import {
  ArrayOfTupleOfUint16AndUint64,
  Pool,
  PoolWithPoolKey
} from "@oraichain/oraidex-contracts-sdk/build/OraiswapV3.types";
import { RouteNotFoundError } from "./error";

/** Read the flow chart below to understand the process of the ZapConsumer
Flow ref: https://lucid.app/lucidchart/11f8ee36-ee71-4f46-8028-a953ac4f5e87/edit?viewport_loc=-3263%2C-2130%2C3114%2C1694%2C0_0&invitationId=inv_cbe9b842-b255-4c8a-824e-2bc78a6f3860
 */

export class ZapConsumer {
  private _router: string;
  private _handler: OraiswapV3Handler;
  private _smartRouteConfig: SmartRouteConfig;
  private _devitation: number;

  constructor(config: ZapConfig) {
    this._router = config.routerApi;
    this._handler = new OraiswapV3Handler(config.client, config.dexV3Address, config.multicallAddress);
    this._smartRouteConfig = config.smartRouteConfig;
    this._devitation = config.devitation;
  }

  public get handler(): OraiswapV3Handler {
    return this._handler;
  }

  private async getPriceInfo({
    sourceAsset,
    destAsset
  }: {
    sourceAsset: TokenItemType;
    destAsset: TokenItemType;
  }): Promise<SmartRouteResponse> {
    try {
      if (sourceAsset.name === destAsset.name)
        return {
          swapAmount: (10n ** BigInt(sourceAsset.decimals)).toString(),
          returnAmount: (10n ** BigInt(sourceAsset.decimals)).toString(),
          routes: null
        };
      const res = await fetch(this._router, {
        method: "POST",
        body: JSON.stringify({
          sourceAsset: extractAddress(sourceAsset),
          sourceChainId: sourceAsset.chainId,
          destAsset: extractAddress(destAsset),
          destChainId: destAsset.chainId,
          offerAmount: (10n ** BigInt(sourceAsset.decimals)).toString(),
          swapOptions: this._smartRouteConfig.swapOptions
        }),
        headers: {
          "Content-Type": "application/json"
        }
      });

      return JSON.parse(await res.text());
    } catch (e) {
      console.log(`[ZapConsumer] getPriceInfo error: ${e}`);
      throw new RouteNotFoundError(e);
    }
  }

  private async findRoute({
    sourceAsset,
    destAsset,
    amount
  }: {
    sourceAsset: TokenItemType;
    destAsset: TokenItemType;
    amount: bigint;
  }): Promise<SmartRouteResponse> {
    try {
      if (amount === 0n) {
        return {
          swapAmount: "0",
          returnAmount: "0",
          routes: null
        };
      }
      if (sourceAsset.name === destAsset.name)
        return {
          swapAmount: amount.toString(),
          returnAmount: amount.toString(),
          routes: null
        };
      const res = await fetch(this._router, {
        method: "POST",
        body: JSON.stringify({
          sourceAsset: extractAddress(sourceAsset),
          sourceChainId: sourceAsset.chainId,
          destAsset: extractAddress(destAsset),
          destChainId: destAsset.chainId,
          offerAmount: amount.toString(),
          swapOptions: this._smartRouteConfig.swapOptions
        }),
        headers: {
          "Content-Type": "application/json"
        }
      });

      return JSON.parse(await res.text());
    } catch (e) {
      console.log(`[ZapConsumer] getPriceInfo error: ${e}`);
      throw new RouteNotFoundError(e);
    }
  }

  public async getAllLiquidityTicks(poolKey: PoolKey, tickmap: Tickmap): Promise<LiquidityTick[]> {
    const tickIndexes: number[] = [];
    for (const [chunkIndex, chunk] of tickmap.bitmap.entries()) {
      for (let bit = 0; bit < CHUNK_SIZE; bit++) {
        const checkedBit = chunk & (1n << BigInt(bit));
        if (checkedBit !== 0n) {
          const tickIndex = positionToTick(Number(chunkIndex), bit, poolKey.fee_tier.tick_spacing);
          tickIndexes.push(tickIndex);
        }
      }
    }

    const tickResults = await this.handler.liquidityTicks(poolKey, tickIndexes);

    return tickResults.map((tick) => {
      return {
        ...tick,
        liquidity_change: BigInt(tick.liquidity_change)
      };
    });
  }

  public async getFullTickmap(poolKey: PoolKey): Promise<Tickmap> {
    const minTick = getMinTick(poolKey.fee_tier.tick_spacing);
    const maxTick = getMaxTick(poolKey.fee_tier.tick_spacing);
    const tickmap = await this.handler.tickMap(poolKey, minTick, maxTick, true);
    const bitmap = new Map<bigint, bigint>();
    tickmap.forEach((t) => {
      bitmap.set(BigInt(t[0].toString()), BigInt(t[1].toString()));
    });
    return { bitmap };
  }

  private async processZapInWithSingleSide({
    poolKey,
    pool,
    sqrtPrice,
    tokenIn,
    amountIn,
    lowerTick,
    upperTick,
    tokenX,
    tokenY,
    slippage = 1,
    allPools,
    allTicks,
    allTickMaps
  }: {
    poolKey: PoolKey;
    pool: Pool;
    sqrtPrice: bigint;
    tokenIn: TokenItemType;
    amountIn: string;
    lowerTick: number;
    upperTick: number;
    tokenX: TokenItemType;
    tokenY: TokenItemType;
    slippage?: number;
    allPools: Record<string, PoolWithPoolKey>;
    allTicks: Record<string, LiquidityTick[]>;
    allTickMaps: Record<string, Tickmap>;
  }): Promise<ZapInLiquidityResponse> {
    try {
      let tokenNeed: TokenItemType;
      let isTokenX: boolean = true;
      if (upperTick < pool.current_tick_index) {
        tokenNeed = tokenY;
        isTokenX = false;
      } else {
        tokenNeed = tokenX;
      }

      const actualReceive = await this.findRoute({
        sourceAsset: tokenIn,
        destAsset: tokenNeed,
        amount: BigInt(amountIn)
      });

      const routes: ActionRoute[] = [];
      actualReceive.routes !== null &&
        actualReceive.routes.forEach((route) => {
          route.paths.forEach((path) => {
            path.actions.forEach((action) => {
              if (action.protocol === "OraidexV3") {
                routes.push(action);
              }
            });
          });
        });

      let simulatedNextSqrtPrice = BigInt(pool.sqrt_price);
      let simualteNextTick = pool.current_tick_index;
      console.dir(routes, { depth: null });
      for (const route of routes) {
        if (route.swapInfo.find((swap) => swap.poolId === poolKeyToString(poolKey))) {
          const isXToY = route.tokenOut === poolKey.token_x ? false : true;
          const amountOut = route.tokenOutAmount;
          const tickMap = await this.getFullTickmap(poolKey);
          const liquidityTicks = await this.getAllLiquidityTicks(poolKey, tickMap);
          const convertPool = {
            ...pool,
            liquidity: BigInt(pool.liquidity),
            sqrt_price: BigInt(pool.sqrt_price),
            fee_growth_global_x: BigInt(pool.fee_growth_global_x),
            fee_growth_global_y: BigInt(pool.fee_growth_global_y),
            fee_protocol_token_x: BigInt(pool.fee_protocol_token_x),
            fee_protocol_token_y: BigInt(pool.fee_protocol_token_y)
          };
          const swapResult = simulateSwap(
            tickMap,
            poolKey.fee_tier,
            convertPool,
            liquidityTicks,
            isXToY,
            BigInt(amountOut),
            false,
            isXToY ? getMinSqrtPrice(poolKey.fee_tier.tick_spacing) : getMaxSqrtPrice(poolKey.fee_tier.tick_spacing)
          );

          pool.sqrt_price = ((BigInt(pool.sqrt_price) + BigInt(swapResult.target_sqrt_price)) / 2n).toString();
          const tick = getTickAtSqrtPrice(BigInt(pool.sqrt_price), poolKey.fee_tier.tick_spacing);
          pool.current_tick_index = (simualteNextTick + tick) / 2;
          simulatedNextSqrtPrice = BigInt(pool.sqrt_price);
          simualteNextTick = pool.current_tick_index;
        }
      }

      let message: ZapInLiquidityResponse = {} as ZapInLiquidityResponse;
      if (sqrtPrice === BigInt(pool.sqrt_price)) {
        message.result = ZapInResult.OutRangeNoRouteThroughSelf;
        message.assetIn = parseAsset(tokenIn, amountIn);

        if (isTokenX) {
          message.amountToX = amountIn;
          message.amountToY = "0";
          message.amountX = actualReceive.returnAmount;
          message.amountY = "0";
        } else {
          message.amountToX = "0";
          message.amountToY = amountIn;
          message.amountX = "0";
          message.amountY = actualReceive.returnAmount;
        }

        message.poolKey = poolKey;
        message.sqrtPrice = BigInt(pool.sqrt_price);
        message.tickLowerIndex = lowerTick;
        message.tickUpperIndex = upperTick;
        const routesNeed = generateMessageSwapOperation([actualReceive], slippage);
        let priceImpact = 0;
        routesNeed.forEach((route) => {
          priceImpact += getPriceImpactAfterSwap({
            route: route,
            allPools,
            allTicks,
            allTickMaps
          });
        });
        message.priceImpactX = isTokenX ? priceImpact : 0;
        message.priceImpactY = isTokenX ? 0 : priceImpact;

        message.routes = [...routesNeed];
        message.swapFee = 0;
        message.routes.forEach((route) => {
          route.operations.forEach((operation) => {
            message.swapFee += getFeeRate(operation);
          });
        });
        const res = isTokenX
          ? getLiquidityByX(BigInt(actualReceive.returnAmount), lowerTick, upperTick, BigInt(pool.sqrt_price), true)
          : getLiquidityByY(BigInt(actualReceive.returnAmount), lowerTick, upperTick, BigInt(pool.sqrt_price), true);
        message.minimumLiquidity = res.l ? (BigInt(res.l) * BigInt(100 - slippage)) / 100n : 0n;
        return message;
      }

      if (simualteNextTick < upperTick && simualteNextTick >= lowerTick) {
        message.result = ZapInResult.OutRangeHasRouteThroughSelfMayBecomeInRange;
        message.currentTick = simualteNextTick;
        message.sqrtPrice = simulatedNextSqrtPrice;

        return message;
      } else {
        message.result = ZapInResult.OutRangeHasRouteThroughSelf;
        message.assetIn = parseAsset(tokenIn, amountIn);

        if (isTokenX) {
          message.amountToX = amountIn;
          message.amountToY = "0";
          message.amountX = actualReceive.returnAmount;
          message.amountY = "0";
        } else {
          message.amountToX = "0";
          message.amountToY = amountIn;
          message.amountX = "0";
          message.amountY = actualReceive.returnAmount;
        }

        message.poolKey = poolKey;
        message.sqrtPrice = BigInt(pool.sqrt_price);
        message.tickLowerIndex = lowerTick;
        message.tickUpperIndex = upperTick;
        const routesNeed = generateMessageSwapOperation([actualReceive], slippage);
        let priceImpact = 0;
        routesNeed.forEach((route) => {
          priceImpact += getPriceImpactAfterSwap({
            route: route,
            allPools,
            allTicks,
            allTickMaps
          });
        });
        message.priceImpactX = isTokenX ? priceImpact : 0;
        message.priceImpactY = isTokenX ? 0 : priceImpact;

        message.swapFee = 0;
        message.routes.forEach((route) => {
          route.operations.forEach((operation) => {
            message.swapFee += getFeeRate(operation);
          });
        });
        const res = isTokenX
          ? getLiquidityByX(BigInt(actualReceive.returnAmount), lowerTick, upperTick, BigInt(pool.sqrt_price), true)
          : getLiquidityByY(BigInt(actualReceive.returnAmount), lowerTick, upperTick, BigInt(pool.sqrt_price), true);
        message.minimumLiquidity = res.l ? (BigInt(res.l) * BigInt(100 - slippage)) / 100n : 0n;
        return message;
      }
    } catch (e) {
      console.log(`[ZapConsumer] processZapInWithSingleSide error: ${e}`);
      const message: ZapInLiquidityResponse = {} as ZapInLiquidityResponse;
      if (e instanceof RouteNotFoundError) {
        message.result = ZapInResult.NoRouteFound;
      } else {
        message.result = ZapInResult.SomethingWentWrong;
      }
      return message;
    }
  }

  public async processZapInPositionLiquidity({
    poolKey,
    tokenIn,
    tokenX,
    tokenY,
    amountIn,
    lowerTick,
    upperTick,
    slippage = 1,
    allPools,
    allTicks,
    allTickMaps
  }: {
    poolKey: PoolKey;
    tokenIn: TokenItemType;
    tokenX: TokenItemType;
    tokenY: TokenItemType;
    amountIn: string;
    lowerTick: number;
    upperTick: number;
    slippage?: number;
    allPools: Record<string, PoolWithPoolKey>;
    allTicks: Record<string, LiquidityTick[]>;
    allTickMaps: Record<string, Tickmap>;
  }): Promise<ZapInLiquidityResponse> {
    // get pool info
    const pool = allPools[poolKeyToString(poolKey)];

    console.log(`[ZAPPER] pool: ${tokenX.name} / ${tokenY.name} - ${pool.pool_key.fee_tier.fee / 10 ** 10}%`);

    const sqrtPrice = BigInt(pool.pool.sqrt_price);

    console.log(`[ZAPPER] sqrtPrice: ${sqrtPrice}, currentTick: ${pool.pool.current_tick_index}`);

    let zapResult: ZapInResult;
    let result: ZapInLiquidityResponse;
    if (lowerTick > pool.pool.current_tick_index || upperTick <= pool.pool.current_tick_index) {
      console.log(`[ZAPPER] Position want to add is out range`);
      // Handle case zap in when the position is out range
      result = await this.processZapInWithSingleSide({
        poolKey,
        pool: pool.pool,
        sqrtPrice,
        tokenIn,
        amountIn,
        lowerTick,
        upperTick,
        tokenX,
        tokenY,
        slippage,
        allPools,
        allTicks,
        allTickMaps
      });
    }

    if (result) {
      console.log("[ZAPPER] Result for the out range position!");
      if (result.result !== ZapInResult.OutRangeHasRouteThroughSelfMayBecomeInRange) {
        return result;
      } else {
        pool.pool.current_tick_index = result.currentTick;
        pool.pool.sqrt_price = BigInt(pool.pool.sqrt_price).toString();
      }
    }

    console.log("[ZAPPER] Position is in range");
    // calculate rate of X and Y in the target range
    const { amount: yPerX, l: liquidity } = await getLiquidityByX(
      10n ** BigInt(tokenX.decimals),
      lowerTick,
      upperTick,
      sqrtPrice,
      true
    ); // TODO: still may error
    let m3 = shiftDecimal(BigInt(yPerX.toString()), tokenY.decimals);

    // get price rate by tokenIn
    let m1 = new BigDecimal(1); // xPrice
    let m2 = new BigDecimal(1); // yPrice

    // API time: need to check
    const getXPriceByTokenIn = await this.getPriceInfo({
      sourceAsset: tokenX,
      destAsset: tokenIn
    });

    const getYPriceByTokenIn = await this.getPriceInfo({
      sourceAsset: tokenY,
      destAsset: tokenIn
    });

    // separate case if tokenIn is on of the pool tokens
    if (![poolKey.token_x, poolKey.token_y].includes(extractAddress(tokenIn))) {
      m1 = shiftDecimal(BigInt(getXPriceByTokenIn.returnAmount), tokenIn.decimals);
      m2 = shiftDecimal(BigInt(getYPriceByTokenIn.returnAmount), tokenIn.decimals);
    } else {
      if (extractAddress(tokenIn) === poolKey.token_x) {
        m2 = shiftDecimal(BigInt(getYPriceByTokenIn.returnAmount), tokenIn.decimals);
      } else {
        m1 = shiftDecimal(BigInt(getXPriceByTokenIn.returnAmount), tokenIn.decimals);
      }
    }

    // solve
    let x = new BigDecimal(amountIn).div(m1.add(m2.mul(m3)));
    let y = x.mul(m3);
    let amountX = Math.round(x.toNumber());
    let amountY = Math.round(y.toNumber());

    // get value of Token In
    let amountInToX = BigInt(Math.round(x.mul(m1).toNumber()));
    let amountInToY = BigInt(amountIn) - amountInToX;

    // re-check
    // API time: need to check
    const actualAmountXReceived = await this.findRoute({
      sourceAsset: tokenIn,
      destAsset: tokenX,
      amount: amountInToX
    });
    const actualAmountYReceived = await this.findRoute({
      sourceAsset: tokenIn,
      destAsset: tokenY,
      amount: amountInToY
    });

    // get all routes
    const routes: ActionRoute[] = [];
    actualAmountXReceived.routes !== null &&
      actualAmountXReceived.routes.forEach((route) => {
        route.paths.forEach((path) => {
          path.actions.forEach((action) => {
            if (action.protocol === "OraidexV3") {
              routes.push(action);
            }
          });
        });
      });
    actualAmountYReceived.routes !== null &&
      actualAmountYReceived.routes.forEach((route) => {
        route.paths.forEach((path) => {
          path.actions.forEach((action) => {
            if (action.protocol === "OraidexV3") {
              routes.push(action);
            }
          });
        });
      });
    zapResult = ZapInResult.InRangeNoRouteThroughSelf;

    console.log(
      `[ZAPPER] After step 1, result is: amountX=${amountInToX.toString()} and amountY=${amountInToY.toString()}`
    );
    console.log(
      `[ZAPPER] After step 1, result actual is: amountX=${actualAmountXReceived.returnAmount} and amountY=${actualAmountYReceived.returnAmount}`
    );

    let simulatedNextSqrtPrice = BigInt(pool.pool.sqrt_price);
    let simulatedNextTick = pool.pool.current_tick_index;
    for (const route of routes) {
      if (route.swapInfo.find((swap) => swap.poolId === poolKeyToString(poolKey))) {
        const isXToY = route.tokenOut === poolKey.token_x ? false : true;
        const amountOut = route.tokenOutAmount;
        const tickMap = allTickMaps[poolKeyToString(poolKey)];
        const liquidityTicks = allTicks[poolKeyToString(poolKey)];
        const convertPool = {
          ...pool.pool,
          liquidity: BigInt(pool.pool.liquidity),
          sqrt_price: BigInt(pool.pool.sqrt_price),
          fee_growth_global_x: BigInt(pool.pool.fee_growth_global_x),
          fee_growth_global_y: BigInt(pool.pool.fee_growth_global_y),
          fee_protocol_token_x: BigInt(pool.pool.fee_protocol_token_x),
          fee_protocol_token_y: BigInt(pool.pool.fee_protocol_token_y)
        };
        const swapResult = simulateSwap(
          tickMap,
          poolKey.fee_tier,
          convertPool,
          liquidityTicks,
          isXToY,
          BigInt(amountOut),
          false,
          isXToY ? getMinSqrtPrice(poolKey.fee_tier.tick_spacing) : getMaxSqrtPrice(poolKey.fee_tier.tick_spacing)
        );

        pool.pool.sqrt_price = ((BigInt(pool.pool.sqrt_price) + BigInt(swapResult.target_sqrt_price)) / 2n).toString();
        const tick = getTickAtSqrtPrice(BigInt(pool.pool.sqrt_price), poolKey.fee_tier.tick_spacing);
        pool.pool.current_tick_index = (simulatedNextTick + tick) / 2;
        simulatedNextTick = pool.pool.current_tick_index;
        simulatedNextSqrtPrice = BigInt(pool.pool.sqrt_price);
      }
    }

    let liquidityAfter = liquidity;
    if (sqrtPrice !== BigInt(pool.pool.sqrt_price)) {
      console.log(`[ZAPPER] There is a route through self`);
      zapResult = ZapInResult.InRangeHasRouteThroughSelf;
      if (simulatedNextTick > upperTick || simulatedNextTick < lowerTick) {
        console.log(`[ZAPPER] This route may make the position out of range`);
        zapResult = ZapInResult.InRangeHasRouteThroughSelfMayBecomeOutRange;

        // out range -> return message imediate instead of re-calculate
        const message: ZapInLiquidityResponse = {} as ZapInLiquidityResponse;
        message.result = zapResult;
        message.assetIn = parseAsset(tokenIn, amountIn);

        message.amountToX = amountInToX.toString();
        message.amountToY = amountInToY.toString();
        message.amountX = actualAmountXReceived.returnAmount;
        message.amountY = actualAmountYReceived.returnAmount;

        message.poolKey = poolKey;
        message.sqrtPrice = BigInt(pool.pool.sqrt_price);
        message.tickLowerIndex = lowerTick;
        message.tickUpperIndex = upperTick;
        const routesX = generateMessageSwapOperation([actualAmountXReceived], slippage);
        const routesY = generateMessageSwapOperation([actualAmountYReceived], slippage);
        let priceImpactX = 0;
        let priceImpactY = 0;
        routesX.forEach((route) => {
          priceImpactX += getPriceImpactAfterSwap({
            route: route,
            allPools,
            allTicks,
            allTickMaps
          });
        });
        routesY.forEach((route) => {
          priceImpactY += getPriceImpactAfterSwap({
            route: route,
            allPools,
            allTicks,
            allTickMaps
          });
        });
        message.priceImpactX = priceImpactX;
        message.priceImpactY = priceImpactY;

        message.routes = [...routesX, ...routesY];
        message.swapFee = 0;
        message.routes.forEach((route) => {
          route.operations.forEach((operation) => {
            message.swapFee += getFeeRate(operation);
          });
        });

        const res1 = getLiquidityByX(BigInt(amountInToX), lowerTick, upperTick, sqrtPrice, true);
        const res2 = getLiquidityByY(BigInt(amountInToY), lowerTick, upperTick, sqrtPrice, true);
        message.minimumLiquidity =
          res1.l > res2.l
            ? (BigInt(res2.l) * BigInt(100 - slippage)) / 100n
            : (BigInt(res1.l) * BigInt(100 - slippage)) / 100n;
        return message;
      }

      // re calculate m3
      console.log(`[ZAPPER] Recalculate to find the best option`);
      const { amount: yPerXAfter, liquidityAfter: l } = await getLiquidityByX(
        10n ** BigInt(tokenX.decimals),
        lowerTick,
        upperTick,
        BigInt(pool.pool.sqrt_price),
        true
      );
      liquidityAfter = l;
      m3 = shiftDecimal(BigInt(yPerXAfter.toString()), tokenY.decimals);
      // solve
      x = new BigDecimal(amountIn).div(m1.add(m2.mul(m3)));
      y = x.mul(m3);
      amountX = Math.round(x.toNumber());
      amountY = Math.round(y.toNumber());

      // get value of Token In
      amountInToX = BigInt(Math.round(x.mul(m1).toNumber()));
      amountInToY = BigInt(amountIn) - amountInToX;
    }

    const diffX = Math.abs(Number(actualAmountXReceived.returnAmount) - amountX) / amountX;
    const diffY = Math.abs(Number(actualAmountYReceived.returnAmount) - amountY) / amountY;
    if (diffX > this._devitation || diffY > this._devitation) {
      console.log(`[ZAPPER] Deviation is too high, re-calculate`);
      // > devitation, re-calculate
      const x1 = new BigDecimal(actualAmountXReceived.returnAmount);
      const y1 = new BigDecimal(actualAmountYReceived.returnAmount);
      const xPriceByY = await this.getPriceInfo({
        sourceAsset: tokenX,
        destAsset: tokenY
      });
      const m4 = shiftDecimal(BigInt(xPriceByY.returnAmount), tokenY.decimals);
      const deltaX = y1.sub(m3.mul(x1)).div(m3.add(m4));
      amountInToX += BigInt(Math.round(deltaX.mul(m1).toNumber()));
      amountInToY = BigInt(amountIn) - amountInToX;
    }

    // build messages
    const messages: ZapInLiquidityResponse = {} as ZapInLiquidityResponse;

    // API time: need to check
    let xRouteInfo: SmartRouteResponse;
    let yRouteInfo: SmartRouteResponse;
    xRouteInfo = await this.findRoute({
      sourceAsset: tokenIn,
      destAsset: tokenX,
      amount: amountInToX
    });
    yRouteInfo = await this.findRoute({
      sourceAsset: tokenIn,
      destAsset: tokenY,
      amount: amountInToY
    });

    // create message
    console.log("[ZAPPER] building message...");
    messages.result = result ? result.result : zapResult;
    messages.amountToX = amountInToX.toString();
    messages.amountToY = amountInToY.toString();
    messages.assetIn = parseAsset(tokenIn, amountIn);

    const minimumReceiveX = xRouteInfo.routes
      ? Math.trunc(new BigDecimal(xRouteInfo.returnAmount).mul((100 - slippage) / 100).toNumber()).toString()
      : xRouteInfo.returnAmount;
    const minimumReceiveY = yRouteInfo.routes
      ? Math.trunc(new BigDecimal(yRouteInfo.returnAmount).mul((100 - slippage) / 100).toNumber()).toString()
      : yRouteInfo.returnAmount;
    messages.minimumReceiveX = minimumReceiveX;
    messages.minimumReceiveY = minimumReceiveY;

    messages.poolKey = poolKey;
    messages.tickLowerIndex = lowerTick;
    messages.tickUpperIndex = upperTick;

    messages.amountX = xRouteInfo.returnAmount;
    messages.amountY = yRouteInfo.returnAmount;
    messages.sqrtPrice = BigInt(pool.pool.sqrt_price);

    const routesX = generateMessageSwapOperation([xRouteInfo], slippage);
    const routesY = generateMessageSwapOperation([yRouteInfo], slippage);
    let priceImpactX = 0;
    let priceImpactY = 0;
    routesX.forEach((route) => {
      priceImpactX += getPriceImpactAfterSwap({
        route: route,
        allPools,
        allTicks,
        allTickMaps
      });
    });
    routesY.forEach((route) => {
      priceImpactY += getPriceImpactAfterSwap({
        route: route,
        allPools,
        allTicks,
        allTickMaps
      });
    });
    messages.routes = [...routesX, ...routesY];
    messages.priceImpactX = priceImpactX;
    messages.priceImpactY = priceImpactY;

    messages.swapFee = 0;
    messages.routes.forEach((route) => {
      route.operations.forEach((operation) => {
        messages.swapFee += getFeeRate(operation);
      });
    });

    const res1 = getLiquidityByX(BigInt(amountInToX), lowerTick, upperTick, BigInt(pool.pool.sqrt_price), true);
    const res2 = getLiquidityByY(BigInt(amountInToY), lowerTick, upperTick, BigInt(pool.pool.sqrt_price), true);
    messages.minimumLiquidity =
      res1.l > res2.l
        ? (BigInt(res2.l) * BigInt(100 - slippage)) / 100n
        : (BigInt(res1.l) * BigInt(100 - slippage)) / 100n;

    return messages;
  }

  public async processZapOutPositionLiquidity({
    tokenId,
    owner,
    tokenOut,
    slippage = 1,
    allPools,
    allTicks,
    allTickMaps
  }: {
    tokenId: number;
    owner: string;
    tokenOut: TokenItemType;
    slippage?: number;
    allPools: Record<string, PoolWithPoolKey>;
    allTicks: Record<string, LiquidityTick[]>;
    allTickMaps: Record<string, Tickmap>;
  }): Promise<ZapOutLiquidityResponse> {
    try {
      // get position info
      const rewardAmounts: Record<string, bigint> = {};
      const positions = await this._handler.getPositions(owner);
      let index = 0;
      const position = positions.find((p, i) => {
        index = i;
        return p.token_id === tokenId;
      });
      const pool = await this._handler.getPool(position.pool_key);
      // calculate amount X and Y
      const res = calculateTokenAmounts(pool.pool, position);
      const amountX = res.x;
      const amountY = res.y;
      rewardAmounts[pool.pool_key.token_x] = amountX;
      rewardAmounts[pool.pool_key.token_y] = amountY;

      // TODO: incentives is left, no need to swap
      // calculate incentives
      // const incentives = await this._handler.positionIncentives(index, owner);
      // for (const incentive of incentives) {
      //   if (
      //     parseAssetInfo(incentive.info) === pool.pool_key.token_x ||
      //     parseAssetInfo(incentive.info) === pool.pool_key.token_y
      //   ) {
      //     rewardAmounts[parseAssetInfo(incentive.info)] = rewardAmounts[parseAssetInfo(incentive.info)]
      //       ? rewardAmounts[parseAssetInfo(incentive.info)] + BigInt(incentive.amount)
      //       : BigInt(incentive.amount);
      //   }
      // }

      // const routes: SmartRouteResponse[] = [];
      const xRouteInfo = await this.findRoute({
        sourceAsset: oraichainTokens.find((t) => extractAddress(t) === pool.pool_key.token_x),
        destAsset: tokenOut,
        amount: rewardAmounts[pool.pool_key.token_x]
      });
      const yRouteInfo = await this.findRoute({
        sourceAsset: oraichainTokens.find((t) => extractAddress(t) === pool.pool_key.token_y),
        destAsset: tokenOut,
        amount: rewardAmounts[pool.pool_key.token_y]
      });

      // build messages
      const messages: ZapOutLiquidityResponse = {} as ZapOutLiquidityResponse;
      messages.positionIndex = index;

      const minimumReceiveX = xRouteInfo.routes
        ? Math.trunc(new BigDecimal(xRouteInfo.returnAmount).mul((100 - slippage) / 100).toNumber()).toString()
        : xRouteInfo.returnAmount;
      const minimumReceiveY = yRouteInfo.routes
        ? Math.trunc(new BigDecimal(yRouteInfo.returnAmount).mul((100 - slippage) / 100).toNumber()).toString()
        : yRouteInfo.returnAmount;
      messages.minimumReceiveX = minimumReceiveX;
      messages.minimumReceiveY = minimumReceiveY;

      const routesX = generateMessageSwapOperation([xRouteInfo], slippage);
      const routesY = generateMessageSwapOperation([yRouteInfo], slippage);
      let priceImpactX = 0;
      let priceImpactY = 0;
      routesX.forEach((route) => {
        priceImpactX += getPriceImpactAfterSwap({
          route: route,
          allPools,
          allTicks,
          allTickMaps
        });
      });
      routesY.forEach((route) => {
        priceImpactY += getPriceImpactAfterSwap({
          route: route,
          allPools,
          allTicks,
          allTickMaps
        });
      });
      messages.priceImpactX = priceImpactX;
      messages.priceImpactY = priceImpactY;

      messages.routes = [...routesX, ...routesY];
      messages.swapFee = 0;
      messages.routes.forEach((route) => {
        route.operations.forEach((operation) => {
          messages.swapFee += getFeeRate(operation);
        });
      });

      messages.amountToX = BigInt(xRouteInfo.returnAmount);
      messages.amountToY = BigInt(yRouteInfo.returnAmount);

      return messages;
    } catch (e) {
      const message: ZapOutLiquidityResponse = {} as ZapOutLiquidityResponse;
      console.log(`error: ${e}`);
      if (e instanceof RouteNotFoundError) {
        message.result = ZapOutResult.NoRouteFound;
      } else {
        message.result = ZapOutResult.SomethingWentWrong;
      }
      return message;
    }
  }
}
