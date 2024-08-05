import { Asset, OraiswapV3QueryClient } from "@oraichain/oraidex-contracts-sdk";
import {
  AllNftInfoResponse,
  Approval,
  ApprovedForAllResponse,
  ArrayOfTupleOfUint16AndUint64,
  FeeTier,
  LiquidityTick,
  OwnerOfResponse,
  PoolWithPoolKey,
  Position,
  PositionTick,
  QuoteResult,
  Tick
} from "@oraichain/oraidex-contracts-sdk/build/OraiswapV3.types";
import { PoolKey, Tickmap, getMaxTick, getMinTick, positionToTick } from "@oraichain/oraiswap-v3-wasm";
import {
  CHUNK_QUERY,
  CHUNK_SIZE,
  LIQUIDITY_TICKS_LIMIT,
  MAX_TICKMAP_QUERY_SIZE,
  ORAISWAP_V3_CONTRACT,
  POSITION_TICKS_LIMIT
} from "./const";
import {
  calculateLiquidityForPair,
  calculateLiquidityForRanges,
  parse,
  parsePoolKey,
  poolKeyToString,
  queryChunk
} from "./helpers";
import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { PositionLiquidInfo, VirtualRange } from "./types";

// TODO!: add docs

export class OraiswapV3Handler {
  private _client: OraiswapV3QueryClient;

  constructor(client: CosmWasmClient, address: string = ORAISWAP_V3_CONTRACT) {
    this._client = new OraiswapV3QueryClient(client, address);
  }

  /// ->> NEW CODE
  public async getAdmin(): Promise<string> {
    return await this._client.admin();
  }

  public async getProtocolFee(): Promise<number> {
    return await this._client.protocolFee();
  }

  public async getPosition(owner: string, posIndex: number) {
    return await this._client.position({ ownerId: owner, index: posIndex });
  }

  public async getPositions(owner: string): Promise<Position[]> {
    const length = await this.getPositionLength(owner);
    return await queryChunk(CHUNK_QUERY, this._client.positions, { ownerId: owner });
  }

  public async feeTierExist(feeTier: FeeTier): Promise<boolean> {
    return await this._client.feeTierExist({
      feeTier
    });
  }

