import {
  AMM_V3_CONTRACT,
  KWT_CONTRACT,
  MULTICALL_CONTRACT,
  oraichainTokens,
  ORAIX_CONTRACT,
  OSMO,
  OSMOSIS_ORAICHAIN_DENOM,
  TokenItemType,
  USDT_CONTRACT
} from "@oraichain/oraidex-common";
import { ZapConsumer } from "./zap-consumer";
import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { extractAddress, parsePoolKey } from "./helpers";
import { getTickAtSqrtPrice } from "./wasm/oraiswap_v3_wasm";

async function main() {
  const zapper = new ZapConsumer({
    routerApi: "https://osor.oraidex.io/smart-router/alpha-router",
    client: await CosmWasmClient.connect("https://rpc.orai.io"),
    dexV3Address: AMM_V3_CONTRACT,
    multiCallAddress: MULTICALL_CONTRACT,
    deviation: 0,
    smartRouteConfig: {
      swapOptions: {
        protocols: ["OraidexV3"]
      }
    }
  });

  const tokenIn = oraichainTokens.find((t) => t.denom === "orai") as TokenItemType;
  const pool = `${OSMOSIS_ORAICHAIN_DENOM}-orai-${(0.3 / 100) * 10 ** 12}-100`;
  const poolKey = parsePoolKey(pool);

  // for (let i = 0; i < 10; i++) {
    // const poolInfo = await zapper.handler.getPool(poolKey);
    // console.log("poolInfo", poolInfo);
  // }

  const tickSpacing = poolKey.fee_tier.tick_spacing;
  const currentTick = (await zapper.handler.getPool(poolKey)).pool.current_tick_index;

  // console.log(getTickAtSqrtPrice(314557996917228655710133n, 10));

  console.time("processZapInPositionLiquidity");
  const res = await zapper.processZapInPositionLiquidity({
    poolKey: poolKey,
    tokenIn: tokenIn as TokenItemType,
    amountIn: "1000000000",
    lowerTick: currentTick - tickSpacing * 1,
    upperTick: currentTick + tickSpacing * 1,
    tokenX: oraichainTokens.find((t) => extractAddress(t) === poolKey.token_x) as TokenItemType,
    tokenY: oraichainTokens.find((t) => extractAddress(t) === poolKey.token_y) as TokenItemType,
  });
  console.timeEnd("processZapInPositionLiquidity");
  // console.dir(res, { depth: null });
}

main().catch(console.error);
