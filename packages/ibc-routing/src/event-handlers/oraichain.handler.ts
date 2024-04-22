import { Event } from "@cosmjs/stargate";
import { EvmChainPrefix } from "@oraichain/oraidex-common";
import { invokableMachineStateKeys } from "../constants";
import { createOraichainIntepreter } from "../intepreters/oraichain.intepreter";
import { parseRpcEvents } from "../utils/events";
import { EventHandler } from "./event.handler";

export class OraichainHandler extends EventHandler {
  public handleEvent(eventData: any[]) {
    for (const eventItem of eventData) {
      const events: Event[] = eventItem.result.events;
      const decodedEvents = parseRpcEvents(events);

      for (const event of decodedEvents) {
        if (event.type === "send_packet") {
          const packetData = event.attributes.find((item) => item.key == "packet_data");
          if (!packetData) {
            return;
          }
          const packetDataValue = packetData.value;
          try {
            if (
              Object.values(EvmChainPrefix).find((item) => JSON.parse(packetDataValue).denom.includes(item)) !==
              undefined
            ) {
              const intepreter = createOraichainIntepreter(this.db);
              this.im.appendIntepreter(intepreter);
              intepreter._inner.start();
              intepreter._inner.send({
                type: invokableMachineStateKeys.STORE_ON_TRANSFER_BACK_TO_REMOTE_CHAIN,
                payload: eventItem
              });
            }
          } catch (err) {}
          return;
        }
        if (event.type === "recv_packet") {
          this.im.transitionInterpreters(invokableMachineStateKeys.STORE_ON_RECV_PACKET_ORAICHAIN, eventItem);
        }
        if (event.type === "acknowledgement_packet") {
          this.im.transitionInterpreters(invokableMachineStateKeys.STORE_ON_ACKNOWLEDGEMENT_ORAICHAIN, eventItem);
        }
      }
    }
  }
}
