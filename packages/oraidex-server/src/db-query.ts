import { DuckDb, PoolAmountHistory } from "@oraichain/oraidex-sync";

export type LowHighPriceOfPairType = {
  low: number;
  high: number;
  pair: string;
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
}
