import path from "path";
import { fileURLToPath } from "url";
import { ZapConsumer } from "../src/zap-consumer";
import {
  IncentivesFundManagerClient,
  OraiswapFactoryClient,
  OraiswapMixedRouterClient,
  OraiswapOracleClient,
  OraiswapTokenClient,
  OraiswapV3Client,
  OraiswapV3Types,
  ZapperClient
} from "@oraichain/oraidex-contracts-sdk";
import fs from "fs";
import { describe, it, beforeEach, expect } from "vitest";
import {
  client,
  createTokenWithDecimal,
  deployDexV3,
  deployer,
  deployFactory,
  deployIncentivesFundManager,
  deployMixedRouter,
  deployMultiCall,
  deployOracle,
  deployZapper
} from "./test-common";
import {
  getGlobalMaxSqrtPrice,
  getGlobalMinSqrtPrice,
  getMinTick,
  getTickAtSqrtPrice,
  newPoolKey,
  OraiswapV3Handler
} from "../src";
import { MulticallQueryClient } from "@oraichain/common-contracts-sdk";

// move signer to dynamic signing of an object
declare module "@oraichain/oraidex-contracts-sdk" {
  interface OraiswapTokenClient {
    connect(signer: string): OraiswapTokenClient;
  }
}
OraiswapTokenClient.prototype.connect = function (signer: string): OraiswapTokenClient {
  this.sender = signer;
  return this;
};

