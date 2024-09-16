/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  calculateAmountDelta,
  calculateSqrtPrice,
  getMaxSqrtPrice,
  getMinSqrtPrice,
  simulateSwap
} from "./wasm/oraiswap_v3_wasm";
import {
  AmountDeltaResult,
  LiquidityTick,
  PoolKey,
  PoolSnapshot,
  PoolStatsData,
  PositionLiquidInfo,
  SmartRouteResponse,
  Tickmap,
  TokenData,
  VirtualRange
} from "./types";
import { DENOMINATOR, LIQUIDITY_DENOMINATOR, PRICE_DENOMINATOR } from "./const";
import { Pool, PoolWithPoolKey, Position } from "@oraichain/oraidex-contracts-sdk/build/OraiswapV3.types";
import { BigDecimal, parseAssetInfoFromContractAddrOrDenom, TokenItemType } from "@oraichain/oraidex-common";
import { Asset, Route, SwapOperation } from "@oraichain/oraidex-contracts-sdk/build/Zapper.types";

export const getVolume = (pool: PoolWithPoolKey, protocolFee: number): { volumeX: bigint; volumeY: bigint } => {
  const feeDenominator = (BigInt(protocolFee) * BigInt(pool.pool_key.fee_tier.fee)) / DENOMINATOR;
  const volumeX = (BigInt(pool.pool.fee_protocol_token_x) * DENOMINATOR) / feeDenominator;
  const volumeY = (BigInt(pool.pool.fee_protocol_token_y) * DENOMINATOR) / feeDenominator;

  return { volumeX, volumeY };
};

export const getGlobalFee = (pool: PoolWithPoolKey, protocolFee: number): { feeX: bigint; feeY: bigint } => {
  const feeX = (BigInt(pool.pool.fee_protocol_token_x) * DENOMINATOR) / BigInt(protocolFee);
  const feeY = (BigInt(pool.pool.fee_protocol_token_y) * DENOMINATOR) / BigInt(protocolFee);

  return { feeX, feeY };
};

export const calculateLiquidityForRanges = (
  liquidityChanges: LiquidityTick[],
  tickRanges: VirtualRange[]
): PositionLiquidInfo[] => {
  let currentLiquidity = 0n;
  const rangeLiquidity = [];

  liquidityChanges.forEach((change) => {
    let liquidityChange = change.liquidity_change;
    if (!change.sign) {
      liquidityChange = -liquidityChange;
    }
    currentLiquidity += liquidityChange;

    tickRanges.forEach((range, index) => {
      if (change.index >= range.lowerTick && change.index < range.upperTick) {
        if (!rangeLiquidity[index]) {
          rangeLiquidity[index] = 0;
        }
        rangeLiquidity[index] = currentLiquidity;
      }
    });
  });

  return rangeLiquidity.map((liquidity, index) => ({
    lower_tick_index: tickRanges[index].lowerTick,
    upper_tick_index: tickRanges[index].upperTick,
    liquidity: liquidity
  }));
};

export function extractAddress(tokenInfo: TokenItemType) {
  return tokenInfo.contractAddress ? tokenInfo.contractAddress : tokenInfo.denom;
}

const isBoolean = (value: any): boolean => {
  return typeof value === "boolean";
};

const isNumber = (value: any): boolean => {
  return typeof value === "number";
};

const isArray = (value: any): boolean => {
  return Array.isArray(value);
};

const isObject = (value: any): boolean => {
  return typeof value === "object" && value !== null;
};

export const parse = (value: any) => {
  if (isArray(value)) {
    return value.map((element: any) => parse(element));
  }

  if (isObject(value)) {
    const newValue: { [key: string]: any } = {};

    Object.entries(value as { [key: string]: any }).forEach(([key, value]) => {
      newValue[key] = parse(value);
    });

    return newValue;
  }

  if (isBoolean(value) || isNumber(value)) {
    return value;
  }

  try {
    return BigInt(value);
  } catch (e) {
    return value;
  }
};

export const getX = (
  liquidity: bigint,
  upperSqrtPrice: bigint,
  currentSqrtPrice: bigint,
  lowerSqrtPrice: bigint
): bigint => {
  if (upperSqrtPrice <= 0n || currentSqrtPrice <= 0n || lowerSqrtPrice <= 0n) {
    throw new Error("Price cannot be lower or equal 0");
  }

  let denominator: bigint;
  let nominator: bigint;

  if (currentSqrtPrice >= upperSqrtPrice) {
    return 0n;
  } else if (currentSqrtPrice < lowerSqrtPrice) {
    denominator = (lowerSqrtPrice * upperSqrtPrice) / PRICE_DENOMINATOR;
    nominator = upperSqrtPrice - lowerSqrtPrice;
  } else {
    denominator = (upperSqrtPrice * currentSqrtPrice) / PRICE_DENOMINATOR;
    nominator = upperSqrtPrice - currentSqrtPrice;
  }

  return (liquidity * nominator) / denominator / LIQUIDITY_DENOMINATOR;
};

