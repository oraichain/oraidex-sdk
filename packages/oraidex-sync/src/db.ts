import fs from "fs";
import { Database, Connection } from "duckdb-async";

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
}
