import { createMachine } from "xstate";
import { DuckDB } from "./db";

export const createEvmToEvmMachine = (db: DuckDB) => {
  return createMachine({
    initial: "evm",
    context: {
      db
    },
    states: {
      evm: {
        on: {
          // listen to event sent elsewhere. Once received 'STORE' type event, then it will move to 'storeDb' state
          STORE: "storeEvm"
        }
      },
      storeEvm: {
        invoke: {
          // function that returns a promise
          src: async (ctx, event) => {
            console.log("event in store Evm: ", event);
            return new Promise((resolve) => resolve("foobar"));
          },
          onDone: "afterDb" // move to 'afterDb' state
        }
      },
      afterDb: {
        entry: () => {
          console.log("in after db");
        }
      }
    }
  });
};
