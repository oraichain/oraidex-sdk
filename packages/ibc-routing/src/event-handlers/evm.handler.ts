import { generateError } from "@oraichain/oraidex-common";
import { invokableMachineStateKeys, sendToCosmosEvent } from "../constants";
import { keccak256HashString } from "../helpers";
import { createEvmIntepreter } from "../intepreters/evm.intepreter";
import { EventHandler } from "./event.handler";

export class EvmEventHandler extends EventHandler {
  public handleEvent(eventData: any[]) {
    const eventObject = eventData.find((data) => typeof data === "object" && data.topics);
    if (!eventObject)
      throw generateError(
        `There is something wrong with the evm event because it has no topics: ${JSON.stringify(eventData)}`
      );
    const topics: string[] = eventObject.topics;
    if (!topics)
      throw generateError(`There is no topics => something wrong with this event: ${JSON.stringify(eventData)}`);

    if (topics.includes(keccak256HashString(sendToCosmosEvent))) {
      // create new machine so we start a new context for the transaction
      const intepreter = createEvmIntepreter(this.db);
      this.im.appendIntepreter(intepreter);

      // we wont need to loop through the intepreter list because we know this event starts a new machine already
      intepreter._inner.start();
      intepreter._inner.send({ type: invokableMachineStateKeys.STORE_SEND_TO_COSMOS, payload: eventData });
    } else {
      console.log("unrelated event data: ", eventData);
    }
  }
}
