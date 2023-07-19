import { Database, Connection } from "duckdb-async";
import {
  PairInfoData,
  PriceInfo,
  SwapOperationData,
  TokenVolumeData,
  VolumeData,
  WithdrawLiquidityOperationData
} from "./types";
import fs, { rename } from "fs";
import { renameKey, replaceAllNonAlphaBetChar } from "./helper";

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
      `CREATE TABLE IF NOT EXISTS pair_infos (
        firstAssetInfo VARCHAR, 
        secondAssetInfo VARCHAR, 
        commissionRate VARCHAR, 
        pairAddr VARCHAR, 
        liquidityAddr VARCHAR, 
        oracleAddr VARCHAR,
        PRIMARY KEY (pairAddr) )`
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

  reduceVolume(
    volume: VolumeData[],
    data: { modifiedOfferDenom: string; modifiedAskDenom: string; offerDenom: string; askDenom: string }
  ): VolumeData {
    // by default, the offer denom & ask denom are in modified state. Need to rename them afterwards
    const { offerDenom, modifiedOfferDenom, askDenom, modifiedAskDenom } = data;
    let volumeData = volume.reduce((accumulator, currentObject) => {
      accumulator[modifiedOfferDenom] = (accumulator[modifiedOfferDenom] || 0) + currentObject[modifiedOfferDenom];
      accumulator[modifiedAskDenom] = (accumulator[modifiedAskDenom] || 0) + currentObject[modifiedAskDenom];
      return accumulator;
    }, {}) as VolumeData;
    volumeData = renameKey(volumeData, modifiedOfferDenom, offerDenom);
    volumeData = renameKey(volumeData, modifiedAskDenom, askDenom);

    return volumeData;
  }

  async queryAllVolume(offerDenom: string, askDenom: string): Promise<TokenVolumeData> {
    const modifiedOfferDenom = replaceAllNonAlphaBetChar(offerDenom);
    const modifiedAskDenom = replaceAllNonAlphaBetChar(askDenom);
    const volume = (
      await Promise.all([
        this.conn.all(
          `SELECT sum(offerAmount) as ${modifiedOfferDenom}, sum(returnAmount) as ${modifiedAskDenom} 
          from swap_ops_data 
          where offerDenom = ? 
          and askDenom = ?`,
          offerDenom,
          askDenom
        ),
        this.conn.all(
          `SELECT sum(offerAmount) as ${modifiedAskDenom}, sum(returnAmount) as ${modifiedOfferDenom} 
          from swap_ops_data 
          where offerDenom = ? 
          and askDenom = ?`,
          askDenom,
          offerDenom
        )
      ])
    ).flat();
    return {
      offerDenom,
      askDenom,
      volume: this.reduceVolume(volume, { offerDenom, modifiedOfferDenom, askDenom, modifiedAskDenom })
    };
  }

  async queryAllVolumeRange(
    offerDenom: string,
    askDenom: string,
    startTime: string,
    endTime: string
  ): Promise<TokenVolumeData> {
    // need to replace because the denom can contain numbers and other figures. We replace for temporary only, will be reverted once finish reducing
    const modifiedOfferDenom = replaceAllNonAlphaBetChar(offerDenom);
    const modifiedAskDenom = replaceAllNonAlphaBetChar(askDenom);
    const volume = (
      await Promise.all([
        this.conn.all(
          `SELECT sum(offerAmount) as ${modifiedOfferDenom}, sum(returnAmount) as ${modifiedAskDenom}
        from swap_ops_data 
        where offerDenom = ? 
        and askDenom = ? 
        and timestamp >= '${startTime}'::TIMESTAMP 
        and timestamp <= '${endTime}'::TIMESTAMP`,
          offerDenom,
          askDenom
        ),
        this.conn.all(
          `SELECT sum(offerAmount) as ${modifiedAskDenom}, sum(returnAmount) as ${modifiedOfferDenom}
        from swap_ops_data 
        where offerDenom = ? 
        and askDenom = ? 
        and timestamp >= '${startTime}'::TIMESTAMP 
        and timestamp <= '${endTime}'::TIMESTAMP`,
          askDenom,
          offerDenom
        )
      ])
    ).flat();
    return {
      offerDenom,
      askDenom,
      volume: this.reduceVolume(volume, { offerDenom, modifiedOfferDenom, askDenom, modifiedAskDenom }) // reduce volume to aggregate ask & offer volume of a token together
    };
  }

  async queryLatestTimestampSwapOps(): Promise<string> {
    const latestTimestamp = await this.conn.all("SELECT timestamp from swap_ops_data order by timestamp desc limit 1");
    if (latestTimestamp.length === 0 || !latestTimestamp[0].timestamp) return new Date().toISOString(); // fallback case
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
