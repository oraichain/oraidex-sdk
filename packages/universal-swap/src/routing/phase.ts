import { TxEvent } from "@cosmjs/tendermint-rpc";
import { BridgeContext } from "./event-listener";

export abstract class Phase {
  constructor(public context: BridgeContext) {}
  public abstract processPhase(data: any): Promise<void>;
}

export class CosmosPhase extends Phase {
  public processPhase(data: TxEvent): Promise<void> {
    this.context.conn.send("");
  }
}
