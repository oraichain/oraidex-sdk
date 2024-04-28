import { Connection, Database } from "duckdb-async";
import _ from "lodash";
import { DatabaseEnum } from "./constants";

// The below state field to confirm whether a state is completedly finished or not
// Notice: there are some tuples that are unique, such as:
// 1. (eventNonce, evmChainPrefix)
// 2. (txId, evmChainPrefix)
// 3. (batchNonce, denom, evmChainPrefix)
// 4. (packetSequence, srcChannel, portChannel)
// 5. soon...
// TODO: fix passing data flow by apache-arrow

// EVM db notes:
// EVM -> Oraichain: unique key (eventNonce, evmChainPrefix)
// Oraichain -> EVM: unique key (eventNonce, evmChainPrefix, destinationReceiver)
export const sqlCommands = {
  create: {
    [DatabaseEnum.Evm]: `create table if not exists EvmState 
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
      primary key (eventNonce, evmChainPrefix, destinationReceiver),
    )`,
    [DatabaseEnum.OraiBridge]: `create table if not exists OraiBridgeState 
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
      packetSequence uinteger,
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
      primary key (packetSequence, srcChannel, dstChannel)
    )`,
    [DatabaseEnum.Oraichain]: `create table if not exists OraichainState 
    (
      txHash varchar,
      height uinteger,
      prevState varchar,
      prevTxHash varchar,
      nextState varchar,
      packetSequence uinteger,
      packetAck varchar,
      sender varchar,
      localReceiver varchar,
      nextPacketSequence uinteger,
      nextMemo varchar,
      nextAmount varchar,
      nextReceiver varchar,
      nextDestinationDenom varchar,
      srcChannel varchar,
      dstChannel varchar,
      status varchar,
      primary key (packetSequence, srcChannel, dstChannel)
    )`,
    [DatabaseEnum.Cosmos]: `create table if not exists CosmosState
    (
      txHash varchar,
      height uinteger,
      chainId varchar,
      prevState varchar,
      prevTxHash varchar,
      nextState varchar,
      packetSequence uinteger,
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
      primary key (packetSequence, srcChannel, dstChannel)
    )
    `
  }
};

// TODO: Change some query and update here to make it more general
// to use all at one function instead of create multiple functions here.
export abstract class DuckDB {
  abstract createTable(): Promise<void>;
  // General
  abstract select(tableName: DatabaseEnum, options?: OptionInterface): Promise<any>;
  abstract insert(tableName: DatabaseEnum, data: Object): Promise<void>;
  abstract update(tableName: DatabaseEnum, overrideData: Object, options: OptionInterface): Promise<void>;
  // ONLY FOR TEST
  abstract dropTable(tableName: string): Promise<void>;
}

export interface PaginationInterface {
  limit?: number;
  offset?: number;
}

export interface OptionInterface {
  where?: Object;
  attributes?: string[];
  pagination?: PaginationInterface;
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

  // GENERAL FUNCTIONS (IDEA SAME AS ORM)
  // SEE db.spec.ts for sampleing usage
  /**
   * @dev
   * @params where: which is where query
   * @params attributes: is the columns that you want to display, empty is *
   * @params pagination: for pagination like limit and offset
   */
  async select(tableName: DatabaseEnum, options?: OptionInterface): Promise<any> {
    const defaultOptions = {
      where: {},
      attributes: [],
      pagination: {}
    };
    const [query, values] = this.selectClause(tableName, { ...defaultOptions, ...options });
    const result = await this.conn.all(query, ...values);
    return result;
  }

  async insert(tableName: DatabaseEnum, data: Object): Promise<void> {
    const [query, values] = this.insertClause(tableName, data);
    await this.conn.run(query, ...values);
  }

  async update(tableName: DatabaseEnum, overrideData: Object, options: OptionInterface): Promise<void> {
    const [query, values] = this.updateClause(tableName, overrideData, options);
    await this.conn.run(query, ...values);
  }

  async createTable() {
    for (const createCommand of Object.values(sqlCommands.create)) {
      await this.conn.exec(createCommand);
    }
  }

  async dropTable(tableName: string) {
    const query = `DROP TABLE ${tableName}`;
    await this.conn.run(query);
  }

  // ORM BASIC
  selectClause(
    tableName: string,
    options: OptionInterface = {
      where: {},
      attributes: [],
      pagination: {}
    }
  ): [string, any[]] {
    const attributes = options.attributes;
    const whereKeys = Object.keys(options.where);
    const whereValues = Object.values(options.where);
    const whereClauses = whereKeys.length > 0 ? `WHERE ${whereKeys.map((item) => `${item} = ?`).join(" AND ")}` : "";
    const paginationKeys = Object.keys(options.pagination);
    const paginationValues = Object.values(options.pagination);
    const paginationClause =
      paginationKeys.length > 0
        ? `${options.pagination?.limit ? `LIMIT ?` : ""} ${options.pagination?.offset ? "OFFSET ?" : ""}`
        : "";

    const query = _.trim(
      `SELECT ${
        attributes.length > 0 ? attributes.join(", ") : "*"
      } FROM ${tableName} ${whereClauses} ${paginationClause}`
    );

    return [query, [...whereValues, ...paginationValues]];
  }

  insertClause(tableName: string, data: Object): [string, any[]] {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const query = `INSERT OR IGNORE INTO ${tableName} (${keys.join(", ")}) VALUES (${keys.map((_) => "?").join(", ")})`;
    return [_.trim(query), values];
  }

  updateClause(tableName: DatabaseEnum, overrideData: Object, options: OptionInterface): [string, any[]] {
    const overrideDataKeys = Object.keys(overrideData);
    const overrideDataValues = Object.values(overrideData);
    const setDataClause = `SET ${overrideDataKeys.map((item) => `${item} = ?`).join(", ")}`;
    const whereKeys = Object.keys(options.where);
    const whereValues = Object.values(options.where);
    const whereClauses = whereKeys.length > 0 ? `WHERE ${whereKeys.map((item) => `${item} = ?`).join(" AND ")}` : "";

    const query = _.trim(`UPDATE ${tableName} ${setDataClause} ${whereClauses}`);

    return [query, [...overrideDataValues, ...whereValues]];
  }
}
