export const SUPPORTED_RESOLUTIONS = {
  1: "1m",
  5: "5m",
  15: "15m",
  30: "30m",
  60: "1h",
  120: "2h",
  240: "4h",
  360: "6h",
  480: "8h",
  1440: "1d"
};

export const FAVORITES_INTERVAL = ["5", "15", "60", "240", "1440"];

export const CHART_PERIODS = {
  "1m": 60,
  "5m": 60 * 5,
  "15m": 60 * 15,
  "30m": 60 * 30,
  "1h": 60 * 60,
  "2h": 60 * 60 * 2,
  "4h": 60 * 60 * 4,
  "6h": 60 * 60 * 6,
  "8h": 60 * 60 * 8,
  "1d": 60 * 60 * 24
};

export const LAST_BAR_REFRESH_INTERVAL = 15000; // 15 seconds
export const TV_CHART_RELOAD_INTERVAL = 15 * 60 * 1000; // 15 minutes
export const DEFAULT_LIBRARY_URL = "https://chart.oraidex.io/charting_library.standalone.js";
