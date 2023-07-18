import * as dotenv from "dotenv";
import express from "express";
import {
  DuckDb,
  TickerInfo,
  pairs,
  parseAssetInfoOnlyDenom,
  findPairAddress,
  simulateSwapPriceWithUsdt,
  findUsdOraiInPair,
  toDisplay,
  OraiDexSync
} from "@oraichain/oraidex-sync";
import cors from "cors";
import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { OraiswapRouterQueryClient } from "@oraichain/oraidex-contracts-sdk";
import { getDate24hBeforeNow, parseSymbolsToTickerId } from "./helper";

dotenv.config();

const app = express();
app.use(cors());

let duckDb: DuckDb;

const port = parseInt(process.env.PORT) || 2024;
const hostname = process.env.HOSTNAME || "0.0.0.0";
const rpcUrl = process.env.RPC_URL || "https://rpc.orai.io";

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
          const { baseIndex, targetIndex, target } = findUsdOraiInPair(pair.asset_infos);
          const latestTimestamp = await duckDb.queryLatestTimestampSwapOps();
          const now = new Date(latestTimestamp);
          const then = getDate24hBeforeNow(now).toISOString();
          const baseInfo = parseAssetInfoOnlyDenom(pair.asset_infos[baseIndex]);
          const targetInfo = parseAssetInfoOnlyDenom(pair.asset_infos[targetIndex]);
          const volume = await duckDb.queryAllVolumeRange(baseInfo, targetInfo, then, now.toISOString());
          let tickerInfo: TickerInfo = {
            ticker_id: tickerId,
            base_currency: symbols[baseIndex],
            target_currency: symbols[targetIndex],
            last_price: "",
            base_volume: toDisplay(BigInt(volume.volume[baseInfo])).toString(), // TODO: remove random
            target_volume: toDisplay(BigInt(volume.volume[targetInfo])).toString(),
            pool_id: pairAddr ?? "",
            base: symbols[baseIndex],
            target: symbols[targetIndex]
          };
          try {
            // reverse because in pairs, we put base info as first index
            const price = await simulateSwapPriceWithUsdt(target, routerContract);
            tickerInfo.last_price = price.amount;
          } catch (error) {
            tickerInfo.last_price = "0";
          }
          return tickerInfo;
        })
      )
    ).map((result) => {
      if (result.status === "fulfilled") return result.value;
      else console.log("result: ", result.reason);
    });
    console.table(data);
    res.status(200).send(data);
  } catch (error) {
    console.log("error: ", error);
    res.status(500).send(`Error: ${JSON.stringify(error)}`);
  }
});

app.listen(port, hostname, async () => {
  // sync data for the service to read
  // console.dir(pairInfos, { depth: null });
  duckDb = await DuckDb.create("oraidex-sync-data");
  const oraidexSync = await OraiDexSync.create(duckDb, process.env.RPC_URL || "https://rpc.orai.io");
  oraidexSync.sync();
  console.log(`[server]: oraiDEX info server is running at http://${hostname}:${port}`);
});
