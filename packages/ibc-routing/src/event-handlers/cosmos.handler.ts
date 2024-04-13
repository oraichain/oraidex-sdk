import { Event } from "@cosmjs/stargate";
import { IbcWasmContract, invokableMachineStateKeys } from "../constants";
import { createCosmosIntepreter } from "../intepreters/cosmos.intepreter";
import { EventHandler } from "./event.handler";

export class CosmosHandler extends EventHandler {
  // This function will be used to handle the case frontend submit txhash
  public handleEvent(eventData: any[]) {
    for (const eventItem of eventData) {
      // we don't need to parse event on cosmos
      const events: Event[] = eventItem.txEvent.result.events;
      for (const event of events) {
        if (event.type != "send_packet") {
          continue;
        }
        const marshalPacketData = event.attributes.find((item) => item.key === "packet_data").value;
        const packetData = JSON.parse(marshalPacketData);

        if (packetData.memo == "" || !packetData.memo.includes("wasm") || !packetData.memo.includes("contract")) {
          continue;
        }

        const decodedMemo = JSON.parse(packetData.memo);
        if (decodedMemo.wasm.contract === IbcWasmContract) {
          // create new machine so we start a new context for the transaction
          const intepreter = createCosmosIntepreter(this.db);
          this.im.appendIntepreter(intepreter);
          intepreter.start();
          intepreter.send({
            type: invokableMachineStateKeys.STORE_ON_IBC_TRANSFER_FROM_REMOTE,
            payload: {
              event: event,
              ...eventItem
            }
          });
          return;
        }
      }
    }
  }
}