export const getY = (
  liquidity: bigint,
  upperSqrtPrice: bigint,
  currentSqrtPrice: bigint,
  lowerSqrtPrice: bigint
): bigint => {
  if (lowerSqrtPrice <= 0n || currentSqrtPrice <= 0n || upperSqrtPrice <= 0n) {
    throw new Error("Price cannot be 0");
  }

  let difference: bigint;
  if (currentSqrtPrice <= lowerSqrtPrice) {
    return 0n;
  } else if (currentSqrtPrice >= upperSqrtPrice) {
    difference = upperSqrtPrice - lowerSqrtPrice;
  } else {
    difference = currentSqrtPrice - lowerSqrtPrice;
  }

  return (liquidity * difference) / PRICE_DENOMINATOR / LIQUIDITY_DENOMINATOR;
};

export const calculateLiquidityForPair = async (positions: PositionLiquidInfo[], sqrt_price: bigint) => {
  let liquidityX = 0n;
  let liquidityY = 0n;
  for (const position of positions) {
    let xVal, yVal;

    try {
      xVal = getX(
        position.liquidity,
        calculateSqrtPrice(position.upper_tick_index),
        sqrt_price,
        calculateSqrtPrice(position.lower_tick_index)
      );
    } catch (error) {
      xVal = 0n;
    }

    try {
      yVal = getY(
        position.liquidity,
        calculateSqrtPrice(position.upper_tick_index),
        sqrt_price,
        calculateSqrtPrice(position.lower_tick_index)
      );
    } catch (error) {
      yVal = 0n;
    }

    liquidityX = liquidityX + xVal;
    liquidityY = liquidityY + yVal;
  }

  return { liquidityX, liquidityY };
};

export const poolKeyToString = (poolKey: PoolKey): string => {
  return poolKey.token_x + "-" + poolKey.token_y + "-" + poolKey.fee_tier.fee + "-" + poolKey.fee_tier.tick_spacing;
};

export const onlySnaps = (data: Record<string, PoolStatsData>): Record<string, PoolSnapshot[]> => {
  const newData: Record<string, PoolSnapshot[]> = {};

  Object.entries(data).forEach(([address, pool]) => {
    newData[address] = pool.snapshots.slice(-31);
  });

  return newData;
};

export const sliceSnaps = (
  data: Record<string, PoolSnapshot[]>,
  limit: number = 28,
  skip: number = 0
): Record<string, PoolSnapshot[]> => {
  const newData: Record<string, PoolSnapshot[]> = {};

  Object.entries(data).forEach(([address, pool]) => {
    const arr = pool.slice(-limit + skip);
    arr.splice(arr.length - skip, skip);
    newData[address] = arr;
  });

  return newData;
};

export const getUsdValue24 = (total: bigint, decimals: number, price: number, lastTotal: bigint): number => {
  const totalAmount = total - lastTotal;
  const totalPrice = formatWithDecimal(totalAmount.toString(), decimals.toString(), price.toString());

  return Number(totalPrice);
};

export const formatWithDecimal = (amountStr?: string, decimalStr?: string, priceUsd?: string) => {
  const amount = amountStr === undefined ? 0 : amountStr;
  const decimal = decimalStr === undefined ? new BigDecimal(1) : new BigDecimal(10 ** Number(decimalStr));
  const price = priceUsd === undefined ? 1 : Number(priceUsd);
  const amountDecimal = new BigDecimal(amount);
  const value = amountDecimal.div(decimal).valueOf();
  return value * price;
};

export const parsePoolKey = (poolKeyStr: string): PoolKey => {
  const [tokenX, tokenY, fee, tickSpacing] = poolKeyStr.split("-");
  return {
    token_x: tokenX,
    token_y: tokenY,
    fee_tier: {
      fee: Number(fee),
      tick_spacing: Number(tickSpacing)
    }
  };
};

export const calculateTokenAmounts = (pool: Pool, position: Position): AmountDeltaResult => {
  return _calculateTokenAmounts(pool, position, false);
};

export const _calculateTokenAmounts = (pool: Pool, position: Position, sign: boolean): AmountDeltaResult => {
  return calculateAmountDelta(
    pool.current_tick_index,
    BigInt(pool.sqrt_price),
    BigInt(position.liquidity),
    sign,
    position.upper_tick_index,
    position.lower_tick_index
  );
};

export const shiftDecimal = (value: bigint, decimals: number): BigDecimal => {
  const valueStr = value.toString().padStart(decimals + 1, "0"); // Pad with leading zeros if needed
  const intStr = valueStr.slice(0, -decimals) || "0"; // Retrieve integral part or default to "0"
  const decStr = valueStr.slice(-decimals); // Retrieve decimal part
  return new BigDecimal(`${intStr}.${decStr}`, decimals);
};

