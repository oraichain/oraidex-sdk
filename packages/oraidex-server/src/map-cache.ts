export enum CACHE_KEY {
  SIMULATE_PRICE = "SIMULATE_PRICE",
  POOLS_INFO = "POOLS_INFO",
  TICKER_ORDER_BOOK = "TICKER_ORDER_BOOK",
  COINGECKO_PRICES = "COINGECKO_PRICES"
}

let updateTimeout: NodeJS.Timeout;

export const cache: Map<string, any> = new Map();
export const cacheListeners: Map<string, (...args: any[]) => Promise<void>> = new Map();

export const registerListener = (key: string, listener: (...args: any[]) => Promise<any>) => {
  cacheListeners.set(key, listener);
};

export const updateInterval = async (interval = 30000): Promise<void> => {
  for (const key of cacheListeners.keys()) {
    console.log("rerun >> Key: ", key);
    const listener = cacheListeners.get(key);

    if (listener) {
      try {
        const value = await listener();
        cache.set(key, value);
      } catch (error) {
        console.log("Error update cache: ", error.message);
      }
    }
  }

  // Clear the existing timeout
  if (updateTimeout) {
    clearTimeout(updateTimeout);
  }

  // Set a new timeout
  updateTimeout = setTimeout(() => updateInterval(interval), interval);
};
