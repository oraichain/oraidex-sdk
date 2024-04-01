import { generateError } from "@oraichain/oraidex-common";
import { invokableMachineStateKeys, sendToCosmosEvent } from "../constants";
import { keccak256HashString } from "../helpers";
import { createEvmToEvmInterpreter } from "../interpreter/evm-evm-interpreter";
import { EventHandler } from "./event-handler";

export class EvmEventHandler extends EventHandler {
  public transitionInterpreters(type: string, payload: any) {
    for (let i = 0; i < this.intepreters.length; i++) {
      const currentState = this.intepreters[i].send({ type, payload });
      // this means that the entire state machine has reached the final state => done, we can remove the intepreter from the list (it is also stopped automatically as well)
      if (currentState.done) this.intepreters.splice(i, 1);
    }
  }

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
      const intepreter = createEvmToEvmInterpreter(this.db);
      this.intepreters.push(intepreter);
      intepreter.start();
      // we wont need to loop through the intepreter list because we know this event starts a new machine already
      intepreter.send({ type: invokableMachineStateKeys.STORE_SEND_TO_COSMOS, payload: eventData });
    } else {
      console.log("unrelated event data: ", eventData);
    }
  }

  // TODO: in-case our server is down, we will be able to reconstruct the intepreters and their current contexts from our db
  public async recoverInterpreters() {}
}
