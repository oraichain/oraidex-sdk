import { invokableMachineStateKeys } from "../constants";
import { EventHandler } from "./event-handler";

export class OraichainHandler extends EventHandler {
  public transitionInterpreters(type: string, payload: any) {
    for (let i = 0; i < this.intepreters.length; i++) {
      const currentState = this.intepreters[i].send({ type, payload });
      // this means that the entire state machine has reached the final state => done, we can remove the intepreter from the list (it is also stopped automatically as well)
      if (currentState.done) this.intepreters.splice(i, 1);
    }
  }

  public handleEvent(eventData: any[]) {
    // TODO: we also have the transfer_back_to_remote_chain case where we need to create a new intepreter
    this.transitionInterpreters(invokableMachineStateKeys.STORE_ON_RECV_PACKET, eventData[0]);
  }

  // TODO: in-case our server is down, we will be able to reconstruct the intepreters and their current contexts from our db
  async recoverInterpreters() {}
}
