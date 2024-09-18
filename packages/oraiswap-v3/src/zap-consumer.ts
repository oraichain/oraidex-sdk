import { BigDecimal, oraichainTokens, parseAssetInfo, TokenItemType } from "@oraichain/oraidex-common";
import { OraiswapV3Handler } from "./handler";
import {
  ActionRoute,
  CalculateSwapResult,
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
  getMinSqrtPrice,
  getTickAtSqrtPrice,
  simulateSwap
} from "./wasm/oraiswap_v3_wasm";
import {
  buildZapOutMessage,
  calculateMinimumLiquidity,
  calculateRewardAmounts,
  calculateSwapFee,
  calculateTokenAmounts,
  extractAddress,
  extractOraidexV3Actions,
  generateMessageSwapOperation,
  getFeeRate,
  parseAsset,
  poolKeyToString,
  populateMessageZapIn,
  shiftDecimal
} from "./helpers";
import { Pool } from "@oraichain/oraidex-contracts-sdk/build/OraiswapV3.types";
import { RouteNotFoundError } from "./error";

/** Read the flow chart below to understand the process of the ZapConsumer
Flow ref: https://lucid.app/lucidchart/11f8ee36-ee71-4f46-8028-a953ac4f5e87/edit?viewport_loc=-3263%2C-2130%2C3114%2C1694%2C0_0&invitationId=inv_cbe9b842-b255-4c8a-824e-2bc78a6f3860
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

  private async findZapOutRoutes(
    pool: any,
    tokenOut: TokenItemType,
    rewardAmounts: Record<string, bigint>
  ): Promise<{
    xRouteInfo: SmartRouteResponse;
    yRouteInfo: SmartRouteResponse;
  }> {
    const xRouteInfoPromise = this.findRoute({
      sourceAsset: oraichainTokens.find((t) => extractAddress(t) === pool.pool_key.token_x),
      destAsset: tokenOut,
      amount: rewardAmounts[pool.pool_key.token_x]
    });
    const yRouteInfoPromise = this.findRoute({
      sourceAsset: oraichainTokens.find((t) => extractAddress(t) === pool.pool_key.token_y),
      destAsset: tokenOut,
      amount: rewardAmounts[pool.pool_key.token_y]
    });
    const [xRouteInfo, yRouteInfo] = await Promise.all([xRouteInfoPromise, yRouteInfoPromise]);
    return { xRouteInfo, yRouteInfo };
  }

  private async findZapInRoutes(
    tokenIn: TokenItemType,
    tokenX: TokenItemType,
    tokenY: TokenItemType,
    amountInToX: bigint,
    amountInToY: bigint
  ) {
    const xRouteInfoPromise = this.findRoute({
      sourceAsset: tokenIn,
      destAsset: tokenX,
      amount: amountInToX
    });
    const yRouteInfoPromise = this.findRoute({
      sourceAsset: tokenIn,
      destAsset: tokenY,
      amount: amountInToY
    });
    const [xRouteInfo, yRouteInfo] = await Promise.all([xRouteInfoPromise, yRouteInfoPromise]);
    return { xRouteInfo, yRouteInfo };
  }

  private async simulateSwapOffChain(poolKey: PoolKey, pool: Pool, route: ActionRoute): Promise<CalculateSwapResult> {
    const isXToY = route.tokenOut === poolKey.token_x ? false : true;
    const amountOut = route.tokenOutAmount;
    const tickMap = await this._handler.getFullTickmap(poolKey);
    const liquidityTicks = await this._handler.getAllLiquidityTicks(poolKey, tickMap);
    const convertLiquidityTicks = liquidityTicks.map((tick) => {
      return {
        ...tick,
        liquidity_change: BigInt(tick.liquidity_change),
      }
    });
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
      convertLiquidityTicks,
      isXToY,
      BigInt(amountOut),
      false,
      isXToY ? getMinSqrtPrice(poolKey.fee_tier.tick_spacing) : getMaxSqrtPrice(poolKey.fee_tier.tick_spacing)
    );
    return swapResult;
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
    slippage = 1
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

      const routes: ActionRoute[] = extractOraidexV3Actions(actualReceive.routes);

      let simulatedNextSqrtPrice = BigInt(pool.sqrt_price);
      let simulateNextTick = pool.current_tick_index;
      for (const route of routes) {
        if (route.swapInfo.find((swap) => swap.poolId === poolKeyToString(poolKey))) {
          const swapResult = await this.simulateSwapOffChain(poolKey, pool, route);

          pool.sqrt_price = ((BigInt(pool.sqrt_price) + BigInt(swapResult.target_sqrt_price)) / 2n).toString();
          const tick = getTickAtSqrtPrice(BigInt(pool.sqrt_price), poolKey.fee_tier.tick_spacing);
          pool.current_tick_index = (simulateNextTick + tick) / 2;
          simulatedNextSqrtPrice = BigInt(pool.sqrt_price);
          simulateNextTick = pool.current_tick_index;
        }
      }

      let message: ZapInLiquidityResponse = {} as ZapInLiquidityResponse;
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

      if (sqrtPrice === BigInt(pool.sqrt_price)) {
        message.result = ZapInResult.OutRangeNoRouteThroughSelf;
        return message;
      }

      if (simulateNextTick < upperTick && simulateNextTick >= lowerTick) {
        message.result = ZapInResult.OutRangeHasRouteThroughSelfMayBecomeInRange;
        message.currentTick = simulateNextTick;
        message.sqrtPrice = simulatedNextSqrtPrice;

        return message;
      } else {
        message.result = ZapInResult.OutRangeHasRouteThroughSelf;
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
    slippage = 1
  }: {
    poolKey: PoolKey;
    tokenIn: TokenItemType;
    tokenX: TokenItemType;
    tokenY: TokenItemType;
    amountIn: string;
    lowerTick: number;
    upperTick: number;
    slippage?: number;
  }): Promise<ZapInLiquidityResponse> {
    try {
      const pool = await this.handler.getPool(poolKey);
      const sqrtPrice = BigInt(pool.pool.sqrt_price);

      let zapResult: ZapInResult;
      let result: ZapInLiquidityResponse;

      if (lowerTick > pool.pool.current_tick_index || upperTick <= pool.pool.current_tick_index) {
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
          slippage
        });
      }

      if (result) {
        if (result.result !== ZapInResult.OutRangeHasRouteThroughSelfMayBecomeInRange) {
          return result;
        } else {
          pool.pool.current_tick_index = result.currentTick;
          pool.pool.sqrt_price = BigInt(pool.pool.sqrt_price).toString();
        }
      }

      const { amount: yPerX, l: liquidity } = getLiquidityByX(
        10n ** BigInt(tokenX.decimals),
        lowerTick,
        upperTick,
        sqrtPrice,
        true
      );
      let m3 = shiftDecimal(BigInt(yPerX.toString()), tokenY.decimals);
      let m1 = new BigDecimal(1);
      let m2 = new BigDecimal(1);
      const getXPriceByTokenInPromise = this.getPriceInfo({
        sourceAsset: tokenX,
        destAsset: tokenIn
      });
      const getYPriceByTokenInPromise = this.getPriceInfo({
        sourceAsset: tokenY,
        destAsset: tokenIn
      });
      const [getXPriceByTokenIn, getYPriceByTokenIn] = await Promise.all([
        getXPriceByTokenInPromise,
        getYPriceByTokenInPromise
      ]);
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
      let x = new BigDecimal(amountIn).div(m1.add(m2.mul(m3)));
      let y = x.mul(m3);
      let amountX = Math.round(x.toNumber());
      let amountY = Math.round(y.toNumber());
      let amountInToX = BigInt(Math.round(x.mul(m1).toNumber()));
      let amountInToY = BigInt(amountIn) - amountInToX;

      const actualAmountXReceivedPromise = this.findRoute({
        sourceAsset: tokenIn,
        destAsset: tokenX,
        amount: amountInToX
      });
      const actualAmountYReceivedPromise = this.findRoute({
        sourceAsset: tokenIn,
        destAsset: tokenY,
        amount: amountInToY
      });
      const [actualAmountXReceived, actualAmountYReceived] = await Promise.all([
        actualAmountXReceivedPromise,
        actualAmountYReceivedPromise
      ]);
      const routes: ActionRoute[] = extractOraidexV3Actions([
        ...actualAmountXReceived.routes,
        ...actualAmountYReceived.routes
      ]);

      zapResult = ZapInResult.InRangeNoRouteThroughSelf;
      let simulatedNextSqrtPrice = BigInt(pool.pool.sqrt_price);
      let simulatedNextTick = pool.pool.current_tick_index;
      for (const route of routes) {
        if (route.swapInfo.find((swap) => swap.poolId === poolKeyToString(poolKey))) {
          const swapResult = await this.simulateSwapOffChain(poolKey, pool.pool, route);

          pool.pool.sqrt_price = (
            (BigInt(pool.pool.sqrt_price) + BigInt(swapResult.target_sqrt_price)) /
            2n
          ).toString();
          const tick = getTickAtSqrtPrice(BigInt(pool.pool.sqrt_price), poolKey.fee_tier.tick_spacing);
          pool.pool.current_tick_index = (simulatedNextTick + tick) / 2;
          simulatedNextTick = pool.pool.current_tick_index;
          simulatedNextSqrtPrice = BigInt(pool.pool.sqrt_price);
        }
      }

      let liquidityAfter = liquidity;
      if (sqrtPrice !== BigInt(pool.pool.sqrt_price)) {
        zapResult = ZapInResult.InRangeHasRouteThroughSelf;
        if (simulatedNextTick > upperTick || simulatedNextTick < lowerTick) {
          zapResult = ZapInResult.InRangeHasRouteThroughSelfMayBecomeOutRange;

          const message: ZapInLiquidityResponse = {} as ZapInLiquidityResponse;
          message.result = zapResult;
          populateMessageZapIn(
            message,
            tokenIn,
            amountIn,
            amountInToX,
            amountInToY,
            actualAmountXReceived,
            actualAmountYReceived,
            poolKey,
            pool.pool,
            lowerTick,
            upperTick,
            slippage
          );
          calculateSwapFee(message);
          calculateMinimumLiquidity(
            message,
            actualAmountXReceived,
            actualAmountYReceived,
            lowerTick,
            upperTick,
            sqrtPrice,
            slippage
          );
          return message;
        }

        const { amount: yPerXAfter, liquidityAfter: l } = await getLiquidityByX(
          10n ** BigInt(tokenX.decimals),
          lowerTick,
          upperTick,
          BigInt(pool.pool.sqrt_price),
          true
        );
        liquidityAfter = l;
        m3 = shiftDecimal(BigInt(yPerXAfter.toString()), tokenY.decimals);
        x = new BigDecimal(amountIn).div(m1.add(m2.mul(m3)));
        y = x.mul(m3);
        amountX = Math.round(x.toNumber());
        amountY = Math.round(y.toNumber());
        amountInToX = BigInt(Math.round(x.mul(m1).toNumber()));
        amountInToY = BigInt(amountIn) - amountInToX;
      }

      const diffX = Math.abs(Number(actualAmountXReceived.returnAmount) - amountX) / amountX;
      const diffY = Math.abs(Number(actualAmountYReceived.returnAmount) - amountY) / amountY;
      if (diffX > this._deviation || diffY > this._deviation) {
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

      const { xRouteInfo, yRouteInfo } = await this.findZapInRoutes(tokenIn, tokenX, tokenY, amountInToX, amountInToY);

      const messages: ZapInLiquidityResponse = {} as ZapInLiquidityResponse;
      messages.result = result ? result.result : zapResult;

      populateMessageZapIn(
        messages,
        tokenIn,
        amountIn,
        amountInToX,
        amountInToY,
        xRouteInfo,
        yRouteInfo,
        poolKey,
        pool.pool,
        lowerTick,
        upperTick,
        slippage
      );
      calculateSwapFee(messages);
      calculateMinimumLiquidity(
        messages,
        xRouteInfo,
        yRouteInfo,
        lowerTick,
        upperTick,
        BigInt(pool.pool.sqrt_price),
        slippage
      );

      return messages;
    } catch (e) {
      console.log(`[ZapConsumer] processZapInPositionLiquidity error: ${e}`);
      const message: ZapInLiquidityResponse = {} as ZapInLiquidityResponse;
      if (e instanceof RouteNotFoundError) {
        message.result = ZapInResult.NoRouteFound;
      } else {
        message.result = ZapInResult.SomethingWentWrong;
      }
      return message;
    }
  }

  public async processZapOutPositionLiquidity({
    tokenId,
    owner,
    tokenOut,
    slippage = 1,
    zapFee
  }: {
    tokenId: number;
    owner: string;
    tokenOut: TokenItemType;
    slippage?: number;
    zapFee: number;
  }): Promise<ZapOutLiquidityResponse> {
    try {
      const rewardAmounts: Record<string, bigint> = {};
      const positions = await this._handler.getPositions(owner);
      let index = 0;
      const position = positions.find((p, i) => {
        index = i;
        return p.token_id === tokenId;
      });
      const pool = await this._handler.getPool(position.pool_key);
      const { amountX, amountY } = calculateRewardAmounts(pool, position, zapFee);

      rewardAmounts[pool.pool_key.token_x] = amountX;
      rewardAmounts[pool.pool_key.token_y] = amountY;

      const { xRouteInfo, yRouteInfo } = await this.findZapOutRoutes(pool, tokenOut, rewardAmounts);

      return buildZapOutMessage(ZapOutResult.Success, index, xRouteInfo, yRouteInfo, slippage);
    } catch (e) {
      const message: ZapOutLiquidityResponse = {} as ZapOutLiquidityResponse;
      console.log(`error: ${e}`);
      if (e instanceof RouteNotFoundError) {
        message.result = ZapOutResult.NoRouteFound;
      } else {
        message.result = ZapOutResult.SomethingWentWrong;
      }
    }
  }
}
