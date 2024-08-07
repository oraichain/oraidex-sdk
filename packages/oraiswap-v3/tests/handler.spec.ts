import { OraiswapV3Client, OraiswapV3Types } from "@oraichain/oraidex-contracts-sdk";
import { calculateSqrtPrice, getGlobalMinSqrtPrice, newFeeTier, newPoolKey, toPercentage } from "@oraichain/oraiswap-v3-wasm";
import { bobAddress, client, createTokens, senderAddress } from "./test-common";
import fs from "fs";
import path from "path";
import { OraiswapV3Handler, poolKeyToString } from "../src";
import { expect, afterAll, beforeAll, describe, it, beforeEach } from "vitest";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
console.log("__filename: ", __filename);
const __dirname = path.dirname(__filename);

describe("test oraiswap-v3 handler functions", () => {
  let protocol_fee = Number(toPercentage(6n, 3));

  let dex: OraiswapV3Client;

  let handler: OraiswapV3Handler;

  beforeEach(async () => {
    const { codeId: dexCodeId } = await client.upload(
      senderAddress,
      fs.readFileSync(path.resolve(__dirname, "data", "oraiswap-v3.wasm")),
      "auto"
    );

    const { codeId: multicalCodeId } = await client.upload(
      senderAddress,
      fs.readFileSync(path.resolve(__dirname, "data", "multicall.wasm")),
      "auto"
    );

    const { contractAddress: multicallAddress } = await client.instantiate(
      senderAddress,
      multicalCodeId,
      {},
      "multicall",
      "auto"
    );

    dex = new OraiswapV3Client(
      client,
      senderAddress,
      (
        await client.instantiate(
          senderAddress,
          dexCodeId,
          { protocol_fee } as OraiswapV3Types.InstantiateMsg,
          "oraiswap_v3",
          "auto"
        )
      ).contractAddress
    );

    handler = new OraiswapV3Handler(client, dex.contractAddress, multicallAddress);
  });

  it("getPairLiquidityValues", async () => {
    let feeTier = newFeeTier(protocol_fee, 10);
    await dex.addFeeTier({ feeTier });

    let initTick = 0;

    let initSqrtPrice = calculateSqrtPrice(initTick).toString();

    let initialAmount = (1e10).toString();
    let [tokenX, tokenY] = await createTokens(initialAmount, senderAddress, "tokenx", "tokeny");

    await dex.createPool({
      feeTier,
      initSqrtPrice,
      initTick,
      token0: tokenX.contractAddress,
      token1: tokenY.contractAddress
    });

    await tokenX.increaseAllowance({ amount: initialAmount, spender: dex.contractAddress });
    await tokenY.increaseAllowance({ amount: initialAmount, spender: dex.contractAddress });

    let poolKey = newPoolKey(tokenX.contractAddress, tokenY.contractAddress, feeTier);

    let lowerTickIndex = -20;
    let middleTickIndex = -10;
    let upperTickIndex = 10;
    let liquidityDelta = (1000000e6).toString();

    // createPosition (add liquidity)
    await dex.createPosition({
      poolKey,
      lowerTick: lowerTickIndex,
      upperTick: upperTickIndex,
      liquidityDelta,
      slippageLimitLower: "0",
      slippageLimitUpper: "340282366920938463463374607431768211455"
    });

    // createPosition (add liquidity)
    await dex.createPosition({
      poolKey,
      lowerTick: lowerTickIndex - 20,
      upperTick: middleTickIndex,
      liquidityDelta,
      slippageLimitLower: "0",
      slippageLimitUpper: "340282366920938463463374607431768211455"
    });

    const protocolFee = await handler.getProtocolFee();
    const poolList = await handler.getPools();

    const pool = poolList[0];

    expect(pool.pool_key).toEqual(poolKey);
    expect(protocolFee).toEqual(protocol_fee);

    const liquidityValues = await handler.getPairLiquidityValues(pool);
    expect(liquidityValues).toBeDefined();
  });

  it("getAdmin", async () => {
    const admin = await handler.getAdmin();
    expect(admin).toEqual(senderAddress);
  });

  describe("need init state test", () => {
    beforeEach(async () => {
      let feeTier = newFeeTier(protocol_fee, 10);
      await dex.addFeeTier({ feeTier });

      let initTick = 0;

      let initSqrtPrice = calculateSqrtPrice(initTick).toString();

      let initialAmount = (1e10).toString();
      let [tokenX, tokenY] = await createTokens(initialAmount, senderAddress, "tokenx", "tokeny");
      let [tokenZ] = await createTokens(initialAmount, dex.contractAddress, "tokenz");

      await dex.createPool({
        feeTier,
        initSqrtPrice,
        initTick,
        token0: tokenX.contractAddress,
        token1: tokenY.contractAddress
      });

      await tokenX.increaseAllowance({ amount: initialAmount, spender: dex.contractAddress });
      await tokenY.increaseAllowance({ amount: initialAmount, spender: dex.contractAddress });

      let poolKey = newPoolKey(tokenX.contractAddress, tokenY.contractAddress, feeTier);

      let lowerTickIndex = -20;
      let middleTickIndex = -10;
      let upperTickIndex = 10;
      let liquidityDelta = (1000000e6).toString();

      // createPosition (add liquidity)
      await dex.createPosition({
        poolKey,
        lowerTick: lowerTickIndex,
        upperTick: upperTickIndex,
        liquidityDelta,
        slippageLimitLower: "0",
        slippageLimitUpper: "340282366920938463463374607431768211455"
      });

      // createPosition (add liquidity)
      await dex.createPosition({
        poolKey,
        lowerTick: lowerTickIndex - 20,
        upperTick: middleTickIndex,
        liquidityDelta,
        slippageLimitLower: "0",
        slippageLimitUpper: "340282366920938463463374607431768211455"
      });

      await dex.createIncentive({
        poolKey,
        rewardPerSec: "1",
        rewardToken: {
          token: {
            contract_addr: tokenZ.contractAddress,
          }
        }, 
      });
    });

    it("getPositon", async () => {
      const poolList = await handler.getPools();
      const pool = poolList[0];

      const position = await handler.getPosition(senderAddress, 0);
      expect(position).toBeDefined();
    });

    it("getPositions", async () => {
      const positions = await handler.getPositions(senderAddress);
      expect(positions).toBeDefined();
    });

    it("feeTierExist", async () => {
      const expectedFee = newFeeTier(protocol_fee, 10);
      const feeTier = await handler.feeTierExist({
        fee: expectedFee.fee,
        tick_spacing: expectedFee.tick_spacing
      });
      expect(feeTier).toBeDefined();
    });

    it("getPool", async () => {
      const poolList = await handler.getPools();
      const pool = poolList[0];

      const poolWithPoolKey = await handler.getPool(pool.pool_key);
      expect(poolWithPoolKey).toBeDefined();
    });

    it("getTick", async () => {
      const poolList = await handler.getPools();
      const pool = poolList[0];

      const tick = await handler.getTick(pool.pool_key, 10);
      expect(tick).toBeDefined();
    });

    it("isTickInitialized", async () => {
      const poolList = await handler.getPools();
      const pool = poolList[0];

      const isTickInitialized = await handler.isTickInitialized(pool.pool_key, 10);
      expect(isTickInitialized).toBeDefined();
    });

    it("getFeeTiers", async () => {
      const feeTiers = await handler.getFeeTiers();
      expect(feeTiers).toBeDefined();
    });

    it("getPositionTicks", async () => {
      const positionTicks = await handler.getPositionTicks(senderAddress);
      expect(positionTicks).toBeDefined();
    });

    it("getPositionLength", async () => {
      const positionLength = await handler.getPositionLength(senderAddress);
      expect(positionLength).toBeDefined();
    });

    it("getTickMap", async () => {
      const poolList = await handler.getPools();
      const pool = poolList[0];

      const tickMap = await handler.tickMap(pool.pool_key, -20, 20, true);
      expect(tickMap).toBeDefined();
    });

    it("getLiquidityTicks", async () => {
      const poolList = await handler.getPools();
      const pool = poolList[0];

      const liquidityTicks = await handler.liquidityTicks(pool.pool_key, [-20, 10, 10]);
      expect(liquidityTicks).toBeDefined();
    });

    it("liquidityTicksAmount", async () => {
      const poolList = await handler.getPools();
      const pool = poolList[0];

      const liquidityTicksAmount = await handler.liquidityTicksAmount(pool.pool_key, 10, -20);
      expect(liquidityTicksAmount).toBeDefined();
    });

    it("poolsForPair", async () => {
      const poolList = await handler.getPools();
      const pool = poolList[0];

      const poolsForPair = await handler.poolsForPair(pool.pool_key.token_x, pool.pool_key.token_y);
      expect(poolsForPair).toBeDefined();
    });

    it("quote", async () => {
      const poolList = await handler.getPools();
      const pool = poolList[0];

      const quote = await handler.quote(pool.pool_key, true, "100", true, getGlobalMinSqrtPrice().toString());
      expect(quote).toBeDefined();
    });

    it("ownerOf", async () => {
      const ownerOf = await handler.ownerOf(1);
      expect(ownerOf).toBeDefined();
    });

    it("approveForAll", async () => {
      const poolList = await handler.getPools();
      const pool = poolList[0];
      await dex.approve({
        spender: bobAddress,
        tokenId: 1,
      })
      const approveForAll = await handler.approveForAll(senderAddress, true);
      expect(approveForAll).toBeDefined();
    });

    it("nftInfo", async () => {
      const poolList = await handler.getPools();
      const pool = poolList[0];

      const nftInfo = await handler.nftInfo(1);
      expect(nftInfo).toBeDefined();
    });

    it("allNftInfo", async () => {
      const allNftInfo = await handler.allNftInfo(1);
      expect(allNftInfo).toBeDefined();
    });

    it("tokens", async () => {
      const tokens = await handler.tokens(senderAddress);
      expect(tokens).toBeDefined();
    });

    it("positionIncentives", async () => {
      const poolList = await handler.getPools();
      const pool = poolList[0];

      const positionIncentives = await handler.positionIncentives(0, senderAddress);
      expect(positionIncentives).toBeDefined();
    });

    it("poolsByPoolKeys", async () => {
      const poolList = await handler.getPools();
      const pool = poolList[0];

      const poolsByPoolKeys = await handler.poolsByPoolKeys([pool.pool_key]);
      expect(poolsByPoolKeys).toBeDefined();
    });

    it("getPoolByPoolKeyStr", async () => {
      const poolList = await handler.getPools();
      const pool = poolList[0];

      const poolByPoolKeyStr = await handler.getPoolByPoolKeyStr(poolKeyToString(pool.pool_key));
      expect(poolByPoolKeyStr).toBeDefined();
    });

    it("getPoolByPoolKeyListStr", async () => {
      const poolList = await handler.getPools();
      const pool = poolList[0];

      const poolByPoolKeyListStr = await handler.getPoolByPoolKeyListStr([poolKeyToString(pool.pool_key)]);
      expect(poolByPoolKeyListStr).toBeDefined();
    });
  });
});
