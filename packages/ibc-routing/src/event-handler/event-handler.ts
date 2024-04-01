import { AnyInterpreter } from "xstate";
import { DuckDB } from "../db";

export abstract class EventHandler {
  public intepreters: AnyInterpreter[] = [];
  constructor(public readonly db: DuckDB) {}
  public abstract transitionInterpreters(type: string, payload: any): any;
  public abstract handleEvent(eventData: any[]): any;
  // potential method to recover interpreters: https://stately.ai/docs/persistence#event-sourcing
  public abstract recoverInterpreters(): any;
}
