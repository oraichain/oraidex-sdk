import { generateError } from "@oraichain/oraidex-common";
import { invokableMachineStateKeys } from "../constants";
import { EventHandler } from "./event.handler";

export class OraiBridgeHandler extends EventHandler {
  public handleEvent(eventData: any[]) {
    if (eventData.length === 0) throw generateError(`malformed OraiBridge event data: ${JSON.stringify(eventData)}`);
    // TODO: we also have the transfer_back_to_remote_chain case where we need to create a new intepreter
    this.im.transitionInterpreters(invokableMachineStateKeys.STORE_AUTO_FORWARD, eventData[0]);
  }
}
