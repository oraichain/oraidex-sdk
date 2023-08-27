import {
  OraiswapFactoryReadOnlyInterface,
  OraiswapRouterReadOnlyInterface,
  OraiswapStakingTypes,
  OraiswapTokenTypes,
  PairInfo
} from "@oraichain/oraidex-contracts-sdk";
import { PoolResponse } from "@oraichain/oraidex-contracts-sdk/build/OraiswapPair.types";
import { Asset, AssetInfo } from "@oraichain/oraidex-contracts-sdk";
import { Call, MulticallQueryClient, MulticallReadOnlyInterface } from "@oraichain/common-contracts-sdk";
import { fromBinary, toBinary } from "@cosmjs/cosmwasm-stargate";
import { pairs } from "./pairs";
import {
  findAssetInfoPathToUsdt,
  generateSwapOperations,
  getCosmwasmClient,
  parseAssetInfoOnlyDenom,
  toDisplay
} from "./helper";
import { network, tenAmountInDecimalSix, usdtCw20Address } from "./constants";
import { TokenInfoResponse } from "@oraichain/oraidex-contracts-sdk/build/OraiswapToken.types";

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

async function getAllPairInfos(
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

async function simulateSwapPriceWithUsdt(info: AssetInfo, router: OraiswapRouterReadOnlyInterface): Promise<Asset> {
  // adjust the query height to get data from the past
  if (parseAssetInfoOnlyDenom(info) === usdtCw20Address) return { info, amount: "1" };
  const infoPath = findAssetInfoPathToUsdt(info);
  const amount = await simulateSwapPrice(infoPath, router);
  return { info, amount };
}

/**
 * Simulate price for pair[0]/pair[pair.length - 1] where the amount of pair[0] is 10^7. This is a multihop simulate swap function. The asset infos in between of the array are for hopping
 * @param pairPath - the path starting from the offer asset info to the ask asset info
 * @param router - router contract
 * @returns - price after simulating
 */
async function simulateSwapPrice(pairPath: AssetInfo[], router: OraiswapRouterReadOnlyInterface): Promise<string> {
  // usdt case, price is always 1
  const operations = generateSwapOperations(pairPath);
  if (operations.length === 0) return "0"; // error case. Will be handled by the caller function
  try {
    const data = await router.simulateSwapOperations({
      offerAmount: tenAmountInDecimalSix.toString(),
      operations
    });
    return toDisplay(data.amount, 7).toString(); // since we simulate using 10 units, not 1. We use 10 because its a workaround for pools that are too small to simulate using 1 unit
  } catch (error) {
    console.log(`Error when trying to simulate swap with pair: ${JSON.stringify(pairPath)} using router: ${error}`);
    return "0"; // error case. Will be handled by the caller function
  }
}

async function aggregateMulticall(queries: Call[]) {
  const client = await getCosmwasmClient();
  const multicall = new MulticallQueryClient(client, network.multicall);
  const res = await multicall.aggregate({ queries });
  return res.return_data.map((data) => (data.success ? fromBinary(data.data) : undefined));
}

async function fetchTokenInfos(pairInfos: PairInfo[]): Promise<TokenInfoResponse[]> {
  const queries = pairInfos.map((pair) => ({
    address: pair.liquidity_token,
    data: toBinary({
      token_info: {}
    } as OraiswapTokenTypes.QueryMsg)
  }));
  return await aggregateMulticall(queries);
}

async function fetchAllTokenAssetPools(assetInfos: AssetInfo[]): Promise<OraiswapStakingTypes.PoolInfoResponse[]> {
  const queries = assetInfos.map((assetInfo) => {
    return {
      address: network.staking,
      data: toBinary({
        pool_info: {
          asset_info: assetInfo
        }
      } as OraiswapStakingTypes.QueryMsg)
    };
  });

  return await aggregateMulticall(queries);
}

async function fetchAllRewardPerSecInfos(
  assetInfos: AssetInfo[]
): Promise<OraiswapStakingTypes.RewardsPerSecResponse[]> {
  const queries = assetInfos.map((assetInfo) => {
    return {
      address: network.staking,
      data: toBinary({
        rewards_per_sec: {
          asset_info: assetInfo
        }
      } as OraiswapStakingTypes.QueryMsg)
    };
  });
  return await aggregateMulticall(queries);
}

export {
  getAllPairInfos,
  queryPoolInfos,
  simulateSwapPriceWithUsdt,
  simulateSwapPrice,
  aggregateMulticall,
  fetchTokenInfos,
  fetchAllTokenAssetPools,
  fetchAllRewardPerSecInfos
};
