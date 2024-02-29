import { BigDecimal, CW20_DECIMALS } from "@oraichain/oraidex-common";
import { DuckDb, PoolAmountHistory, SwapOperationData } from "@oraichain/oraidex-sync";
import { ARRANGED_PAIRS_CHART, getAssetInfosFromPairString, getPriceAssetByUsdtWithTimestamp } from "./helper";
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
      "SELECT * FROM swap_ops_data WHERE (offerDenom = ? AND askDenom = ?) OR (offerDenom = ? AND askDenom = ?) ORDER BY txheight LIMIT ?";
    const params = [askDenom, offerDenom, offerDenom, askDenom, limit ? Math.min(100, parseInt(limit)) : 20];
    const result = (await this.duckDb.conn.all(sql, ...params)) as SwapOperationData[];
    return result;
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

    const [baseAssetInfo] = getAssetInfosFromPairString(pair);
    if (!baseAssetInfo) throw new Error(`Cannot find  asset infos for pair: ${pair}`);

    const swapVolume = [];
    for (const item of result) {
      const basePriceInUsdt = await getPriceAssetByUsdtWithTimestamp(baseAssetInfo, item.timestamp);
      swapVolume.push({
        time: item.time,
        value: new BigDecimal(Math.trunc(basePriceInUsdt * item.value)).div(10 ** CW20_DECIMALS).toNumber()
      });
    }
    return swapVolume;
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
                   AVG(offerPoolAmount) AS value
                 FROM lp_amount_history
                 WHERE pairAddr = ?
                 GROUP BY DATE_TRUNC('${type}', to_timestamp(timestamp))
                 ORDER BY timestamp
                 `;
    const params = [pairObj.pairAddr];
    const result = await this.duckDb.conn.all(sql, ...params);

    const liquiditiesAvg = [];
    for (const item of result) {
      const basePriceInUsdt = await getPriceAssetByUsdtWithTimestamp(assetInfos[0], item.timestamp);
      const liquidityInUsdt = new BigDecimal(Math.trunc(basePriceInUsdt * item.value))
        .div(10 ** CW20_DECIMALS)
        .mul(2)
        .toNumber();
      liquiditiesAvg.push({
        time: item.time,
        value: liquidityInUsdt
      });
    }
    return liquiditiesAvg;
  }

  async getLiquidityChartAllPools(query: GetHistoricalChart): Promise<HistoricalChartResponse[]> {
    const { type } = query;
    const promiseLiquidities = ARRANGED_PAIRS_CHART.map((p) => {
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

    return totalLiquiditiesChart.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }
}
