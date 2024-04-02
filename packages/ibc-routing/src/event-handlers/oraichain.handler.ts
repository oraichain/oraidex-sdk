import { invokableMachineStateKeys } from "../constants";
import { EventHandler } from "./event.handler";

export class OraichainHandler extends EventHandler {
  public handleEvent(eventData: any[]) {
    // TODO: we also have the transfer_back_to_remote_chain case where we need to create a new intepreter
    this.im.transitionInterpreters(invokableMachineStateKeys.STORE_ON_RECV_PACKET, eventData[0]);
  }
}
