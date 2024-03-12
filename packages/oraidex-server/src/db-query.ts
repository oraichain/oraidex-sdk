import { BigDecimal, CW20_DECIMALS, KWT_CONTRACT, ORAI } from "@oraichain/oraidex-common";
import {
  DuckDb,
  PoolAmountHistory,
  SwapOperationData,
  getDate24hBeforeNow,
  getPairLiquidity,
  getPoolLiquidities,
  getPoolsFromDuckDb
} from "@oraichain/oraidex-sync";
import { ARRANGED_PAIRS_CHART, AllPairsInfo, getAssetInfosFromPairString, getPriceAssetInUsd } from "./helper";
import { CACHE_KEY, cache } from "./map-cache";
import "./polyfill";

export type LowHighPriceOfPairType = {
  low: number;
  high: number;
  pair: string;
};

export type GetSwapHistory = {
  offerDenom: string;
  askDenom: string;
  limit?: string;
};

export type GetHistoricalChart = {
  type: "day" | "week" | "month";
  pair?: string;
};

export type HistoricalChartResponse = {
  time: string;
  value: number;
};

export class DbQuery {
  constructor(public readonly duckDb: DuckDb) {}

  async getLowHighPrice(query?: { timestamp: number }): Promise<LowHighPriceOfPairType[]> {
    const { timestamp } = query;

    let sql = `SELECT min(low) as low,
                      max(high) as high,
                      pair
               FROM swap_ohlcv
              `;
    const params = [];
    if (timestamp) {
      sql += "WHERE timestamp >= ?";
      params.push(timestamp);
    }
    sql += " GROUP BY pair";

    const result = (await this.duckDb.conn.all(sql, ...params)) as LowHighPriceOfPairType[];
    return result;
  }

  async getListLpAmount(query?: { timestamp: number }): Promise<PoolAmountHistory[]> {
    const { timestamp } = query;

    let sql = "SELECT * FROM lp_amount_history ";
    const params = [];
    if (timestamp) {
      sql += "WHERE timestamp >= ? ";
      params.push(timestamp);
    }
    sql += "ORDER BY timestamp DESC";
    const result = (await this.duckDb.conn.all(sql, ...params)) as PoolAmountHistory[];
    return result;
  }

  async getSwapHistory(query: GetSwapHistory): Promise<SwapOperationData[]> {
    const { limit, offerDenom, askDenom } = query;
    const sql =
      "SELECT * FROM swap_ops_data WHERE (offerDenom = ? AND askDenom = ?) OR (offerDenom = ? AND askDenom = ?) ORDER BY txheight DESC LIMIT ?";
    const params = [askDenom, offerDenom, offerDenom, askDenom, limit ? Math.min(100, parseInt(limit)) : 20];
    const result = (await this.duckDb.conn.all(sql, ...params)) as SwapOperationData[];
    return result;
  }

  async getSwapVolumeForPairByRangeTime(pair: string, then: number, now: number, basePriceInUsdt: number) {
    const sql = `SELECT SUM(volume) AS value
                 FROM swap_ohlcv
                 WHERE pair = ? AND timestamp >= ? AND timestamp <= ?`;
    const params = [pair, then, now];
    const result = await this.duckDb.conn.all(sql, ...params);
    if (result.length === 0) return 0;
    const swapVolume = new BigDecimal(Math.trunc(basePriceInUsdt * result[0].value))
      .div(10 ** CW20_DECIMALS)
      .toNumber();
    return swapVolume;
  }

  async getSwapVolumeAllPair(query: GetHistoricalChart): Promise<HistoricalChartResponse[]> {
    const { type } = query;
    const promiseVolumes = ARRANGED_PAIRS_CHART.map((p) => {
      return this.getSwapVolume({ pair: p.info, type });
    });
    const result = await Promise.all(promiseVolumes);
    const res: {
      [timestamp: string]: number;
    } = {};
    result.flat().reduce((acc, cur) => {
      const date = new Date(cur.time);
      const time = date.toISOString();
      if (!acc[time]) acc[time] = cur.value;
      else acc[time] += cur.value;
      return acc;
    }, res);
    const totalVolumeChart = [];
    for (const [time, value] of Object.entries(res)) {
      totalVolumeChart.push({
        time,
        value
      });
    }

    return totalVolumeChart.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }

  async getSwapVolume(query: GetHistoricalChart): Promise<HistoricalChartResponse[]> {
    const { pair, type } = query;
    const assetInfos = getAssetInfosFromPairString(pair);
    if (!assetInfos) throw new Error(`Cannot find asset infos for pairAddr: ${pair}`);

    const sql = `SELECT
                   ANY_VALUE(timestamp) as timestamp,
                   DATE_TRUNC('${type}', to_timestamp(timestamp)) AS time,
                   SUM(volume) AS value
                 FROM swap_ohlcv
                 WHERE pair = ?
                 GROUP BY DATE_TRUNC('${type}', to_timestamp(timestamp))
                 ORDER BY timestamp
                 `;
    const params = [pair];
    const result = await this.duckDb.conn.all(sql, ...params);

    const [baseAssetInfo] = assetInfos;
    const basePriceInUsdt = await getPriceAssetInUsd(baseAssetInfo);

    const swapVolume = [];
    for (const item of result) {
      swapVolume.push({
        time: item.time,
        value: new BigDecimal(Math.trunc(basePriceInUsdt * item.value)).div(10 ** CW20_DECIMALS).toNumber()
      });
    }

    // get volume latest 24h for the last record
    const now = new Date();
    const then = getDate24hBeforeNow(now);
    const swapVolumeLatest24h = await this.getSwapVolumeForPairByRangeTime(
      pair,
      Math.trunc(then.getTime() / 1000),
      Math.trunc(now.getTime() / 1000),
      basePriceInUsdt
    );
    if (swapVolumeLatest24h)
      swapVolume[swapVolume.length - 1] = {
        ...swapVolume[swapVolume.length - 1],
        value: swapVolumeLatest24h
      };
    return swapVolume;
  }

