import { WebsocketClient } from "@cosmjs/tendermint-rpc";
import { Tendermint37Client } from "@cosmjs/tendermint-rpc/build/tendermint37";
import { buildQuery } from "@cosmjs/tendermint-rpc/build/tendermint37/requests";
import { createMachine, interpret } from "xstate";

let txList = [];

const machine = createMachine({
  initial: "dbEntry",
  states: {
    dbEntry: {
      on: {
        // listen to event sent elsewhere. Once received 'STORE' type event, then it will move to 'storeDb' state
        STORE: "storeDb"
      }
    },
    storeDb: {
      invoke: {
        // function that returns a promise
        src: (ctx, event) => {
          txList.push(event.txHash);
          console.log("tx list: ", txList);
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

const txMachine = interpret(machine, { devTools: true })
  .onTransition((s) => console.log(s.value))
  .start();

const connectCosmosSocket = async () => {
  const client = await Tendermint37Client.create(new WebsocketClient("testnet.rpc.orai.io"));
  const stream = client.subscribeTx(
    buildQuery({
      tags: []
    })
  );
  stream.subscribe({
    next: async (event) => {
      const txHash = Buffer.from(event.hash).toString("hex").toUpperCase();
      // console.log("new tx hash: ", txHash);
      txMachine.send({ type: "STORE", txHash });
      // const parsedEvents = parseRpcEvents(event.result.events);
      console.log("tx list: ", txList);
      // console.dir(parsedEvents, { depth: null });
    }
  });
};

connectCosmosSocket();
