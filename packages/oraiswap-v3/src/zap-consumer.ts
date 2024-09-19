import { BigDecimal, oraichainTokens, TokenItemType } from "@oraichain/oraidex-common";
import { OraiswapV3Handler } from "./handler";
import {
  ActionRoute,
  CalculateSwapResult,
  PoolKey,
  RouteParams,
  SmartRouteConfig,
  SmartRouteResponse,
  ZapConfig,
  ZapInLiquidityResponse,
  ZapInResult,
  ZapOutLiquidityResponse,
  ZapOutResult
} from "./types";
import {
  getLiquidityByX,
  getMaxSqrtPrice,
  getMinSqrtPrice,
  getTickAtSqrtPrice,
  simulateSwap
} from "./wasm/oraiswap_v3_wasm";
import {
  buildZapOutMessage,
  calculateRewardAmounts,
  extractAddress,
  extractOraidexV3Actions,
  poolKeyToString,
  populateMessageZapIn,
  shiftDecimal
} from "./helpers";
import { Pool, PoolWithPoolKey } from "@oraichain/oraidex-contracts-sdk/build/OraiswapV3.types";
import { RouteNoLiquidity, RouteNotFoundError, SpamTooManyRequestsError } from "./error";

/** Read the flow chart below to understand the process of the ZapConsumer class easier
Flow ref: https://lucid.app/lucidchart/11f8ee36-ee71-4f46-8028-a953ac4f5e87/edit?viewport_loc=-3263%2C-2130%2C3114%2C1694%2C0_0&invitationId=inv_cbe9b842-b255-4c8a-824e-2bc78a6f3860
 */

/**
 * The ZapConsumer class is responsible for consuming the smart router API to find the best route for swapping tokens and provide/remove liquidity for specific pools & range.
 * It also simulates the swap off-chain to calculate the expected result of the swap.
 * @returns ZapConsumer
 * @constructor - create a new instance of the ZapConsumer
 * @param config - the configuration object for the ZapConsumer
 * @function handler - get the OraiswapV3Handler instance
 * @function findRoute - find the best route for swapping tokens
 * @function findZapRoutes - find the best routes for swapping tokens
 * @function simulateSwapOffChain - simulate the swap off-chain for the route which go through the target pool want to add liquidity
 * @function simulateSwapOffChainForRoute - go through the routes, simulate the swap off-chain for the route which go through the target pool want to add liquidity
 * @function processZapInWithSingleSide - process the zap in with a single side
 * @function processZapInPositionLiquidity - find routes, simulate swap, simulate liquidity can be added
 * @function processZapOutPositionLiquidity - find the best routes for removing liquidity
 */
export class ZapConsumer {
  private _router: string;
  private _handler: OraiswapV3Handler;
  private _smartRouteConfig: SmartRouteConfig;
  private _deviation: number;

  constructor(config: ZapConfig) {
    this._router = config.routerApi;
    this._handler = new OraiswapV3Handler(config.client, config.dexV3Address, config.multiCallAddress);
    this._smartRouteConfig = config.smartRouteConfig;
    this._deviation = config.deviation;
  }

  public get handler(): OraiswapV3Handler {
    return this._handler;
  }

  /**
   * Get the price info of the source asset to the destination asset
   * @param route - the route params
   * @returns SmartRouteResponse
   * @throws RouteNotFoundError
   * @throws SpamTooManyRequestsError
   * @throws Error
   */
  private async findRoute(route: RouteParams, isGetPrice: boolean = false): Promise<SmartRouteResponse> {
    const { sourceAsset, destAsset, amount } = route;
    if (sourceAsset.name === destAsset.name) {
      return { swapAmount: amount.toString(), returnAmount: amount.toString(), routes: [] };
    }

    const body = JSON.stringify({
      sourceAsset: extractAddress(sourceAsset),
      sourceChainId: sourceAsset.chainId,
      destAsset: extractAddress(destAsset),
      destChainId: destAsset.chainId,
      offerAmount: amount.toString(),
      swapOptions: this._smartRouteConfig.swapOptions
    });

    try {
      const res = await fetch(this._router, { method: "POST", body, headers: { "Content-Type": "application/json" } });

      // otherwise, if the res is not 200, throw an error because API calls limit is reached
      if (res.status !== 200) {
        throw new SpamTooManyRequestsError();
      }

      const response: SmartRouteResponse = await res.json();

      if (response.returnAmount === "0") {
        if (isGetPrice) {
          // maybe the amount of source is too small, try to increase the amount 
          const newAmount = BigInt(amount) * 10n;
          return await this.findRoute({ sourceAsset, destAsset, amount: newAmount }, true);
        }

        throw new RouteNoLiquidity();
      }

      return response;
    } catch (e) {
      console.error(`[ZapConsumer] getPriceInfo error: ${e}`);
      if (e instanceof SpamTooManyRequestsError || e instanceof RouteNoLiquidity) {
        throw e;
      } else {
        throw new RouteNotFoundError(`${sourceAsset.name} -> ${destAsset.name}`);
      }
    }
  }

