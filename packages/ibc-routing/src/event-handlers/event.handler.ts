import { DuckDB } from "../db";
import IntepreterManager from "../managers/intepreter.manager";

export abstract class EventHandler {
  constructor(public readonly db: DuckDB, protected im: IntepreterManager) {}
  public abstract handleEvent(eventData: any[]): any;
}
