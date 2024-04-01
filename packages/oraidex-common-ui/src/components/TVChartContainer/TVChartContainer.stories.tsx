import React from "react";
import { Meta, StoryObj } from "@storybook/react";
import TVChartContainer, { TVChartContainerProsp } from "./TVChartContainer";

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
  }
};

export const OraiAtomChart: Story = (args: TVChartContainerProsp) => (
  <div style={{ height: "80vh" }}>
    <TVChartContainer {...args} />;
  </div>
);
OraiAtomChart.args = {
  theme: "dark",
  currentPair: {
    symbol: "ORAI/ATOM",
    info: "orai-ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78"
  }
};