  /**
   * Find the best routes
   * @param routeParams - the route array want to find
   * @returns SmartRouteResponse[]
   */
  private async findZapRoutes(routeParams: RouteParams[], isGetPrice: boolean = false): Promise<SmartRouteResponse[]> {
    const promises = routeParams.map((params) => this.findRoute(params, isGetPrice));
    return Promise.all(promises);
  }

  /**
   * Simulate the swap off-chain for the route which go through the target pool want to add liquidity
   * @param poolKey - pool key of the pool
   * @param pool - pool info
   * @param route - the route want to simulate
   * @returns result of the swap
   */
  private async simulateSwapOffChain(poolKey: PoolKey, pool: Pool, route: ActionRoute): Promise<CalculateSwapResult> {
    const isXToY = route.tokenOut === poolKey.token_x ? false : true;
    const tickMap = await this._handler.getFullTickmap(poolKey);
    const liquidityTicks = await this._handler.getAllLiquidityTicks(poolKey, tickMap);
    const liquidityChanges = liquidityTicks.map((tick) => ({
      ...tick,
      liquidity_change: BigInt(tick.liquidity_change)
    }));
    const poolInfo = {
      ...pool,
      liquidity: BigInt(pool.liquidity),
      sqrt_price: BigInt(pool.sqrt_price),
      fee_growth_global_x: BigInt(pool.fee_growth_global_x),
      fee_growth_global_y: BigInt(pool.fee_growth_global_y),
      fee_protocol_token_x: BigInt(pool.fee_protocol_token_x),
      fee_protocol_token_y: BigInt(pool.fee_protocol_token_y)
    };

    return simulateSwap(
      tickMap,
      poolKey.fee_tier,
      poolInfo,
      liquidityChanges,
      isXToY,
      BigInt(route.tokenOutAmount),
      false,
      isXToY ? getMinSqrtPrice(poolKey.fee_tier.tick_spacing) : getMaxSqrtPrice(poolKey.fee_tier.tick_spacing)
    );
  }

  /**
   * Go through the routes, simulate the swap off-chain for the route which go through the target pool want to add liquidity
   * @param routes - the routes want to simulate
   * @param poolKey - pool key of the pool
   * @param pool - pool info
   * @returns SmartRouteResponse[]
   */
  private async simulateSwapOffChainForRoute(routes: ActionRoute[], poolKey: PoolKey, pool: Pool) {
    for (const route of routes) {
      if (route.swapInfo.find((swap) => swap.poolId === poolKeyToString(poolKey))) {
        const swapResult = await this.simulateSwapOffChain(poolKey, pool, route);

        pool.sqrt_price = ((BigInt(pool.sqrt_price) + BigInt(swapResult.target_sqrt_price)) / 2n).toString();
        const tick = getTickAtSqrtPrice(BigInt(pool.sqrt_price), poolKey.fee_tier.tick_spacing);
        pool.current_tick_index = (pool.current_tick_index + tick) / 2;
      }
    }
  }

