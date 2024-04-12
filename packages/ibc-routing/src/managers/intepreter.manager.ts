import { Mutex, MutexInterface } from "async-mutex";
import { AnyInterpreter } from "xstate";

class IntepreterManager {
  private intepreters: AnyInterpreter[] = [];
  private mutex: MutexInterface;

  constructor() {
    this.mutex = new Mutex();
  }

  public transitionInterpreters(type: string, payload: any): any {
    this.mutex
      .runExclusive(() => {
        this.intepreters = this.intepreters.filter((intepreter) => {
          const { done } = intepreter.send({ type, payload });
          return !done;
        });
      })
      .then(() => {
        this.mutex.release();
      });
  }

  public appendIntepreter(intepreter: AnyInterpreter) {
    this.mutex
      .runExclusive(() => {
        this.intepreters = [...this.intepreters, intepreter];
      })
      .then(() => {
        this.mutex.release();
      });
  }

  public deleteIntepreter(index: number) {
    this.mutex
      .runExclusive(() => {
        this.intepreters.splice(index, 1);
      })
      .then(() => {
        this.mutex.release();
      });
  }

  public getIntepreter(index: number): AnyInterpreter {
    return this.intepreters[index];
  }

  public getLengthIntepreters(): number {
    return this.intepreters.length;
  }

  // potential method to recover interpreters: https://stately.ai/docs/persistence#event-sourcing
  public recoverInterpreters(): any {}
}

export default IntepreterManager;
