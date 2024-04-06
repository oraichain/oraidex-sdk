import { invokableMachineStateKeys } from "../constants";
import { EventHandler } from "./event.handler";

export class OraichainHandler extends EventHandler {
  public handleEvent(eventData: any[]) {
    for (const eventItem of eventData) {
      const events = eventItem.result.events;
      switch (true) {
        case events.find((attr) => attr.type === "recv_packet") !== undefined:
          this.im.transitionInterpreters(invokableMachineStateKeys.STORE_ON_RECV_PACKET_ORAICHAIN, eventItem);
          break;
        case events.find((attr) => attr.type === "acknowledge_packet") !== undefined:
          this.im.transitionInterpreters(invokableMachineStateKeys.STORE_ON_ACKNOWLEDGEMENT_ORAICHAIN, eventItem);
          break;
      }
    }
  }
}
