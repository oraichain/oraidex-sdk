import { assign, createMachine } from "xstate";
import { DuckDB } from "./db";
import { OraiBridgeRouteData, unmarshalOraiBridgeRoute } from "@oraichain/oraidex-universal-swap";

export const createEvmToEvmMachine = (db: DuckDB) => {
  return createMachine({
    initial: "evm",
    // we only maintain important context attributes for events to identify which machine they belong to
    context: {
      db,
      evmEventNonce: -1,
      oraiBridgeEventNonce: -1,
      oraiBridgePacketSequence: -1,
      oraiReceivePacketSequence: -1, // sequence when OnRecvPacket
      oraiSendPacketSequence: -1, // sequence when SendPacket
      finalMemo: ""
    },
    states: {
      evm: {
        on: {
          // listen to event sent elsewhere. Once received 'STORE' type event, then it will move to 'storeDb' state
          STORE_SEND_TO_COSMOS: "sendToCosmosEvm"
        }
      },
      oraibridge: {
        on: {
          STORE_AUTO_FORWARD: "autoForwardOraiBridge"
        }
      },
      // oraichain: {
      //   on: {
      //     STORE_ON_RECV_PACKET: "storeOraichain"
      //   }
      // },
      sendToCosmosEvm: {
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
              prevTxHash: "",
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
            // this context data will be used for querying in the next state
            ctx.evmEventNonce = sendToCosmosData.eventNonce;
            console.log("send to cosmos data: ", sendToCosmosData);
            await ctx.db.insertData(sendToCosmosData, "evm_state");
            return new Promise((resolve) => resolve(sendToCosmosData.eventNonce));
          },
          onDone: "oraibridge", // move to 'afterDb' state
          // rejected promise
          onError: {
            target: "SendToCosmosEvmFailure",
            // rejected promise data is on event.data property
            actions: (ctx, event) => console.log("error storing data into evm state: ", event.data)
          }
        }
      },
      SendToCosmosEvmFailure: {},
      autoForwardFailure: {},
      autoForwardOraiBridge: {
        invoke: {
          src: (ctx, event) => {
            console.log("event in autoforward oraibridge: ", event);
            return new Promise((resolve) => resolve(""));
          },
          // onDone: "oraichain", // move to 'afterDb' state
          // rejected promise
          onError: {
            target: "autoForwardFailure",
            // rejected promise data is on event.data property
            actions: (ctx, event) => console.log("error storing data into oraibridge state: ", event.data)
          }
        }
      }
    }
  });
};
