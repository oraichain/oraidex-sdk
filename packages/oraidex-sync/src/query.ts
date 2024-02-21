import { fromBinary, toBinary } from "@cosmjs/cosmwasm-stargate";
import { Addr, MulticallQueryClient, MulticallReadOnlyInterface } from "@oraichain/common-contracts-sdk";
import { Call } from "@oraichain/common-contracts-sdk/build/Multicall.types";
import {
  AssetInfo,
  OraiswapFactoryReadOnlyInterface,
  OraiswapRouterReadOnlyInterface,
  OraiswapRouterTypes,
  OraiswapStakingTypes,
  OraiswapTokenTypes,
  PairInfo
} from "@oraichain/oraidex-contracts-sdk";
import { PoolResponse } from "@oraichain/oraidex-contracts-sdk/build/OraiswapPair.types";
import { TokenInfoResponse } from "@oraichain/oraidex-contracts-sdk/build/OraiswapToken.types";
import { network, oraixCw20Address, tenAmountInDecimalSix, usdcCw20Address } from "./constants";
import { generateSwapOperations, getCosmwasmClient, toDisplay } from "./helper";
import { parseAssetInfoOnlyDenom } from "./parse";
import { PAIRS } from "@oraichain/oraidex-common";

async function queryPoolInfos(pairAddrs: string[], wantedHeight?: number): Promise<PoolResponse[]> {
  const calls: Call[] = pairAddrs.map((pair) => {
    return {
      address: pair,
      data: toBinary({
        pool: {}
      })
    };
  });

  const chunks = [];
  const MAX_CHUNK_SIZE = 10;
  for (let i = 0; i < calls.length; i += MAX_CHUNK_SIZE) {
    chunks.push(calls.slice(i, i + MAX_CHUNK_SIZE));
  }

  try {
    const res = (await Promise.all(chunks.map((chunk) => aggregateMulticall(chunk, wantedHeight)))) as any[][];
    return res.flat().filter(Boolean);
  } catch (error) {
    console.log(`Error when trying to queryPoolInfos: ${JSON.stringify(error)}`);
    throw new Error("queryPoolInfosFails::" + error?.message);
  }
}

async function queryAllPairInfos(
  factoryV1: OraiswapFactoryReadOnlyInterface,
  factoryV2: OraiswapFactoryReadOnlyInterface
): Promise<PairInfo[]> {
  // TODO: change this to multicall
  const liquidityResults: PairInfo[] = (
    await Promise.allSettled([
      ...PAIRS.map((pair) => factoryV1.pair({ assetInfos: pair.asset_infos })),
      ...PAIRS.map((pair) => factoryV2.pair({ assetInfos: pair.asset_infos }))
    ])
  )
    .map((res) => {
      if (res.status === "fulfilled") return res.value;
    })
    .filter(Boolean);
  return liquidityResults;
}

/**
 * Simulate price for pair[0]/pair[pair.length - 1] where the amount of pair[0] is 10^7. This is a multihop simulate swap function. The asset infos in between of the array are for hopping
 * Must divide the pairCalls into chunks of 5 to avoid the error: "Error: Query failed with (18): out of gas in location: wasm contract"
 * @param pairPaths - the array of path starting from the offer asset info to the ask asset info
 * @param router - router contract
 * @returns - prices after simulating
 */
async function simulateSwapPrice(pairPaths: AssetInfo[][], router: OraiswapRouterReadOnlyInterface): Promise<string[]> {
  const MAX_CHUNK_SIZE = 5;
  const dataCall = [];
  for (const pairPath of pairPaths) {
    // usdt case, price is always 1
    const operations = generateSwapOperations(pairPath);

    // TECH DEBT: hardcode simulate for pair oraix/usdc
    const isSimulateOraixUsdc =
      pairPath.some((assetInfo) => parseAssetInfoOnlyDenom(assetInfo) === oraixCw20Address) &&
      pairPath.some((assetInfo) => parseAssetInfoOnlyDenom(assetInfo) === usdcCw20Address);
    const THOUDAND_AMOUNT_IN_DECIMAL_SIX = 1000000000;
    const offerAmount = isSimulateOraixUsdc ? THOUDAND_AMOUNT_IN_DECIMAL_SIX : tenAmountInDecimalSix;
    const sourceDecimals = isSimulateOraixUsdc ? 9 : 7;
    dataCall.push({
      sourceDecimals,
      offerAmount: offerAmount.toString(),
      operations
    });
  }
  const calls: Call[] = dataCall.map((data) => {
    return {
      address: router.contractAddress,
      data: toBinary({
        simulate_swap_operations: {
          offer_amount: data.offerAmount,
          operations: data.operations
        }
      } as OraiswapRouterTypes.QueryMsg)
    };
  });

  const chunks = [];

  for (let i = 0; i < calls.length; i += MAX_CHUNK_SIZE) {
    chunks.push(calls.slice(i, i + MAX_CHUNK_SIZE));
  }
  try {
    const res = (await Promise.all(
      chunks.map((chunk) => aggregateMulticall(chunk))
    )) as OraiswapRouterTypes.SimulateSwapOperationsResponse[][];
    return res.flat().map((data, ind) => toDisplay(data?.amount || "0", dataCall[ind].sourceDecimals).toString());
  } catch (error) {
    console.log(`Error when trying to simulate swap with pairs: ${JSON.stringify(pairPaths)} using router: ${error}`);
    throw new Error("SwapSimulateSwapPriceFail::" + error.message); // error case. Will be handled by the caller function
  }
}

async function aggregateMulticall<T>(queries: Call[], wantedHeight?: number): Promise<T[]> {
  const client = await getCosmwasmClient();
  client.setQueryClientWithHeight(wantedHeight);
  const multicall = new MulticallQueryClient(client, network.multicall);
  const res = await multicall.tryAggregate({ queries });
  return res.return_data.map((data) => (data.success ? fromBinary(data.data) : undefined)) as T[];
}

async function fetchTokenInfos(liquidityAddrs: Addr[]): Promise<TokenInfoResponse[]> {
  const queries = liquidityAddrs.map((address) => ({
    address,
    data: toBinary({
      token_info: {}
    } as OraiswapTokenTypes.QueryMsg)
  }));
  return await aggregateMulticall(queries);
}

async function fetchAllTokenAssetPools(assetInfos: Addr[]): Promise<OraiswapStakingTypes.PoolInfoResponse[]> {
  const queries = assetInfos.map((staking_token) => {
    return {
      address: network.staking,
      data: toBinary({
        pool_info: {
          staking_token
        }
      } as OraiswapStakingTypes.QueryMsg)
    };
  });

  return await aggregateMulticall(queries);
}

async function fetchAllRewardPerSecInfos(assetInfos: Addr[]): Promise<OraiswapStakingTypes.RewardsPerSecResponse[]> {
  const queries = assetInfos.map((staking_token) => {
    return {
      address: network.staking,
      data: toBinary({
        rewards_per_sec: {
          staking_token
        }
      } as OraiswapStakingTypes.QueryMsg)
    };
  });
  return await aggregateMulticall(queries);
}

export {
  aggregateMulticall,
  fetchAllRewardPerSecInfos,
  fetchAllTokenAssetPools,
  fetchTokenInfos,
  queryAllPairInfos,
  queryPoolInfos,
  simulateSwapPrice
};
