import { Database, Connection } from "duckdb-async";
import { SwapOperationData, WithdrawLiquidityOperationData } from "./types";
import fs from "fs";

export class DuckDb {
  protected constructor(public readonly conn: Connection) {}

  static async create(fileName?: string): Promise<DuckDb> {
    const db = await Database.create(fileName ?? "data");
    const conn = await db.connect();
    return new DuckDb(conn);
  }

  async createHeightSnapshot() {
    await this.conn.exec("CREATE TABLE IF NOT EXISTS height_snapshot (currentInd UINTEGER,PRIMARY KEY (currentInd))");
  }

  async loadHeightSnapshot() {
    const result = await this.conn.all("SELECT * FROM height_snapshot");
    return result.length > 0 ? result[0] : { currentInd: 1 };
  }

  async insertHeightSnapshot(currentInd: number) {
    await this.conn.run("INSERT OR REPLACE INTO height_snapshot VALUES (?)", currentInd);
  }

  private async insertBulkData(data: any[], tableName: string) {
    // we wont insert anything if the data is empty. Otherwise it would throw an error while inserting
    if (data.length === 0) return;
    const tableFile = `${tableName}.json`;
    // the file written out is temporary only. Will be deleted after insertion
    await fs.promises.writeFile(tableFile, JSON.stringify(data));
    await this.conn.run(`INSERT INTO ${tableName} SELECT * FROM read_json_auto(?)`, tableFile);
    await fs.promises.unlink(tableFile);
  }

  async createSwapOpsTable() {
    await this.conn.exec(
      "CREATE TABLE IF NOT EXISTS swap_ops_data (txhash VARCHAR, timestamp TIMESTAMP, offerDenom VARCHAR, offerAmount UBIGINT, askDenom VARCHAR, returnAmount UBIGINT, taxAmount UBIGINT, commissionAmount UBIGINT, spreadAmount UBIGINT)"
    );
  }

  async insertSwapOps(ops: SwapOperationData[]) {
    await this.insertBulkData(ops, "swap_ops_data");
  }

  async createLiquidityOpsTable() {
    try {
      await this.conn.all("select enum_range(NULL::LPOPTYPE);");
    } catch (error) {
      // if error it means the enum does not exist => create new
      await this.conn.exec("CREATE TYPE LPOPTYPE AS ENUM ('provide','withdraw');");
    }
    await this.conn.exec(
      "CREATE TABLE IF NOT EXISTS lp_ops_data (txhash VARCHAR, timestamp TIMESTAMP, firstTokenAmount UBIGINT, firstTokenDenom VARCHAR, secondTokenAmount UBIGINT, secondTokenDenom VARCHAR, txCreator VARCHAR, opType LPOPTYPE)"
    );
  }

  async insertLpOps(ops: WithdrawLiquidityOperationData[]) {
    await this.insertBulkData(ops, "lp_ops_data");
  }

  async querySwapOps() {
    return this.conn.all("SELECT count(*) from swap_ops_data");
  }

  async queryLpOps() {
    return this.conn.all("SELECT count(*) from lp_ops_data");
  }
}
