import "polyfill";
import { createRoot } from "react-dom/client";
import { TVChartContainer } from "./components";
import "./index.scss";
import React from "react";

const initApp = async () => {
  const root = createRoot(document.getElementById("oraiswap"));

  root.render(<TVChartContainer theme="light" currentPair={} />);
};

initApp();

export * from "./components";
