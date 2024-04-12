import { Mutex, MutexInterface } from "async-mutex";
import fs from "fs";
import { AnyInterpreter, createMachine, interpret } from "xstate";
import { DuckDbNode } from "../db";

class IntepreterManager {
  private intepreters: AnyInterpreter[] = [];
  private mutex: MutexInterface;
  private path: string;
  private temporary: boolean;

  /**
   *
   * @param temporary: whether writing path file is temporary or not (used for test)
   * @param path: path to store file
   */
  constructor(temporary: boolean = false, path: string = ".") {
    this.mutex = new Mutex();
    this.path = `${path}/backup.json`;
    this.temporary = temporary;
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
      .runExclusive(async () => {
        this.intepreters = [...this.intepreters, intepreter];

        const data = this._getAllSnapshot();
        await fs.promises.writeFile(this.path, JSON.stringify(data));
        if (this.temporary) {
          await fs.promises.unlink(this.path);
        }
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
  public async recoverInterpreters(): Promise<void> {
    const data = await fs.promises.readFile(this.path, "utf-8");
    const intepreters = JSON.parse(data);
    for (const intepreter of intepreters) {
      let initialState = {
        ...JSON.parse(intepreter),
        context: {
          ...JSON.parse(intepreter).context,
          db: DuckDbNode.instances
        }
      };
      const machine = createMachine({
        predictableActionArguments: true,
        preserveActionOrder: true
      });
      const intepreterInstance = interpret(machine).onTransition((state) => console.log(state.value));
      this.appendIntepreter(intepreter);
      intepreterInstance.execute(initialState);
    }
  }

  private _getAllSnapshot(): string[] {
    return this.intepreters.map((item) => JSON.stringify(item.getSnapshot()));
  }
}

export default IntepreterManager;
