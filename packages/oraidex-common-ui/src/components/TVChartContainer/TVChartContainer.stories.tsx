import React from "react";
import { Meta, StoryObj } from "@storybook/react";
import TVChartContainer, { TVChartContainerProsp } from "./TVChartContainer";
import { BASE_API_URL, BASE_SOCKET_URL } from "./helpers/requests";

const meta: Meta<typeof TVChartContainer> = {
  component: TVChartContainer,
  title: "Tradingview",
  argTypes: {}
};
export default meta;

type Story = StoryObj<typeof TVChartContainer>;
export const OraiUsdtChart: Story = (args: TVChartContainerProsp) => (
  <div style={{ height: "80vh" }}>
    <TVChartContainer {...args} />;
  </div>
);
OraiUsdtChart.args = {
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
  baseURL: BASE_API_URL.ORAIDEX,
  wsUrl: BASE_SOCKET_URL.ORAIDEX
};

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
  ]
  // baseURL: BASE_API_URL.ORAIDEX,
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
  baseURL: BASE_API_URL.FUTURE,
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
  baseURL: BASE_API_URL.ORDERBOOK,
  wsUrl: BASE_SOCKET_URL.ORDERBOOK
};
