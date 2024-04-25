import { Mutex, MutexInterface } from "async-mutex";
import fs from "fs";
import { AnyInterpreter, InterpreterStatus } from "xstate";
import { IntepreterType } from "../constants";
import { DuckDbNode } from "../db";
import { createCosmosIntepreter } from "../intepreters/cosmos.intepreter";
import { createEvmIntepreter } from "../intepreters/evm.intepreter";
import { createOraichainIntepreter } from "../intepreters/oraichain.intepreter";

export interface IntepreterInterface {
  _inner: AnyInterpreter;
  type: IntepreterType;
}

class IntepreterManager {
  private intepreters: IntepreterInterface[] = [];
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
        this.intepreters = [
          ...this.intepreters.filter((intepreter) => {
            if (intepreter._inner.status === InterpreterStatus.Stopped) {
              console.log("Remove one of intepreters");
              return false;
            }

            intepreter._inner.send({ type, payload });
            return true;
          })
        ];

        this.saveIntepreters();
      })
      .then(() => {
        this.mutex.release();
      });
  }

  public appendIntepreter(intepreter: IntepreterInterface) {
    this.mutex
      .runExclusive(async () => {
        this.intepreters = [...this.intepreters, intepreter];

        this.saveIntepreters();
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

  public getIntepreter(index: number): IntepreterInterface {
    return this.intepreters[index];
  }

  public getLengthIntepreters(): number {
    return this.intepreters.length;
  }

  // potential method to recover interpreters: https://stately.ai/docs/persistence#event-sourcing
  public recoverInterpreters() {
    if (!fs.existsSync(this.path)) {
      return;
    }

    const data = fs.readFileSync(this.path, "utf-8");
    const intepreters = JSON.parse(data);
    let duckDb = DuckDbNode.instances;
    for (const intepreter of intepreters) {
      let intepreterData = JSON.parse(intepreter);
      let recoverIntepreter = undefined;

      let initialState = {
        ...intepreterData._inner,
        context: {
          ...intepreterData._inner.context,
          db: duckDb
        }
      };

      switch (intepreterData.type) {
        case IntepreterType.COSMOS:
          recoverIntepreter = createCosmosIntepreter(duckDb);
          break;
        case IntepreterType.EVM:
          recoverIntepreter = createEvmIntepreter(duckDb);
          break;
        case IntepreterType.ORAICHAIN:
          recoverIntepreter = createOraichainIntepreter(duckDb);
          break;
      }

      if (recoverIntepreter !== undefined) {
        recoverIntepreter._inner.start(initialState);
        this.appendIntepreter(recoverIntepreter);
      }
    }
  }

  private saveIntepreters() {
    const data = this._getAllSnapshot();
    fs.writeFileSync(this.path, JSON.stringify(data));
    if (this.temporary) {
      fs.unlinkSync(this.path);
    }
  }

  private _getAllSnapshot(): string[] {
    return this.intepreters.map((item) => JSON.stringify({ _inner: item._inner.getSnapshot(), type: item.type }));
  }
}

export default IntepreterManager;
