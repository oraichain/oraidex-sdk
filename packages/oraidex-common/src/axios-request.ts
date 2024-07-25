import Axios, { AxiosAdapter } from "axios";
import { cacheAdapterEnhancer, throttleAdapterEnhancer, retryAdapterEnhancer } from "axios-extensions";

export async function getAxios(baseUrl?: string) {
  const AXIOS_TIMEOUT = 10000;
  const AXIOS_THROTTLE_THRESHOLD = 2000;
  const axios = Axios.create({
    timeout: AXIOS_TIMEOUT,
    retryTimes: 3,
    // cache will be enabled by default in 2 seconds
    adapter: retryAdapterEnhancer(
      throttleAdapterEnhancer(cacheAdapterEnhancer(Axios.defaults.adapter as AxiosAdapter), {
        threshold: AXIOS_THROTTLE_THRESHOLD
      })
    ),
    baseURL: baseUrl
  });

  return { axios };
}
