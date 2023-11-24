import { CHART_PERIODS } from "./constants";
import { Bar } from "./types";
import { pairsChart } from "../config";

export function getObjectKeyFromValue(value, object) {
  return Object.keys(object).find((key) => object[key] === value);
}

export function formatTimeInBarToMs(bar: Bar): Bar {
  return {
    ...bar,
    time: bar.time * 1000,
    volume: bar.volume / 1e6
  };
}

export function getCurrentCandleTime(period: string) {
  const periodSeconds = CHART_PERIODS[period];
  return Math.floor(Date.now() / 1000 / periodSeconds) * periodSeconds;
}

// calculate the starting timestamp of the current time bar in a time chart,
// given a specified time period
export function getCurrentBarTimestamp(timestamp: number, periodSeconds: number) {
  return Math.floor(timestamp / (periodSeconds * 1000)) * (periodSeconds * 1000);
}

// Fill bar gaps with empty time
export function fillBarGaps(bars: Bar[], periodSeconds: number) {
  if (bars.length < 2) return bars;

  const newBars = [bars[0]];
  let prevTime = bars[0].time;

  for (let i = 1; i < bars.length; i++) {
    const { time, open } = bars[i];
    if (prevTime) {
      const numBarsToFill = Math.floor((time - prevTime) / periodSeconds) - 1;
      for (let j = numBarsToFill; j > 0; j--) {
        const newBar = {
          time: time - j * periodSeconds,
          open,
          close: open,
          high: open * 1.0003,
          low: open * 0.9996
        };
        newBars.push(newBar);
      }
    }
    prevTime = time;
    newBars.push(bars[i]);
  }

  return newBars;
}

// Returns all parts of the symbol
export function parseFullSymbol(fullSymbol) {
  const match = fullSymbol.match(/^(\w+):(\w+)\/(\w+)$/);
  if (!match) {
    return null;
  }

  return {
    exchange: match[1],
    fromSymbol: match[2],
    toSymbol: match[3]
  };
}

export function parseChannelFromPair(pair: string): string {
  try {
    const pairInfo = pairsChart.find((p) => p.info === pair);
    return pairInfo?.symbol;
  } catch (error) {
    console.error("error parse channel from pair", error);
  }
}

export function roundTime(timeIn: Date, interval: number): number {
  const roundTo = interval * 60 * 1000;

  const dateOut = Math.round(timeIn.getTime() / roundTo) * roundTo;
  return dateOut / 1000;
}
