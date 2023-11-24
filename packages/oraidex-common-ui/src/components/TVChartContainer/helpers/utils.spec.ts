import { Bar } from "./types";
import {
  fillBarGaps,
  formatTimeInBarToMs,
  getCurrentCandleTime,
  getObjectKeyFromValue,
  parseChannelFromPair,
  parseFullSymbol
} from "./utils";

describe.only("test-utils-func", () => {
  it.each([
    ["bar", { foo: "bar" }, "foo"],
    ["bar_not_found", { foo: "bar" }, undefined]
  ])("test-getObjectKeyFromValue-should-return-correctly-key", (value, object, expectedKey) => {
    const key = getObjectKeyFromValue(value, object);
    expect(key).toBe(expectedKey);
  });

  it("test-formatTimeInBarToMs-should-return-correctly-bar", () => {
    const bar: Bar = {
      time: 1,
      open: 1,
      high: 1,
      low: 1,
      close: 1,
      volume: 1000000
    };
    const formatedBar = formatTimeInBarToMs(bar);
    expect(formatedBar).toMatchObject({
      time: 1000,
      open: 1,
      high: 1,
      low: 1,
      close: 1,
      volume: 1
    });
  });

  it.each([
    ["1m", 60],
    ["5m", 5 * 60],
    ["4h", 60 * 60 * 4]
  ])(
    "test-getCurrentCandleTime-with-period-%s-should-return-correctly-current-candle-time",
    (period: string, resolution: number) => {
      const result = getCurrentCandleTime(period);
      const expectedResult = Math.floor(Date.now() / 1000 / resolution) * resolution;
      expect(result).toEqual(expectedResult);
    }
  );

  it.each([
    [
      "bar-length-less-than-2",
      [
        {
          time: 1,
          open: 1,
          high: 1,
          low: 1,
          close: 1
        }
      ],
      [
        {
          time: 1,
          open: 1,
          high: 1,
          low: 1,
          close: 1
        }
      ]
    ],
    [
      "bars-have-a-gap",
      [
        { time: Math.floor(Date.now() / 1000) - 60 * 3, open: 100, close: 105, high: 105, low: 104 },
        { time: Math.floor(Date.now() / 1000) - 60 * 2, open: 100, close: 105, high: 105, low: 104 },
        { time: Math.floor(Date.now() / 1000), open: 100, close: 105, high: 105, low: 104 }
      ],
      [
        { time: Math.floor(Date.now() / 1000) - 60 * 3, open: 100, close: 105, high: 105, low: 104 },
        { time: Math.floor(Date.now() / 1000) - 60 * 2, open: 100, close: 105, high: 105, low: 104 },
        { time: Math.floor(Date.now() / 1000) - 60 * 1, open: 100, close: 100, high: 100.03, low: 99.96000000000001 }, // Filled gap with a new bar
        { time: Math.floor(Date.now() / 1000), open: 100, close: 105, high: 105, low: 104 }
      ]
    ]
  ])("test-fillBarGaps-with-%s-should-return-correctly-new-bars", (_caseName, bars, expectedResult) => {
    const periodSeconds = 60;
    const result = fillBarGaps(bars, periodSeconds);
    expect(result).toMatchObject(expectedResult);
  });

  it.each([
    ["", null],
    ["OraiDEX:ORAI", null],
    ["OraiDEX:ORAI-USDT", null],
    ["OraiDEX-ORAI-USDT", null],
    [
      "OraiDEX:ORAI/USDT",
      {
        exchange: "OraiDEX",
        fromSymbol: "ORAI",
        toSymbol: "USDT"
      }
    ]
  ])("test-parseFullSymbol-with-symol-%s-should-return-%s", (fullSymbol, expectedResult) => {
    const result = parseFullSymbol(fullSymbol);
    expect(result).toEqual(expectedResult);
  });

  it.each([
    ["invalid-pair", undefined],
    ["orai-orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh", "ORAI/USDT"]
  ])(
    "test-parseChannelFromPair-with-%s-should-return-correctly-channel-name",
    (pair: string, expectedResult: string) => {
      const result = parseChannelFromPair(pair);
      expect(result).toBe(expectedResult);
    }
  );
});
