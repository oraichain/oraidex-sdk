import { PeriodParams } from "../charting_library";
import { Bar } from "./types";

export const getTokenChartPrice = async (
  pair: string,
  periodParams: PeriodParams,
  resolution: string
): Promise<Bar[]> => {
  try {
    const baseUrl = `https://api.oraidex.io/v1`
    const response = await fetch(`${baseUrl}/candles?pair=${pair}&startTime=${periodParams.from}&endTime=${periodParams.to}&tf=${+resolution * 60}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (e) {
    console.error("GetTokenChartPrice", e);
    return [];
  }
};
