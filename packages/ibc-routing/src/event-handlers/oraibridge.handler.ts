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
      const events = eventItem.result.events;
      switch (true) {
        case events.find((attr) => attr.type === "recv_packet") !== undefined:
          this.im.transitionInterpreters(invokableMachineStateKeys.STORE_ON_RECV_PACKET_ORAIBRIDGE, eventData[0]);
          break;
        case events.find((attr) => attr.type === oraiBridgeAutoForwardEventType) !== undefined:
          this.im.transitionInterpreters(invokableMachineStateKeys.STORE_AUTO_FORWARD, eventData[0]);
          break;
        case events.find((attr) => attr.type === eventBatchCreatedEventType) !== undefined:
          this.im.transitionInterpreters(invokableMachineStateKeys.STORE_ON_REQUEST_BATCH, eventData[0]);
          break;
        case events.find((attr) => attr.type === batchSendToEthClaimEventType) !== undefined:
          this.im.transitionInterpreters(invokableMachineStateKeys.STORE_ON_BATCH_SEND_TO_ETH_CLAIM, eventData[0]);
      }
    }
  }
}
