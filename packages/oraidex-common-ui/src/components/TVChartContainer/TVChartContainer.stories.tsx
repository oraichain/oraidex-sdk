import React from "react";
import { Meta, StoryObj } from "@storybook/react";
import TVChartContainer, { TVChartContainerProsp } from "./TVChartContainer";
import { BASE_API_URL, BASE_SOCKET_URL } from "./helpers/requests";
import axios from "axios";
import { Bar } from "./helpers/types";

const meta: Meta<typeof TVChartContainer> = {
  component: TVChartContainer,
  title: "Tradingview",
  argTypes: {}
};
export default meta;

type Story = StoryObj<typeof TVChartContainer>;
// export const OraiUsdtChart: Story = (args: TVChartContainerProsp) => (
//   <div style={{ height: "80vh" }}>
//     <TVChartContainer {...args} />;
//   </div>
// );
// OraiUsdtChart.args = {
//   theme: "dark",
//   currentPair: {
//     symbol: "ORAI/USDT",
//     info: "orai-orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh"
//   },
//   pairsChart: [
//     {
//       symbol: "ORAI/USDT",
//       info: "orai-orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh"
//     }
//   ],
//   setChartTimeFrame: (resolution) => {
//     console.log({ resolutionUpdate: resolution });
//   },
//   baseUrl: BASE_API_URL.ORAIDEX,
//   wsUrl: BASE_SOCKET_URL.ORAIDEX
// };

export const OraiAtomChartDefaultURL: Story = (args: TVChartContainerProsp) => (
  <div style={{ height: "80vh" }}>
    <TVChartContainer {...args} />;
  </div>
);
OraiAtomChartDefaultURL.args = {
  theme: "dark",
  currentPair: {
    symbol: "ORAI/ATOM",
    info: "orai-ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78"
  },
  pairsChart: [
    {
      symbol: "ORAI/ATOM",
      info: "orai-ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78"
    }
  ],
  customCssUrl: "/custom-trading.css"
  // baseUrl: BASE_API_URL.ORAIDEX,
  // wsUrl: BASE_SOCKET_URL.ORAIDEX
};

export const TimpiChartDefaultURL: Story = (args: TVChartContainerProsp) => (
  <div style={{ height: "80vh" }}>
    <TVChartContainer {...args} />;
  </div>
);
TimpiChartDefaultURL.args = {
  theme: "dark",
  currentPair: {
    symbol: "NTMPI/USDC",
    info: "ibc/576B1D63E401B6A9A071C78A1D1316D016EC9333D2FEB14AD503FAC4B8731CD1-orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd"
  },
  pairsChart: [
    {
      symbol: "NTMPI/USDC",
      info: "ibc/576B1D63E401B6A9A071C78A1D1316D016EC9333D2FEB14AD503FAC4B8731CD1-orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd"
    }
  ],
  customCssUrl: "/custom-trading.css"
  // baseUrl: BASE_API_URL.ORAIDEX,
  // wsUrl: BASE_SOCKET_URL.ORAIDEX
};

export const OraiUsdcChart: Story = (args: TVChartContainerProsp) => (
  <div style={{ height: "80vh" }}>
    <TVChartContainer {...args} />;
  </div>
);
OraiUsdcChart.args = {
  theme: "dark",
  currentPair: {
    symbol: "ORAI/USDC",
    info: "orai-orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd"
  },
  pairsChart: [
    {
      symbol: "ORAI/USDC",
      info: "orai-orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd"
    }
  ],
  baseUrl: BASE_API_URL.FUTURE,
  wsUrl: BASE_SOCKET_URL.FUTURE
};

export const OraiUsdtODTChart: Story = (args: TVChartContainerProsp) => (
  <div style={{ height: "80vh" }}>
    <TVChartContainer {...args} />;
  </div>
);
OraiUsdtODTChart.args = {
  theme: "dark",
  currentPair: {
    symbol: "ORAI/USDT",
    info: "orai-orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh"
  },
  pairsChart: [
    {
      symbol: "ORAI/USDT",
      info: "orai-orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh"
    }
  ],
  setChartTimeFrame: (resolution) => {
    console.log({ resolutionUpdate: resolution });
  },
  baseUrl: BASE_API_URL.ORDERBOOK,
  wsUrl: BASE_SOCKET_URL.ORDERBOOK,
  fetchDataChart: async (prams: { pair: string; startTime: number; endTime: number; tf: number }): Promise<Bar[]> => {
    const { pair, startTime, endTime, tf } = prams;
    console.log("paams", prams);
    try {
      const res = await axios.get(BASE_API_URL.ORDERBOOK + "/v1/candles/", {
        params: {
          pair: pair.split("-").join(" - "),
          startTime: Math.round(startTime / 60),
          endTime: Math.round(endTime / 60),
          tf: tf / 10
        }
      });

      return [...res.data].map((i) => {
        if (i.high > 200) {
          i.high = i.close + 1;
          i.open = i.close + 0.5;
        }

        return i;
      });
    } catch (e) {
      console.error("GetTokenChartPrice", e);
      return [];
    }
  }
};
