/* eslint-disable security/detect-non-literal-fs-filename */
import fs from "fs";
import fsPromise from "fs/promises";
import path from "path";

export enum CACHE_KEY {
  SIMULATE_PRICE = "SIMULATE_PRICE",
  POOLS_INFO = "POOLS_INFO",
  TICKER_ORDER_BOOK = "TICKER_ORDER_BOOK",
  COINGECKO_PRICES = "COINGECKO_PRICES"
}

const FILE_PATH = process.env.CACHE_FILE_PATH ?? "../cache-data.json";
const cacheFilePath = path.join(__dirname, FILE_PATH);
let updateTimeout: NodeJS.Timeout;

export const readCacheData = () => {
  try {
    if (!fs.existsSync(cacheFilePath)) return {};

    const cachedData = fs.readFileSync(cacheFilePath, { encoding: "utf-8" });
    return JSON.parse(cachedData);
  } catch (error) {
    return {}; // Return empty object on error
  }
};
export const cache: Map<string, any> = new Map(Object.entries(readCacheData()));
export const cacheListeners = new Map<string, (...args: any[]) => Promise<void>>();

export const registerListener = (key: string, listener: (...args: any[]) => Promise<any>) => {
  cacheListeners.set(key, listener);
};

export const updateInterval = async (interval = 30000): Promise<void> => {
  for (const key of cacheListeners.keys()) {
    console.log("rerun cache >> Key: ", key);
    try {
      const listener = cacheListeners.get(key);

      if (listener) {
        const value = await listener();

        // update cache data to json file.
        const cachedData = await readCacheData();
        cachedData[key] = value;
        const newJsonData = JSON.stringify(cachedData, null, 2);
        await fsPromise.writeFile(cacheFilePath, newJsonData, "utf8");

        console.log(`Updated cached ${key} successfully`);
        cache.set(key, value);
      }
    } catch (error) {
      console.error("Error updating cache:", error.message);
    }
  }

  // Clear the existing timeout
  if (updateTimeout) {
    clearTimeout(updateTimeout);
  }

  // Set a new timeout
  updateTimeout = setTimeout(() => updateInterval(interval), interval);
};
