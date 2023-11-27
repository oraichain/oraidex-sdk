import { PeriodParams } from "../charting_library";
import { Bar } from "./types";
import Axios from "axios";
import { throttleAdapterEnhancer, retryAdapterEnhancer } from "axios-extensions";

const AXIOS_TIMEOUT = 10000;
const AXIOS_THROTTLE_THRESHOLD = 2000;
const axios = Axios.create({
  timeout: AXIOS_TIMEOUT,
  retryTimes: 3,
  // cache will be enabled by default in 2 seconds
  adapter: retryAdapterEnhancer(
    throttleAdapterEnhancer(Axios.defaults.adapter!, {
      threshold: AXIOS_THROTTLE_THRESHOLD,
    })
  ),
  baseURL: "https://api.oraidex.io",
});

export const getTokenChartPrice = async (
  pair: string,
  periodParams: PeriodParams,
  resolution: string
): Promise<Bar[]> => {
  try {
    const res = await axios.get("/v1/candles", {
      params: {
        pair,
        startTime: periodParams.from,
        endTime: periodParams.to,
        tf: +resolution * 60,
      },
    });
    return res.data;
  } catch (e) {
    console.error("GetTokenChartPrice", e);
    return [];
  }
};
