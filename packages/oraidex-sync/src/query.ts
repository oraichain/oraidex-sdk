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
import { findAssetInfoPathToUsdt, generateSwapOperations, parseAssetInfoOnlyDenom, toDisplay } from "./helper";
import { tenAmountInDecimalSix, usdtCw20Address } from "./constants";

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
    .filter((res) => {
      if (res.status === "fulfilled") return true;
      return false;
    })
    .map((data) => (data as any).value as PairInfo);
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
 * @returns - pricea fter simulating
 */
async function simulateSwapPrice(pairPath: AssetInfo[], router: OraiswapRouterReadOnlyInterface): Promise<string> {
  // usdt case, price is always 1
  const operations = generateSwapOperations(pairPath);
  if (operations.length === 0) return "0"; // error case. Will be handled by the caller function
  try {
    const data = await router.simulateSwapOperations({
      offerAmount: tenAmountInDecimalSix,
      operations
    });
    return toDisplay(data.amount, 7).toString(); // since we simulate using 10 units, not 1. We use 10 because its a workaround for pools that are too small to simulate using 1 unit
  } catch (error) {
    console.log(`Error when trying to simulate swap with pair: ${JSON.stringify(pairPath)} using router: ${error}`);
    return "0"; // error case. Will be handled by the caller function
  }
}

export { getAllPairInfos, getPoolInfos, simulateSwapPriceWithUsdt, simulateSwapPrice };
