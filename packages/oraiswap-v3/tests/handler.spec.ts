import { OraiswapV3Client, OraiswapV3Types } from "@oraichain/oraidex-contracts-sdk";
import { calculateSqrtPrice, newFeeTier, newPoolKey, toPercentage } from "@oraichain/oraiswap-v3-wasm";
import { client, createTokens, senderAddress } from "./test-common";
import fs from "fs";
import path from "path";
import { OraiswapV3Handler } from "../src";

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

    handler = new OraiswapV3Handler(client, dex.contractAddress);
  });

  it("getPairLiquidityValues", async () => {
    let feeTier = newFeeTier(protocol_fee, 10);
    await dex.addFeeTier({ feeTier });

    let initTick = 0;

    let initSqrtPrice = calculateSqrtPrice(initTick).toString();

    let initialAmount = (1e10).toString();
    let [tokenX, tokenY] = await createTokens(initialAmount, "tokenx", "tokeny");

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
    const poolList = await handler.getPoolList();

    const pool = poolList[0];

    expect(pool.pool_key).toEqual(poolKey);
    expect(protocolFee).toEqual(protocol_fee);

    const liquidityValues = await handler.getPairLiquidityValues(pool);
    expect(liquidityValues).toBeDefined();
  });
});
