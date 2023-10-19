import * as duckdb from "@duckdb/duckdb-wasm";
import { resolve } from "path";
import Worker from "web-worker";
const DUCKDB_DIST = "node_modules/@duckdb/duckdb-wasm/dist";
const getDuckDbDist = (type: string) => {
  return {
    mainModule: resolve(DUCKDB_DIST, `./duckdb-${type}.wasm`),
    mainWorker: resolve(DUCKDB_DIST, `./duckdb-node-${type}.worker.cjs`)
  };
};
const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
  mvp: getDuckDbDist("mvp"),
  eh: getDuckDbDist("eh")
};

export const createTables = async (conn: duckdb.AsyncDuckDBConnection) => {
  // create a context that stores context of a bridge transaction
  await conn.send(`create table if not exists bridge_tx_context 
  (txhash varchar primary key, 
    height uinteger, 
    timestamp uinteger,
    phase varchar
    )`);

  await conn.send(`create table if not exists cosmos_phase 
  (id varchar primary key, 
    memo varchar, 
    denom varchar, 
    receiver varchar, 
    packet_sequence varchar)`);
};

export const initDuckDb = async () => {
  // Select a bundle based on browser checks
  // Select a bundle based on browser checks
  const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
  // Instantiate the asynchronus version of DuckDB-wasm
  const worker = new Worker(bundle.mainWorker!);
  const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.INFO);
  const db = new duckdb.AsyncDuckDB(logger, worker);
  // Instantiate the asynchronus version of DuckDB-wasm
  await db.instantiate(MANUAL_BUNDLES.eh.mainModule);
  const conn = await db.connect();
  await createTables(conn);
  return conn;
};
