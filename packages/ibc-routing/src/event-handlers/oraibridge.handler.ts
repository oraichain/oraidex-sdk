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

      // FIXME: we should not use events.find here. we need to exhaustively search for the attr type as one tx can include many transactions
      if (events.find((attr) => attr.type === "recv_packet")) {
        this.im.transitionInterpreters(invokableMachineStateKeys.STORE_ON_RECV_PACKET_ORAIBRIDGE, eventItem);
        return;
      }
      if (events.find((attr) => attr.type === oraiBridgeAutoForwardEventType)) {
        this.im.transitionInterpreters(invokableMachineStateKeys.STORE_AUTO_FORWARD, eventItem);
        return;
      }
      if (events.find((attr) => attr.type === eventBatchCreatedEventType)) {
        this.im.transitionInterpreters(invokableMachineStateKeys.STORE_ON_REQUEST_BATCH, eventItem);
        return;
      }
      if (events.find((attr) => attr.type === batchSendToEthClaimEventType)) {
        this.im.transitionInterpreters(invokableMachineStateKeys.STORE_ON_BATCH_SEND_TO_ETH_CLAIM, eventItem);
        return;
      }
    }
  }
}