  /**
   * Process the zap in with a single side
   * @param params - the params for providing liquidity
   * @returns result of the zap in operation for single side position
   */
  private async processZapInWithSingleSide(params: {
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
  }): Promise<ZapInLiquidityResponse> {
    try {
      const {
        poolKey,
        pool,
        sqrtPrice,
        tokenIn,
        amountIn,
        lowerTick,
        upperTick,
        tokenX,
        tokenY,
        slippage = 1
      } = params;

      // Get the token need to swap to
      let tokenNeed: TokenItemType;
      let isTokenX: boolean = true;
      if (upperTick < pool.current_tick_index) {
        tokenNeed = tokenY;
        isTokenX = false;
      } else {
        tokenNeed = tokenX;
      }

      // Get the actual receive amount
      const actualReceive = await this.findRoute({
        sourceAsset: tokenIn,
        destAsset: tokenNeed,
        amount: BigInt(amountIn)
      });

      const routes: ActionRoute[] = extractOraidexV3Actions(actualReceive.routes);

      await this.simulateSwapOffChainForRoute(routes, poolKey, pool);

      let message: ZapInLiquidityResponse = {} as ZapInLiquidityResponse;

      populateMessageZapIn(
        message,
        actualReceive,
        actualReceive,
        BigInt(pool.sqrt_price),
        poolKey,
        lowerTick,
        upperTick,
        slippage,
        {
          isTokenX,
          isSingleSide: true
        }
      );

      if (sqrtPrice === BigInt(pool.sqrt_price)) {
        message.status = ZapInResult.OutRangeNoRouteThroughSelf;
        return message;
      }

      if (pool.current_tick_index < upperTick && pool.current_tick_index >= lowerTick) {
        message.status = ZapInResult.OutRangeHasRouteThroughSelfMayBecomeInRange;
        message.currentTick = pool.current_tick_index;
        message.currentSqrtPrice = pool.sqrt_price;
        return message;
      } else {
        message.status = ZapInResult.OutRangeHasRouteThroughSelf;
        return message;
      }
    } catch (e) {
      console.log(`[ZapConsumer] processZapInWithSingleSide error: ${e}`);
      throw e;
    }
  }

