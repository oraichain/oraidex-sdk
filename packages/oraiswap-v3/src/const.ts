import {
  getChunkSize,
  getLiquidityDenominator,
  getLiquidityTicksLimit,
  getMaxTickmapQuerySize,
  getPriceDenominator
} from "./wasm/oraiswap_v3_wasm";

export const ORAISWAP_V3_CONTRACT = "orai10s0c75gw5y5eftms5ncfknw6lzmx0dyhedn75uz793m8zwz4g8zq4d9x9a";

export const DENOMINATOR = 10n ** 12n;
export const LIQUIDITY_DENOMINATOR = getLiquidityDenominator();
export const PRICE_DENOMINATOR = getPriceDenominator();
export const MAX_TICKMAP_QUERY_SIZE = getMaxTickmapQuerySize();
export const CHUNK_SIZE = getChunkSize();
export const LIQUIDITY_TICKS_LIMIT = getLiquidityTicksLimit();
export const CHUNK_QUERY = 100;
export const POSITION_TICKS_LIMIT = 372;
