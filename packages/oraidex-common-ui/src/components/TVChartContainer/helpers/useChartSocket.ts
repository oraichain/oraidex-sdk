import { PAIRS, WEBSOCKET_RECONNECT_ATTEMPTS, WEBSOCKET_RECONNECT_INTERVAL } from "@oraichain/oraidex-common";
import { handleTradeEvent } from "./streaming";
import { useEffect, useState } from "react";
import { WS_URL } from "./requests";
// import * as Sentry from "@sentry/react";
import useWebSocket from "react-use-websocket";
import { EVENT_CHART_SOCKET } from "./constants";

export type LastJsonMessageType = {
  data: any;
  stream: string;
};

export const useChartSocket = ({ currentPair, period, socketConfig }) => {
  const [currentData, setData] = useState(null);
  const [currentPeriod, setPeriod] = useState(period);
  const [pairActive, setPairActive] = useState(currentPair);
  const {
    retryOnError = true,
    reconnectAttempts,
    reconnectInterval,
    wsUrl: socketUrl,
    pairMapping = PAIRS
  } = socketConfig || {};

  const { lastJsonMessage, sendJsonMessage } = useWebSocket<LastJsonMessageType>(socketUrl || WS_URL, {
    onOpen: () => {
      console.info("useChartSocket: connect WebSocket - ", socketUrl);
    },
    onClose: () => {
      console.info("useChartSocket: WebSocket connection closed.");
    },
    onReconnectStop(numAttempts) {
      if (numAttempts === (reconnectAttempts || WEBSOCKET_RECONNECT_ATTEMPTS))
        console.info("useChartSocket: Reconnection reaches above limit. Unsubscribe to all!");
    },
    shouldReconnect: () => true,
    onError: (error) => {
      if (!socketUrl) {
        console.warn("useChartSocket: Not have socketUrl option in websocket!", JSON.stringify(error));
        return;
      }
      console.error("useChartSocket: Have something went wrong with connection.", JSON.stringify(error));
    },
    reconnectAttempts: !socketUrl ? 0 : reconnectAttempts || WEBSOCKET_RECONNECT_ATTEMPTS,
    reconnectInterval: !socketUrl ? 0 : reconnectInterval || WEBSOCKET_RECONNECT_INTERVAL,
    retryOnError: !!retryOnError
  });

  useEffect(() => {
    if (sendJsonMessage && currentPair && period) {
      if (period !== currentPeriod || currentPeriod?.info !== pairActive?.info) {
        sendJsonMessage({
          id: 1,
          method: "UNSUBSCRIBE",
          params: [`${pairActive.info}@${currentPeriod}`]
        });

        setPeriod(period);
        setPairActive(currentPair);
      }

      console.info("SUBSCRIBE", {
        id: 1,
        method: "SUBSCRIBE",
        params: [`${currentPair.info}@${period}`]
      });

      sendJsonMessage({
        id: 1,
        method: "SUBSCRIBE",
        params: [`${currentPair.info}@${period}`]
      });

      return () => {
        sendJsonMessage({
          id: 1,
          method: "UNSUBSCRIBE",
          params: [`${currentPair.info}@${period}`]
        });
      };
    }
  }, [sendJsonMessage, currentPair, period]);

  useEffect(() => {
    if (lastJsonMessage && lastJsonMessage.data) {
      const { data, stream } = lastJsonMessage || {};

      // TODO: check event type
      if (stream === `${currentPair.info}@${period}`) {
        // if (stream !== `Pong`) {
        // console.info("Data stream: ", data);

        setData(data);
        handleTradeEvent(data, pairMapping);
      }
    }
  }, [lastJsonMessage]);

  return { currentPair, data: currentData };
};
