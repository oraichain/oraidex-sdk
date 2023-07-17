import * as dotenv from "dotenv";
import express from "express";
import { DuckDb, OraiDexSync } from "@oraichain/oraidex-sync";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors());

const port = process.env.PORT || 2024;
let duckDb: DuckDb;

app.get("/v1/test", async (req, res) => {
  const result = await duckDb.conn.all("select count(*) from swap_ops_data;");
  res.status(200).send(result);
});

app.listen(port, async () => {
  // sync data for the service to read
  const duckDb = await DuckDb.create("oraidex-sync-data");
  const oraidexSync = await OraiDexSync.create(duckDb, process.env.RPC_URL || "https://rpc.orai.io");
  await oraidexSync.sync();
  console.log(`[server]: Orderbook Info is running at http://localhost:${port}`);
});

// demo pair id in hex form: 5b7b226e61746976655f746f6b656e223a7b2264656e6f6d223a226f726169227d7d2c7b22746f6b656e223a7b22636f6e74726163745f61646472223a226f7261693132687a6a7866683737776c35373267647a637432667876326172786377683667796b63377168227d7d5d
