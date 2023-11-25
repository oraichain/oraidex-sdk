import { FAVORITES_INTERVAL } from "./helpers/constants";
import { PairMapping } from "./helpers/types";

// config for oraichain token
export const AIRI_CONTRACT = "orai10ldgzued6zjp0mkqwsv2mux3ml50l97c74x8sg";
export const ORAIX_CONTRACT = "orai1lus0f0rhx8s03gdllx2n6vhkmf0536dv57wfge";
export const USDT_CONTRACT = "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh";
export const USDC_CONTRACT = "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd";
export const KWT_CONTRACT = "orai1nd4r053e3kgedgld2ymen8l9yrw8xpjyaal7j5";
export const MILKY_CONTRACT = "orai1gzvndtzceqwfymu2kqhta2jn6gmzxvzqwdgvjw";
export const SCORAI_CONTRACT = "orai1065qe48g7aemju045aeyprflytemx7kecxkf5m7u5h5mphd0qlcs47pclp";
export const TRX_CONTRACT = "orai1c7tpjenafvgjtgm9aqwm7afnke6c56hpdms8jc6md40xs3ugd0es5encn0";
export const SCATOM_CONTRACT = "orai19q4qak2g3cj2xc2y3060t0quzn3gfhzx08rjlrdd3vqxhjtat0cq668phq";
export const XOCH_CONTRACT = "orai1lplapmgqnelqn253stz6kmvm3ulgdaytn89a8mz9y85xq8wd684s6xl3lt";
export const INJECTIVE_CONTRACT = "orai19rtmkk6sn4tppvjmp5d5zj6gfsdykrl5rw2euu5gwur3luheuuusesqn49";

export const ORAI = "orai";
export const ATOM_ORAICHAIN_DENOM =
  "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78";
export const OSMOSIS_ORAICHAIN_DENOM =
  "ibc/9C4DCD21B48231D0BC2AC3D1B74A864746B37E4292694C93C617324250D002FC";

const dateFormat = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "2-digit",
});

const timeFormat = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
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
export const DARK_BACKGROUND_CHART = "#151619";
export const LIGHT_BACKGROUND_CHART = "#fff";

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
  "paneProperties.vertGridProperties.color": "rgba(35, 38, 59, 1)",
  "paneProperties.vertGridProperties.style": 2,
  "paneProperties.horzGridProperties.color": "rgba(35, 38, 59, 1)",
  "paneProperties.horzGridProperties.style": 2,
  "mainSeriesProperties.priceLineColor": "#3a3e5e",
  "scalesProperties.textColor": "#fff",
  "scalesProperties.lineColor": "#16182e",
  ...chartStyleOverrides,
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
  "volume_force_overlay",
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
];

export const defaultChartProps = {
  locale: "en",
  library_path: "https://chart.oraidex.io/",
  clientId: "tradingview.com",
  userId: "public_user_id",
  fullscreen: false,
  autosize: true,
  header_widget_dom_node: false,
  overrides: chartOverrides,
  enabled_features: enabledFeatures,
  disabled_features: disabledFeatures,
  custom_css_url: "/charting_library/custom.css",
  favorites: {
    intervals: FAVORITES_INTERVAL,
  },
  custom_formatters: {
    timeFormatter: {
      format: (date) => formatTVTime(date),
    },
    dateFormatter: {
      format: (date) => formatTVDate(date),
    },
  },
};

// the orders are important! Do not change the order of the asset_infos.
export const pairs: PairMapping[] = [
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: USDT_CONTRACT } }],
    symbols: ["ORAI", "USDT"],
  },
  {
    asset_infos: [{ token: { contract_addr: AIRI_CONTRACT } }, { native_token: { denom: ORAI } }],
    symbols: ["AIRI", "ORAI"],
  },
  {
    asset_infos: [{ token: { contract_addr: ORAIX_CONTRACT } }, { native_token: { denom: ORAI } }],
    symbols: ["ORAIX", "ORAI"],
  },
  {
    asset_infos: [{ token: { contract_addr: SCORAI_CONTRACT } }, { native_token: { denom: ORAI } }],
    symbols: ["scORAI", "ORAI"],
  },
  {
    asset_infos: [
      { native_token: { denom: ORAI } },
      { native_token: { denom: ATOM_ORAICHAIN_DENOM } },
    ],
    symbols: ["ORAI", "ATOM"],
  },

  {
    asset_infos: [{ token: { contract_addr: KWT_CONTRACT } }, { native_token: { denom: ORAI } }],
    symbols: ["KWT", "ORAI"],
  },
  {
    asset_infos: [
      { native_token: { denom: ORAI } },
      {
        native_token: { denom: OSMOSIS_ORAICHAIN_DENOM },
      },
    ],
    symbols: ["ORAI", "OSMO"],
  },
  {
    asset_infos: [
      { token: { contract_addr: MILKY_CONTRACT } },
      { token: { contract_addr: USDT_CONTRACT } },
    ],
    symbols: ["MILKY", "USDT"],
  },
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: USDC_CONTRACT } }],
    symbols: ["ORAI", "USDC"],
  },
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: TRX_CONTRACT } }],
    symbols: ["ORAI", "wTRX"],
  },
  {
    asset_infos: [
      { token: { contract_addr: SCATOM_CONTRACT } },
      { native_token: { denom: ATOM_ORAICHAIN_DENOM } },
    ],
    symbols: ["scATOM", "ATOM"],
  },
  {
    asset_infos: [
      { token: { contract_addr: INJECTIVE_CONTRACT } },
      { native_token: { denom: ORAI } },
    ],
    symbols: ["INJ", "ORAI"],
  },
];

export const pairsChart = pairs.map((pair) => {
  const assets = pair.asset_infos.map((info) => {
    if ("native_token" in info) return info.native_token.denom;
    return info.token.contract_addr;
  });

  return {
    ...pair,
    assets,
    info: `${assets[0]}-${assets[1]}`,
    symbol: `${pair.symbols[0]}/${pair.symbols[1]}`,
  };
});