export const parseAsset = (token: TokenItemType, amount: string): Asset => {
  const info = token.contractAddress
    ? { token: { contract_addr: token.contractAddress } }
    : { native_token: { denom: token.denom } };
  return {
    amount,
    info
  };
};

export const generateMessageSwapOperation = (responses: SmartRouteResponse[], slippage: number): Route[] => {
  const flattenRoutes: Route[] = [];

  for (const response of responses) {
    if (!response.routes) continue;
    if (response.routes.length === 0) continue;

    const { routes, returnAmount, swapAmount } = response;

    for (const route of routes) {
      const { swapAmount, returnAmount, paths } = route;
      const operations: SwapOperation[] = [];
      for (const path of paths) {
        const { actions, chainId, tokenIn, tokenInAmount, tokenOut, tokenOutAmount, tokenOutChainId } = path;
        for (const action of actions) {
          const { protocol, swapInfo, tokenIn, tokenInAmount, tokenOut, tokenOutAmount, type } = action;
          let currTokenIn = parseAssetInfoFromContractAddrOrDenom(tokenIn);
          for (const swap of swapInfo) {
            const { poolId } = swap;
            const [tokenX, tokenY, fee, tickSpacing] = poolId.split("-");
            const tokenOut = parseAssetInfoFromContractAddrOrDenom(swap.tokenOut);
            if (tokenX && tokenY && fee && tickSpacing) {
              operations.push({
                swap_v3: {
                  pool_key: {
                    token_x: tokenX,
                    token_y: tokenY,
                    fee_tier: {
                      fee: Number(fee),
                      tick_spacing: Number(tickSpacing)
                    }
                  },
                  x_to_y: tokenY === swap.tokenOut
                }
              });
            } else {
              operations.push({
                orai_swap: {
                  offer_asset_info: currTokenIn,
                  ask_asset_info: tokenOut
                }
              });
            }
            currTokenIn = tokenOut;
          }
        }
      }
      flattenRoutes.push({
        offer_amount: swapAmount,
        operations,
        token_in: paths[0].tokenIn,
        minimum_receive: Math.round(Number(returnAmount) * (100 - slippage) / 100).toString()
      });
    }
  }

  return flattenRoutes;
};

export const getFeeRate = (operation: SwapOperation): number => {
  if ("orai_swap" in operation) {
    return 0.003;
  } else {
    return operation.swap_v3.pool_key.fee_tier.fee / 10 ** 12;
  }
};

export const calculatePriceImpact = (startingSqrtPrice: bigint, endingSqrtPrice: bigint): bigint => {
  const startingPrice = startingSqrtPrice * startingSqrtPrice;
  const endingPrice = endingSqrtPrice * endingSqrtPrice;
  let priceQuotient: bigint;
  if (endingPrice >= startingPrice) {
    priceQuotient = (DENOMINATOR * startingPrice) / endingPrice;
  } else {
    priceQuotient = (DENOMINATOR * endingPrice) / startingPrice;
  }
  return DENOMINATOR - priceQuotient;
};

// TODO: current work for only dexV3
export const getPriceImpactAfterSwap = ({
  route,
  allPools,
  allTickMaps,
  allTicks
}: {
  route: Route;
  allPools: Record<string, PoolWithPoolKey>;
  allTickMaps: Record<string, Tickmap>;
  allTicks: Record<string, LiquidityTick[]>;
}): number => {
  const { offer_amount, operations, token_in, minimum_receive } = route;

  let totalPriceImpact = 0n;
  let amountIn = BigInt(offer_amount);
  let tokenIn = token_in;
  operations.forEach((operation) => {
    const { swap_v3 } = operation as {
      swap_v3: {
        pool_key: PoolKey;
        x_to_y: boolean;
      };
    };

    const pool = allPools[poolKeyToString(swap_v3.pool_key)];
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
      allTickMaps[poolKeyToString(swap_v3.pool_key)],
      allPools[poolKeyToString(swap_v3.pool_key)].pool_key.fee_tier,
      convertPool,
      allTicks[poolKeyToString(swap_v3.pool_key)],
      swap_v3.x_to_y,
      amountIn,
      true,
      swap_v3.x_to_y
        ? getMinSqrtPrice(swap_v3.pool_key.fee_tier.tick_spacing)
        : getMaxSqrtPrice(swap_v3.pool_key.fee_tier.tick_spacing)
    );

    const priceImpact = calculatePriceImpact(
      BigInt(allPools[poolKeyToString(swap_v3.pool_key)].pool.sqrt_price),
      swapResult.sqrtPrice
    );
    totalPriceImpact += priceImpact;
    amountIn = swapResult.amountOut;
  });

  return Number(totalPriceImpact / BigInt(operations.length)) / 10 ** 12;
};
