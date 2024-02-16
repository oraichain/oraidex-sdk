import { PAIRS } from "@oraichain/oraidex-common/build/pairs";
import { Timezone } from "../charting_library";
import { CHART_PERIODS } from "./constants";
import { Bar } from "./types";

const tradingViewTimeZones: { [key: string]: number } = {
  "Pacific/Honolulu": -10,
  "America/Juneau": -8,
  "America/Los_Angeles": -7,
  "America/Phoenix": -7,
  "America/Vancouver": -7,
  "US/Mountain": -7,
  "America/El_Salvador": -6,
  "America/Bogota": -5,
  "America/Chicago": -5,
  "America/Lima": -5,
  "America/Mexico_City": -5,
  "America/Caracas": -4,
  "America/New_York": -4,
  "America/Toronto": -4,
  "America/Argentina/Buenos_Aires": -3,
  "America/Santiago": -3,
  "America/Sao_Paulo": -3,
  "Etc/UTC": 0,
  "Atlantic/Reykjavik": 0,
  "Africa/Lagos": 1,
  "Europe/London": 1,
  "Africa/Cairo": 2,
  "Africa/Johannesburg": 2,
  "Europe/Belgrade": 2,
  "Europe/Berlin": 2,
  "Europe/Copenhagen": 2,
  "Europe/Luxembourg": 2,
  "Europe/Madrid": 2,
  "Europe/Oslo": 2,
  "Europe/Paris": 2,
  "Europe/Rome": 2,
  "Europe/Stockholm": 2,
  "Europe/Warsaw": 2,
  "Europe/Zurich": 2,
  "Asia/Bahrain": 3,
  "Asia/Jerusalem": 3,
  "Asia/Kuwait": 3,
  "Asia/Qatar": 3,
  "Asia/Riyadh": 3,
  "Europe/Athens": 3,
  "Europe/Helsinki": 3,
  "Europe/Istanbul": 3,
  "Europe/Moscow": 3,
  "Europe/Riga": 3,
  "Europe/Tallinn": 3,
  "Europe/Vilnius": 3,
  "Asia/Kolkata": 3.5,
  "Asia/Dubai": 4,
  "Asia/Muscat": 4,
  "Asia/Tehran": 4.5,
  "Asia/Ashkhabad": 5,
  "Asia/Kathmandu": 5.75,
  "Asia/Almaty": 6,
  "Asia/Bangkok": 7,
  "Asia/Ho_Chi_Minh": 7,
  "Asia/Jakarta": 7,
  "Asia/Chongqing": 8,
  "Asia/Hong_Kong": 8,
  "Asia/Shanghai": 8,
  "Asia/Singapore": 8,
  "Asia/Taipei": 8,
  "Australia/Perth": 8,
  "Asia/Seoul": 9,
  "Asia/Tokyo": 9,
  "Australia/Adelaide": 9.5,
  "Australia/ACT": 10,
  "Australia/Brisbane": 10,
  "Australia/Sydney": 10,
  "Pacific/Norfolk": 11,
  "Pacific/Auckland": 12,
  "Pacific/Chatham": 12.75,
  "Pacific/Fakaofo": 13
};

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

export const parseChannelFromPair = (pair: string) => {
  const checkPair = PAIRS.map((pair) => {
    const assets = pair.asset_infos.map((info) => {
      if ("native_token" in info) return info.native_token.denom;
      return info.token.contract_addr;
    });

    return {
      ...pair,
      symbol: `${pair.symbols[0]}/${pair.symbols[1]}`,
      info: `${assets[0]}-${assets[1]}`,
      baseSymbol: pair.symbols[0],
      quoteSymbol: pair.symbols[1]
    };
  }).find((currentPair) => {
    return pair === currentPair.info;
  });

  return checkPair?.symbol;
};

export function roundTime(timeIn: Date, interval: number): number {
  const roundTo = interval * 60 * 1000;

  const dateOut = Math.round(timeIn.getTime() / roundTo) * roundTo;
  return dateOut / 1000;
}

export function getTradingViewTimeZone() {
  const offsetInHours = (new Date().getTimezoneOffset() / 60) * -1;
  const tradingViewTimeZone = Object.keys(tradingViewTimeZones).find(
    (timeZone) => tradingViewTimeZones[timeZone] === offsetInHours
  );
  if (!tradingViewTimeZone) {
    return "Etc/UTC" as Timezone;
  }
  return tradingViewTimeZone as Timezone;
}
