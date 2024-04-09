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
        for (let i = 0; i < this.intepreters.length; i++) {
          const currentState = this.intepreters[i].send({ type, payload });
          // this means that the entire state machine has reached the final state => done, we can remove the intepreter from the list (it is also stopped automatically as well)
          if (currentState.done) {
            this.intepreters.splice(i, 1);
          }
        }
      })
      .then(() => {
        this.mutex.release();
      });
  }

  public appendIntepreter(intepreter: AnyInterpreter) {
    this.mutex
      .runExclusive(() => {
        this.intepreters.push(intepreter);
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
