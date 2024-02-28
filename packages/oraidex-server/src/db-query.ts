import { PAIRS_CHART, BigDecimal } from "@oraichain/oraidex-common";
import { getBaseAssetInfoFromPairString, getPriceAssetByUsdtWithTimestamp } from "./helper";
import "./polyfill";
import { DuckDb, PoolAmountHistory, SwapOperationData } from "@oraichain/oraidex-sync";

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
    const promiseVolumes = PAIRS_CHART.map((p) => {
      return this.getSwapVolume({ pair: p.info, type });
    });
    const result = await Promise.all(promiseVolumes);
    const res: {
      [timestamp: string]: number;
    } = {};
    result.flat().reduce((acc, cur) => {
      if (!acc[cur.time]) acc[cur.time] = cur.value;
      else acc[cur.time] += cur.value;
      return acc;
    }, res);
    const totalVolumeChart = [];
    for (const [time, value] of Object.entries(res)) {
      totalVolumeChart.push({
        time,
        value
      });
    }

    return totalVolumeChart;
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

    const baseAssetInfo = getBaseAssetInfoFromPairString(pair);
    if (!baseAssetInfo) throw new Error(`Cannot find base asset info for pair: ${pair}`);

    const swapVolume = [];
    for (const item of result) {
      const basePriceInUsdt = await getPriceAssetByUsdtWithTimestamp(baseAssetInfo, item.timestamp);
      swapVolume.push({
        time: item.time,
        value: new BigDecimal(Math.trunc(basePriceInUsdt * item.value)).div(10 ** 6).toNumber()
      });
    }
    return swapVolume;
  }
}
