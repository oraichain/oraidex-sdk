import { useEffect, useMemo, useRef } from "react";
import {
  HistoryCallback,
  LibrarySymbolInfo,
  PeriodParams,
  ResolutionString,
  SubscribeBarsCallback
} from "../charting_library";
import { pairsChart } from "../config";
import { TVDataProvider } from "./TVDataProvider";
import { SUPPORTED_RESOLUTIONS } from "./constants";

export type PairToken = {
  symbol: string;
  info: string;
};

const configurationData = {
  supported_resolutions: Object.keys(SUPPORTED_RESOLUTIONS),
  supports_marks: false,
  supports_timescale_marks: false,
  supports_time: true,
  reset_cache_timeout: 100
};

type Props = {
  dataProvider?: TVDataProvider;
  currentPair: PairToken;
  setChartDataLength: any;
};

export const EXCHANGE_NAME = "OraiDEX";

export default function useTVDatafeed({ dataProvider, currentPair, setChartDataLength }: Props) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>();
  const resetCacheRef = useRef<() => void | undefined>();
  const activeTicker = useRef<string | undefined>();
  const tvDataProvider = useRef<TVDataProvider>();
  const shouldRefetchBars = useRef<boolean>(false);
  const lastBarsCache = new Map();

  useEffect(() => {
    if (dataProvider && tvDataProvider.current !== dataProvider) {
      tvDataProvider.current = dataProvider;
    }
  }, [dataProvider]);

  return useMemo(() => {
    return {
      resetCache: function () {
        shouldRefetchBars.current = true;
        resetCacheRef.current?.();
        shouldRefetchBars.current = false;
      },
      datafeed: {
        onReady: (callback) => {
          setTimeout(() => callback(configurationData));
        },
        resolveSymbol(symbolName, onSymbolResolvedCallback) {
          const symbolInfo = {
            name: symbolName,
            type: "crypto",
            description: symbolName,
            ticker: symbolName,
            session: "24x7",
            minmov: 1,
            pricescale: 100000,
            timezone: "Etc/UTC",
            has_intraday: true,
            has_daily: true,
            currency_code: symbolName?.split("/")[1],
            visible_plots_set: "ohlc",
            data_status: "streaming",
            exchange: EXCHANGE_NAME,
            has_empty_bars: true
          };
          setTimeout(() => onSymbolResolvedCallback(symbolInfo));
        },

        async getBars(
          symbolInfo: LibrarySymbolInfo,
          resolution: ResolutionString,
          periodParams: PeriodParams,
          onHistoryCallback: HistoryCallback,
          onErrorCallback: (error: string) => void
        ) {
          if (!SUPPORTED_RESOLUTIONS[resolution]) {
            return onErrorCallback("[getBars] Invalid resolution");
          }
          const { ticker } = symbolInfo;
          if (activeTicker.current !== ticker) {
            activeTicker.current = ticker;
          }
          try {
            if (!ticker) {
              onErrorCallback("Invalid ticker!");
              return;
            }
            const pair = pairsChart.find((p) => p.symbol === symbolInfo.ticker);

            const bars = await tvDataProvider.current?.getBars(
              pair?.info,
              ticker,
              resolution,
              periodParams,
              shouldRefetchBars.current
            );

            if (periodParams.firstDataRequest) {
              lastBarsCache.set(symbolInfo.full_name, {
                ...bars[bars.length - 1]
              });
              setChartDataLength(bars.length);
            }
            console.log(`[getBars]: returned ${bars.length} bar(s)`);

            const noData = !bars || (bars && bars?.length === 0);
            onHistoryCallback(bars, { noData });
          } catch (e) {
            onErrorCallback("Unable to load historical data!");
          }
        },
        async subscribeBars(
          symbolInfo: LibrarySymbolInfo,
          resolution: ResolutionString,
          onRealtimeCallback: SubscribeBarsCallback,
          subscribeUID,
          onResetCacheNeededCallback: () => void
        ) {
          console.log("[subscribeBars]: Method call with subscriberUID:", subscribeUID);
          // subscribeOnStream(
          //   symbolInfo,
          //   resolution,
          //   onRealtimeCallback,
          //   subscribeUID,
          //   onResetCacheNeededCallback,
          //   lastBarsCache.get(symbolInfo.full_name)
          // );
        },
        unsubscribeBars: () => {
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      }
    };
  }, [currentPair.info]);
}
