import { Event } from "@cosmjs/stargate";
import { parseRpcEvents } from "@oraichain/oraidex-common";
import { invokableMachineStateKeys, onExecuteContractTag } from "../constants";
import { createCosmosIntepreter } from "../intepreters/cosmos.intepreter";
import { createOraichainIntepreter } from "../intepreters/oraichain.intepreter";
import { EventHandler } from "./event.handler";

export class OraichainHandler extends EventHandler {
  public handleEvent(eventData: any[]) {
    for (const eventItem of eventData) {
      const events: Event[] = eventItem.result.events;
      // FIXME: we should not use events.find here. we need to exhaustively search for the attr type as one tx can include many transactions
      if (eventItem.result.log.includes("ibc_hooks_receive") && eventItem.result.log.includes("universal_swap")) {
        // create new machine so we start a new context for the transaction
        const intepreter = createCosmosIntepreter(this.db);
        this.im.appendIntepreter(intepreter);
        intepreter.start();
        intepreter.send({ type: invokableMachineStateKeys.STORE_ON_RECV_PACKET_ORAICHAIN, payload: eventItem });
        return;
      }
      if (eventItem.result.log.includes(onExecuteContractTag.value)) {
        const decodedEvents = parseRpcEvents(events);
        const sendPacketData = decodedEvents.find((item) => item.type == "send_packet");
        if (!sendPacketData) {
          return;
        }
        const packetData = sendPacketData.attributes.find((item) => item.key == "packet_data");
        if (!packetData) {
          return;
        }
        const packetDataValue = packetData.value;
        if (packetDataValue.includes("0x")) {
          const intepreter = createOraichainIntepreter(this.db);
          this.im.appendIntepreter(intepreter);
          intepreter.start();
          intepreter.send({
            type: invokableMachineStateKeys.STORE_ON_TRANSFER_BACK_TO_REMOTE_CHAIN,
            payload: eventItem
          });
        }
        return;
      }
      if (events.find((attr) => attr.type === "recv_packet")) {
        this.im.transitionInterpreters(invokableMachineStateKeys.STORE_ON_RECV_PACKET_ORAICHAIN, eventItem);
        return;
      }
      if (events.find((attr) => attr.type === "acknowledge_packet")) {
        this.im.transitionInterpreters(invokableMachineStateKeys.STORE_ON_ACKNOWLEDGEMENT_ORAICHAIN, eventItem);
        return;
      }
    }
  }
}