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
  ZapOutLiquidityResponse
} from "./types";
import {
  getLiquidityByX,
  getMaxSqrtPrice,
  getMaxTick,
  getMinSqrtPrice,
  getMinTick,
  positionToTick,
  simulateSwap
} from "./wasm/oraiswap_v3_wasm";
import {
  calculateTokenAmounts,
  extractAddress,
  generateMessageSwapOperation,
  parseAsset,
  poolKeyToString,
  shiftDecimal
} from "./helpers";
import { CHUNK_SIZE } from "./const";
import { ArrayOfTupleOfUint16AndUint64 } from "@oraichain/oraidex-contracts-sdk/build/OraiswapV3.types";

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
      return null;
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
      return null;
    }
  }

  public async getRawTickmap(
    poolKey: PoolKey,
    lowerTick: number,
    upperTick: number,
    xToY: boolean
  ): Promise<ArrayOfTupleOfUint16AndUint64> {
    const tickmaps = await this._handler.tickMap(poolKey, lowerTick, upperTick, xToY);
    return tickmaps;
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

  public async processZapInPositionLiquidity({
    poolKey,
    tokenIn,
    amountIn,
    lowerTick,
    upperTick,
    slippage = 1
  }: {
    poolKey: PoolKey;
    tokenIn: TokenItemType;
    amountIn: string;
    lowerTick: number;
    upperTick: number;
    slippage?: number;
  }): Promise<ZapInLiquidityResponse> {
    // get pool info
    const tokenX = oraichainTokens.find((t) => extractAddress(t) === poolKey.token_x);
    const tokenY = oraichainTokens.find((t) => extractAddress(t) === poolKey.token_y);
    console.log("===================================");
    console.log(`[ZAP-CONSUMER] Pool: ${tokenX.name}/${tokenY.name} - ${Number(poolKey.fee_tier.fee) / 10 ** 10}%`);
    console.log(`[ZAP-CONSUMER] Token In: ${tokenIn.name} - ${amountIn}`);
    const pool = await this._handler.getPool(poolKey);
    const sqrtPrice = BigInt(pool.pool.sqrt_price);

    // calculate rate of X and Y in the target range
    const { amount: yPerX } = await getLiquidityByX(
      10n ** BigInt(tokenX.decimals),
      lowerTick,
      upperTick,
      sqrtPrice,
      true
    );
    let m3 = shiftDecimal(BigInt(yPerX.toString()), tokenY.decimals);

    // get price rate by tokenIn
    let m1 = new BigDecimal(1); // xPrice
    let m2 = new BigDecimal(1); // yPrice

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
    console.log(`[ZAP-CONSUMER] First equation: m1=${m1.toNumber()}, m2=${m2.toNumber()}, m3=${m3.toNumber()}`);

    // solve
    let x = new BigDecimal(amountIn).div(m1.add(m2.mul(m3)));
    let y = x.mul(m3);
    let amountX = Math.round(x.toNumber());
    let amountY = Math.round(y.toNumber());

    // get value of Token In
    let amountInToX = BigInt(Math.round(x.mul(m1).toNumber()));
    let amountInToY = BigInt(amountIn) - amountInToX;
    console.log(
      `[ZAP-CONSUMER] Result 1: ${amountInToX} ${tokenIn.name} to ${amountX} ${tokenX.name}, ${amountInToY} ${tokenIn.name} to ${amountY} ${tokenY.name}`
    );

    // re-check
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
    console.log(
      `[ZAP-CONSUMER] Actual received: ${actualAmountXReceived.returnAmount} ${tokenX.name}, ${actualAmountYReceived.returnAmount} ${tokenY.name}`
    );

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
    let simulatedNextSqrtPrice = BigInt(pool.pool.sqrt_price);
    // console.dir(routes, { depth: null });
    for (const route of routes) {
      if (route.swapInfo.find((swap) => swap.poolId === poolKeyToString(poolKey))) {
        console.log(`[ZAP-CONSUMER] Found route go through current pool`);
        const isXToY = route.tokenOut === poolKey.token_x ? false : true;
        const amountOut = route.tokenOutAmount;
        const tickMap = await this.getFullTickmap(poolKey);
        const liquidityTicks = await this.getAllLiquidityTicks(poolKey, tickMap);
        const convertPool = {
          ...pool.pool,
          liquidity: BigInt(pool.pool.liquidity),
          sqrt_price: BigInt(pool.pool.sqrt_price),
          fee_growth_global_x: BigInt(pool.pool.fee_growth_global_x),
          fee_growth_global_y: BigInt(pool.pool.fee_growth_global_y),
          fee_protocol_token_x: BigInt(pool.pool.fee_protocol_token_x),
          fee_protocol_token_y: BigInt(pool.pool.fee_protocol_token_y)
        };
        // console.log({ amountOut });
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
        simulatedNextSqrtPrice = BigInt(pool.pool.sqrt_price);
      }
    }
    if (sqrtPrice !== BigInt(pool.pool.sqrt_price))
      console.log(`[ZAP-CONSUMER] Update pool sqrt price from ${sqrtPrice} to ${pool.pool.sqrt_price}`);

    // re calculate m3
    const { amount: yPerXAfter } = await getLiquidityByX(
      10n ** BigInt(tokenX.decimals),
      lowerTick,
      upperTick,
      BigInt(pool.pool.sqrt_price),
      true
    );
    m3 = shiftDecimal(BigInt(yPerXAfter.toString()), tokenY.decimals);
    // solve
    x = new BigDecimal(amountIn).div(m1.add(m2.mul(m3)));
    y = x.mul(m3);
    amountX = Math.round(x.toNumber());
    amountY = Math.round(y.toNumber());

    // get value of Token In
    amountInToX = BigInt(Math.round(x.mul(m1).toNumber()));
    amountInToY = BigInt(amountIn) - amountInToX;
    console.log(
      `[ZAP-CONSUMER] Result 2: ${amountInToX} ${tokenIn.name} to ${amountX} ${tokenX.name}, ${amountInToY} ${tokenIn.name} to ${amountY} ${tokenY.name}`
    );

    const diffX = Math.abs(Number(actualAmountXReceived.returnAmount) - amountX) / amountX;
    const diffY = Math.abs(Number(actualAmountYReceived.returnAmount) - amountY) / amountY;
    console.log(`[ZAP-CONSUMER] Difference: x=${diffX}, y=${diffY}`);
    if (diffX > this._devitation || diffY > this._devitation) {
      // > devitation, re-calculate
      console.log("[ZAP-CONSUMER] Re-calculate because of devitation");
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
      console.log(
        `[ZAP-CONSUMER] Result 3: ${amountInToX} ${tokenIn.name} to ${amountX} ${tokenX.name}, ${amountInToY} ${tokenIn} to ${amountY} ${tokenY.name}`
      );
    }

    // build messages
    console.log("[ZAP-CONSUMER] Build messages");
    const messages: ZapInLiquidityResponse = {} as ZapInLiquidityResponse;

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
    console.log(
      `[ZAP-CONSUMER] Final result: ${amountInToX} ${tokenIn.name} to ${xRouteInfo.returnAmount} ${tokenX.name}, ${amountInToY} ${tokenIn.name} to ${yRouteInfo.returnAmount} ${tokenY.name}`
    );

    // create message
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

    messages.operationToX = xRouteInfo.routes ? generateMessageSwapOperation(xRouteInfo) : [];
    messages.operationToY = yRouteInfo.routes ? generateMessageSwapOperation(yRouteInfo) : [];

    messages.poolKey = poolKey;
    messages.tickLowerIndex = lowerTick;
    messages.tickUpperIndex = upperTick;

    messages.amountX = xRouteInfo.returnAmount;
    messages.amountY = yRouteInfo.returnAmount;

    return messages;
  }

  public async processZapOutPositionLiquidity({
    tokenId,
    owner,
    tokenOut,
    slippage = 1
  }: {
    tokenId: number;
    owner: string;
    tokenOut: TokenItemType;
    slippage?: number;
  }): Promise<ZapOutLiquidityResponse> {
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

    // calculate incentives
    const incentives = await this._handler.positionIncentives(index, owner);
    for (const incentive of incentives) {
      if (
        parseAssetInfo(incentive.info) === pool.pool_key.token_x ||
        parseAssetInfo(incentive.info) === pool.pool_key.token_y
      ) {
        rewardAmounts[parseAssetInfo(incentive.info)] = rewardAmounts[parseAssetInfo(incentive.info)]
          ? rewardAmounts[parseAssetInfo(incentive.info)] + BigInt(incentive.amount)
          : BigInt(incentive.amount);
      }
    }

    // find best route
    const routes: SmartRouteResponse[] = [];
    // Object.keys(rewardAmounts).forEach(async (asset) => {
    //   if (asset !== tokenOut.name) {
    //     const route = await this.findRoute({
    //       sourceAsset: oraichainTokens.find((t) => extractAddress(t) === asset),
    //       destAsset: tokenOut,
    //       amount: rewardAmounts[asset]
    //     });
    //     if (route) {
    //       routes.push(route);
    //     }
    //   }
    // });
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
    const messages: ZapOutLiquidityResponse = null;
    messages.positionIndex = index;
    
    const minimumReceiveX = xRouteInfo.routes
      ? Math.trunc(new BigDecimal(xRouteInfo.returnAmount).mul((100 - slippage) / 100).toNumber()).toString()
      : xRouteInfo.returnAmount;
    const minimumReceiveY = yRouteInfo.routes
      ? Math.trunc(new BigDecimal(yRouteInfo.returnAmount).mul((100 - slippage) / 100).toNumber()).toString()
      : yRouteInfo.returnAmount;
    messages.minimumReceiveX = minimumReceiveX;
    messages.minimumReceiveY = minimumReceiveY;

    messages.operationFromX = xRouteInfo.routes ? generateMessageSwapOperation(xRouteInfo) : [];
    messages.operationFromY = yRouteInfo.routes ? generateMessageSwapOperation(yRouteInfo) : [];

    return messages;
  }
}
