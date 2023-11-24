import { parseChannelFromPair, parseFullSymbol, roundTime } from "./utils";

const channelToSubscription = new Map();
const handleTradeEvent = (data) => {
  const { open, close, low, high, volume, time, pair } = data;
  const channelString = parseChannelFromPair(pair);

  const subscriptionItem = channelToSubscription.get(channelString);
  if (subscriptionItem === undefined) {
    return;
  }
  const { lastDailyBar, resolution } = subscriptionItem;
  const roundLastBarTime = roundTime(new Date(lastDailyBar.time), resolution);
  const roundNextOrderTime = roundTime(new Date(time), resolution);

  let bar;
  if (roundNextOrderTime > roundLastBarTime) {
    bar = {
      time: roundNextOrderTime * 1000,
      open,
      high,
      low,
      close,
      volume: volume * Math.pow(10, -6)
    };
    console.info("[socket] Generate new bar", bar);
  } else if (roundNextOrderTime === roundLastBarTime) {
    bar = {
      ...lastDailyBar,
      high: Math.max(lastDailyBar.high, high),
      low: Math.min(lastDailyBar.low, low),
      close,
      volume: volume * Math.pow(10, -6) + lastDailyBar.volume
    };
    console.info("[socket] Update the latest bar by price", bar);
  } else {
    return;
  }
  subscriptionItem.lastDailyBar = bar;

  // Send data to every subscriber of that symbol
  subscriptionItem.handlers.forEach((handler) => handler.callback(bar));
};

function subscribeOnStream(
  symbolInfo,
  resolution,
  onRealtimeCallback,
  subscriberUID,
  _onResetCacheNeededCallback,
  lastDailyBar
) {
  const parsedSymbol = parseFullSymbol(symbolInfo.full_name);
  const channelString = `${parsedSymbol.fromSymbol}/${parsedSymbol.toSymbol}`;
  const handler = {
    id: subscriberUID,
    callback: onRealtimeCallback
  };
  let subscriptionItem = channelToSubscription.get(channelString);
  subscriptionItem = {
    subscriberUID,
    resolution,
    lastDailyBar,
    handlers: [handler]
  };
  channelToSubscription.set(channelString, subscriptionItem);
  console.log("[subscribeBars]: Subscribe to streaming. Channel:", channelString);
}

function unsubscribeFromStream(subscriberUID) {
  // Find a subscription with id === subscriberUID
  for (const channelString of channelToSubscription.keys()) {
    const subscriptionItem = channelToSubscription.get(channelString);
    const handlerIndex = subscriptionItem.handlers.findIndex((handler) => handler.id === subscriberUID);

    if (handlerIndex !== -1) {
      // Remove from handlers
      subscriptionItem.handlers.splice(handlerIndex, 1);

      if (subscriptionItem.handlers.length === 0) {
        // Unsubscribe from the channel if it was the last handler
        console.log("[unsubscribeBars]: Unsubscribe from streaming. Channel:", channelString);
        channelToSubscription.delete(channelString);
        break;
      }
    }
  }
}

export { handleTradeEvent, subscribeOnStream, unsubscribeFromStream };
