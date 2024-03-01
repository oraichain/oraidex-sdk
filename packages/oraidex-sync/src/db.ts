import { AssetInfo } from "@oraichain/oraidex-contracts-sdk";
import { Connection, Database } from "duckdb-async";
import fs from "fs";
import { isoToTimestampNumber, renameKey } from "./helper";
import { parseAssetInfo, replaceAllNonAlphaBetChar, toObject } from "./parse";
import {
  EarningOperationData,
  GetCandlesQuery,
  GetFeeSwap,
  GetVolumeQuery,
  Ohlcv,
  PairInfoData,
  PoolAmountHistory,
  PoolApr,
  PriceInfo,
  StakeByUserResponse,
  SwapOperationData,
  TokenVolumeData,
  TotalLiquidity,
  VolumeData,
  VolumeRange,
  WithdrawLiquidityOperationData
} from "./types";

export class DuckDb {
  static instances: DuckDb;
  protected constructor(public readonly conn: Connection, private db: Database) {}

  static async create(fileName: string): Promise<DuckDb> {
    if (!fileName) throw new Error("Filename is not provided!");
    if (!DuckDb.instances) {
      let db = await Database.create(fileName);
      await db.close(); // close to flush WAL file
      db = await Database.create(fileName);
      const conn = await db.connect();
      DuckDb.instances = new DuckDb(conn, db);
    }

    return DuckDb.instances;
  }

  async closeDb() {
    this.db.close();
  }