declare module "@oraichain/oraidex-contracts-sdk" {
  interface OraiswapV3Client {
    connect(signer: string): OraiswapV3Client;
  }
}
OraiswapV3Client.prototype.connect = function (signer: string): OraiswapV3Client {
  this.sender = signer;
  return this;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const alice = "orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g";
const bob = "orai1602dkqjvh4s7ryajnz2uwhr8vetrwr8nekpxv5";

describe("ZapConsumer", () => {
  describe("Test connect function", () => {
    let tokenTest: OraiswapTokenClient;
    beforeEach(async () => {
      tokenTest = await createTokenWithDecimal("USDT", 6);
    });

    it("connect of cw20 function", async () => {
      expect(tokenTest.sender).toEqual(deployer);
      await tokenTest.mint({
        recipient: alice,
        amount: "1000000000"
      });
      expect((await tokenTest.balance({ address: alice })).balance).toEqual("1000000000");
      await tokenTest.connect(alice).transfer({
        recipient: bob,
        amount: "1000000000"
      });
      expect((await tokenTest.balance({ address: alice })).balance).toEqual("0");
      expect((await tokenTest.balance({ address: bob })).balance).toEqual("1000000000");
    });
  });

  describe("Test zap base on return message", () => {
    /*
       We will simulate test cases base on return message of zap function: 
       - zapIn: 
     */
    let multiCall: MulticallQueryClient;
    let oraix: OraiswapTokenClient; // orai17lgwcg4sesnnuk0r6vwtp0cpxncq28phzwj3e4
    let usdt: OraiswapTokenClient; // orai1hkkmmpf6npaxq0lmjavudlu6nux63jqxdu5fge
    let usdc: OraiswapTokenClient; //orai14asjuxtfd2mkwxpzlv60fd45h0jj6y4qz70hpt
    let incentivesFundManager: IncentivesFundManagerClient;
    let oraiswapV3: OraiswapV3Client;
    let oracle: OraiswapOracleClient;
    let factory: OraiswapFactoryClient;
    let mixedRouter: OraiswapMixedRouterClient;
    let zapper: ZapperClient;
    let zapConsumer: ZapConsumer;
    let handler: OraiswapV3Handler;
    let feeTier1: OraiswapV3Types.FeeTier;
    let feeTier2: OraiswapV3Types.FeeTier;

    beforeEach(async () => {
      oraix = await createTokenWithDecimal("ORAIX", 6);
      usdt = await createTokenWithDecimal("USDT", 6);
      usdc = await createTokenWithDecimal("USDC", 6);

      multiCall = await deployMultiCall();

      incentivesFundManager = await deployIncentivesFundManager({
        owner: deployer,
        oraiswap_v3: deployer
      });

      oraiswapV3 = await deployDexV3({
        protocol_fee: 0.25 * 10 ** 12,
        incentives_fund_manager: incentivesFundManager.contractAddress
      });

      await incentivesFundManager.updateConfig({
        oraiswapV3: oraiswapV3.contractAddress,
        owner: deployer
      });

      oracle = await deployOracle({});

      factory = await deployFactory({
        pair_code_id: 1,
        token_code_id: 1,
        oracle_addr: oracle.contractAddress
      });

      mixedRouter = await deployMixedRouter({
        factory_addr: factory.contractAddress,
        factory_addr_v2: factory.contractAddress,
        oraiswap_v3: oraiswapV3.contractAddress
      });

      zapper = await deployZapper({
        admin: deployer,
        dex_v3: oraiswapV3.contractAddress,
        mixed_router: mixedRouter.contractAddress
      });

      feeTier1 = {
        fee: 0.003 * 10 ** 12,
        tick_spacing: 100
      };
      feeTier2 = {
        fee: 0.0005 * 10 ** 12,
        tick_spacing: 10
      };

      await oraiswapV3.connect(deployer).addFeeTier({
        feeTier: feeTier1
      });
      await oraiswapV3.connect(deployer).addFeeTier({
        feeTier: feeTier2
      });

      // pool 0
      await oraiswapV3.connect(alice).createPool({
        token0: oraix.contractAddress,
        token1: usdt.contractAddress,
        initSqrtPrice: (2n * 10n ** 24n).toString(),
        initTick: 13800,
        feeTier: {
          fee: 0.003 * 10 ** 12,
          tick_spacing: 100
        }
      });
      // pool 1
      await oraiswapV3.connect(alice).createPool({
        token0: oraix.contractAddress,
        token1: usdc.contractAddress,
        initSqrtPrice: (5n * 10n ** 23n).toString(),
        initTick: -13900,
        feeTier: {
          fee: 0.003 * 10 ** 12,
          tick_spacing: 100
        }
      });
      // pool 2
      await oraiswapV3.connect(alice).createPool({
        token0: usdt.contractAddress,
        token1: usdc.contractAddress,
        initSqrtPrice: (1n * 10n ** 24n).toString(),
        initTick: 0,
        feeTier: {
          fee: 0.0005 * 10 ** 12,
          tick_spacing: 10
        }
      });

      zapConsumer = new ZapConsumer({
        client: client,
        dexV3Address: oraiswapV3.contractAddress,
        deviation: 0,
        multiCallAddress: multiCall.contractAddress,
        routerApi: "mockAPI",
        smartRouteConfig: {
          swapOptions: {
            protocols: ["OraidexV3"]
          }
        }
      });

      handler = zapConsumer.handler;
    });

    it("InRangeNoRouteThroughSelf", async () => {
      // zap to pool usdt usdc, use oraix
      const pools = await handler.getPools();

      await oraix.connect(deployer).mint({
        recipient: alice,
        amount: (1000n * 10n ** 6n).toString()
      });
      await usdc.connect(deployer).mint({
        recipient: alice,
        amount: (1000n * 10n ** 6n).toString()
      });
      await usdt.connect(deployer).mint({
        recipient: alice,
        amount: (1000n * 10n ** 6n).toString()
      });

      await oraix.connect(alice).increaseAllowance({
        spender: oraiswapV3.contractAddress,
        amount: (1000n * 10n ** 6n).toString()
      });
      await usdc.connect(alice).increaseAllowance({
        spender: oraiswapV3.contractAddress,
        amount: (1000n * 10n ** 6n).toString()
      });
      await usdt.connect(alice).increaseAllowance({
        spender: oraiswapV3.contractAddress,
        amount: (1000n * 10n ** 6n).toString()
      });

      const oraixUsdtPK = newPoolKey(oraix.contractAddress, usdt.contractAddress, feeTier1); // oraix < usdt
      const usdcOraixPK = newPoolKey(oraix.contractAddress, usdc.contractAddress, feeTier1); // usdc < oraix
      const usdcUsdtPK = newPoolKey(usdt.contractAddress, usdc.contractAddress, feeTier2); // usdc < usdt

      await oraiswapV3.connect(alice).createPosition({
        poolKey: oraixUsdtPK,
        lowerTick: 13700,
        upperTick: 13900,
        liquidityDelta: (10000n * 10n ** 6n).toString(),
        slippageLimitLower: getGlobalMinSqrtPrice().toString(),
        slippageLimitUpper: getGlobalMaxSqrtPrice().toString()
      });
      await oraiswapV3.connect(alice).createPosition({
        poolKey: usdcOraixPK,
        lowerTick: -14000,
        upperTick: -13800,
        liquidityDelta: (10000n * 10n ** 6n).toString(),
        slippageLimitLower: getGlobalMinSqrtPrice().toString(),
        slippageLimitUpper: getGlobalMaxSqrtPrice().toString()
      });
      await oraiswapV3.connect(alice).createPosition({
        poolKey: usdcUsdtPK,
        lowerTick: -10,
        upperTick: 10,
        liquidityDelta: (10000n * 10n ** 6n).toString(),
        slippageLimitLower: getGlobalMinSqrtPrice().toString(),
        slippageLimitUpper: getGlobalMaxSqrtPrice().toString()
      });

      const oraixUsdt = await handler.getPool(oraixUsdtPK);
      const usdcOraix = await handler.getPool(usdcOraixPK);
      const usdcUsdt = await handler.getPool(usdcUsdtPK);

      // console.log({ oraixUsdt, usdcOraix, usdcUsdt });

      const positions = await handler.allPositions();
      const liquidityOraixUsdt = await handler.getPairLiquidityValues(oraixUsdt, positions);
      const liquidityUsdcOraix = await handler.getPairLiquidityValues(usdcOraix, positions);
      const liquidityUsdcUsdt = await handler.getPairLiquidityValues(usdcUsdt, positions);
    });
  });
});
