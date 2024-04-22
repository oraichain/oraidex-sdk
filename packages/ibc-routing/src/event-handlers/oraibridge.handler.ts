import { Event } from "@cosmjs/stargate";
import { generateError } from "@oraichain/oraidex-common";
import {
  batchSendToEthClaimEventType,
  eventBatchCreatedEventType,
  invokableMachineStateKeys,
  oraiBridgeAutoForwardEventType
} from "../constants";
import { EventHandler } from "./event.handler";

export class OraiBridgeHandler extends EventHandler {
  public handleEvent(eventData: any[]) {
    if (eventData.length === 0) throw generateError(`malformed OraiBridge event data: ${JSON.stringify(eventData)}`);
    for (const eventItem of eventData) {
      const events: Event[] = eventItem.result.events;

      for (const event of events) {
        if (event.type === "recv_packet") {
          this.im.transitionInterpreters(invokableMachineStateKeys.STORE_ON_RECV_PACKET_ORAIBRIDGE, eventItem);
        }
        if (event.type === oraiBridgeAutoForwardEventType) {
          this.im.transitionInterpreters(invokableMachineStateKeys.STORE_AUTO_FORWARD, eventItem);
        }
        if (event.type === eventBatchCreatedEventType) {
          this.im.transitionInterpreters(invokableMachineStateKeys.STORE_ON_REQUEST_BATCH, eventItem);
        }
        if (event.type === batchSendToEthClaimEventType) {
          this.im.transitionInterpreters(invokableMachineStateKeys.STORE_ON_BATCH_SEND_TO_ETH_CLAIM, eventItem);
        }
      }
    }
  }
}
