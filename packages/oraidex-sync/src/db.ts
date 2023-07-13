import { Database, Connection } from 'duckdb-async';
import { ProvideLiquidityOperationData, SwapOperationData, WithdrawLiquidityOperationData } from './types';
import fs from 'fs';

function generateRandomString(length) {
  const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let randomString = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * letters.length);
    randomString += letters[randomIndex];
  }

  return randomString;
}

export class DuckDb {
  private db: Database;

  closeDuckDb(): void {
    this.db.close();
  }

  async initDuckDb(fileName?: string): Promise<void> {
    this.db = await Database.create(fileName ?? 'oraidex-sync-data');
  }

  async initDuckDbConnection(): Promise<Connection> {
    return this.db.connect();
  }

  async createHeightSnapshot() {
    const db = await this.initDuckDbConnection();
    await db.exec('CREATE TABLE IF NOT EXISTS height_snapshot (currentInd INTEGER,PRIMARY KEY (currentInd))');
  }

  async loadHeightSnapshot() {
    const db = await this.initDuckDbConnection();
    const result = await db.all('SELECT * FROM height_snapshot');
    return result.length > 0 ? result[0] : { currentInd: 1 };
  }

  async insertHeightSnapshot(currentInd: number) {
    const db = await this.initDuckDbConnection();
    await db.exec('INSERT OR REPLACE INTO height_snapshot VALUES (?)', currentInd);
  }

  private async insertBulkData(data: any[], tableName: string) {
    const db = await this.initDuckDbConnection();
    // random because we will discard this file once we finish inserting the bulk data into the db
    const randomString = generateRandomString(20);
    // const randomString = 'foobar';
    const randomFile = `${randomString}.json`;
    await fs.promises.writeFile(randomFile, JSON.stringify(data));
    await db.exec(`CREATE TEMP TABLE ${randomString} AS SELECT * FROM read_json_auto(?)`, randomFile);
    // delete file before inserting because the insertion may throw error
    fs.unlink(randomFile, () => {});
    await db.exec(`INSERT INTO ${tableName} SELECT * FROM ${randomString}`);
  }

  async createSwapOpsTable() {
    const db = await this.initDuckDbConnection();
    await db.exec(
      'CREATE TABLE IF NOT EXISTS swap_ops_data (txhash VARCHAR, offerDenom VARCHAR, offerAmount INTEGER, askDenom VARCHAR, returnAmount INTEGER, taxAmount INTEGER, commissionAmount INTEGER, spreadAmount INTEGER)'
    );
  }

  async insertSwapOps(ops: SwapOperationData[]) {
    await this.insertBulkData(ops, 'swap_ops_data');
  }

  async createLiquidityOpsTable() {
    const db = await this.initDuckDbConnection();
    await db.exec('CREATE TYPE LPOPTYPE AS ENUM ("provide","withdraw")');
    await db.exec(
      'CREATE TABLE IF NOT EXISTS lp_ops_data (txhash VARCHAR, firstTokenAmount INTEGER, firstTokenDenom VARCHAR, secondTokenAmount INTEGER, secondTokenDenom VARCHAR, provider VARCHAR, opType LPOPTYPE)'
    );
  }

  async insertLpOps(ops: WithdrawLiquidityOperationData[]) {
    await this.insertBulkData(ops, 'lp_ops_data');
  }
}