  public async getPool(poolKey: PoolKey): Promise<PoolWithPoolKey> {
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

  public async getPools(): Promise<PoolWithPoolKey[]> {
    return await queryChunk(CHUNK_QUERY, this._client.pools, {});
  }

  public async getTick(poolKey: PoolKey, tickIndex: number): Promise<Tick> {
    return await this._client.tick({ key: poolKey, index: tickIndex });
  }

  public async isTickInitialized(poolKey: PoolKey, tickIndex: number): Promise<boolean> {
    return await this._client.isTickInitialized({ key: poolKey, index: tickIndex });
  }

  public async getFeeTiers(): Promise<FeeTier[]> {
    return await this._client.feeTiers();
  }

  public async getPositionTicks(owner: string): Promise<PositionTick[]> {
    const positionTicks: PositionTick[] = [];
    const positonsLength = await this.getPositionLength(owner);

    for (let i = 0; i < positonsLength; i += POSITION_TICKS_LIMIT) {
      const res = await this._client.positionTicks({
        owner,
        offset: i
      });
      positionTicks.push(...res);
    }

    return positionTicks;
  }

  public async getPositionLength(owner: string): Promise<number> {
    return await this._client.userPositionAmount({ owner });
  }

  public async tickMap(
    poolKey: PoolKey,
    lowerTickIndex: number,
    upperTickIndex: number,
    xToY: boolean
  ): Promise<ArrayOfTupleOfUint16AndUint64> {
    return await this._client.tickMap({
      poolKey,
      lowerTickIndex,
      upperTickIndex,
      xToY
    });
  }

  public async liquidityTicks(poolKey: PoolKey, tickIndexes: number[]): Promise<LiquidityTick[]> {
    const liquidityTicks: LiquidityTick[] = [];

    for (let i = 0; i < tickIndexes.length; i += LIQUIDITY_TICKS_LIMIT) {
      const res = await this._client.liquidityTicks({
        poolKey,
        tickIndexes: tickIndexes.slice(i, i + LIQUIDITY_TICKS_LIMIT)
      });
      liquidityTicks.push(...res);
    }

    return liquidityTicks;
  }

  /// get number of tick initialized from lowerTickIndex to upperTickIndex
  public async liquidityTicksAmount(poolKey: PoolKey, upperTickIndex: number, lowerTickIndex: number): Promise<number> {
    return await this._client.liquidityTicksAmount({
      poolKey,
      upperTick: upperTickIndex,
      lowerTick: lowerTickIndex
    });
  }

  // get all pools that have token0 and token1, no need to limit cause number of feeTiers is small enough
  public async poolsForPair(token0: string, token1: string): Promise<PoolWithPoolKey[]> {
    return await this._client.poolsForPair({ token0, token1 });
  }

  public async quote(
    poolKey: PoolKey,
    xToY: boolean,
    amount: string,
    byAmountIn: boolean,
    sqrtPriceLimit: string
  ): Promise<QuoteResult> {
    return await this._client.quote({
      poolKey,
      xToY,
      amount,
      byAmountIn,
      sqrtPriceLimit
    });
  }

  public async ownerOf(tokenId: number, includeExpored: boolean = false): Promise<OwnerOfResponse> {
    return await this._client.ownerOf({ tokenId, includeExpired: includeExpored });
  }

  public async approveForAll(owner: string, includeExpired: boolean = false): Promise<Approval[]> {
    const approvals: Approval[] = [];

    for (let i = 0; i < length; i += CHUNK_QUERY) {
      const res = (await this._client.approvedForAll({
        owner,
        startAfter: i.toString(),
        limit: CHUNK_QUERY,
        includeExpired
      })).operators;
      approvals.push(...res);
    }

    return approvals;
  }

  public async nftInfo(tokenId: number): Promise<Position> {
    return (await this._client.nftInfo({ tokenId })).extension;
  }

  public async allNftInfo(tokenId: number): Promise<AllNftInfoResponse> {
    return (await this._client.allNftInfo({ tokenId }));
  }

  public async tokens(owner: string): Promise<number[]> {
    const tokens: number[] = [];
    const numTokens = await this.numTokens();

    for (let i = 0; i < numTokens; i += CHUNK_QUERY) {
      const res = (await this._client.tokens({ owner, startAfter: i, limit: CHUNK_QUERY })).tokens;
      tokens.push(...res);
    }

    return tokens; 
  }

  public async allTokens(): Promise<number[]> {
    const tokens: number[] = [];
    const numTokens = await this.numTokens();

    for (let i = 0; i < numTokens; i += CHUNK_QUERY) {
      const res = (await this._client.allTokens({ startAfter: i, limit: CHUNK_QUERY })).tokens;
      tokens.push(...res);
    }

    return tokens;
  }

  public async numTokens(): Promise<number> {
    return (await this._client.numTokens()).count;
  }

  public async positionIncentives(index: number, owner: string): Promise<Asset[]> {
    return (await this._client.positionIncentives({ index, ownerId: owner }));
  }

  // public async poolsByPoolKeys(poolKeys: PoolKey[]): Promise<PoolWithPoolKey[]> {
  //   const pools = await this._client.poolsByPoolKeys({ poolKeys });
  //   return pools;
  // }

  // public async allPositions(): Promise<Position[]> {
  //   return await queryChunk(CHUNK_QUERY, this._client.allPositions, {});
  // }

  /// ->> OLD CODE
  public async getPoolList(): Promise<PoolWithPoolKey[]> {
    return await this._client.pools({});
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

    const pos: PositionLiquidInfo[] = calculateLiquidityForRanges(liquidityTicks as any, tickArray);

    return await calculateLiquidityForPair(pos, BigInt(pool.pool.sqrt_price));
  }
}
