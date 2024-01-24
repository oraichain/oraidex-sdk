import { PeriodParams } from "../charting_library";
import { Bar } from "./types";
import Axios from "axios";
import { throttleAdapterEnhancer, retryAdapterEnhancer } from "axios-extensions";
import { PairToken } from "./useTVDatafeed";

const AXIOS_TIMEOUT = 10000;
const AXIOS_THROTTLE_THRESHOLD = 2000;

export enum BASE_API_URL {
  ORAIDEX = "https://api.oraidex.io",
  FUTURE = "https://futures-backend.oraidex.io",
  ORDERBOOK = "https://orderbook-backend.oraidex.io",

  ORAIDEX_STAGING = "https://api-staging.oraidex.io",
  FUTURE_STAGING = "https://futures-backend-staging.oraidex.io",
  ORDERBOOK_STAGING = "https://server.oraidex.io"
}

export enum BASE_SOCKET_URL {
  ORAIDEX = "wss://api.oraidex.io/websocket",
  FUTURE = "wss://futures-backend.oraidex.io/websocket",
  ORDERBOOK = "wss://orderbook-backend.oraidex.io/websocket",

  ORAIDEX_STAGING = "wss://api-staging.oraidex.io/websocket",
  FUTURE_STAGING = "wss://futures-backend-staging.oraidex.io/websocket",
  ORDERBOOK_STAGING = "wss://server.oraidex.io/websocket"
}

export const API_CANDLE_BY_BASE_URL = {
  [BASE_API_URL.ORAIDEX]: "/v1/candles",
  [BASE_API_URL.FUTURE]: "/v1/future/candles",
  [BASE_API_URL.ORDERBOOK]: "/v1/candles",

  [BASE_API_URL.ORAIDEX_STAGING]: "/v1/candles",
  [BASE_API_URL.FUTURE_STAGING]: "/v1/future/candles",
  [BASE_API_URL.ORDERBOOK_STAGING]: "/v1/candles"
};

export const BASE_URL = BASE_API_URL.ORAIDEX;
export const WS_URL = BASE_SOCKET_URL.ORAIDEX;
export const DEFAULT_CANDLE_ENDPOINT = API_CANDLE_BY_BASE_URL[BASE_API_URL.ORAIDEX];

const createAxiosWithBaseUrl = (baseURL: string) => {
  const axios = Axios.create({
    timeout: AXIOS_TIMEOUT,
    retryTimes: 3,
    // cache will be enabled by default in 2 seconds
    adapter: retryAdapterEnhancer(
      throttleAdapterEnhancer(Axios.defaults.adapter!, {
        threshold: AXIOS_THROTTLE_THRESHOLD
      })
    ),
    baseURL
  });
  // axios.defaults.baseURL = baseURL
  return axios;
};

export const getTokenChartPrice = async (
  pair: PairToken,
  periodParams: PeriodParams,
  resolution: string,
  baseUrl: string = BASE_URL
): Promise<Bar[]> => {
  try {
    const axios = createAxiosWithBaseUrl(baseUrl);
    const endpoint = API_CANDLE_BY_BASE_URL[baseUrl] || DEFAULT_CANDLE_ENDPOINT;
    const { info, symbol } = pair || {};

    const res = await axios.get(endpoint, {
      params: {
        pair: info,
        symbol: symbol,
        startTime: periodParams.from,
        endTime: periodParams.to,
        tf: +resolution * 60
      }
    });

    return res.data;
  } catch (e) {
    console.error("GetTokenChartPrice", e);
    return [];
  }
};
