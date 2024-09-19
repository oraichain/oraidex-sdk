import {
  AMM_V3_CONTRACT,
  KWT_CONTRACT,
  MULTICALL_CONTRACT,
  oraichainTokens,
  ORAIX_CONTRACT,
  TokenItemType,
  USDT_CONTRACT,
} from "@oraichain/oraidex-common";
import { ZapConsumer } from "./zap-consumer";
import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { extractAddress, parsePoolKey } from "./helpers";

async function main() {
  const zapper = new ZapConsumer({
    routerApi: "https://osor.oraidex.io/smart-router/alpha-router",
    client: await CosmWasmClient.connect("https://rpc.orai.io"),
    dexV3Address: AMM_V3_CONTRACT,
    multiCallAddress: MULTICALL_CONTRACT,
    deviation: 0,
    smartRouteConfig: {
      swapOptions: {
        protocols: ["OraidexV3"],
      }
    },
  });

  const tokenIn = oraichainTokens.find((t) => t.name === "ORAI") as TokenItemType;
  const pool = `orai-${ORAIX_CONTRACT}-3000000000-100`;
  const poolKey = parsePoolKey(pool);
  const poolInfo = await zapper.handler.getPool(poolKey);
  const tickSpacing = poolKey.fee_tier.tick_spacing;
  const currentTick = (await zapper.handler.getPool(poolKey)).pool.current_tick_index;

  console.time("processZapInPositionLiquidity");
  const res = await zapper.processZapInPositionLiquidity({
    pool: poolInfo,
    tokenIn: tokenIn as TokenItemType,
    amountIn: (10 ** tokenIn.decimals).toString(),
    lowerTick: currentTick - tickSpacing * 3,
    upperTick: currentTick + tickSpacing * 3,
    tokenX: oraichainTokens.find((t) => extractAddress(t) === poolKey.token_x) as TokenItemType,
    tokenY: oraichainTokens.find((t) => extractAddress(t) === poolKey.token_y) as TokenItemType,
  });
  console.timeEnd("processZapInPositionLiquidity");
  console.dir(res, { depth: null });
}

main().catch(console.error);
