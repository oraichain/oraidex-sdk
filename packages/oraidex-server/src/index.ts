import * as dotenv from "dotenv";
import express from "express";
import {
  AssetData,
  DuckDb,
  OraiDexSync,
  PairMapping,
  TickerInfo,
  pairs,
  simulateSwapPricePair,
  parseAssetInfoOnlyDenom,
  usdtCw20Address,
  usdcCw20Address,
  getAllPairInfos,
  parseAssetInfo,
  PairInfoData,
  findPairAddress
} from "@oraichain/oraidex-sync";
import cors from "cors";
import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import {
  AssetInfo,
  OraiswapFactoryQueryClient,
  OraiswapRouterQueryClient,
  PairInfo
} from "@oraichain/oraidex-contracts-sdk";
import { parseSymbolsToTickerId } from "./helper";

dotenv.config();

const app = express();
app.use(cors());

let duckDb: DuckDb;

const port = parseInt(process.env.PORT) || 2024;
const hostname = process.env.HOSTNAME || "0.0.0.0";
const rpcUrl = process.env.RPC_URL || "https://rpc.orai.io";

async function queryAllPairInfos(): Promise<PairInfo[]> {
  const cosmwasmClient = await CosmWasmClient.connect(rpcUrl);
  const firstFactoryClient = new OraiswapFactoryQueryClient(
    cosmwasmClient,
    process.env.FACTORY_CONTACT_ADDRESS_V1 || "orai1hemdkz4xx9kukgrunxu3yw0nvpyxf34v82d2c8"
  );
  const secondFactoryClient = new OraiswapFactoryQueryClient(
    cosmwasmClient,
    process.env.FACTORY_CONTACT_ADDRESS_V2 || "orai167r4ut7avvgpp3rlzksz6vw5spmykluzagvmj3ht845fjschwugqjsqhst"
  );
  return getAllPairInfos(firstFactoryClient, secondFactoryClient);
}

app.get("/pairs", async (req, res) => {
  try {
    const pairInfos = await duckDb.queryPairInfos();
    res.status(200).send(
      pairs.map((pair) => {
        const pairAddr = findPairAddress(pairInfos, pair.asset_infos);
        return {
          ticker_id: parseSymbolsToTickerId(pair.symbols),
          base: pair.symbols[0],
          target: pair.symbols[1],
          pool_id: pairAddr ?? ""
        };
      })
    );
  } catch (error) {
    res.status(500).send(`Error getting pair infos: ${JSON.stringify(error)}`);
  }
});

app.get("/tickers", async (req, res) => {
  try {
    const cosmwasmClient = await CosmWasmClient.connect(rpcUrl);
    const routerContract = new OraiswapRouterQueryClient(
      cosmwasmClient,
      process.env.ROUTER_CONTRACT_ADDRESS || "orai1j0r67r9k8t34pnhy00x3ftuxuwg0r6r4p8p6rrc8az0ednzr8y9s3sj2sf"
    );
    const pairInfos = await duckDb.queryPairInfos();
    const data: TickerInfo[] = (
      await Promise.allSettled(
        pairs.map(async (pair) => {
          const symbols = pair.symbols;
          const pairAddr = findPairAddress(pairInfos, pair.asset_infos);
          const tickerId = parseSymbolsToTickerId(symbols);
          const hasUsdInPair = pair.asset_infos.some(
            (info) =>
              parseAssetInfoOnlyDenom(info) === usdtCw20Address || parseAssetInfoOnlyDenom(info) === usdcCw20Address
          );
          const currencies = hasUsdInPair ? pair.symbols.reverse() : pair.symbols;
          const assetInfosForSimulation = hasUsdInPair ? pair.asset_infos : pair.asset_infos.reverse();
          try {
            // reverse because in pairs, we put base info as first index
            const price = await simulateSwapPricePair(
              assetInfosForSimulation as [AssetInfo, AssetInfo],
              routerContract
            );
            return {
              ticker_id: tickerId,
              base_currency: currencies[0],
              target_currency: currencies[1],
              last_price: price,
              base_volume: "0",
              target_volume: "0",
              pool_id: pairAddr ?? "",
              base: currencies[0],
              target: currencies[1]
            } as TickerInfo;
          } catch (error) {
            return {
              ticker_id: tickerId,
              base_currency: currencies[0],
              target_currency: currencies[1],
              last_price: "0",
              base_volume: "0",
              target_volume: "0",
              pool_id: pairAddr ?? "",
              base: currencies[0],
              target: currencies[1]
            };
          }
        })
      )
    ).map((result) => {
      if (result.status === "fulfilled") return result.value;
    });
    console.table(data);
    res.status(200).send(data);
  } catch (error) {
    res.status(500).send(`Error: ${JSON.stringify(error)}`);
  }
});

app.listen(port, hostname, async () => {
  // sync data for the service to read
  duckDb = await DuckDb.create("oraidex-sync-data");
  await Promise.all([
    duckDb.createHeightSnapshot(),
    duckDb.createLiquidityOpsTable(),
    duckDb.createSwapOpsTable(),
    duckDb.createPairInfosTable(),
    duckDb.createPriceInfoTable()
  ]);
  const pairInfos = await queryAllPairInfos();
  // Promise.all([insert pool info, and insert pair info. Promise all because pool info & updated pair info must go together])
  await duckDb.insertPairInfos(
    pairInfos.map(
      (pair) =>
        ({
          firstAssetInfo: parseAssetInfo(pair.asset_infos[0]),
          secondAssetInfo: parseAssetInfo(pair.asset_infos[1]),
          commissionRate: pair.commission_rate,
          pairAddr: pair.contract_addr,
          liquidityAddr: pair.liquidity_token,
          oracleAddr: pair.oracle_addr
        } as PairInfoData)
    )
  );
  // console.dir(pairInfos, { depth: null });
  // const oraidexSync = await OraiDexSync.create(duckDb, process.env.RPC_URL || "https://rpc.orai.io");
  // await oraidexSync.sync();
  console.log(`[server]: oraiDEX info server is running at http://${hostname}:${port}`);
});