  /**
   * Find routes, simulate swap, simulate liquidity can be added
   * @param params - the params for providing liquidity
   * @returns result of the zap in operation
   */
  public async processZapInPositionLiquidity(params: {
    pool: PoolWithPoolKey;
    tokenIn: TokenItemType;
    amountIn: string;
    lowerTick: number;
    upperTick: number;
    tokenX: TokenItemType;
    tokenY: TokenItemType;
    slippage?: number;
  }): Promise<ZapInLiquidityResponse> {
    try {
      // take params
      const { pool, tokenIn, amountIn, lowerTick, upperTick, tokenX, tokenY, slippage = 1 } = params;

      // init message response
      const zapInResult: ZapInLiquidityResponse = {} as ZapInLiquidityResponse;
      zapInResult.poolKey = pool.pool_key;
      zapInResult.tickLowerIndex = lowerTick;
      zapInResult.tickUpperIndex = upperTick;

      // if the position is out range, call @processZapInWithSingleSide
      if (lowerTick >= pool.pool.current_tick_index || upperTick < pool.pool.current_tick_index) {
        const zapInSingleSideResult = await this.processZapInWithSingleSide({
          poolKey: pool.pool_key,
          pool: pool.pool,
          sqrtPrice: BigInt(pool.pool.sqrt_price),
          tokenIn,
          amountIn,
          lowerTick,
          upperTick,
          tokenX,
          tokenY,
          slippage
        });

        if (zapInSingleSideResult.status !== ZapInResult.OutRangeHasRouteThroughSelfMayBecomeInRange) {
          return zapInSingleSideResult;
        }

        pool.pool.current_tick_index = zapInSingleSideResult.currentTick;
        pool.pool.sqrt_price = zapInSingleSideResult.currentSqrtPrice;
        zapInResult.status = zapInSingleSideResult.status;
      }

      // snap start sqrt price for checking if the pool is changed
      const startSqrtPrice = BigInt(pool.pool.sqrt_price);

      // Calculate 1: based on yPerX in pool, X and Y price in tokenIn
      const { amount: yPerXAmount, l: liquidity } = getLiquidityByX(
        10n ** BigInt(tokenX.decimals),
        lowerTick,
        upperTick,
        BigInt(pool.pool.sqrt_price),
        true
      );
      let yPerX = shiftDecimal(BigInt(yPerXAmount.toString()), tokenY.decimals);
      let xPriceByTokenIn = new BigDecimal(1);
      let yPriceByTokenIn = new BigDecimal(1);
      let [getXPriceByTokenIn, getYPriceByTokenIn] = await this.findZapRoutes([
        {
          sourceAsset: tokenX,
          destAsset: tokenIn,
          amount: 10n ** BigInt(tokenX.decimals)
        },
        {
          sourceAsset: tokenY,
          destAsset: tokenIn,
          amount: 10n ** BigInt(tokenY.decimals)
        }
      ], true);

      const extendDecimalX = getXPriceByTokenIn.swapAmount.length - 1 - tokenIn.decimals;
      const extendDecimalY = getYPriceByTokenIn.swapAmount.length - 1 - tokenIn.decimals;

      if (![pool.pool_key.token_x, pool.pool_key.token_y].includes(extractAddress(tokenIn))) {
        xPriceByTokenIn = shiftDecimal(BigInt(getXPriceByTokenIn.returnAmount), tokenIn.decimals + extendDecimalX);
        yPriceByTokenIn = shiftDecimal(BigInt(getYPriceByTokenIn.returnAmount), tokenIn.decimals + extendDecimalY);
      } else {
        if (extractAddress(tokenIn) === pool.pool_key.token_x) {
          yPriceByTokenIn = shiftDecimal(BigInt(getYPriceByTokenIn.returnAmount), tokenIn.decimals + extendDecimalY);
        } else {
          xPriceByTokenIn = shiftDecimal(BigInt(getXPriceByTokenIn.returnAmount), tokenIn.decimals + extendDecimalX);
        }
      }

      let xResult = new BigDecimal(amountIn).div(xPriceByTokenIn.add(yPriceByTokenIn.mul(yPerX)));
      let yResult = xResult.mul(yPerX);
      let amountX = Math.round(xResult.toNumber());
      let amountY = Math.round(yResult.toNumber());
      let amountInToX = BigInt(Math.round(xResult.mul(xPriceByTokenIn).toNumber()));
      let amountInToY = BigInt(amountIn) - amountInToX;

      // After calculate equation, we have to get the actual amount received
      const [actualAmountXReceived, actualAmountYReceived] = await this.findZapRoutes([
        {
          sourceAsset: tokenIn,
          destAsset: tokenX,
          amount: amountInToX
        },
        {
          sourceAsset: tokenIn,
          destAsset: tokenY,
          amount: amountInToY
        }
      ]);
      const routes: ActionRoute[] = extractOraidexV3Actions([
        ...actualAmountXReceived.routes,
        ...actualAmountYReceived.routes
      ]);

      // if we don't have to calculate anything more, the result is InRangeNoRouteThroughSelf
      zapInResult.status = ZapInResult.InRangeNoRouteThroughSelf;

      // if the route go through the target pool, we have to simulate the swap off-chain for better accuracy
      await this.simulateSwapOffChainForRoute(routes, pool.pool_key, pool.pool);

      if (startSqrtPrice !== BigInt(pool.pool.sqrt_price)) {
        // if the sqrt price is changed, the result is InRangeHasRouteThroughSelf
        zapInResult.status = ZapInResult.InRangeHasRouteThroughSelf;

        if (pool.pool.current_tick_index >= upperTick || pool.pool.current_tick_index < lowerTick) {
          // if the pool is out range, the result is InRangeHasRouteThroughSelfMayBecomeOutRange
          zapInResult.status = ZapInResult.InRangeHasRouteThroughSelfMayBecomeOutRange;

          populateMessageZapIn(
            zapInResult,
            actualAmountXReceived,
            actualAmountYReceived,
            BigInt(pool.pool.sqrt_price),
            pool.pool_key,
            lowerTick,
            upperTick,
            slippage
          );
          return zapInResult;
        }

        // Calculate 2: based on xPerY in pool after simulate swap, X and Y price in tokenIn
        const { amount: yPerXAfter, liquidityAfter: l } = await getLiquidityByX(
          10n ** BigInt(tokenX.decimals),
          lowerTick,
          upperTick,
          BigInt(pool.pool.sqrt_price),
          true
        );
        yPerX = shiftDecimal(BigInt(yPerXAfter.toString()), tokenY.decimals);
        xResult = new BigDecimal(amountIn).div(xPriceByTokenIn.add(yPriceByTokenIn.mul(yPerX)));
        yResult = xResult.mul(yPerX);
        amountX = Math.round(xResult.toNumber());
        amountY = Math.round(yResult.toNumber());
        amountInToX = BigInt(Math.round(xResult.mul(xPriceByTokenIn).toNumber()));
        amountInToY = BigInt(amountIn) - amountInToX;
      }

      // Calculate 3: based on actual amount received, re-balance the result
      const diffX = Math.abs(Number(actualAmountXReceived.returnAmount) - amountX) / amountX;
      const diffY = Math.abs(Number(actualAmountYReceived.returnAmount) - amountY) / amountY;
      if (diffX > this._deviation || diffY > this._deviation) {
        const xAmount = new BigDecimal(actualAmountXReceived.returnAmount);
        const yAmount = new BigDecimal(actualAmountYReceived.returnAmount);
        const xPriceByYAmount = await this.findRoute({
          sourceAsset: tokenX,
          destAsset: tokenY,
          amount: 10n ** BigInt(tokenX.decimals)
        }, true);
        const extendDecimal = xPriceByYAmount.swapAmount.length - tokenY.decimals;
        const xPriceByY = shiftDecimal(BigInt(xPriceByYAmount.returnAmount), tokenY.decimals + extendDecimal);
        const deltaX = yAmount.sub(yPerX.mul(xAmount)).div(yPerX.add(xPriceByY));
        amountInToX += BigInt(Math.round(deltaX.mul(xPriceByTokenIn).toNumber()));
        amountInToY = BigInt(amountIn) - amountInToX;
      }

      const [xRouteInfo, yRouteInfo] = await this.findZapRoutes([
        {
          sourceAsset: tokenIn,
          destAsset: tokenX,
          amount: amountInToX
        },
        {
          sourceAsset: tokenIn,
          destAsset: tokenY,
          amount: amountInToY
        }
      ]);

      populateMessageZapIn(
        zapInResult,
        xRouteInfo,
        yRouteInfo,
        BigInt(pool.pool.sqrt_price),
        pool.pool_key,
        lowerTick,
        upperTick,
        slippage
      );

      return zapInResult;
    } catch (e) {
      console.log(`[ZapConsumer] processZapInPositionLiquidity error: ${e}`);
      throw e;
    }
  }

