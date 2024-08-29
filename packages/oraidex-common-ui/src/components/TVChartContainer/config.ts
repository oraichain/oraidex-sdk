import { FAVORITES_INTERVAL } from "./helpers/constants";
import { addMinutes, format as formatDateFn } from "date-fns";

const dateFormat = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "2-digit"
});

const timeFormat = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit"
});

// extend formatToJson
// @ts-ignore
Intl.DateTimeFormat.prototype.formatToJson = function (date: Date) {
  const _this = this as Intl.DateTimeFormat;
  return Object.fromEntries(
    _this
      .formatToParts(date)
      .filter((item) => item.type !== "literal")
      .map((item) => [item.type, item.value])
  ) as Record<Intl.DateTimeFormatPartTypes, string>;
};

export function formatTVDate(date: Date) {
  // @ts-ignore
  const obj = dateFormat.formatToJson(date);
  return `${obj.day} ${obj.month} ${obj.year}`;
}

export function formatTVTime(date: Date) {
  // @ts-ignore
  const obj = timeFormat.formatToJson(date);
  return `${obj.hour}:${obj.minute}:${obj.second} ${obj.dayPeriod}`;
}

const RED = "#fa3c58";
const GREEN = "#0ecc83";
export const DEFAULT_PERIOD = "4h";
export const DARK_BACKGROUND_CHART = "#1b1c1a";
export const LIGHT_BACKGROUND_CHART = "#fff";

export enum PERIOD_TO_MINUTE {
  "1m" = 1,
  "5m" = 5,
  "15m" = 15,
  "30m" = 30,
  "1h" = 60,
  "2h" = 120,
  "4h" = 240,
  "6h" = 360,
  "8h" = 480,
  "24h" = 1440
}

const chartStyleOverrides = ["candleStyle", "hollowCandleStyle", "haStyle"].reduce((acc, cv) => {
  acc[`mainSeriesProperties.${cv}.drawWick`] = true;
  acc[`mainSeriesProperties.${cv}.drawBorder`] = false;
  acc[`mainSeriesProperties.${cv}.upColor`] = GREEN;
  acc[`mainSeriesProperties.${cv}.downColor`] = RED;
  acc[`mainSeriesProperties.${cv}.wickUpColor`] = GREEN;
  acc[`mainSeriesProperties.${cv}.wickDownColor`] = RED;
  acc[`mainSeriesProperties.${cv}.borderUpColor`] = GREEN;
  acc[`mainSeriesProperties.${cv}.borderDownColor`] = RED;
  return acc;
}, {});

const chartOverrides = {
  "paneProperties.background": "#16182e",
  "paneProperties.backgroundGradientStartColor": "#16182e",
  "paneProperties.backgroundGradientEndColor": "#16182e",
  "paneProperties.backgroundType": "solid",
  "paneProperties.vertGridProperties.style": 2,
  "paneProperties.horzGridProperties.style": 2,
  "mainSeriesProperties.priceLineColor": "#3a3e5e",

  "mainSeriesProperties.showCountdown": false,

  "mainSeriesProperties.barStyle.dontDrawOpen": true,
  "mainSeriesProperties.candleStyle.barColorsOnPrevClose": false,
  "mainSeriesProperties.hollowCandleStyle.drawWick": false,
  "mainSeriesProperties.haStyle.barColorsOnPrevClose": false,
  // "paneProperties.legendProperties.showSeriesTitle": false,
  "paneProperties.legendProperties.showSeriesOHLC": true,
  "paneProperties.legendProperties.showStudyTitles": true,
  // "paneProperties.legendProperties.showStudyValues": true,
  "paneProperties.topMargin": 12,
  "paneProperties.bottomMargin": 2,
  "scalesProperties.fontSize": 12,
  "scalesProperties.showSymbolLabels": false,
  "scalesProperties.showStudyLastValue": false,
  ...chartStyleOverrides
};

export const disabledFeaturesOnMobile = ["header_saveload", "header_fullscreen_button"];

const disabledFeatures = [
  "show_logo_on_all_charts",
  "caption_buttons_text_if_possible",
  "header_compare",
  "compare_symbol",
  "display_market_status",
  "header_interval_dialog_button",
  "show_interval_dialog_on_key_press",
  "header_symbol_search",
  "popup_hints",
  "header_in_fullscreen_mode",
  "right_bar_stays_on_scroll",
  "symbol_info",
  "volume_force_overlay"
];

const enabledFeatures = [
  "side_toolbar_in_fullscreen_mode",
  "header_in_fullscreen_mode",
  "hide_resolution_in_legend",
  "items_favoriting",
  "hide_left_toolbar_by_default",
  "create_volume_indicator_by_default",
  "use_localstorage_for_settings",
  "save_chart_properties_to_local_storage",
  "study_templates"
];

export const defaultChartProps = {
  locale: "en",
  library_path: "https://chart.oraidex.io/",
  clientId: "tradingview.com",
  userId: "public_user_id",
  fullscreen: true,
  overrides: chartOverrides,
  disabled_features: ["use_localstorage_for_settings"],
  enabled_features: [],
  favorites: {
    intervals: FAVORITES_INTERVAL
  },
  drawings_access: {
    type: "black" as "black" | "white",
    tools: [{ name: "Regression Trend", grayed: true }]
  },
  custom_formatters: {
    timeFormatter: {
      format: (date) => {
        return formatDateFn(addMinutes(date, date.getTimezoneOffset()), "hh:mm:ss a");
      }
    },
    dateFormatter: {
      // format: (date) => formatTVDate(date)
      format: (date) => formatDateFn(addMinutes(date, date.getTimezoneOffset()), "dd MMM yyyy hh:mm:ss a")
    }
  }
};
