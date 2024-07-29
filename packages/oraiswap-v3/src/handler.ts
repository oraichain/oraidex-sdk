import { OraiswapV3QueryClient } from "@oraichain/oraidex-contracts-sdk";
import {
  ArrayOfTupleOfUint16AndUint64,
  PoolWithPoolKey
} from "@oraichain/oraidex-contracts-sdk/build/OraiswapV3.types";
import { LiquidityTick, PoolKey, Tickmap, getMaxTick, getMinTick, positionToTick } from "@oraichain/oraiswap-v3-wasm";
import { CHUNK_SIZE, LIQUIDITY_TICKS_LIMIT, MAX_TICKMAP_QUERY_SIZE, ORAISWAP_V3_CONTRACT } from "./const";
import {
  calculateLiquidityForPair,
  calculateLiquidityForRanges,
  parse,
  parsePoolKey,
  poolKeyToString
} from "./helpers";
import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { PositionLiquidInfo, VirtualRange } from "./types";

// TODO!: add docs

export class OraiswapV3Handler {
  private _client: OraiswapV3QueryClient;

  constructor(client: CosmWasmClient, address: string = ORAISWAP_V3_CONTRACT) {
    this._client = new OraiswapV3QueryClient(client, address);
  }

  public async getPoolList(): Promise<PoolWithPoolKey[]> {
    return await this._client.pools({});
  }

  public async getProtocolFee(): Promise<number> {
    return await this._client.protocolFee();
  }

  public async getRawTickmap(
    poolKey: PoolKey,
    lowerTick: number,
    upperTick: number,
    xToY: boolean
  ): Promise<ArrayOfTupleOfUint16AndUint64> {
    const tickmaps = await this._client.tickMap({
      lowerTickIndex: lowerTick,
      upperTickIndex: upperTick,
      xToY,
      poolKey
    });
    return tickmaps;
  }

  public async getFullTickmap(poolKey: PoolKey): Promise<Tickmap> {
    const maxTick = getMaxTick(poolKey.fee_tier.tick_spacing);
    let lowerTick = getMinTick(poolKey.fee_tier.tick_spacing);

    const xToY = false;

    const promises = [];
    const tickSpacing = poolKey.fee_tier.tick_spacing;

    const jump = (MAX_TICKMAP_QUERY_SIZE - 3) * CHUNK_SIZE;

    while (lowerTick <= maxTick) {
      let nextTick = lowerTick + jump;
      const remainder = nextTick % tickSpacing;

      if (remainder > 0) {
        nextTick += tickSpacing - remainder;
      } else if (remainder < 0) {
        nextTick -= remainder;
      }

      let upperTick = nextTick;

      if (upperTick > maxTick) {
        upperTick = maxTick;
      }

      const result = this.getRawTickmap(poolKey, lowerTick, upperTick, xToY).then(
        (tickmap) => tickmap.map(([a, b]) => [BigInt(a), BigInt(b)]) as [bigint, bigint][]
      );
      promises.push(result);

      lowerTick = upperTick + tickSpacing;
    }

    const fullResult = (await Promise.all(promises)).flat(1);

    const storedTickmap = new Map<bigint, bigint>(fullResult);

    return { bitmap: storedTickmap };
  }

  public async getAllLiquidityTicks(poolKey: PoolKey, tickmap: Tickmap): Promise<LiquidityTick[]> {
    const tickIndexes: number[] = [];
    for (const [chunkIndex, chunk] of tickmap.bitmap.entries()) {
      for (let bit = 0; bit < CHUNK_SIZE; bit++) {
        const checkedBit = chunk & (1n << BigInt(bit));
        if (checkedBit) {
          const tickIndex = positionToTick(Number(chunkIndex), bit, poolKey.fee_tier.tick_spacing);
          tickIndexes.push(tickIndex);
        }
      }
    }
    const tickLimit = LIQUIDITY_TICKS_LIMIT;
    const promises: Promise<LiquidityTick[]>[] = [];
    for (let i = 0; i < tickIndexes.length; i += tickLimit) {
      promises.push(
        this._client
          .liquidityTicks({
            poolKey,
            tickIndexes: tickIndexes.slice(i, i + tickLimit).map(Number)
          })
          .then(parse)
      );
    }

    const tickResults = await Promise.all(promises);
    return tickResults.flat(1);
  }

  public async getPoolByPoolKeyStr(poolKeyStr: string): Promise<PoolWithPoolKey> {
    const poolKey = parsePoolKey(poolKeyStr);
    const pool = await this._client.pool({
      feeTier: poolKey.fee_tier,
      token0: poolKey.token_x,
      token1: poolKey.token_y
    });
    return {
      pool_key: poolKey,
      pool
    };
  }

  public async getPoolByPoolKeyListStr(poolKeyList: string[]): Promise<PoolWithPoolKey[]> {
    const promises = poolKeyList.map((poolKeyStr) => this.getPoolByPoolKeyStr(poolKeyStr));
    return await Promise.all(promises);
  }

  public async getPairLiquidityValues(pool: PoolWithPoolKey): Promise<{ liquidityX: bigint; liquidityY: bigint }> {
    const tickmap = await this.getFullTickmap(pool.pool_key);

    const liquidityTicks = await this.getAllLiquidityTicks(pool.pool_key, tickmap);

    const tickIndexes: number[] = [];
    for (const [chunkIndex, chunk] of tickmap.bitmap.entries()) {
      for (let bit = 0; bit < CHUNK_SIZE; bit++) {
        const checkedBit = chunk & (1n << BigInt(bit));
        if (checkedBit) {
          const tickIndex = positionToTick(Number(chunkIndex), bit, pool.pool_key.fee_tier.tick_spacing);
          tickIndexes.push(tickIndex);
        }
      }
    }

    const tickArray: VirtualRange[] = [];

    for (let i = 0; i < tickIndexes.length - 1; i++) {
      tickArray.push({
        lowerTick: tickIndexes[i],
        upperTick: tickIndexes[i + 1]
      });
    }

    const pos: PositionLiquidInfo[] = calculateLiquidityForRanges(liquidityTicks, tickArray);

    return await calculateLiquidityForPair(pos, BigInt(pool.pool.sqrt_price));
  }
}
