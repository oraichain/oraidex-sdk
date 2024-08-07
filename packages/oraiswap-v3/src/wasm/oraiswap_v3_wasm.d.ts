/* tslint:disable */
/* eslint-disable */
/**
* @param {SqrtPrice} current_sqrt_price
* @param {SqrtPrice} target_sqrt_price
* @param {Liquidity} liquidity
* @param {TokenAmount} amount
* @param {boolean} by_amount_in
* @param {Percentage} fee
* @returns {SwapResult}
*/
export function computeSwapStep(current_sqrt_price: SqrtPrice, target_sqrt_price: SqrtPrice, liquidity: Liquidity, amount: TokenAmount, by_amount_in: boolean, fee: Percentage): SwapResult;
/**
* @param {SqrtPrice} sqrt_price_a
* @param {SqrtPrice} sqrt_price_b
* @param {Liquidity} liquidity
* @param {boolean} rounding_up
* @returns {TokenAmount}
*/
export function getDeltaX(sqrt_price_a: SqrtPrice, sqrt_price_b: SqrtPrice, liquidity: Liquidity, rounding_up: boolean): TokenAmount;
/**
* @param {SqrtPrice} sqrt_price_a
* @param {SqrtPrice} sqrt_price_b
* @param {Liquidity} liquidity
* @param {boolean} rounding_up
* @returns {TokenAmount}
*/
export function getDeltaY(sqrt_price_a: SqrtPrice, sqrt_price_b: SqrtPrice, liquidity: Liquidity, rounding_up: boolean): TokenAmount;
/**
* @param {SqrtPrice} starting_sqrt_price
* @param {Liquidity} liquidity
* @param {TokenAmount} amount
* @param {boolean} x_to_y
* @returns {SqrtPrice}
*/
export function getNextSqrtPriceFromInput(starting_sqrt_price: SqrtPrice, liquidity: Liquidity, amount: TokenAmount, x_to_y: boolean): SqrtPrice;
/**
* @param {SqrtPrice} starting_sqrt_price
* @param {Liquidity} liquidity
* @param {TokenAmount} amount
* @param {boolean} x_to_y
* @returns {SqrtPrice}
*/
export function getNextSqrtPriceFromOutput(starting_sqrt_price: SqrtPrice, liquidity: Liquidity, amount: TokenAmount, x_to_y: boolean): SqrtPrice;
/**
* @param {SqrtPrice} starting_sqrt_price
* @param {Liquidity} liquidity
* @param {TokenAmount} x
* @param {boolean} add_x
* @returns {SqrtPrice}
*/
export function getNextSqrtPriceXUp(starting_sqrt_price: SqrtPrice, liquidity: Liquidity, x: TokenAmount, add_x: boolean): SqrtPrice;
/**
* @param {SqrtPrice} starting_sqrt_price
* @param {Liquidity} liquidity
* @param {TokenAmount} y
* @param {boolean} add_y
* @returns {SqrtPrice}
*/
export function getNextSqrtPriceYDown(starting_sqrt_price: SqrtPrice, liquidity: Liquidity, y: TokenAmount, add_y: boolean): SqrtPrice;
/**
* @param {number} current_tick_index
* @param {SqrtPrice} current_sqrt_price
* @param {Liquidity} liquidity_delta
* @param {boolean} liquidity_sign
* @param {number} upper_tick
* @param {number} lower_tick
* @returns {AmountDeltaResult}
*/
export function calculateAmountDelta(current_tick_index: number, current_sqrt_price: SqrtPrice, liquidity_delta: Liquidity, liquidity_sign: boolean, upper_tick: number, lower_tick: number): AmountDeltaResult;
/**
* @param {TokenAmount} amount
* @param {SqrtPrice} starting_sqrt_price
* @param {Liquidity} liquidity
* @param {Percentage} fee
* @param {boolean} by_amount_in
* @param {boolean} x_to_y
* @returns {boolean}
*/
export function isEnoughAmountToChangePrice(amount: TokenAmount, starting_sqrt_price: SqrtPrice, liquidity: Liquidity, fee: Percentage, by_amount_in: boolean, x_to_y: boolean): boolean;
/**
* @param {number} tick_spacing
* @returns {Liquidity}
*/
export function calculateMaxLiquidityPerTick(tick_spacing: number): Liquidity;
/**
* @param {number} tick_lower
* @param {number} tick_upper
* @param {number} tick_spacing
*/
export function checkTicks(tick_lower: number, tick_upper: number, tick_spacing: number): void;
/**
* @param {number} tick_index
* @param {number} tick_spacing
*/
export function checkTick(tick_index: number, tick_spacing: number): void;
/**
* @param {TokenAmount} expected_amount_out
* @param {Percentage} slippage
* @returns {TokenAmount}
*/
export function calculateMinAmountOut(expected_amount_out: TokenAmount, slippage: Percentage): TokenAmount;
/**
* @param {number} tick
* @param {number} tick_spacing
* @returns {PositionResult}
*/
export function tickToPositionJs(tick: number, tick_spacing: number): PositionResult;
/**
* @param {number} chunk
* @param {number} bit
* @param {number} tick_spacing
* @returns {number}
*/
export function positionToTick(chunk: number, bit: number, tick_spacing: number): number;
/**
* @returns {bigint}
*/
export function getGlobalMaxSqrtPrice(): bigint;
/**
* @returns {bigint}
*/
export function getGlobalMinSqrtPrice(): bigint;
/**
* @returns {number}
*/
export function getTickSearchRange(): number;
/**
* @param {number} tick_spacing
* @returns {number}
*/
export function getMaxChunk(tick_spacing: number): number;
/**
* @returns {number}
*/
export function getChunkSize(): number;
/**
* @returns {number}
*/
export function getMaxTickCross(): number;
/**
* @returns {number}
*/
export function getMaxTickmapQuerySize(): number;
/**
* @returns {number}
*/
export function getLiquidityTicksLimit(): number;
/**
* @returns {number}
*/
export function getMaxPoolKeysReturned(): number;
/**
* @returns {number}
*/
export function getMaxPoolPairsReturned(): number;
/**
* @param {number} lower_tick_index
* @param {FeeGrowth} lower_tick_fee_growth_outside_x
* @param {FeeGrowth} lower_tick_fee_growth_outside_y
* @param {number} upper_tick_index
* @param {FeeGrowth} upper_tick_fee_growth_outside_x
* @param {FeeGrowth} upper_tick_fee_growth_outside_y
* @param {number} pool_current_tick_index
* @param {FeeGrowth} pool_fee_growth_global_x
* @param {FeeGrowth} pool_fee_growth_global_y
* @param {FeeGrowth} position_fee_growth_inside_x
* @param {FeeGrowth} position_fee_growth_inside_y
* @param {Liquidity} position_liquidity
* @returns {TokenAmounts}
*/
export function calculateFee(lower_tick_index: number, lower_tick_fee_growth_outside_x: FeeGrowth, lower_tick_fee_growth_outside_y: FeeGrowth, upper_tick_index: number, upper_tick_fee_growth_outside_x: FeeGrowth, upper_tick_fee_growth_outside_y: FeeGrowth, pool_current_tick_index: number, pool_fee_growth_global_x: FeeGrowth, pool_fee_growth_global_y: FeeGrowth, position_fee_growth_inside_x: FeeGrowth, position_fee_growth_inside_y: FeeGrowth, position_liquidity: Liquidity): TokenAmounts;
/**
* @param {string} token_candidate
* @param {string} token_to_compare
* @returns {boolean}
*/
export function isTokenX(token_candidate: string, token_to_compare: string): boolean;
/**
* @param {number} tick_index
* @param {number} tick_spacing
* @param {SqrtPrice} sqrt_price
* @returns {boolean}
*/
export function checkTickToSqrtPriceRelationship(tick_index: number, tick_spacing: number, sqrt_price: SqrtPrice): boolean;
/**
* @param {number} accurate_tick
* @param {number} tick_spacing
* @returns {number}
*/
export function alignTickToSpacing(accurate_tick: number, tick_spacing: number): number;
/**
* @param {SqrtPrice} sqrt_price
* @param {number} tick_spacing
* @returns {number}
*/
export function getTickAtSqrtPrice(sqrt_price: SqrtPrice, tick_spacing: number): number;
/**
* @param {TokenAmount} x
* @param {number} lower_tick
* @param {number} upper_tick
* @param {SqrtPrice} current_sqrt_price
* @param {boolean} rounding_up
* @returns {SingleTokenLiquidity}
*/
export function getLiquidityByX(x: TokenAmount, lower_tick: number, upper_tick: number, current_sqrt_price: SqrtPrice, rounding_up: boolean): SingleTokenLiquidity;
/**
* @param {TokenAmount} y
* @param {number} lower_tick
* @param {number} upper_tick
* @param {SqrtPrice} current_sqrt_price
* @param {boolean} rounding_up
* @returns {SingleTokenLiquidity}
*/
export function getLiquidityByY(y: TokenAmount, lower_tick: number, upper_tick: number, current_sqrt_price: SqrtPrice, rounding_up: boolean): SingleTokenLiquidity;
/**
* @param {Percentage} fee
* @param {number} tick_spacing
* @returns {FeeTier}
*/
export function newFeeTier(fee: Percentage, tick_spacing: number): FeeTier;
/**
* @param {string} token_0
* @param {string} token_1
* @param {FeeTier} fee_tier
* @returns {PoolKey}
*/
export function newPoolKey(token_0: string, token_1: string, fee_tier: FeeTier): PoolKey;
/**
* @param {Tickmap} tickmap
* @param {FeeTier} fee_tier
* @param {Pool} pool
* @param {LiquidityTickVec} ticks
* @param {boolean} x_to_y
* @param {TokenAmount} amount
* @param {boolean} by_amount_in
* @param {SqrtPrice} sqrt_price_limit
* @returns {CalculateSwapResult}
*/
export function simulateSwap(tickmap: Tickmap, fee_tier: FeeTier, pool: Pool, ticks: LiquidityTickVec, x_to_y: boolean, amount: TokenAmount, by_amount_in: boolean, sqrt_price_limit: SqrtPrice): CalculateSwapResult;
/**
* @returns {bigint}
*/
export function getFeeGrowthScale(): bigint;
/**
* @returns {bigint}
*/
export function getFeeGrowthDenominator(): bigint;
/**
* @param {bigint} integer
* @param {number | undefined} [scale]
* @returns {bigint}
*/
export function toFeeGrowth(integer: bigint, scale?: number): bigint;
/**
* @returns {bigint}
*/
export function getFixedPointScale(): bigint;
/**
* @returns {bigint}
*/
export function getFixedPointDenominator(): bigint;
/**
* @param {bigint} integer
* @param {number | undefined} [scale]
* @returns {bigint}
*/
export function toFixedPoint(integer: bigint, scale?: number): bigint;
/**
* @returns {bigint}
*/
export function getLiquidityScale(): bigint;
/**
* @returns {bigint}
*/
export function getLiquidityDenominator(): bigint;
/**
* @param {bigint} integer
* @param {number | undefined} [scale]
* @returns {bigint}
*/
export function toLiquidity(integer: bigint, scale?: number): bigint;
/**
* @returns {bigint}
*/
export function getPercentageScale(): bigint;
/**
* @returns {bigint}
*/
export function getPercentageDenominator(): bigint;
/**
* @param {bigint} integer
* @param {number | undefined} [scale]
* @returns {bigint}
*/
export function toPercentage(integer: bigint, scale?: number): bigint;
/**
* @returns {bigint}
*/
export function getPriceScale(): bigint;
/**
* @returns {bigint}
*/
export function getPriceDenominator(): bigint;
/**
* @param {bigint} integer
* @param {number | undefined} [scale]
* @returns {bigint}
*/
export function toPrice(integer: bigint, scale?: number): bigint;
/**
* @returns {bigint}
*/
export function getSecondsPerLiquidityScale(): bigint;
/**
* @returns {bigint}
*/
export function getSecondsPerLiquidityDenominator(): bigint;
/**
* @param {bigint} integer
* @param {number | undefined} [scale]
* @returns {bigint}
*/
export function toSecondsPerLiquidity(integer: bigint, scale?: number): bigint;
/**
* @returns {bigint}
*/
export function getSqrtPriceScale(): bigint;
/**
* @returns {bigint}
*/
export function getSqrtPriceDenominator(): bigint;
/**
* @param {bigint} integer
* @param {number | undefined} [scale]
* @returns {bigint}
*/
export function toSqrtPrice(integer: bigint, scale?: number): bigint;
/**
* @param {number} tick_index
* @returns {SqrtPrice}
*/
export function calculateSqrtPrice(tick_index: number): SqrtPrice;
/**
* @param {number} tick_spacing
* @returns {number}
*/
export function getMaxTick(tick_spacing: number): number;
/**
* @param {number} tick_spacing
* @returns {number}
*/
export function getMinTick(tick_spacing: number): number;
/**
* @param {number} tick_spacing
* @returns {SqrtPrice}
*/
export function getMaxSqrtPrice(tick_spacing: number): SqrtPrice;
/**
* @param {number} tick_spacing
* @returns {SqrtPrice}
*/
export function getMinSqrtPrice(tick_spacing: number): SqrtPrice;
/**
* @returns {bigint}
*/
export function getTokenAmountScale(): bigint;
/**
* @returns {bigint}
*/
export function getTokenAmountDenominator(): bigint;
/**
* @param {bigint} integer
* @param {number | undefined} [scale]
* @returns {bigint}
*/
export function toTokenAmount(integer: bigint, scale?: number): bigint;
/**
*/
export enum SwapError {
  NotAdmin = 0,
  NotFeeReceiver = 1,
  PoolAlreadyExist = 2,
  PoolNotFound = 3,
  TickAlreadyExist = 4,
  InvalidTickIndexOrTickSpacing = 5,
  PositionNotFound = 6,
  TickNotFound = 7,
  FeeTierNotFound = 8,
  PoolKeyNotFound = 9,
  AmountIsZero = 10,
  WrongLimit = 11,
  PriceLimitReached = 12,
  NoGainSwap = 13,
  InvalidTickSpacing = 14,
  FeeTierAlreadyExist = 15,
  PoolKeyAlreadyExist = 16,
  UnauthorizedFeeReceiver = 17,
  ZeroLiquidity = 18,
  TransferError = 19,
  TokensAreSame = 20,
  AmountUnderMinimumAmountOut = 21,
  InvalidFee = 22,
  NotEmptyTickDeinitialization = 23,
  InvalidInitTick = 24,
  InvalidInitSqrtPrice = 25,
  TickLimitReached = 26,
  NoRouteFound = 27,
  MaxTicksCrossed = 28,
  StateOutdated = 29,
  InsufficientLiquidity = 30,
}
export interface AmountDeltaResult {
    x: TokenAmount;
    y: TokenAmount;
    update_liquidity: boolean;
}

