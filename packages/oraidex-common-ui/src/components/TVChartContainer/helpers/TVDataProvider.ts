import { PeriodParams } from "../charting_library";
import { Bar } from "./types";
import { fillBarGaps, formatTimeInBarToMs, getCurrentCandleTime } from "./utils";
import { getTokenChartPrice } from "./requests";
import { CHART_PERIODS, SUPPORTED_RESOLUTIONS } from "./constants";

const getUTCTimestamp = (periodTimestamp: number = 0, nowDate: Date = new Date()): number => {
  const secondsPerDay = 86400;
  const currentSecondTime = Math.floor(nowDate.getTime() / 1000);
  return currentSecondTime + periodTimestamp * secondsPerDay;
};

const initialHistoryBarsInfo = {
  period: "",
  data: [],
  ticker: ""
};

export class TVDataProvider {
  lastBar: Bar | null;
  startTime: number;
  lastTicker: string;
  lastPeriod: string;
  barsInfo: {
    period: string;
    data: Bar[];
    ticker: string;
  };

  constructor() {
    this.lastBar = null;
    this.startTime = 0;
    this.lastTicker = "";
    this.lastPeriod = "";
    this.barsInfo = initialHistoryBarsInfo;
  }

  async getTokenHistoryBars(
    pair: string,
    ticker: string,
    periodParams: PeriodParams,
    shouldRefetchBars: boolean,
    resolution: string
  ): Promise<Bar[]> {
    const barsInfo = this.barsInfo;
    const period = SUPPORTED_RESOLUTIONS[resolution];
    if (!barsInfo.data.length || barsInfo.ticker !== ticker || barsInfo.period !== period || shouldRefetchBars) {
      try {
        const bars = await getTokenChartPrice(pair, periodParams, resolution);
        const filledBars = fillBarGaps(bars, CHART_PERIODS[period]);
        const currentCandleTime = getCurrentCandleTime(period);
        const lastCandleTime = currentCandleTime - CHART_PERIODS[period];
        const lastBar = filledBars[filledBars.length - 1];
        if (lastBar?.time === currentCandleTime || lastBar?.time === lastCandleTime) {
          this.lastBar = { ...lastBar, ticker };
        }
        this.barsInfo.data = filledBars;
        this.barsInfo.ticker = ticker;
        this.barsInfo.period = period;
      } catch (error) {
        console.error("GetTokenHistoryBars error:", error);
        this.barsInfo = initialHistoryBarsInfo;
      }
    }

    const { from, to, countBack } = periodParams;
    const toWithOffset = to;
    const fromWithOffset = from;
    const bars = barsInfo.data.filter((bar) => bar.time > fromWithOffset && bar.time <= toWithOffset);

    // if no bars returned, return empty array
    if (!bars.length) {
      return [];
    }

    // if bars are fewer than countBack, return all of them
    if (bars.length < countBack) {
      return bars;
    }

    // if bars are more than countBack, return latest bars
    return bars.slice(bars.length - countBack, bars.length);
  }

  async getBars(
    pair: string,
    ticker: string,
    resolution: string,
    periodParams: PeriodParams,
    shouldRefetchBars: boolean
  ) {
    try {
      const bars = await this.getTokenHistoryBars(pair, ticker, periodParams, shouldRefetchBars, resolution);
      return bars.sort((a, b) => a.time - b.time).map(formatTimeInBarToMs);
    } catch (e) {
      console.error("getBars", e);
      throw new Error("Failed to get history bars");
    }
  }

  async getLastBar(pair: string, ticker: string, period: string, resolution: string) {
    if (!ticker || !period || !pair) {
      throw new Error("Invalid input. Ticker, period, and chainId are required parameters.");
    }
    const prices = await getTokenChartPrice(
      pair,
      {
        from: getUTCTimestamp() - CHART_PERIODS[period],
        to: getUTCTimestamp(),
        countBack: Number(period),
        firstDataRequest: false
      },
      resolution
    );

    this.lastBar = prices[prices.length - 1];
    return this.lastBar;
  }

  async getLiveBar(pair: string, ticker: string, resolution: string) {
    const period = SUPPORTED_RESOLUTIONS[resolution];
    if (!ticker || !period || !pair) return;

    try {
      this.lastBar = await this.getLastBar(pair, ticker, period, resolution);
      this.lastBar = formatTimeInBarToMs(this.lastBar);
    } catch (error) {
      console.error(error);
    }
    if (!this.lastBar) return;
    return this.lastBar;
  }
}
