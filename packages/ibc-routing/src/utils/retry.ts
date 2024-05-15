import { setTimeout } from "timers/promises";

export const retryFunc = async (func: () => Promise<void>, retryTimes: number = 10) => {
  for (let i = 0; i < retryTimes; i++) {
    try {
      await func();
      return;
    } catch (err) {
      await setTimeout(100);
    }
  }
};