export interface SwapResult {
    next_sqrt_price: SqrtPrice;
    amount_in: TokenAmount;
    amount_out: TokenAmount;
    fee_amount: TokenAmount;
}

export interface Tickmap {
    bitmap: Map<bigint,bigint>;
}

export interface PositionResult {
    chunk: number;
    bit: number;
}

export interface SwapHop {
    pool_key: PoolKey;
    x_to_y: boolean;
}

export interface QuoteResult {
    amount_in: TokenAmount;
    amount_out: TokenAmount;
    target_sqrt_price: SqrtPrice;
    ticks: Tick[];
}

export interface TokenAmounts {
    x: TokenAmount;
    y: TokenAmount;
}

export interface SingleTokenLiquidity {
    l: Liquidity;
    amount: TokenAmount;
}

export interface Config {
    admin: string;
    protocol_fee: Percentage;
}

export interface FeeTier {
    fee: Percentage;
    tick_spacing: number;
}

export interface Pool {
    liquidity: Liquidity;
    sqrt_price: SqrtPrice;
    current_tick_index: number;
    fee_growth_global_x: FeeGrowth;
    fee_growth_global_y: FeeGrowth;
    fee_protocol_token_x: TokenAmount;
    fee_protocol_token_y: TokenAmount;
    start_timestamp: number;
    last_timestamp: number;
    fee_receiver: string;
}

