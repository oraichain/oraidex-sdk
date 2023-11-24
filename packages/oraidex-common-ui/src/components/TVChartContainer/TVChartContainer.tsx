import React, { useEffect, useRef, useState } from "react";
import { useLocalStorage, useMedia } from "react-use";
import { SaveLoadAdapter } from "./SaveLoadAdapter";
import { ChartData, ChartingLibraryWidgetOptions, IChartingLibraryWidget, ResolutionString } from "./charting_library";
import {
  DARK_BACKGROUND_CHART,
  DEFAULT_PERIOD,
  LIGHT_BACKGROUND_CHART,
  defaultChartProps,
  disabledFeaturesOnMobile
} from "./config";
import { TVDataProvider } from "./helpers/TVDataProvider";
import { DEFAULT_LIBRARY_URL, SUPPORTED_RESOLUTIONS, TV_CHART_RELOAD_INTERVAL } from "./helpers/constants";
import useTVDatafeed, { PairToken } from "./helpers/useTVDatafeed";
import { getObjectKeyFromValue } from "./helpers/utils";

export function useLocalStorageSerializeKey<T>(
  key: string | any[],
  value: T,
  opts?: {
    raw: boolean;
    serializer: (val: T) => string;
    deserializer: (value: string) => T;
  }
) {
  key = JSON.stringify(key);
  return useLocalStorage<T>(key, value, opts);
}

export type TVChartContainerProsp = {
  libraryUrl?: string;
  theme: "dark" | "light";
  currentPair: PairToken;
};
export default function TVChartContainer({ libraryUrl = DEFAULT_LIBRARY_URL, theme, currentPair }) {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const tvWidgetRef = useRef<IChartingLibraryWidget | null>(null);
  const [tvCharts, setTvCharts] = useLocalStorage<ChartData[] | undefined>("TV_SAVE_LOAD_CHARTS_KEY", []);
  const [chartDataLength, setChartDataLength] = useState(0);
  const { datafeed, resetCache } = useTVDatafeed({
    dataProvider: new TVDataProvider(),
    currentPair,
    setChartDataLength
  });
  const isMobile = useMedia("(max-width: 550px)");
  const [chartReady, setChartReady] = useState(false);
  const [period, setPeriod] = useLocalStorageSerializeKey([currentPair.symbol, "Chart-period"], DEFAULT_PERIOD);
  const symbolRef = useRef(currentPair.symbol);

  useEffect(() => {
    if (chartReady && tvWidgetRef.current && currentPair.symbol !== tvWidgetRef.current?.activeChart?.().symbol()) {
      tvWidgetRef.current.setSymbol(currentPair.symbol, tvWidgetRef.current.activeChart().resolution(), () => {});
    }
  }, [currentPair, chartReady, period]);

  /* Tradingview charting library only fetches the historical data once so if the tab is inactive or system is in sleep mode
  for a long time, the historical data will be outdated. */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        localStorage.setItem("TV_CHART_RELOAD_TIMESTAMP_KEY", Date.now().toString());
      } else {
        if (!tvWidgetRef.current) return;
        const tvReloadTimestamp = Number(localStorage.getItem("TV_CHART_RELOAD_TIMESTAMP_KEY"));
        if (tvReloadTimestamp && Date.now() - tvReloadTimestamp > TV_CHART_RELOAD_INTERVAL) {
          if (resetCache) {
            resetCache();
            tvWidgetRef.current.activeChart().resetData();
          }
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [resetCache]);

  useEffect(() => {
    const widgetOptions = {
      ...defaultChartProps,
      debug: false,
      symbol: symbolRef.current, // Using ref to avoid unnecessary re-renders on symbol change and still have access to the latest symbol
      datafeed,
      theme: theme === "dark" ? "Dark" : "Light",
      container: chartContainerRef.current,
      loading_screen: {
        backgroundColor: theme === "dark" ? DARK_BACKGROUND_CHART : LIGHT_BACKGROUND_CHART,
        foregroundColor: theme === "dark" ? DARK_BACKGROUND_CHART : LIGHT_BACKGROUND_CHART
      },
      interval: getObjectKeyFromValue(period, SUPPORTED_RESOLUTIONS),
      save_load_adapter: new SaveLoadAdapter(symbolRef.current, tvCharts, setTvCharts),
      studies: [],
      timeframe: "1M",
      time_scale: {
        min_bar_spacing: 15
      },
      time_frames: [
        { text: "6m", resolution: "6h" as ResolutionString, description: "6 Months" },
        { text: "1m", resolution: "1h" as ResolutionString, description: "1 Month" },
        { text: "2w", resolution: "1h" as ResolutionString, description: "2 Weeks" },
        { text: "1w", resolution: "1h" as ResolutionString, description: "1 Week" },
        { text: "1d", resolution: "15" as ResolutionString, description: "1 Day" }
      ]
    };
    if (isMobile) widgetOptions.disabled_features.push(...disabledFeaturesOnMobile);

    const script = document.createElement("script");
    script.async = true;
    script.src = libraryUrl;
    script.onload = () => {
      tvWidgetRef.current = new window.TradingView.widget(widgetOptions as any as ChartingLibraryWidgetOptions);
      tvWidgetRef.current.onChartReady(function () {
        setChartReady(true);
        tvWidgetRef.current.applyOverrides({
          "paneProperties.background": theme === "dark" ? DARK_BACKGROUND_CHART : LIGHT_BACKGROUND_CHART,
          "paneProperties.backgroundType": "solid"
        });

        const activeChart = tvWidgetRef.current.activeChart();
        activeChart.onIntervalChanged().subscribe(null, (interval) => {
          if (SUPPORTED_RESOLUTIONS[interval]) {
            const period = SUPPORTED_RESOLUTIONS[interval];
            setPeriod(period);
          }
        });

        // create indicator
        activeChart.createStudy("Volume");
      });
    };

    document.body.appendChild(script);

    return () => {
      if (tvWidgetRef.current) {
        tvWidgetRef.current.remove();
        tvWidgetRef.current = null;
        setChartReady(false);
      }
    };
  }, [theme]);

  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center"
      }}
    >
      <div
        style={{
          height: "100%",
          width: "100%",
          visibility: chartDataLength > 0 ? "visible" : "hidden"
        }}
        ref={chartContainerRef}
      />
    </div>
  );
}
