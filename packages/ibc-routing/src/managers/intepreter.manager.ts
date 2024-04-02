import { AnyInterpreter } from "xstate";

class IntepreterManager {
  private intepreters: AnyInterpreter[] = [];

  public transitionInterpreters(type: string, payload: any): any {
    for (let i = 0; i < this.intepreters.length; i++) {
      const currentState = this.intepreters[i].send({ type, payload });
      // this means that the entire state machine has reached the final state => done, we can remove the intepreter from the list (it is also stopped automatically as well)
      if (currentState.done) {
        this.intepreters.splice(i, 1);
      }
    }
  }

  public appendIntepreter(intepreter: AnyInterpreter) {
    this.intepreters.push(intepreter);
  }

  // potential method to recover interpreters: https://stately.ai/docs/persistence#event-sourcing
  public recoverInterpreters(): any {}
}

export default IntepreterManager;