export interface PoolKey {
    token_x: string;
    token_y: string;
    fee_tier: FeeTier;
}

export interface Position {
    pool_key: PoolKey;
    liquidity: Liquidity;
    lower_tick_index: number;
    upper_tick_index: number;
    fee_growth_inside_x: FeeGrowth;
    fee_growth_inside_y: FeeGrowth;
    last_block_number: number;
    tokens_owed_x: TokenAmount;
    tokens_owed_y: TokenAmount;
}

export interface Tick {
    index: number;
    sign: boolean;
    liquidity_change: Liquidity;
    liquidity_gross: Liquidity;
    sqrt_price: SqrtPrice;
    fee_growth_outside_x: FeeGrowth;
    fee_growth_outside_y: FeeGrowth;
    seconds_outside: number;
}

export interface PositionTick {
    index: number;
    fee_growth_outside_x: FeeGrowth;
    fee_growth_outside_y: FeeGrowth;
    seconds_outside: number;
}

export interface LiquidityTick {
    index: number;
    liquidity_change: Liquidity;
    sign: boolean;
}

export type LiquidityTickVec = LiquidityTick[];

export type FeeGrowth = bigint;

export type FixedPoint = bigint;

export type Liquidity = bigint;

export type Percentage = number;

export type Price = bigint;

