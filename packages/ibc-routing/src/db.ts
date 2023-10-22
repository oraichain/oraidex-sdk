import * as duckdb from "@duckdb/duckdb-wasm";
import { Connection, Database } from "duckdb-async";
import { resolve } from "path";
import Worker from "web-worker";
import fs from "fs";
import { toObject } from "@oraichain/oraidex-common";

export const sqlCommands = {
  create: {
    evmState: `create table if not exists evm_state 
    (
      txHash varchar,
      height uinteger,
      prevState varchar,
      nextState varchar,
      destination varchar,
      fromAmount ubigint,
      oraiBridgeChannelId varchar,
      oraiReceiver varchar,
      destinationDenom varchar,
      destinationChannelId varchar,
      destinationReceiver varchar,
      eventNonce uinteger,
    )`,
    oraiBridgeState: `create table if not exists oraibridge_state 
    (
      txHash varchar,
      height uinteger,
      prevState varchar,
      nextState varchar,
      eventNonce uinteger,
      packetSequence uinteger
    )`,
    oraichainState: `create table if not exists oraichain_state 
    (
        txhash varchar,
        height uinteger,
        prevState varchar,
        nextState varchar,
        packetSequence uinteger,
        packetAck varchar,
        nextPacketSequence uinteger,
        nextMemo varchar,
        nextAmount ubigint,
        nextReceiver varchar,
        nextDestinationDenom varchar,
    )`
  },
  query: {
    evmState: `SELECT * from evm_state where txHash = ?`,
    oraiBridgeState: `
      SELECT * from oraibridge_state where eventNonce = ?
      `,
    oraichainState: `
      SELECT * from oraichain_state where packetSequence = ?
      `
  }
};

export abstract class DuckDB {
  abstract createTable(): Promise<void>;
  abstract queryInitialEvmStateByHash(txHash: string): Promise<any>;
  abstract queryOraiBridgeStateByNonce(eventNonce: string): Promise<any>;
  abstract queryOraichainStateBySequence(packetSequence: string): Promise<any>;
  abstract insertData(data: any, tableName: string): Promise<void>;
}

export class DuckDbNode extends DuckDB {
  static instances: DuckDbNode;
  protected constructor(public readonly conn: Connection, private db: Database) {
    super();
  }

  static async create(tableName?: string): Promise<DuckDbNode> {
    const path = tableName || ":memory:";
    if (!DuckDbNode.instances) {
      let db = await Database.create(path);
      await db.close(); // close to flush WAL file
      db = await Database.create(path);
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

  async queryInitialEvmStateByHash(txHash: string) {
    const result = await this.conn.all(sqlCommands.query.evmState, txHash);
    if (result.length > 0) return result[0];
    return [];
  }

  async queryOraiBridgeStateByNonce(eventNonce: string) {
    const result = await this.conn.all(sqlCommands.query.oraiBridgeState, eventNonce);
    if (result.length > 0) return result[0];
    return [];
  }

  async queryOraichainStateBySequence(packetSequence: string) {
    const result = await this.conn.all(sqlCommands.query.oraichainState, packetSequence);
    if (result.length > 0) return result[0];
    return [];
  }

  // TODO: use typescript here instead of any
  async insertData(data: any, tableName: string) {
    const tableFile = `${tableName}.json`;
    // the file written out is temporary only. Will be deleted after insertion
    await fs.promises.writeFile(tableFile, JSON.stringify(toObject(data)));
    const query = `INSERT INTO ${tableName} SELECT * FROM read_json_auto(?)`;
    await this.conn.run(query, tableFile);
    await fs.promises.unlink(tableFile);
  }
}

export class DuckDbWasm extends DuckDB {
  static instances: DuckDbWasm;
  protected constructor(public readonly conn: duckdb.AsyncDuckDBConnection, private db: duckdb.AsyncDuckDB) {
    super();
  }

  static async create(currentRootDir: string): Promise<DuckDbWasm> {
    const DUCKDB_DIST = resolve(currentRootDir, "node_modules/@duckdb/duckdb-wasm/dist");
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

  async queryInitialEvmStateByHash(txHash: string) {
    const stmt = await this.conn.prepare(sqlCommands.query.evmState);
    const result = (await stmt.query(txHash)).toArray();
    if (result.length > 0) return result[0];
    return [];
  }

  async queryOraiBridgeStateByNonce(eventNonce: string) {
    const stmt = await this.conn.prepare(sqlCommands.query.oraiBridgeState);
    const result = (await stmt.query(eventNonce)).toArray();
    if (result.length > 0) return result[0];
    return [];
  }

  async queryOraichainStateBySequence(packetSequence: string) {
    const stmt = await this.conn.prepare(sqlCommands.query.oraichainState);
    const result = (await stmt.query(packetSequence)).toArray();
    if (result.length > 0) return result[0];
    return [];
  }

  async insertData(data: any, tableName: string) {
    // TODO: FIXME
    //   try {
    //     const tableFile = `${tableName}.json`;
    //     // the file written out is temporary only. Will be deleted after insertion
    //     await fs.promises.writeFile(tableFile, JSON.stringify(toObject(data)));
    //     const query = `INSERT OR REPLACE INTO ${tableName} SELECT * FROM read_json_auto(?)`;
    //     const stmt = await this.conn.prepare(query);
    //     await stmt.send(query, tableFile);
    //     await fs.promises.unlink(tableFile);
    //   } catch (error) {
    //     console.log("insert data error: ", error);
    //   }
  }
}