  async getLatestLiquidityPools() {
    const pools = await getPoolsFromDuckDb();
    const allLiquidities = await getPoolLiquidities(pools);
    const totalLiquiditesInUsdt = allLiquidities.reduce((acc, cur) => {
      acc += cur;
      return acc;
    }, 0);

    return totalLiquiditesInUsdt;
  }

  async getLiquidityChart(query: GetHistoricalChart): Promise<HistoricalChartResponse[]> {
    const { pair, type } = query;
    const assetInfos = getAssetInfosFromPairString(pair);
    if (!assetInfos) throw new Error(`Cannot find asset infos for pairAddr: ${pair}`);

    const pairObj = await this.duckDb.getPoolByAssetInfos(assetInfos);
    if (!pairObj) throw new Error(`Cannot find pair for assetInfos: ${JSON.stringify(assetInfos)}`);

    const sql = `SELECT
                   ANY_VALUE(timestamp) as timestamp,
                   DATE_TRUNC('${type}', to_timestamp(timestamp)) AS time,
                   MAX(offerPoolAmount) AS value
                 FROM lp_amount_history
                 WHERE pairAddr = ?
                 GROUP BY DATE_TRUNC('${type}', to_timestamp(timestamp))
                 ORDER BY timestamp
                 `;
    const params = [pairObj.pairAddr];
    const result = await this.duckDb.conn.all(sql, ...params);

    const [baseAssetInfo] = assetInfos;
    const basePriceInUsdt = await getPriceAssetInUsd(baseAssetInfo);

    const liquiditiesAvg = [];
    for (const item of result) {
      const liquidityInUsdt = new BigDecimal(Math.trunc(basePriceInUsdt * Number(item.value)))
        .div(10 ** CW20_DECIMALS)
        .mul(2)
        .toNumber();
      liquiditiesAvg.push({
        time: item.time,
        value: liquidityInUsdt
      });
    }

    let latestLiquidityPool = 0;
    const poolsInfo = cache.get(CACHE_KEY.POOLS_INFO);
    if (poolsInfo) {
      const currentPool = poolsInfo.find((p) => p.pairAddr === pairObj.pairAddr);
      if (currentPool) latestLiquidityPool = currentPool.totalLiquidity;
    } else {
      latestLiquidityPool = await getPairLiquidity(pairObj);
    }

    if (latestLiquidityPool)
      liquiditiesAvg[liquiditiesAvg.length - 1] = {
        ...liquiditiesAvg[liquiditiesAvg.length - 1],
        value: new BigDecimal(latestLiquidityPool).div(10 ** 6).toNumber()
      };

    const KWT_ORAI_PAIR = `${KWT_CONTRACT}-${ORAI}`;

    // TODO: current harcode filter data for kwt-orai pair
    if (pair === KWT_ORAI_PAIR)
      return liquiditiesAvg.filter((item) => {
        const itemTime = item?.time ? new Date(item.time) : null;
        return itemTime && itemTime.getDate() > 1 && itemTime.getMonth() > 1 && itemTime.getFullYear() > 2023;
      });

    return liquiditiesAvg;
  }

  async getLiquidityChartAllPools(
    query: GetHistoricalChart,
    pairs: AllPairsInfo[]
  ): Promise<HistoricalChartResponse[]> {
    const { type } = query;
    const promiseLiquidities = pairs.map((p) => {
      return this.getLiquidityChart({ pair: p.info, type });
    });
    const result = await Promise.all(promiseLiquidities);
    const res: {
      [timestamp: string]: number;
    } = {};
    result.flat().reduce((acc, cur) => {
      const date = new Date(cur.time);
      const time = date.toISOString();
      if (!acc[time]) acc[time] = cur.value;
      else acc[time] += cur.value;
      return acc;
    }, res);
    const totalLiquiditiesChart = [];
    for (const [time, value] of Object.entries(res)) {
      totalLiquiditiesChart.push({
        time,
        value
      });
    }

    let latestLiquidityPools = 0;
    const poolsInfo = cache.get(CACHE_KEY.POOLS_INFO);
    if (poolsInfo) {
      poolsInfo.reduce((acc, cur) => {
        acc += cur.totalLiquidity;
        return acc;
      }, latestLiquidityPools);
    } else {
      latestLiquidityPools = await this.getLatestLiquidityPools();
    }

    if (latestLiquidityPools)
      totalLiquiditiesChart[totalLiquiditiesChart.length - 1] = {
        ...totalLiquiditiesChart[totalLiquiditiesChart.length - 1],
        value: new BigDecimal(latestLiquidityPools).div(10 ** 6).toNumber()
      };

    return totalLiquiditiesChart.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }
}