export type SecondsPerLiquidity = bigint;

export type SqrtPrice = bigint;

export type TokenAmount = bigint;

export interface CalculateSwapResult {
    amount_in: TokenAmount;
    amount_out: TokenAmount;
    fee: TokenAmount;
    start_sqrt_price: SqrtPrice;
    target_sqrt_price: SqrtPrice;
    crossed_ticks: LiquidityTick[];
    global_insufficient_liquidity: boolean;
    state_outdated: boolean;
    max_ticks_crossed: boolean;
}


export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly computeSwapStep: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
  readonly getDeltaX: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly getDeltaY: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly getNextSqrtPriceFromInput: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly getNextSqrtPriceFromOutput: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly getNextSqrtPriceXUp: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly getNextSqrtPriceYDown: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly calculateAmountDelta: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
  readonly isEnoughAmountToChangePrice: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
  readonly calculateMaxLiquidityPerTick: (a: number) => number;
  readonly checkTicks: (a: number, b: number, c: number, d: number) => void;
  readonly checkTick: (a: number, b: number, c: number) => void;
  readonly calculateMinAmountOut: (a: number, b: number) => number;
  readonly tickToPositionJs: (a: number, b: number, c: number) => void;
  readonly positionToTick: (a: number, b: number, c: number) => number;
  readonly getGlobalMaxSqrtPrice: () => number;
  readonly getGlobalMinSqrtPrice: () => number;
  readonly getTickSearchRange: () => number;
  readonly getMaxChunk: (a: number) => number;
  readonly getChunkSize: () => number;
  readonly getMaxTickCross: () => number;
  readonly getMaxTickmapQuerySize: () => number;
  readonly getLiquidityTicksLimit: () => number;
  readonly getMaxPoolKeysReturned: () => number;
  readonly getMaxPoolPairsReturned: () => number;
  readonly calculateFee: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number) => void;
  readonly isTokenX: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly checkTickToSqrtPriceRelationship: (a: number, b: number, c: number, d: number) => void;
  readonly alignTickToSpacing: (a: number, b: number) => number;
  readonly getTickAtSqrtPrice: (a: number, b: number, c: number) => void;
  readonly getLiquidityByX: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
  readonly getLiquidityByY: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
  readonly newFeeTier: (a: number, b: number, c: number) => void;
  readonly newPoolKey: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
  readonly simulateSwap: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => void;
  readonly getFeeGrowthScale: () => number;
  readonly getFeeGrowthDenominator: () => number;
  readonly toFeeGrowth: (a: number, b: number) => number;
  readonly getFixedPointScale: () => number;
  readonly getFixedPointDenominator: () => number;
  readonly toFixedPoint: (a: number, b: number) => number;
  readonly getLiquidityScale: () => number;
  readonly getLiquidityDenominator: () => number;
  readonly toLiquidity: (a: number, b: number) => number;
  readonly getPercentageDenominator: () => number;
  readonly toPercentage: (a: number, b: number) => number;
  readonly getPriceScale: () => number;
  readonly getPriceDenominator: () => number;
  readonly toPrice: (a: number, b: number) => number;
  readonly toSecondsPerLiquidity: (a: number, b: number) => number;
  readonly toSqrtPrice: (a: number, b: number) => number;
  readonly calculateSqrtPrice: (a: number, b: number) => void;
  readonly getMaxTick: (a: number) => number;
  readonly getMinTick: (a: number) => number;
  readonly getMaxSqrtPrice: (a: number) => number;
  readonly getMinSqrtPrice: (a: number) => number;
  readonly getTokenAmountScale: () => number;
  readonly getTokenAmountDenominator: () => number;
  readonly toTokenAmount: (a: number, b: number) => number;
  readonly getSecondsPerLiquidityDenominator: () => number;
  readonly getSqrtPriceDenominator: () => number;
  readonly getPercentageScale: () => number;
  readonly getSecondsPerLiquidityScale: () => number;
  readonly getSqrtPriceScale: () => number;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
  readonly __wbindgen_exn_store: (a: number) => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {SyncInitInput} module
*
* @returns {InitOutput}
*/
export function initSync(module: SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {InitInput | Promise<InitInput>} module_or_path
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: InitInput | Promise<InitInput>): Promise<InitOutput>;
