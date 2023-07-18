import { Database, Connection } from "duckdb-async";
import { PairInfoData, PriceInfo, SwapOperationData, TokenVolumeData, WithdrawLiquidityOperationData } from "./types";
import fs from "fs";

export class DuckDb {
  protected constructor(public readonly conn: Connection) {}

  static async create(fileName?: string): Promise<DuckDb> {
    const db = await Database.create(fileName ?? "data");
    const conn = await db.connect();
    return new DuckDb(conn);
  }

  private async insertBulkData(data: any[], tableName: string, replace?: boolean, fileName?: string) {
    // we wont insert anything if the data is empty. Otherwise it would throw an error while inserting
    if (data.length === 0) return;
    const tableFile = fileName ?? `${tableName}.json`;
    // the file written out is temporary only. Will be deleted after insertion
    await fs.promises.writeFile(tableFile, JSON.stringify(data));
    const query = replace
      ? `INSERT OR REPLACE INTO ${tableName} SELECT * FROM read_json_auto(?)`
      : `INSERT INTO ${tableName} SELECT * FROM read_json_auto(?)`;
    await this.conn.run(query, tableFile);
    await fs.promises.unlink(tableFile);
  }

  // sync height table
  async createHeightSnapshot() {
    await this.conn.exec("CREATE TABLE IF NOT EXISTS height_snapshot (config VARCHAR PRIMARY KEY, value UINTEGER)");
  }

  async loadHeightSnapshot(): Promise<number> {
    const result = await this.conn.all("SELECT value FROM height_snapshot where config = 'last_block_height'");
    return result.length > 0 ? (result[0].value as number) : 1;
  }

  async insertHeightSnapshot(currentInd: number) {
    await this.conn.run("INSERT OR REPLACE into height_snapshot VALUES ('last_block_height',?)", currentInd);
  }

  // swap operation table handling
  async createSwapOpsTable() {
    await this.conn.exec(
      `CREATE TABLE IF NOT EXISTS swap_ops_data (
        askDenom VARCHAR, 
        commissionAmount UBIGINT,
        offerAmount UBIGINT,
        offerDenom VARCHAR, 
        returnAmount UBIGINT, 
        spreadAmount UBIGINT, 
        taxAmount UBIGINT, 
        timestamp TIMESTAMP, 
        txhash VARCHAR)`
    );
  }

  async insertSwapOps(ops: SwapOperationData[]) {
    await this.insertBulkData(ops, "swap_ops_data");
  }

  // liquidity operations (provide, withdraw lp) handling
  async createLiquidityOpsTable() {
    try {
      await this.conn.all("select enum_range(NULL::LPOPTYPE);");
    } catch (error) {
      // if error it means the enum does not exist => create new
      await this.conn.exec("CREATE TYPE LPOPTYPE AS ENUM ('provide','withdraw');");
    }
    await this.conn.exec(
      `CREATE TABLE IF NOT EXISTS lp_ops_data (
        firstTokenAmount UBIGINT, 
        firstTokenDenom VARCHAR, 
        firstTokenLp UBIGINT, 
        opType LPOPTYPE, 
        secondTokenAmount UBIGINT, 
        secondTokenDenom VARCHAR, 
        secondTokenLp UBIGINT,
        timestamp TIMESTAMP,
        txCreator VARCHAR, 
        txhash VARCHAR)`
    );
  }

  async insertLpOps(ops: WithdrawLiquidityOperationData[]) {
    await this.insertBulkData(ops, "lp_ops_data");
  }

  // store all the current pair infos of oraiDEX. Will be updated to the latest pair list after the sync is restarted
  async createPairInfosTable() {
    await this.conn.exec(
      "CREATE TABLE IF NOT EXISTS pair_infos (firstAssetInfo VARCHAR, secondAssetInfo VARCHAR, commissionRate VARCHAR, pairAddr VARCHAR, liquidityAddr VARCHAR, oracleAddr VARCHAR,PRIMARY KEY (pairAddr) )"
    );
  }

  async insertPairInfos(ops: PairInfoData[]) {
    await this.insertBulkData(ops, "pair_infos", true);
  }

  async createPriceInfoTable() {
    await this.conn.exec(
      "CREATE TABLE IF NOT EXISTS price_infos (txheight UINTEGER, timestamp TIMESTAMP, assetInfo VARCHAR, price UINTEGER)"
    );
  }

  async insertPriceInfos(ops: PriceInfo[]) {
    await this.insertBulkData(ops, "price_infos", false, `price_infos-${Math.random() * 1000}`);
  }

  async queryAllVolume(denom: string): Promise<TokenVolumeData> {
    const volume = (
      await Promise.all([
        this.conn.all("SELECT sum(offerAmount) as volume from swap_ops_data where offerDenom = ?;", denom),
        this.conn.all("SELECT sum(returnAmount) as volume from swap_ops_data where askDenom = ?;", denom)
      ])
    )
      .flat()
      .filter((vol) => vol.volume);
    console.log("volume: ", volume);
    return {
      denom,
      volume: volume.reduce((accumulator, currentObject) => {
        return accumulator + currentObject.volume;
      }, 0)
    };
  }

  async queryAllVolumeRange(denom: string, startTime: string, endTime: string) {
    const volume = (
      await Promise.all([
        this.conn.all(
          `SELECT sum(offerAmount) 
        as volume 
        from swap_ops_data 
        where offerDenom = ? and timestamp >= '${startTime}'::TIMESTAMP and timestamp <= '${endTime}'::TIMESTAMP`,
          denom
        ),
        this.conn.all(
          `SELECT sum(returnAmount) 
        as volume 
        from swap_ops_data 
        where askDenom = ? and timestamp >= '${startTime}'::TIMESTAMP and timestamp <= '${endTime}'::TIMESTAMP`,
          denom
        )
      ])
    ).flat();
    return {
      denom,
      volume: volume.reduce((accumulator, currentObject) => {
        return accumulator + currentObject.volume;
      }, 0)
    };
  }

  async queryLatestTimestampSwapOps(): Promise<string> {
    const latestTimestamp = await this.conn.all("SELECT timestamp from swap_ops_data order by timestamp desc limit 1");
    return latestTimestamp[0].timestamp as string;
  }

  async querySwapOps() {
    return this.conn.all("SELECT count(*) from swap_ops_data");
  }

  async queryLpOps() {
    return this.conn.all("SELECT * from lp_ops_data");
  }

  async queryPairInfos(): Promise<PairInfoData[]> {
    return (await this.conn.all("SELECT firstAssetInfo, secondAssetInfo, pairAddr from pair_infos")).map(
      (data) => data as PairInfoData
    );
  }
}

[{ volume: 1 }, { volume: 3 }];
