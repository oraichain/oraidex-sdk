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
import { pairs } from "./pairs";
import { parseAssetInfoOnlyDenom } from "./parse";

async function queryPoolInfos(pairAddrs: string[], multicall: MulticallReadOnlyInterface): Promise<PoolResponse[]> {
  // adjust the query height to get data from the past
  const res = await multicall.tryAggregate({
    queries: pairAddrs.map((pair) => {
      return {
        address: pair,
        data: toBinary({
          pool: {}
        })
      };
    })
  });
  // reset query client to latest for other functions to call
  return res.return_data.map((data) => (data.success ? fromBinary(data.data) : undefined)).filter((data) => data); // remove undefined items
}

async function queryAllPairInfos(
  factoryV1: OraiswapFactoryReadOnlyInterface,
  factoryV2: OraiswapFactoryReadOnlyInterface
): Promise<PairInfo[]> {
  // TODO: change this to multicall
  const liquidityResults: PairInfo[] = (
    await Promise.allSettled([
      ...pairs.map((pair) => factoryV1.pair({ assetInfos: pair.asset_infos })),
      ...pairs.map((pair) => factoryV2.pair({ assetInfos: pair.asset_infos }))
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
  const call: Call[] = dataCall.map((data) => {
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
  const chunks = call.reduce((resultArray, item, index) => {
    const chunkIndex = Math.floor(index / MAX_CHUNK_SIZE);
    if (!resultArray[chunkIndex]) {
      resultArray[chunkIndex] = []; // start a new chunk
    }
    resultArray[chunkIndex].push(item);
    return resultArray;
  }, []);
  try {
    const res = (await Promise.all(
      chunks.map(aggregateMulticall<OraiswapRouterTypes.SimulateSwapOperationsResponse>)
    )) as OraiswapRouterTypes.SimulateSwapOperationsResponse[][];
    return res.flat().map((data, ind) => toDisplay(data.amount, dataCall[ind].sourceDecimals).toString());
  } catch (error) {
    console.log(`Error when trying to simulate swap with pairs: ${JSON.stringify(pairPaths)} using router: ${error}`);
    throw new Error("SwapSimulateSwapPriceFail::" + error.message); // error case. Will be handled by the caller function
  }
}

async function aggregateMulticall<T>(queries: Call[]): Promise<T[]> {
  const client = await getCosmwasmClient();
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