  /**
   * Find the best routes for removing liquidity
   * @param tokenId - the token id of the position
   * @param owner - the owner of the position
   * @param tokenOut - the token out
   * @param zapFee - the zap fee
   * @param slippage - the slippage
   * @returns result of the zap out operation
   */
  public async processZapOutPositionLiquidity({
    tokenId,
    owner,
    tokenOut,
    zapFee,
    slippage = 1
  }: {
    tokenId: number;
    owner: string;
    tokenOut: TokenItemType;
    zapFee: number;
    slippage?: number;
  }): Promise<ZapOutLiquidityResponse> {
    try {
      const positions = await this._handler.getPositions(owner);
      let index = 0;
      const position = positions.find((p, i) => {
        index = i;
        return p.token_id === tokenId;
      });
      const pool = await this._handler.getPool(position.pool_key);
      const { amountX, amountY } = calculateRewardAmounts(pool, position, zapFee);

      const [xRouteInfo, yRouteInfo] = await this.findZapRoutes([
        {
          sourceAsset: oraichainTokens.find((t) => extractAddress(t) === pool.pool_key.token_x) as TokenItemType,
          destAsset: tokenOut,
          amount: amountX
        },
        {
          sourceAsset: oraichainTokens.find((t) => extractAddress(t) === pool.pool_key.token_y) as TokenItemType,
          destAsset: tokenOut,
          amount: amountY
        }
      ]);

      return buildZapOutMessage(ZapOutResult.Success, index, xRouteInfo, yRouteInfo, slippage);
    } catch (e) {
      console.log(`[ZapConsumer] ZapOut error: ${e}`);
      throw e;
    }
  }
}
