import * as duckdb from "@duckdb/duckdb-wasm";
import { Connection, Database } from "duckdb-async";
import { resolve } from "path";
import Worker from "web-worker";

export const sqlCommands = {
  create: {
    evmState: `create table if not exists evm_state 
    (
      txhash varchar,
      height uinteger,
      prev_state varchar,
      memo varchar,
      chain_id varchar,
      from_amount ubigint,
      destination denom varchar,
      destination_channel_id varchar,
      destination_receiver varchar,
      event_nonce uinteger,
    )`,
    oraiBridgeState: `create table if not exists oraibridge_state 
    (
      txhash varchar,
      height uinteger,
      event_nonce uinteger,
      packet_sequence uinteger
    )`,
    oraichainState: `create table if not exists oraichain_state 
    (
        txhash varchar,
        height uinteger,
        packet_sequence uinteger,
        packet_ack varchar,
        next_packet_sequence uinteger,
        next_memo varchar,
        next_amount ubigint,
        next_receiver varchar,
        next_destination_denom varchar,
    )`
  }
};

export abstract class DuckDB {
  abstract createTable(): Promise<void>;
}

export class DuckDbNode extends DuckDB {
  static instances: DuckDbNode;
  protected constructor(public readonly conn: Connection, private db: Database) {
    super();
  }

  static async create(fileName: string): Promise<DuckDbNode> {
    if (!fileName) throw new Error("Filename is not provided!");
    if (!DuckDbNode.instances) {
      let db = await Database.create(fileName);
      await db.close(); // close to flush WAL file
      db = await Database.create(fileName);
      const conn = await db.connect();
      DuckDbNode.instances = new DuckDbNode(conn, db);
    }

    return DuckDbNode.instances;
  }

  async createTable() {
    for (let createCommand of Object.values(sqlCommands.create)) {
      await this.conn.exec(createCommand);
    }
  }
}

export class DuckDbWasm extends DuckDB {
  static instances: DuckDbWasm;
  protected constructor(public readonly conn: duckdb.AsyncDuckDBConnection, private db: duckdb.AsyncDuckDB) {
    super();
  }

  static async create(): Promise<DuckDbWasm> {
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
    DuckDbWasm.instances = new DuckDbWasm(conn, db);
    return DuckDbWasm.instances;
  }

  async createTable() {
    for (let createCommand of Object.values(sqlCommands.create)) {
      await this.conn.send(createCommand);
    }
  }
}
