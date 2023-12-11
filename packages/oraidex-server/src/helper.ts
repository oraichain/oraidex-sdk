import { ORAI } from "@oraichain/oraidex-sync";
import bech32 from "bech32";
export function parseSymbolsToTickerId([base, quote]: [string, string]) {
  return `${base}_${quote}`;
}

export function getDate24hBeforeNow(time: Date) {
  const twentyFourHoursInMilliseconds = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  const date24hBeforeNow = new Date(time.getTime() - twentyFourHoursInMilliseconds);
  return date24hBeforeNow;
}

/**
 *
 * @param time
 * @param tf in seconds
 * @returns
 */
export function getSpecificDateBeforeNow(time: Date, tf: number) {
  const timeInMs = tf * 1000; //time in milliseconds
  const dateBeforeNow = new Date(time.getTime() - timeInMs);
  return dateBeforeNow;
}

export function calculateBasePriceFromTickerVolume(baseVolume: string, targetVolume: string): number {
  return parseFloat(targetVolume) / parseFloat(baseVolume);
}

export function pairToString([base, quote]: string[]): string {
  return `${base}-${quote}`;
}

export const validateContractAddress = (contractAddress: string) => {
  try {
    const { prefix } = bech32.decode(contractAddress);
    if (prefix === ORAI) return true;
    return false;
  } catch (error) {
    console.log("error: ", error);
    return false;
  }
};
