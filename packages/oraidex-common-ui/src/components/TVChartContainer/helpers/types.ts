import { Bar as BarType, PeriodParams } from "../charting_library";
import { PairToken } from "./useTVDatafeed";

export type Bar = BarType & {
  ticker?: string;
};

/**
 * @attribute pair: string - ex: "orai-orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh";
 * @attribute symbol: string - ex: "ORAI/USDT";
 * @attribute startTime: number (time in seconds);
 * @attribute endTime: number (time in seconds);
 * @attribute tf: number (time in seconds);
 */
export type FetchChartDataParams = {
  pair: string;
  symbol?: string;
  startTime: number;
  endTime: number;
  tf: number;
};

export type GetBarDataParams = {
  pair: PairToken;
  ticker: string;
  resolution: string;
  periodParams: PeriodParams;
  shouldRefetchBars: boolean;
  baseUrl?: string;
  fetchDataChart?: (arg: FetchChartDataParams) => Promise<Bar[]>;
};

export type GetLastBarDataParams = {
  pair: PairToken;
  ticker: string;
  period: string;
  resolution: string;
  fetchDataChart?: (arg: FetchChartDataParams) => Promise<Bar[]>;
  baseUrl?: string;
};

export type GetLiveBarDataParams = {
  pair: PairToken;
  ticker: string;
  resolution: string;
  baseUrl?: string;
  fetchDataChart?: (arg: FetchChartDataParams) => Promise<Bar[]>;
};

export type GetTokenChartPriceParams = {
  pair: PairToken;
  periodParams: PeriodParams;
  resolution: string;
  fetchDataChart?: (params: FetchChartDataParams) => Promise<Bar[]>;
  baseUrl: string;
};
