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

  async createHeightSnapshot() {
    const db = await this.initDuckDbConnection();
    await db.all(
      "CREATE TABLE IF NOT EXISTS height_snapshot (currentInd INTEGER,PRIMARY KEY (currentInd))"
    );
  }

  async loadHeightSnapshot() {
    const db = await this.initDuckDbConnection();
    const result = await db.all("SELECT * FROM height_snapshot");
    return result.length > 0 ? result[0] : { currentInd: 1 };
  }

  async insertHeightSnapshot(currentInd: number) {
    const db = await this.initDuckDbConnection();
    await db.all(
      "INSERT OR REPLACE INTO height_snapshot VALUES (?)",
      currentInd
    );
  }
}
