import { Event } from "@cosmjs/stargate";
import { generateError } from "@oraichain/oraidex-common";
import { setTimeout } from "timers/promises";
import {
  batchSendToEthClaimEventType,
  eventBatchCreatedEventType,
  invokableMachineStateKeys,
  oraiBridgeAutoForwardEventType,
  WaitTimePerEachTransition
} from "../constants";
import { parseRpcEvents } from "../utils/events";
import { EventHandler } from "./event.handler";

export class OraiBridgeHandler extends EventHandler {
  public handleEvent(txEventData: any[]) {
    if (txEventData.length === 0)
      throw generateError(`malformed OraiBridge event data: ${JSON.stringify(txEventData)}`);
    for (const txEventItem of txEventData) {
      const events: Event[] = txEventItem.result.events;
      const decodedEvents: Event[] = parseRpcEvents(events);

      let previousEventType = "";
      for (const event of decodedEvents) {
        // if the next event is the same as previous event then it has to wait a little time to broadcast event to intepreters
        setTimeout(WaitTimePerEachTransition * (previousEventType === event.type ? 1 : 0)).then(() => {
          if (event.type === "recv_packet") {
            this.im.transitionInterpreters(invokableMachineStateKeys.STORE_ON_RECV_PACKET_ORAIBRIDGE, {
              eventItem: event,
              txEvent: txEventItem
            });
          }
          if (event.type === oraiBridgeAutoForwardEventType) {
            this.im.transitionInterpreters(invokableMachineStateKeys.STORE_AUTO_FORWARD, {
              eventItem: event,
              txEvent: txEventItem
            });
          }
          if (event.type === eventBatchCreatedEventType) {
            this.im.transitionInterpreters(invokableMachineStateKeys.STORE_ON_REQUEST_BATCH, txEventItem);
          }
          if (event.type === batchSendToEthClaimEventType) {
            this.im.transitionInterpreters(invokableMachineStateKeys.STORE_ON_BATCH_SEND_TO_ETH_CLAIM, txEventItem);
          }
          previousEventType = event.type;
        });
      }
    }
  }
}
