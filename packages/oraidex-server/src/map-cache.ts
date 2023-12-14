export enum CACHE_KEY {
  SIMULATE_PRICE = "SIMULATE_PRICE"
}
export const cache: Map<string, any> = new Map();
export const cacheListeners: Map<string, (...args: any[]) => Promise<void>> = new Map();

export const registerListener = (key: string, listener: (...args: any[]) => Promise<any>) => {
  cacheListeners.set(key, listener);
};

export const updateInterval = async (interval = 5000): Promise<void> => {
  for (const key of cacheListeners.keys()) {
    const listener = cacheListeners.get(key);
    if (listener) {
      const value = await listener();
      cache.set(key, value);
    }
  }
  setTimeout(updateInterval, interval);
};
