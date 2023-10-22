import { assign, createMachine } from "xstate";
import { DuckDB } from "./db";
import { OraiBridgeRouteData, unmarshalOraiBridgeRoute } from "@oraichain/oraidex-universal-swap";

export const createEvmToEvmMachine = (db: DuckDB) => {
  return createMachine({
    initial: "evm",
    context: {
      db,
      initialTxHash: ""
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
            const eventData = event.payload;
            const { transactionHash: txHash, blockNumber: height } = eventData[5];
            const routeData: OraiBridgeRouteData = unmarshalOraiBridgeRoute(eventData[2]);
            const sendToCosmosData = {
              txHash,
              height,
              prevState: "",
              nextState: "oraibridge_state",
              destination: eventData[2],
              fromAmount: eventData[3].toString(),
              oraiBridgeChannelId: routeData.oraiBridgeChannel,
              oraiReceiver: routeData.oraiReceiver,
              destinationDenom: routeData.tokenIdentifier,
              destinationChannel: routeData.finalDestinationChannel,
              destinationReceiver: routeData.finalReceiver,
              eventNonce: parseInt(eventData[4].toString())
            };
            ctx.initialTxHash = txHash;
            await ctx.db.insertData(sendToCosmosData, "evm_state");
            return new Promise((resolve) => resolve(txHash));
          },
          onDone: "afterDb", // move to 'afterDb' state
          // rejected promise
          onError: {
            target: "storeEvmFailure",
            // rejected promise data is on event.data property
            actions: (ctx, event) => console.log("error storing data into evm state: ", event.data)
          }
        }
      },
      storeEvmFailure: {},
      afterDb: {
        entry: () => {
          console.log("in after db");
        }
      }
    }
  });
};
