import {
  AMM_V3_CONTRACT,
  MULTICALL_CONTRACT,
  oraichainTokens,
  ORAIX_CONTRACT,
  TokenItemType,
  USDT_CONTRACT
} from "@oraichain/oraidex-common";
import { ZapConsumer } from "./zap-consumer";
import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { extractAddress } from "./helpers";

async function main() {
  const poolList = [
    // `orai-${USDT_CONTRACT}-3000000000-100`,
    // `${ATOM_ORAICHAIN_DENOM}-orai-3000000000-100`,
    // `${USDT_CONTRACT}-${USDC_CONTRACT}-500000000-10`,
    // `orai-${USDC_CONTRACT}-3000000000-100`,
    // `${OSMOSIS_ORAICHAIN_DENOM}-orai-3000000000-100`,
    `orai-${ORAIX_CONTRACT}-3000000000-100`
  ];
  const tokenIn = oraichainTokens.find((t) => extractAddress(t) === USDT_CONTRACT) as TokenItemType;

  const zapper = new ZapConsumer({
    routerApi: "",
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

  // const handler = zapper.handler;

  // const pool = await handler.getPool(parsePoolKey(poolList[0]));
  // console.log(pool);
  // const tickMap = await zapper.getFullTickmap(parsePoolKey(poolList[0]));
  // console.log(tickMap);

  //[221800, 2900, 700, 800, 1000, 1800, -5500, -4500, -221800]
  //[221800, 2900, 700, 800, 1000, 1800, -5500, -4500, -221800]

  // const minTick = getMinTick(poolKey.fee_tier.tick_spacing);
  // const maxTick = getMaxTick(poolKey.fee_tier.tick_spacing);
  // const tickMap = await handler.tickMap(parsePoolKey(poolList[0]), minTick, maxTick, true);
  // console.log(tickMap);
  // const tickMap2 = await zapper.getFullTickmap(parsePoolKey(poolList[0]));
  // console.log({ tickMap2 });

  // const liquidityTick = await zapper.getAllLiquidityTicks(parsePoolKey(poolList[0]), tickMap2);
  // console.log({ liquidityTick });
  // const tickSpacing = parsePoolKey(poolList[0]).fee_tier.tick_spacing;
  // const currentTick = (await zapper.handler.getPool(parsePoolKey(poolList[0]))).pool.current_tick_index;

  // const poolKey = parsePoolKey(poolList[0]);
  // const res = await zapper.processZapInPositionLiquidity({
  //   poolKey: poolKey,
  //   tokenIn: tokenIn as TokenItemType,
  //   amountIn: "10000000",
  //   lowerTick: currentTick - tickSpacing * 3,
  //   upperTick: currentTick + tickSpacing * 3,
  //   tokenX: oraichainTokens.find((t) => extractAddress(t) === 'orai') as TokenItemType,
  //   tokenY: oraichainTokens.find((t) => extractAddress(t) === ORAIX_CONTRACT) as TokenItemType,
  // });
  // console.log({ res });
}

main().catch(console.error);
