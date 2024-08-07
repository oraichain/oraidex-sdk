export interface SnapshotValueData {
  tokenBNFromBeginning: string;
  usdValue24: number;
}

export interface PoolSnapshot {
  timestamp: number;
  volumeX: SnapshotValueData;
  volumeY: SnapshotValueData;
  liquidityX: SnapshotValueData;
  liquidityY: SnapshotValueData;
  feeX: SnapshotValueData;
  feeY: SnapshotValueData;
}

export interface PoolStatsData {
  snapshots: PoolSnapshot[];
  tokenX: {
    address: string;
    decimals: number;
  };
  tokenY: {
    address: string;
    decimals: number;
  };
}

export interface TokenData {
  address: string;
  symbol: string;
  coinGeckoId?: string;
  decimals: number;
}

export interface VirtualRange {
  lowerTick: number;
  upperTick: number;
}

export interface PositionLiquidInfo {
  liquidity: bigint;
  upper_tick_index: number;
  lower_tick_index: number;
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
  bitmap: Map<bigint, bigint>;
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
  readonly isEnoughAmountToChangePrice: (
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
    g: number
  ) => void;
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
  readonly calculateFee: (
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
    g: number,
    h: number,
    i: number,
    j: number,
    k: number,
    l: number,
    m: number
  ) => void;
  readonly isTokenX: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly checkTickToSqrtPriceRelationship: (a: number, b: number, c: number, d: number) => void;
  readonly alignTickToSpacing: (a: number, b: number) => number;
  readonly getTickAtSqrtPrice: (a: number, b: number, c: number) => void;
  readonly getLiquidityByX: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
  readonly getLiquidityByY: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
  readonly newFeeTier: (a: number, b: number, c: number) => void;
  readonly newPoolKey: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
  readonly simulateSwap: (
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
    g: number,
    h: number,
    i: number
  ) => void;
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
