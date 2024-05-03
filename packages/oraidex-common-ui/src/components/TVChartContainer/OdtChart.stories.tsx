import React from "react";
import { Meta, StoryObj } from "@storybook/react";
import TVChartContainer, { TVChartContainerProsp } from "./TVChartContainer";
import { BASE_API_URL, BASE_SOCKET_URL } from "./helpers/requests";
import axios from "axios";
import { Bar } from "./helpers/types";

import { USDT_CONTRACT, XOCH_CONTRACT, BTC_CONTRACT } from "@oraichain/oraidex-common";

const DATA_PAIRS_ODT = [
  {
    id: 1,
    symbol: "ORAI/USDT",
    slippage: "0.0000000000000000", // TODO: remove
    from: "orai",
    to: USDT_CONTRACT,
    price_decimal: 6,
    info: "orai - " + USDT_CONTRACT,
    route: "/ORAI_USDT"
  },
  {
    id: 2,
    symbol: "xOCH/USDT",
    slippage: "0.0000000000000000", // TODO: remove
    from: XOCH_CONTRACT,
    to: USDT_CONTRACT,
    price_decimal: 6,
    info: `${XOCH_CONTRACT} - ${USDT_CONTRACT}`,
    route: "/xOCH_USDT"
  },
  {
    id: 4,
    symbol: "BTC/USDT",
    slippage: "0.0000000000000000", // TODO: remove
    from: BTC_CONTRACT,
    to: USDT_CONTRACT,
    price_decimal: 6,
    info: `${BTC_CONTRACT} - ${USDT_CONTRACT}`,
    route: "/BTC_USDT"
  }
];

const meta: Meta<typeof TVChartContainer> = {
  component: TVChartContainer,
  title: "ODT Tradingview",
  argTypes: {}
};
export default meta;

type Story = StoryObj<typeof TVChartContainer>;

export const OraiUsdtODTChart: Story = (args: TVChartContainerProsp) => (
  <div style={{ height: "80vh" }}>
    <TVChartContainer {...args} />;
  </div>
);
OraiUsdtODTChart.args = {
  theme: "dark",
  currentPair: {
    symbol: "ORAI/USDT",
    info: "orai - orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh"
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

  baseUrl: BASE_API_URL.ORDERBOOK_STAGING,

  fetchDataChart: async (prams: { pair: string; startTime: number; endTime: number; tf: number }): Promise<Bar[]> => {
    const { pair, startTime, endTime, tf } = prams;
    console.log("params", prams);

    try {
      const res = await axios.get(BASE_API_URL.ORDERBOOK_STAGING + "/v1/candles/", {
        params: {
          pair: pair.split("-").join(" - "),
          startTime: Math.round(startTime / 60),
          endTime: Math.round(endTime / 60),
          tf: tf / 60
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
  },
  socketConfig: {
    wsUrl: BASE_SOCKET_URL.ORDERBOOK_STAGING
  }
};

export const BtcUsdtODTChart: Story = (args: TVChartContainerProsp) => (
  <div style={{ height: "80vh" }}>
    <TVChartContainer {...args} />;
  </div>
);
BtcUsdtODTChart.args = {
  theme: "dark",
  currentPair: {
    symbol: "BTC/USDT",
    info: "orai10g6frpysmdgw5tdqke47als6f97aqmr8s3cljsvjce4n5enjftcqtamzsd - orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh"
  },
  pairsChart: [
    {
      symbol: "BTC/USDT",
      info: "orai10g6frpysmdgw5tdqke47als6f97aqmr8s3cljsvjce4n5enjftcqtamzsd-orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh"
    }
  ],
  setChartTimeFrame: (resolution) => {
    console.log({ resolutionUpdate: resolution });
  },

  baseUrl: BASE_API_URL.ORDERBOOK_STAGING,

  fetchDataChart: async (prams: { pair: string; startTime: number; endTime: number; tf: number }): Promise<Bar[]> => {
    const { pair, startTime, endTime, tf } = prams;
    console.log("params", prams);

    try {
      const res = await axios.get(BASE_API_URL.ORDERBOOK_STAGING + "/v1/candles/", {
        params: {
          pair: pair.split("-").join(" - "),
          startTime: Math.round(startTime / 60),
          endTime: Math.round(endTime / 60),
          tf: tf / 60
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
  },
  socketConfig: {
    wsUrl: BASE_SOCKET_URL.ORDERBOOK_STAGING,
    pairMapping: DATA_PAIRS_ODT
  }
};

export const XOCHUsdtODTChart: Story = (args: TVChartContainerProsp) => (
  <div style={{ height: "80vh" }}>
    <TVChartContainer {...args} />;
  </div>
);
XOCHUsdtODTChart.args = {
  theme: "dark",
  currentPair: {
    symbol: "xOCH/USDT",
    info: "orai1lplapmgqnelqn253stz6kmvm3ulgdaytn89a8mz9y85xq8wd684s6xl3lt - orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh"
  },
  pairsChart: [
    {
      symbol: "xOCH/USDT",
      info: "orai1lplapmgqnelqn253stz6kmvm3ulgdaytn89a8mz9y85xq8wd684s6xl3lt-orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh"
    }
  ],
  setChartTimeFrame: (resolution) => {
    console.log({ resolutionUpdate: resolution });
  },

  baseUrl: BASE_API_URL.ORDERBOOK_STAGING,

  fetchDataChart: async (prams: { pair: string; startTime: number; endTime: number; tf: number }): Promise<Bar[]> => {
    const { pair, startTime, endTime, tf } = prams;
    console.log("params", prams);

    try {
      const res = await axios.get(BASE_API_URL.ORDERBOOK_STAGING + "/v1/candles/", {
        params: {
          pair: pair.split("-").join(" - "),
          startTime: Math.round(startTime / 60),
          endTime: Math.round(endTime / 60),
          tf: tf / 60
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
  },
  socketConfig: {
    wsUrl: BASE_SOCKET_URL.ORDERBOOK_STAGING,
    pairMapping: DATA_PAIRS_ODT
  }
};
