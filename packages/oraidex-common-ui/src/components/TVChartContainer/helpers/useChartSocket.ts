import { handleTradeEvent } from "components/TVChartContainer/helpers/streaming";
import { useEffect, useState } from "react";

export const APP_WS_URL = "";

export const useChartSocket = (currentPair, socketUrl) => {
  const [data, setData] = useState([]);

  useEffect(() => {
    const ws = new WebSocket(socketUrl || APP_WS_URL);
    ws.onmessage = (message) => {
      const payload = JSON.parse(message.data);
      console.info("[socket] Message:", payload);
      if (payload.event === "spot") {
        setData(payload.data);

        for (const ohlcv of payload.data) {
          handleTradeEvent(ohlcv);
        }
      }
    };

    return () => {
      ws.close();
    };
  }, [currentPair, socketUrl]);

  return { currentPair, data };
};
