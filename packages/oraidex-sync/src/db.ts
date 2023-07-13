import { Database, Connection } from "duckdb-async";
import { SwapOperationData, WithdrawLiquidityOperationData } from "./types";
import fs from "fs";

export class DuckDb {
  private db: Database;

  closeDuckDb(): void {
    this.db.close();
  }

  async initDuckDb(fileName?: string): Promise<void> {
    this.db = await Database.create(fileName ?? "oraidex-sync-data");
  }

  async initDuckDbConnection(): Promise<Connection> {
    return this.db.connect();
  }

  async createHeightSnapshot() {
    const db = await this.initDuckDbConnection();
    await db.exec("CREATE TABLE IF NOT EXISTS height_snapshot (currentInd UINTEGER,PRIMARY KEY (currentInd))");
  }

  async loadHeightSnapshot() {
    const db = await this.initDuckDbConnection();
    const result = await db.all("SELECT * FROM height_snapshot");
    return result.length > 0 ? result[0] : { currentInd: 1 };
  }

  async insertHeightSnapshot(currentInd: number) {
    const db = await this.initDuckDbConnection();
    await db.run("INSERT OR REPLACE INTO height_snapshot VALUES (?)", currentInd);
  }

  private async insertBulkData(data: any[], tableName: string) {
    // we wont insert anything if the data is empty. Otherwise it would throw an error while inserting
    if (data.length === 0) return;
    const db = await this.initDuckDbConnection();
    const tableFile = `${tableName}.json`;
    // the file written out is temporary only. Will be deleted after insertion
    await fs.promises.writeFile(tableFile, JSON.stringify(data));
    await db.run(`INSERT INTO ${tableName} SELECT * FROM read_json_auto(?)`, tableFile);
    await fs.promises.unlink(tableFile);
  }

  async createSwapOpsTable() {
    const db = await this.initDuckDbConnection();
    await db.exec(
      "CREATE TABLE IF NOT EXISTS swap_ops_data (txhash VARCHAR, timestamp TIMESTAMP, offerDenom VARCHAR, offerAmount UBIGINT, askDenom VARCHAR, returnAmount UBIGINT, taxAmount UBIGINT, commissionAmount UBIGINT, spreadAmount UBIGINT)"
    );
  }

  async insertSwapOps(ops: SwapOperationData[]) {
    await this.insertBulkData(ops, "swap_ops_data");
  }

  async createLiquidityOpsTable() {
    const db = await this.initDuckDbConnection();
    try {
      await db.all("select enum_range(NULL::LPOPTYPE);");
    } catch (error) {
      // if error it means the enum does not exist => create new
      await db.exec("CREATE TYPE LPOPTYPE AS ENUM ('provide','withdraw');");
    }
    await db.exec(
      "CREATE TABLE IF NOT EXISTS lp_ops_data (txhash VARCHAR, timestamp TIMESTAMP, firstTokenAmount UBIGINT, firstTokenDenom VARCHAR, secondTokenAmount UBIGINT, secondTokenDenom VARCHAR, txCreator VARCHAR, opType LPOPTYPE)"
    );
  }

  async insertLpOps(ops: WithdrawLiquidityOperationData[]) {
    await this.insertBulkData(ops, "lp_ops_data");
  }

  async querySwapOps() {
    const db = await this.initDuckDbConnection();
    return db.all("SELECT count(*) from swap_ops_data");
  }

  async queryLpOps() {
    const db = await this.initDuckDbConnection();
    return db.all("SELECT count(*) from lp_ops_data");
  }
}
