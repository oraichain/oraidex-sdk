import Axios from "axios";
import { retryAdapterEnhancer, throttleAdapterEnhancer } from "axios-extensions";
import { Bar, GetTokenChartPriceParams } from "./types";

const AXIOS_TIMEOUT = 10000;
const AXIOS_THROTTLE_THRESHOLD = 2000;

export enum BASE_API_URL {
  ORAIDEX = "https://api.oraidex.io",
  FUTURE = "https://futures-backend.oraidex.io",
  ORDERBOOK = "https://orderbook-backend.oraidex.io",

  ORAIDEX_STAGING = "https://api-staging.oraidex.io",
  FUTURE_STAGING = "https://futures-backend-staging.oraidex.io",
  ORDERBOOK_STAGING = "https://server-staging.oraidex.io"
}

export enum BASE_SOCKET_URL {
  ORAIDEX = "wss://api.oraidex.io/websocket",
  FUTURE = "wss://futures-backend.oraidex.io/websocket",
  ORDERBOOK = "wss://orderbook-backend.oraidex.io/websocket",

  ORAIDEX_STAGING = "wss://api-staging.oraidex.io/websocket",
  FUTURE_STAGING = "wss://futures-backend-staging.oraidex.io/websocket",
  ORDERBOOK_STAGING = "wss://server-staging.oraidex.io/websocket/"
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

export const getTokenChartPrice = async ({
  pair,
  periodParams,
  resolution,
  fetchDataChart,
  baseUrl = BASE_URL
}: GetTokenChartPriceParams): Promise<Bar[]> => {
  try {
    const axios = createAxiosWithBaseUrl(baseUrl);
    const endpoint = API_CANDLE_BY_BASE_URL[baseUrl] || DEFAULT_CANDLE_ENDPOINT;
    const { info, symbol } = pair || {};

    if (fetchDataChart) {
      return await fetchDataChart({
        pair: info,
        symbol: symbol,
        startTime: periodParams.from,
        endTime: periodParams.to,
        tf: +resolution * 60
      });
    }
    const res = await axios.get(endpoint, {
      params: {
        pair: info,
        symbol: symbol,
        startTime: periodParams.from,
        endTime: periodParams.to,
        tf: +resolution * 60
      }
    });

    //   const TWO_PM_TIMESTAMP = 1708412400;
    //   return res.data && res.data.filter((item) => Number(item.time) >= TWO_PM_TIMESTAMP);
    // }

    return res.data;
  } catch (err) {}
};