  private async insertBulkData(data: any[], tableName: string, replace?: boolean, fileName?: string) {
    // we wont insert anything if the data is empty. Otherwise it would throw an error while inserting
    if (!Array.isArray(data) || data.length === 0) return;
    const tableFile = fileName ?? `${tableName}.json`;
    // the file written out is temporary only. Will be deleted after insertion
    await fs.promises.writeFile(tableFile, JSON.stringify(toObject(data)));
    const query = `INSERT OR REPLACE INTO ${tableName} SELECT * FROM read_json_auto(?)`;
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
    try {
      await this.conn.all("select enum_range(NULL::directionType);");
    } catch (error) {
      // if error it means the enum does not exist => create new
      await this.conn.exec("CREATE TYPE directionType AS ENUM ('Buy','Sell');");
    }
    await this.conn.exec(
      `CREATE TABLE IF NOT EXISTS swap_ops_data (
        askDenom VARCHAR, 
        commissionAmount UBIGINT,
        direction directionType,
        offerAmount UBIGINT,
        offerDenom VARCHAR, 
        uniqueKey VARCHAR UNIQUE,
        returnAmount UBIGINT, 
        spreadAmount UBIGINT, 
        taxAmount UBIGINT, 
        timestamp UINTEGER, 
        txhash VARCHAR,
        txheight UINTEGER)`
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
        basePrice double,
        baseTokenAmount UBIGINT, 
        baseTokenDenom VARCHAR, 
        opType LPOPTYPE, 
        uniqueKey VARCHAR UNIQUE,
        quoteTokenAmount UBIGINT, 
        quoteTokenDenom VARCHAR, 
        timestamp UINTEGER,
        txCreator VARCHAR, 
        txhash VARCHAR,
        txheight UINTEGER,
        taxRate UBIGINT)`
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
        symbols VARCHAR,
        fromIconUrl VARCHAR,
        toIconUrl VARCHAR,
        PRIMARY KEY (pairAddr) )`
    );
  }

  async insertPairInfos(ops: PairInfoData[]) {
    await this.insertBulkData(ops, "pair_infos", true);
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

  async queryAllVolumeRange(
    offerDenom: string, // eg: orai
    askDenom: string, // usdt
    startTime: number,
    endTime: number
  ): Promise<TokenVolumeData> {
    // need to replace because the denom can contain numbers and other figures. We replace for temporary only, will be reverted once finish reducing
    const modifiedOfferDenom = replaceAllNonAlphaBetChar(offerDenom);
    const modifiedAskDenom = replaceAllNonAlphaBetChar(askDenom);
    const volumeByOfferDenom = await this.conn.all(
      `SELECT sum(offerAmount) as ${modifiedOfferDenom}, sum(returnAmount) as ${modifiedAskDenom}
    from swap_ops_data 
    where offerDenom = ? 
    and askDenom = ? 
    and timestamp >= ? 
    and timestamp <= ?`,
      offerDenom,
      askDenom,
      startTime,
      endTime
    );
    const volumeByAskDenom = await this.conn.all(
      `SELECT sum(offerAmount) as ${modifiedAskDenom}, sum(returnAmount) as ${modifiedOfferDenom}
    from swap_ops_data 
    where offerDenom = ? 
    and askDenom = ? 
    and timestamp >= ? 
    and timestamp <= ?`,
      askDenom,
      offerDenom,
      startTime,
      endTime
    );
    const volume = [volumeByOfferDenom, volumeByAskDenom].flat();

    return {
      offerDenom,
      askDenom,
      volume: this.reduceVolume(volume, { offerDenom, modifiedOfferDenom, askDenom, modifiedAskDenom }) // reduce volume to aggregate ask & offer volume of a token together
    };
  }

  async queryLatestTimestampSwapOps(): Promise<number> {
    const latestTimestamp = await this.conn.all("SELECT timestamp from swap_ops_data order by timestamp desc limit 1");
    if (latestTimestamp.length === 0 || !latestTimestamp[0].timestamp)
      return isoToTimestampNumber(new Date().toISOString()); // fallback case
    return latestTimestamp[0].timestamp as number;
  }

  async querySwapOps() {
    return this.conn.all("SELECT count(*) from swap_ops_data");
  }

  async queryLpOps() {
    return this.conn.all("SELECT * from lp_ops_data");
  }

  async queryPairInfos(): Promise<PairInfoData[]> {
    return (
      await this.conn.all("SELECT firstAssetInfo, secondAssetInfo, pairAddr, commissionRate from pair_infos")
    ).map((data) => data as PairInfoData);
  }

  /**
   * query total lp with time frame. negative lp is withdraw. COALESCE - if null then use default value
   * @param tf timeframe in seconds
   * @param startTime start time in iso format
   * @param endTime end time in iso format
   */
  async queryTotalLpTimeFrame(tf: number, startTime: string, endTime: string): Promise<TotalLiquidity[]> {
    const result = await this.conn.all(
      `with pivot_lp_ops as (
        pivot lp_ops_data
        on opType
        using sum(baseTokenAmount + quoteTokenAmount) as liquidity )
        SELECT (timestamp // ?) as time,
        sum(COALESCE(provide_liquidity,0) - COALESCE(withdraw_liquidity, 0)) as liquidity,
        any_value(txheight) as height
        from pivot_lp_ops
        where timestamp >= ? 
        and timestamp <= ?
        group by time
        order by time`,
      tf,
      startTime,
      endTime
    );
    // reset time to iso format after dividing in the query
    result.forEach((item) => {
      item.time = item.time * tf;
    });
    return result as TotalLiquidity[];
  }

  async createSwapOhlcv() {
    await this.conn.exec(
      `CREATE TABLE IF NOT EXISTS swap_ohlcv (
        uniqueKey varchar UNIQUE,
        timestamp uinteger,
        pair varchar,
        volume ubigint,
        open double,
        close double,
        low double,
        high double)
        `
    );
  }

  async insertOhlcv(ohlcv: Ohlcv[]) {
    const filtedOhlcv = ohlcv.filter((item) => item.open != 0 && item.close != 0 && item.low != 0 && item.high != 0);
    await this.insertBulkData(filtedOhlcv, "swap_ohlcv");
  }

  async getOhlcvCandles(query: GetCandlesQuery): Promise<Ohlcv[]> {
    const { pair, tf, startTime, endTime } = query;

    // tf should be in seconds
    const result = await this.conn.all(
      `
        SELECT timestamp // ? as time,
                sum(volume) as volume,
                first(open) as open,
                last(close) as close,
                min(low) as low,
                max(high) as high
        FROM swap_ohlcv
        WHERE pair = ? AND timestamp >= ? AND timestamp <= ?
        GROUP BY time
        ORDER BY time
    `,
      +tf,
      pair,
      startTime,
      endTime
    );

    // get second
    result.forEach((item) => {
      item.time *= BigInt(+tf);
    });

    return result as Ohlcv[];
  }

  async getVolumeRange(tf: number, startTime: number, endTime: number, pair: string): Promise<VolumeRange[]> {
    const result = await this.conn.all(
      `
      SELECT timestamp // ? as time,
        any_value(pair) as pair,
        sum(volume) as baseVolume,
        cast(sum(close * volume) as UBIGINT) as quoteVolume,
        avg(close) as basePrice,
        FROM swap_ohlcv
        WHERE timestamp >= ? 
        AND timestamp <= ?
        and pair = ?
        GROUP BY time
        ORDER BY time
      `,
      tf,
      startTime,
      endTime,
      pair
    );
    return result.map((res) => ({
      ...res,
      time: new Date(Number(res.time) * tf * 1000).toISOString()
    })) as VolumeRange[];
  }

  async getPools(): Promise<PairInfoData[]> {
    return (await this.conn.all("SELECT * from pair_infos")).map((data) => data as PairInfoData);
  }

  async getPoolByAssetInfos(assetInfos: [AssetInfo, AssetInfo]): Promise<PairInfoData> {
    const firstAssetInfo = parseAssetInfo(assetInfos[0]);
    const secondAssetInfo = parseAssetInfo(assetInfos[1]);
    let pool = await this.conn.all(
      "SELECT * from pair_infos WHERE firstAssetInfo = ? AND secondAssetInfo = ?",
      firstAssetInfo,
      secondAssetInfo
    );
    if (pool.length === 0)
      pool = await this.conn.all(
        "SELECT * from pair_infos WHERE firstAssetInfo = ? AND secondAssetInfo = ?",
        secondAssetInfo,
        firstAssetInfo
      );

    return pool.map((data) => data as PairInfoData)[0];
  }

  async getFeeSwap(payload: GetFeeSwap): Promise<[number, number]> {
    const { offerDenom, askDenom, startTime, endTime } = payload;
    const feeRightDirection = await this.conn.all(
      `
      SELECT 
        sum(commissionAmount + taxAmount) as totalFee,
        FROM swap_ops_data
        WHERE timestamp >= ? 
        AND timestamp <= ?
        AND offerDenom = ?
        AND askDenom = ?
      `,
      startTime,
      endTime,
      offerDenom,
      askDenom
    );

    const feeReverseDirection = await this.conn.all(
      `
      SELECT 
        sum(commissionAmount + taxAmount) as totalFee,
        FROM swap_ops_data
        WHERE timestamp >= ? 
        AND timestamp <= ?
        AND offerDenom = ?
        AND askDenom = ?
      `,
      startTime,
      endTime,
      askDenom,
      offerDenom
    );

    return [feeRightDirection[0]?.totalFee, feeReverseDirection[0]?.totalFee];
  }

  async getFeeLiquidity(payload: GetFeeSwap): Promise<bigint> {
    const { offerDenom, askDenom, startTime, endTime } = payload;
    const result = await this.conn.all(
      `
      SELECT 
        sum(taxRate) as totalFee,
        FROM lp_ops_data
        WHERE timestamp >= ? 
        AND timestamp <= ?
        AND baseTokenDenom = ?
        AND quoteTokenDenom = ?
      `,
      startTime,
      endTime,
      offerDenom,
      askDenom
    );
    return BigInt(result[0]?.totalFee ?? 0);
  }

  async getVolumeSwap(payload: GetVolumeQuery): Promise<bigint> {
    const { pair, startTime, endTime } = payload;
    const result = await this.conn.all(
      `
      SELECT 
        sum(volume) as totalVolume,
        FROM swap_ohlcv
        WHERE timestamp >= ? 
        AND timestamp <= ?
        AND pair = ?
      `,
      startTime,
      endTime,
      pair
    );
    return BigInt(result[0]?.totalVolume ?? 0);
  }

  async createLpAmountHistoryTable() {
    await this.conn.exec(
      `CREATE TABLE IF NOT EXISTS lp_amount_history (
        offerPoolAmount ubigint,
        askPoolAmount ubigint,
        height uinteger,
        timestamp uinteger,
        totalShare varchar,
        pairAddr varchar,
        uniqueKey varchar UNIQUE)
      `
    );
  }

  async getLatestLpPoolAmount(pairAddr: string) {
    const result = await this.conn.all(
      `
        SELECT * FROM lp_amount_history
        WHERE pairAddr = ?
        ORDER BY height DESC
        LIMIT 1
      `,
      pairAddr
    );
    return result[0] as PoolAmountHistory;
  }

  async getLpAmountWithTime(pairAddr: string, timestamp: number) {
    const result = await this.conn.all(
      `
        SELECT * FROM lp_amount_history
        WHERE pairAddr = ? AND timestamp >= ?
        ORDER BY timestamp ASC
        LIMIT 1
      `,
      pairAddr,
      timestamp
    );
    return result[0] as PoolAmountHistory;
  }

  async getLpAmountByTime(pairAddr: string, timestamp: number) {
    const result = await this.conn.all(
      `
        SELECT * FROM lp_amount_history
        WHERE pairAddr = ? AND timestamp >= ?
        ORDER BY timestamp ASC
      `,
      pairAddr,
      timestamp
    );
    return result as PoolAmountHistory[];
  }

  async insertPoolAmountHistory(ops: PoolAmountHistory[]) {
    await this.insertBulkData(ops, "lp_amount_history");
  }

  async createPoolAprTable() {
    await this.conn.exec(
      `CREATE TABLE IF NOT EXISTS pool_apr (
          uniqueKey varchar UNIQUE,
          pairAddr varchar,
          height uinteger,
          totalSupply varchar,
          totalBondAmount varchar,
          rewardPerSec varchar,
          apr double
        )
      `
    );
  }

  async addTimestampColToPoolAprTable() {
    await this.conn.run("ALTER TABLE pool_apr ADD COLUMN IF NOT EXISTS timestamp UBIGINT DEFAULT 0");
  }

  async addAprBoostColToPoolAprTable() {
    await this.conn.run("ALTER TABLE pool_apr ADD COLUMN IF NOT EXISTS aprBoost DOUBLE DEFAULT 0");
  }

  async insertPoolAprs(poolAprs: PoolApr[]) {
    await this.insertBulkData(poolAprs, "pool_apr");
  }

  async getLatestPoolApr(pairAddr: string): Promise<PoolApr> {
    const result = await this.conn.all(
      `
        SELECT * FROM pool_apr
        WHERE pairAddr = ?
        ORDER BY timestamp DESC
        LIMIT 1
      `,
      pairAddr
    );

    return result[0] as PoolApr;
  }

  async getAllAprs() {
    const result = await this.conn.all(
      `
      WITH RankedPool AS (
        SELECT pairAddr, apr, rewardPerSec, totalSupply, height, aprBoost,
               ROW_NUMBER() OVER (PARTITION BY pairAddr ORDER BY timestamp DESC) AS rn
        FROM pool_apr
    )
    SELECT pairAddr, apr, rewardPerSec, totalSupply, aprBoost
    FROM RankedPool
    WHERE rn = 1
    ORDER BY apr
    ;
      `
    );
    return result as Pick<PoolApr, "apr" | "pairAddr" | "rewardPerSec" | "totalSupply" | "aprBoost">[];
  }

  async getMyEarnedAmount(stakerAddress: string, startTime: number, endTime: number, stakingAssetDenom?: string) {
    let query = ` SELECT stakingAssetDenom, SUM(earnAmountInUsdt) as earnAmountInUsdt
    FROM earning_history
    WHERE stakerAddress = ? AND timestamp >= ? AND timestamp <= ?
  `;
    const queryParams = [stakerAddress, startTime, endTime];
    if (stakingAssetDenom) {
      query += " AND stakingAssetDenom = ?";
      queryParams.push(stakingAssetDenom);
    }

    query += " GROUP BY stakingAssetDenom";

    const result = await this.conn.all(query, ...queryParams);
    return result as StakeByUserResponse[];
  }

  async createEarningHistoryTable() {
    await this.conn.exec(
      `CREATE TABLE IF NOT EXISTS earning_history (
          uniqueKey varchar UNIQUE,
          txheight uinteger,
          txhash varchar,
          timestamp uinteger,
          stakerAddress varchar,
          stakingAssetDenom varchar,
          stakingAssetPrice double,
          earnAmount bigint,
          earnAmountInUsdt double,
          rewardAssetDenom varchar
        )
      `
    );
  }

  async insertEarningHistories(earningHistories: EarningOperationData[]) {
    await this.insertBulkData(earningHistories, "earning_history");
  }

  async getEarningHistoriesByStaker(stakerAddress: string): Promise<number> {
    const result = await this.conn.all(
      "SELECT count(*) as count from earning_history WHERE stakerAddress = ?",
      stakerAddress
    );
    return result[0].count;
  }

  async getLpAmountHistory(): Promise<number> {
    const result = await this.conn.all("SELECT count(*) as count from lp_amount_history");
    return result[0].count;
  }
}
