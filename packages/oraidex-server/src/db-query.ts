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

export class DbQuery {
  constructor(public readonly duckDb: DuckDb) { }

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
}
