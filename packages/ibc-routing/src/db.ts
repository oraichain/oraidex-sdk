import * as duckdb from "@duckdb/duckdb-wasm";
import { Connection, Database } from "duckdb-async";
import { resolve } from "path";
import Worker from "web-worker";
import fs from "fs";
import { generateError, toObject } from "@oraichain/oraidex-common";

export const sqlCommands = {
  create: {
    EvmState: `create table if not exists EvmState 
    (
      txHash varchar,
      height uinteger,
      prevState varchar,
      prevTxHash varchar,
      nextState varchar,
      destination varchar,
      fromAmount hugeint,
      oraiBridgeChannelId varchar,
      oraiReceiver varchar,
      destinationDenom varchar,
      destinationChannelId varchar,
      destinationReceiver varchar,
      eventNonce uinteger primary key,
    )`,
    OraiBridgeState: `create table if not exists OraiBridgeState 
    (
      txHash varchar,
      height uinteger,
      prevState varchar,
      prevTxHash varchar,
      nextState varchar,
      eventNonce uinteger,
      packetSequence uinteger primary key,
      amount hugeint,
      denom varchar,
      memo varchar,
      receiver varchar,
      sender varchar,
      srcPort varchar,
      srcChannel varchar,
      dstPort varchar,
      dstChannel varchar,
    )`,
    OraichainState: `create table if not exists OraichainState 
    (
        txHash varchar,
        height uinteger,
        prevState varchar,
        prevTxHash varchar,
        nextState varchar,
        packetSequence uinteger primary key,
        packetAck varchar,
        nextPacketSequence uinteger,
        nextMemo varchar,
        nextAmount hugeint,
        nextReceiver varchar,
        nextDestinationDenom varchar,
    )`
  },
  query: {
    evmStateByHash: "SELECT * from EvmState where txHash = ?",
    evmStateByNonce: "SELECT * from EvmState where eventNonce = ?",
    oraiBridgeStateByNonce: `
      SELECT * from OraiBridgeState where eventNonce = ?
      `,
    oraiBridgeStateBySequence: `
      SELECT * from OraiBridgeState where packetSequence = ?
      `,
    oraichainStateByPacketSequence: `
      SELECT * from OraichainState where packetSequence = ?
      `,
    stateDataByPacketSequence: (tableName: string) => `SELECT * from ${tableName} where packetSequence = ?`
  }
};

export abstract class DuckDB {
  abstract createTable(): Promise<void>;
  abstract queryInitialEvmStateByHash(txHash: string): Promise<any>;
  abstract queryInitialEvmStateByNonce(nonce: number): Promise<any>;
  abstract queryOraiBridgeStateByNonce(eventNonce: number): Promise<any>;
  abstract queryOraiBridgeStateBySequence(packetSequence: number): Promise<any>;
  abstract queryOraichainStateBySequence(packetSequence: number): Promise<any>;
  abstract findStateByPacketSequence(packetSequence: number): Promise<any>;
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
    for (const createCommand of Object.values(sqlCommands.create)) {
      await this.conn.exec(createCommand);
    }
  }

  async queryInitialEvmStateByHash(txHash: string) {
    const result = await this.conn.all(sqlCommands.query.evmStateByHash, txHash);
    if (result.length > 0) return result[0];
    return [];
  }

  async queryInitialEvmStateByNonce(nonce: number) {
    const result = await this.conn.all(sqlCommands.query.evmStateByNonce, nonce);
    if (result.length > 0) return result[0];
    return [];
  }

  async queryOraiBridgeStateByNonce(eventNonce: number) {
    const result = await this.conn.all(sqlCommands.query.oraiBridgeStateByNonce, eventNonce);
    if (result.length > 0) return result[0];
    return [];
  }

  async queryOraiBridgeStateBySequence(packetSequence: number): Promise<any> {
    const result = await this.conn.all(sqlCommands.query.oraiBridgeStateBySequence, packetSequence);
    if (result.length > 0) return result[0];
    return [];
  }

  async queryOraichainStateBySequence(packetSequence: number) {
    const result = await this.conn.all(sqlCommands.query.oraichainStateByPacketSequence, packetSequence);
    if (result.length > 0) return result[0];
    return [];
  }

  async findStateByPacketSequence(packetSequence: number): Promise<any> {
    for (const tableName of Object.keys(sqlCommands.create)) {
      try {
        const result = await this.conn.all(sqlCommands.query.stateDataByPacketSequence(tableName), packetSequence);
        if (result.length > 0) return { tableName, state: result[0] };
      } catch (error) {
        // ignore errors because some tables may not have packetSequence column
      }
    }
    return { tableName: "", state: "" };
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
    for (const createCommand of Object.values(sqlCommands.create)) {
      await this.conn.send(createCommand);
    }
  }

  async queryInitialEvmStateByHash(txHash: string) {
    const stmt = await this.conn.prepare(sqlCommands.query.evmStateByHash);
    const result = (await stmt.query(txHash)).toArray();
    if (result.length > 0) return result[0];
    return [];
  }

  async queryInitialEvmStateByNonce(nonce: number) {
    const stmt = await this.conn.prepare(sqlCommands.query.evmStateByHash);
    const result = (await stmt.query(nonce)).toArray();
    if (result.length > 0) return result[0];
    return [];
  }

  async queryOraiBridgeStateByNonce(eventNonce: number) {
    const stmt = await this.conn.prepare(sqlCommands.query.oraiBridgeStateByNonce);
    const result = (await stmt.query(eventNonce)).toArray();
    if (result.length > 0) return result[0];
    return [];
  }

  async queryOraiBridgeStateBySequence(packetSequence: number): Promise<any> {
    const stmt = await this.conn.prepare(sqlCommands.query.oraiBridgeStateBySequence);
    const result = (await stmt.query(packetSequence)).toArray();
    if (result.length > 0) return result[0];
    return [];
  }

  async queryOraichainStateBySequence(packetSequence: number) {
    const stmt = await this.conn.prepare(sqlCommands.query.oraichainStateByPacketSequence);
    const result = (await stmt.query(packetSequence)).toArray();
    if (result.length > 0) return result[0];
    return [];
  }

  async findStateByPacketSequence(packetSequence: number): Promise<any> {
    throw generateError("Not implemented");
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
