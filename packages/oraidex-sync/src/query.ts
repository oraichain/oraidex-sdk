import {
  OraiswapFactoryReadOnlyInterface,
  OraiswapRouterReadOnlyInterface,
  PairInfo
} from "@oraichain/oraidex-contracts-sdk";
import { PoolResponse } from "@oraichain/oraidex-contracts-sdk/build/OraiswapPair.types";
import { Asset, AssetInfo } from "@oraichain/oraidex-contracts-sdk";
import { MulticallReadOnlyInterface } from "@oraichain/common-contracts-sdk";
import { fromBinary, toBinary } from "@cosmjs/cosmwasm-stargate";
import { pairs } from "./pairs";
import { findAssetInfoPathToUsdt, generateSwapOperations } from "./helper";
import { priceDecimals, tenAmountInDecimalSix } from "./constants";

async function getPoolInfos(pairs: PairInfo[], multicall: MulticallReadOnlyInterface): Promise<PoolResponse[]> {
  // adjust the query height to get data from the past
  const res = await multicall.tryAggregate({
    queries: pairs.map((pair) => {
      return {
        address: pair.contract_addr,
        data: toBinary({
          pool: {}
        })
      };
    })
  });
  // reset query client to latest for other functions to call
  return res.return_data.map((data) => (data.success ? fromBinary(data.data) : undefined));
}

async function getAllPairInfos(
  factoryV1: OraiswapFactoryReadOnlyInterface,
  factoryV2: OraiswapFactoryReadOnlyInterface
): Promise<PairInfo[]> {
  const liquidityResults: PairInfo[] = (
    await Promise.allSettled([
      ...pairs.map((pair) => factoryV1.pair({ assetInfos: pair.asset_infos })),
      ...pairs.map((pair) => factoryV2.pair({ assetInfos: pair.asset_infos }))
    ])
  )
    .filter((res) => {
      if (res.status === "fulfilled") return true;
      return false;
    })
    .map((data) => (data as any).value as PairInfo);
  return liquidityResults;
}

async function simulateSwapPriceWithUsdt(info: AssetInfo, router: OraiswapRouterReadOnlyInterface): Promise<Asset> {
  // adjust the query height to get data from the past
  const infoPath = findAssetInfoPathToUsdt(info);
  // usdt case, price is always 1
  const operations = generateSwapOperations(infoPath);
  if (operations.length === 0) return { info, amount: "0" }; // error case. Will be handled by the caller function
  try {
    const data = await router.simulateSwapOperations({
      offerAmount: tenAmountInDecimalSix,
      operations
    });
    return { info, amount: (parseInt(data.amount) / priceDecimals).toString() }; // since we simulate using 10 units, not 1. We use 10 because its a workaround for pools that are too small to simulate using 1 unit
  } catch (error) {
    console.log(`Error when trying to simulate swap with asset info: ${JSON.stringify(info)} using router: ${error}`);
    return { info, amount: "0" }; // error case. Will be handled by the caller function
  }
}

async function simulateSwapPricePair(
  pair: [AssetInfo, AssetInfo],
  router: OraiswapRouterReadOnlyInterface
): Promise<string> {
  // usdt case, price is always 1
  const operations = generateSwapOperations(pair);
  if (operations.length === 0) return "0"; // error case. Will be handled by the caller function
  try {
    const data = await router.simulateSwapOperations({
      offerAmount: tenAmountInDecimalSix,
      operations
    });
    return (parseInt(data.amount) / priceDecimals).toString(); // since we simulate using 10 units, not 1. We use 10 because its a workaround for pools that are too small to simulate using 1 unit
  } catch (error) {
    console.log(`Error when trying to simulate swap with pair: ${JSON.stringify(pair)} using router: ${error}`);
    return "0"; // error case. Will be handled by the caller function
  }
}

export { getAllPairInfos, getPoolInfos, simulateSwapPriceWithUsdt, simulateSwapPricePair };
