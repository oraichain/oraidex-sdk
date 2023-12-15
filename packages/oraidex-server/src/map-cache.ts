export enum CACHE_KEY {
  SIMULATE_PRICE = "SIMULATE_PRICE",
  POOLS_INFO = "POOLS_INFO"
}
export const cache: Map<string, any> = new Map();
export const cacheListeners: Map<string, (...args: any[]) => Promise<void>> = new Map();

export const registerListener = (key: string, listener: (...args: any[]) => Promise<any>) => {
  cacheListeners.set(key, listener);
};

export const updateInterval = async (interval = 5000): Promise<void> => {
  for (const key of cacheListeners.keys()) {
    console.log("rerun");
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
  setTimeout(updateInterval, interval);
};
