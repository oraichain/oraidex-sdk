import { toObject } from "@oraichain/oraidex-common";
import { Connection, Database } from "duckdb-async";
import fs from "fs";
import { StateDBStatus } from "./constants";

// The below state field to confirm whether a state is completedly finished or not
// Notice: there are some tuples that are unique, such as:
// 1. (eventNonce, evmChainPrefix)
// 2. (txId, evmChainPrefix)
// 3. (batchNonce, denom, evmChainPrefix)
// TODO: fix passing data flow by apache-arrow
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
      fromAmount varchar,
      oraiBridgeChannelId varchar,
      oraiReceiver varchar,
      destinationDenom varchar,
      destinationChannelId varchar,
      destinationReceiver varchar,
      eventNonce uinteger,
      evmChainPrefix varchar,
      status varchar,
      primary key (eventNonce, evmChainPrefix),
    )`,
    OraiBridgeState: `create table if not exists OraiBridgeState 
    (
      txHash varchar,
      height uinteger,
      prevState varchar,
      prevTxHash varchar,
      nextState varchar,
      eventNonce uinteger,
      batchNonce uinteger,
      txId uinteger,
      evmChainPrefix varchar,
      packetSequence uinteger primary key,
      amount varchar,
      denom varchar,
      memo varchar,
      receiver varchar,
      sender varchar,
      srcPort varchar,
      srcChannel varchar,
      dstPort varchar,
      dstChannel varchar,
      status varchar,
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
      localReceiver varchar,
      nextPacketSequence uinteger,
      nextMemo varchar,
      nextAmount varchar,
      nextReceiver varchar,
      nextDestinationDenom varchar,
      status varchar,
    )`
  },
  query: {
    evmStateByHash: "SELECT * from EvmState where txHash = ?",
    evmStateByEventNonceAndEvmChainPrefix: "SELECT * from EvmState where eventNonce = ? AND evmChainPrefix = ?",
    oraiBridgeStateByEventNonceAndEvmChainPrefix: `
      SELECT * from OraiBridgeState where eventNonce = ? AND evmChainPrefix = ?`,
    oraiBridgeStateBySequence: `
      SELECT * from OraiBridgeState where packetSequence = ?
      `,
    oraichainStateByPacketSequence: `
      SELECT * from OraichainState where packetSequence = ?
      `,
    oraichainStateByNextPacketSequence: `
    SELECT * from OraichainState where nextPacketSequence = ?
    `,
    oraiBridgeByTxIdAndEvmChainPrefix: `
      SELECT * from OraiBridgeState WHERE txId = ? AND evmChainprefix = ? LIMIT ?
    `,
    stateDataByPacketSequence: (tableName: string) => `SELECT * from ${tableName} where packetSequence = ?`
  },
  update: {
    statusByTxHash: (tableName: string) => `UPDATE ${tableName} SET status = ? WHERE txHash = ?`,
    oraichainStatusByNextPacketNonce: () => `UPDATE OraichainState SET status = ? WHERE nextPacketSequence = ?`,
    oraiBridgeBatchNonceByTxIdAndEvmChainPrefix: () =>
      `UPDATE OraiBridgeState SET batchNonce = ? WHERE txId = ? AND evmChainPrefix = ?`,
    oraiBridgeStatusAndEventNonceByTxIdAndEvmChainPrefix: () =>
      `UPDATE OraiBridgeState SET status = ?, eventNonce = ? WHERE txId = ? AND evmChainPrefix = ?`
  }
};

// TODO: Change some query and update here to make it more general
// to use all at one function instead of create multiple functions here.
export abstract class DuckDB {
  abstract createTable(): Promise<void>;
  // EVM
  abstract queryInitialEvmStateByHash(txHash: string): Promise<any>;
  abstract queryInitialEvmStateByEventNonceAndEvmChainPrefix(eventNonce: number, evmChainPrefix: string): Promise<any>;
  // ORAICHAIN
  abstract queryOraichainStateBySequence(packetSequence: number): Promise<any>;
  abstract queryOraichainStateByNextPacketSequence(packetSequence: number): Promise<any>;
  abstract updateOraichainStatusByNextPacketSequence(packetSequence: number, status: StateDBStatus): Promise<void>;
  // ORAIBRIDGE
  abstract queryOraiBridgeStateByEventNonceAndEvmChainPrefix(eventNonce: number, evmChainPrefix: string): Promise<any>;
  abstract queryOraiBridgeStateBySequence(packetSequence: number): Promise<any>;
  abstract queryOraiBridgeByTxIdAndEvmChainPrefix(txId: number, evmChainPrefix: string, limit: number): Promise<any>;
  abstract updateOraiBridgeBatchNonceByTxIdAndEvmChainPrefix(
    batchNonce: number,
    txId: number,
    evmChainPrefix: string
  ): Promise<void>;
  abstract updateOraiBridgeStatusAndEventNonceByTxIdAndEvmChainPrefix(
    status: StateDBStatus,
    eventNonce: number,
    txId: number,
    evmChainPrefix: string
  ): Promise<void>;

  abstract findStateByPacketSequence(packetSequence: number): Promise<any>;

  // TODO: writing from json to db is not safe at all, sometimes it leads to writing wrong column => should be fixed.
  abstract insertData(data: any, tableName: string): Promise<void>;
  abstract updateStatusByTxHash(tableName: string, status: StateDBStatus, txHash: string): Promise<void>;
}

// TODO: use vector instead of writing to files
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

  async queryInitialEvmStateByEventNonceAndEvmChainPrefix(eventNonce: number, evmChainPrefix: string) {
    const result = await this.conn.all(
      sqlCommands.query.evmStateByEventNonceAndEvmChainPrefix,
      eventNonce,
      evmChainPrefix
    );
    if (result.length > 0) return result[0];
    return [];
  }

  async queryOraiBridgeStateByEventNonceAndEvmChainPrefix(eventNonce: number, evmChainPrefix: string) {
    const result = await this.conn.all(
      sqlCommands.query.oraiBridgeStateByEventNonceAndEvmChainPrefix,
      eventNonce,
      evmChainPrefix
    );
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

  async queryOraichainStateByNextPacketSequence(packetSequence: number) {
    const result = await this.conn.all(sqlCommands.query.oraichainStateByNextPacketSequence, packetSequence);
    if (result.length > 0) return result[0];
    return [];
  }

  async queryOraiBridgeByTxIdAndEvmChainPrefix(txId: number, evmChainPrefix: string, limit: number) {
    const result = await this.conn.all(
      sqlCommands.query.oraiBridgeByTxIdAndEvmChainPrefix,
      txId,
      evmChainPrefix,
      limit
    );
    return result;
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

  async updateStatusByTxHash(tableName: string, status: StateDBStatus, txHash: string) {
    const sql = sqlCommands.update.statusByTxHash(tableName);
    await this.conn.run(sql, status, txHash);
  }

  async updateOraichainStatusByNextPacketSequence(packetSequence: number, status: StateDBStatus) {
    const sql = sqlCommands.update.oraichainStatusByNextPacketNonce();
    await this.conn.run(sql, status, packetSequence);
  }

  async updateOraiBridgeBatchNonceByTxIdAndEvmChainPrefix(batchNonce: number, txId: number, evmChainPrefix: string) {
    const sql = sqlCommands.update.oraiBridgeBatchNonceByTxIdAndEvmChainPrefix();
    await this.conn.run(sql, batchNonce, txId, evmChainPrefix);
  }

  async updateOraiBridgeStatusAndEventNonceByTxIdAndEvmChainPrefix(
    status: StateDBStatus,
    eventNonce: number,
    txId: number,
    evmChainPrefix: string
  ) {
    const sql = sqlCommands.update.oraiBridgeStatusAndEventNonceByTxIdAndEvmChainPrefix();
    await this.conn.run(sql, status, eventNonce, txId, evmChainPrefix);
  }
}
