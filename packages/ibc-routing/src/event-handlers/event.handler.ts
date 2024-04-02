import IntepreterManager from "src/managers/intepreter.manager";
import { DuckDB } from "../db";

export abstract class EventHandler {
  constructor(public readonly db: DuckDB, protected im: IntepreterManager) {}
  public abstract handleEvent(eventData: any[]): any;
}
