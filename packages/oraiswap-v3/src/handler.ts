import { Asset, OraiswapV3QueryClient } from "@oraichain/oraidex-contracts-sdk";
import {
  AllNftInfoResponse,
  Approval,
  ArrayOfTupleOfUint16AndUint64,
  FeeTier,
  LiquidityTick,
  OwnerOfResponse,
  PoolKey,
  PoolWithPoolKey,
  Position,
  PositionTick,
  QuoteResult,
  Tick
} from "@oraichain/oraidex-contracts-sdk/build/OraiswapV3.types";
import { CHUNK_QUERY, LIQUIDITY_TICKS_LIMIT, ORAISWAP_V3_CONTRACT, POSITION_TICKS_LIMIT } from "./const";
import { calculateTokenAmounts, parsePoolKey, poolKeyToString } from "./helpers";
import { CosmWasmClient, fromBinary, toBinary } from "@cosmjs/cosmwasm-stargate";
import { MulticallQueryClient } from "@oraichain/common-contracts-sdk";
import { MULTICALL_CONTRACT } from "@oraichain/oraidex-common";

export class OraiswapV3Handler {
  private _client: OraiswapV3QueryClient;
  private _multicall: MulticallQueryClient;

  constructor(
    client: CosmWasmClient,
    address: string = ORAISWAP_V3_CONTRACT,
    multicallAddress: string = MULTICALL_CONTRACT
  ) {
    this._client = new OraiswapV3QueryClient(client, address);
    this._multicall = new MulticallQueryClient(client, multicallAddress);
  }

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
    let positions: Position[] = [];

    while (true) {
      const res = await this._client.positions({
        ownerId: owner,
        limit: CHUNK_QUERY,
        offset: positions.length
      });
      if (res.length < CHUNK_QUERY) {
        positions.push(...res);
        break;
      } else {
        positions.push(...res);
      }
    }

    return positions;
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
    const pools: PoolWithPoolKey[] = [];

    while (true) {
      const res = await this._client.pools({
        limit: CHUNK_QUERY,
        startAfter: pools.length == 0 ? undefined : pools[pools.length - 1].pool_key
      });
      if (res.length < CHUNK_QUERY) {
        pools.push(...res);
        break;
      } else {
        pools.push(...res);
      }
    }

    return pools;
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

    while (tickIndexes.length > 0) {
      const res = await this._client.liquidityTicks({
        poolKey,
        tickIndexes: tickIndexes.splice(0, LIQUIDITY_TICKS_LIMIT)
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

    while (true) {
      const res = (
        await this._client.approvedForAll({
          owner,
          includeExpired: includeExpired,
          limit: CHUNK_QUERY,
          startAfter: approvals.length == 0 ? undefined : approvals[approvals.length - 1].spender
        })
      ).operators;
      if (res.length < CHUNK_QUERY) {
        approvals.push(...res);
        break;
      } else {
        approvals.push(...res);
      }
    }

    return approvals;
  }

  public async nftInfo(tokenId: number): Promise<Position> {
    return (await this._client.nftInfo({ tokenId })).extension;
  }

  public async allNftInfo(tokenId: number): Promise<AllNftInfoResponse> {
    return await this._client.allNftInfo({ tokenId });
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

    while (tokens.length < numTokens) {
      const res = (
        await this._client.allTokens({
          startAfter: tokens.length == 0 ? undefined : tokens[tokens.length - 1],
          limit: CHUNK_QUERY
        })
      ).tokens;
      tokens.push(...res);
    }

    return tokens;
  }

  public async numTokens(): Promise<number> {
    return (await this._client.numTokens()).count;
  }

  public async positionIncentives(index: number, owner: string): Promise<Asset[]> {
    return await this._client.positionIncentives({ index, ownerId: owner });
  }

  public async poolsByPoolKeys(poolKeys: PoolKey[]): Promise<PoolWithPoolKey[]> {
    const pools = await this._client.poolsByPoolKeys({ poolKeys });
    return pools;
  }

  public async allPositions(): Promise<Position[]> {
    const positions: Position[] = [];

    const allTokens = await this.allTokens();
    while (true) {
      const tokens = allTokens.splice(0, 40);
      const res = await this._multicall.aggregate({
        queries: tokens.map((tokenId) => ({
          address: this._client.contractAddress,
          data: toBinary({
            nft_info: {
              token_id: tokenId
            }
          })
        }))
      });

      tokens.map((tokenId, ind) => {
        const position = fromBinary(res.return_data[ind].data);
        positions.push(position.extension);
      });

      if (allTokens.length == 0) {
        break;
      }
    }

    return positions;
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
    const allPositions = await this.allPositions();
    const positions = allPositions.filter((pos) => poolKeyToString(pos.pool_key) === poolKeyToString(pool.pool_key));

    let liquidityX = 0n;
    let liquidityY = 0n;
    for (const pos of positions) {
      const res = calculateTokenAmounts(pool.pool, pos);
      liquidityX += res.x;
      liquidityY += res.y;
    }

    return { liquidityX, liquidityY };
  }
}
