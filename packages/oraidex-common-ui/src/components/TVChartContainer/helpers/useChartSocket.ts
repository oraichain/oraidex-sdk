import { WEBSOCKET_RECONNECT_ATTEMPTS, WEBSOCKET_RECONNECT_INTERVAL } from "@oraichain/oraidex-common";
import { handleTradeEvent } from "./streaming";
import { useEffect, useState } from "react";
import { WS_URL } from "./requests";
// import * as Sentry from "@sentry/react";
import useWebSocket from "react-use-websocket";
import { EVENT_CHART_SOCKET } from "./constants";

export type LastJsonMessageType = {
  data: any;
  event: string;
};

export const useChartSocket = (currentPair, socketUrl) => {
  const [data, setData] = useState([]);

  const { lastJsonMessage } = useWebSocket<LastJsonMessageType>(socketUrl || WS_URL, {
    onOpen: () => {},
    onClose: () => {
      console.info("useChartSocket: WebSocket connection closed.");
    },
    onReconnectStop(numAttempts) {
      if (numAttempts === WEBSOCKET_RECONNECT_ATTEMPTS)
        console.info("useChartSocket: Reconnection reaches above limit. Unsubscribe to all!");
    },
    shouldReconnect: () => true,
    onError: (error) => {
      console.error("useChartSocket: Have something went wrong with connection.", JSON.stringify(error));
      // Sentry.captureException(`useChartSocket error with msg - ${error}`);
    },
    reconnectAttempts: WEBSOCKET_RECONNECT_ATTEMPTS,
    reconnectInterval: WEBSOCKET_RECONNECT_INTERVAL
  });

  useEffect(() => {
    if (lastJsonMessage && lastJsonMessage.data) {
      const { data = [], event } = lastJsonMessage || {};

      if (event === EVENT_CHART_SOCKET) {
        setData(data);

        for (const ohlcv of data) {
          handleTradeEvent(ohlcv);
        }
      }
    }
  }, [lastJsonMessage]);

  return { currentPair, data };
};
