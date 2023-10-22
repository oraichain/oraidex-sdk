import { createMachine, interpret } from "xstate";
import { DuckDB } from "./db";
import { OraiBridgeRouteData, unmarshalOraiBridgeRoute } from "@oraichain/oraidex-universal-swap";
import { TxEvent } from "@cosmjs/tendermint-rpc/build/tendermint37";
import { generateError, parseRpcEvents } from "@oraichain/oraidex-common";
import { oraiBridgeAutoForwardEventType } from "./constants";

// TODO: add more cases for each state to make the machine more resistent
// for example, if server down / socket down, miss oraibridge event, but still receive oraichain event with no found packet sequence then we will need to adapt somehow
export const createEvmToEvmIntepreter = (db: DuckDB) => {
  const machine = createMachine({
    predictableActionArguments: true,
    preserveActionOrder: true,
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
          STORE_AUTO_FORWARD: "checkAutoForward"
        }
      },
      checkAutoForward: {
        invoke: {
          src: async (ctx, event) => {
            if (!event.payload) throw generateError("There should be payload for this auto forward state event");
            const txEvent: TxEvent = event.payload;
            const events = parseRpcEvents(txEvent.result.events);
            const autoForwardEvent = events.find((event) => event.type === oraiBridgeAutoForwardEventType);
            if (!autoForwardEvent) {
              console.log("not autoforward event");
              return;
            }
            const nonceAttr = autoForwardEvent.attributes.find((attr) => attr.key === "nonce");
            if (!nonceAttr) {
              console.log("There is no event nonce attribute.");
              return;
            }
            event;
            const eventNonce = parseInt(JSON.parse(nonceAttr.value));
            console.log("event nonce: ", eventNonce);
            return new Promise((resolve) => resolve({ txEvent, eventNonce }));
          },
          onError: "checkAutoForwardFailure",
          onDone: [
            {
              target: "storeAutoForward",
              cond: (ctx, event) => {
                return event.data.eventNonce === ctx.evmEventNonce;
              }
            },
            {
              target: "oraibridge",
              cond: (ctx, event) => {
                return event.data.eventNonce !== ctx.evmEventNonce;
              }
            }
          ]
        }
      },
      storeAutoForward: {
        invoke: {
          src: async (ctx, event) => {
            const txEvent: TxEvent = event.data.txEvent; // should have { txEvent, eventNonce } sent from checkAutoForward
            const prevEvmState = await ctx.db.queryInitialEvmStateByNonce(event.data.eventNonce);
            if (!prevEvmState) throw generateError("Cannot find the previous evm state data");
            // collect packet sequence
            const events = parseRpcEvents(txEvent.result.events);
            const sendPacketEvent = events.find((e) => e.type === "send_packet");
            if (!sendPacketEvent) throw generateError("Cannot find the send packet event in auto forward message");
            const packetSequenceAttr = sendPacketEvent.attributes.find((attr) => attr.key === "packet_sequence");
            if (!packetSequenceAttr)
              throw generateError("Cannot find the packet sequence in send_packet of auto forward");
            const packetSequence = parseInt(packetSequenceAttr.value);
            const autoForwardData = {
              txHash: Buffer.from(txEvent.hash).toString("hex").toUpperCase(),
              height: txEvent.height,
              prevState: "evm_state",
              prevTxHash: prevEvmState.txHash,
              next_state: "oraichain_state",
              eventNonce: event.data.eventNonce,
              packetSequence: packetSequence
            };
            console.log("auto forward data: ", autoForwardData);
            await ctx.db.insertData(autoForwardData, "oraibridge_state");
            ctx.oraiBridgeEventNonce = event.data.eventNonce;
            ctx.oraiBridgePacketSequence = packetSequence;
            return new Promise((resolve) => resolve(""));
          },
          onDone: { target: "oraichain" }, // the resolved data from 'invoke' above will be passed to the 'oraibridge.autoForward' invoke method
          // rejected promise
          onError: {
            target: "storeAutoForwardFailure",
            // rejected promise data is on event.data property
            actions: (ctx, event) => console.log("error storing data into oraibridge state: ", event.data)
          }
        }
      },
      checkAutoForwardFailure: {},
      storeAutoForwardFailure: {},
      oraichain: {
        on: {
          STORE_ON_RECV_PACKET: "checkOnRecvPacketOraichain"
        }
      },
      checkOnRecvPacketOraichain: {
        invoke: {
          src: (ctx, event) => {
            console.log("received event on Oraichain: ", event);
            // TODO: parse event
            return new Promise((resolve) => resolve(""));
          }
        }
      },
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
          onDone: { target: "oraibridge" }, // the resolved data from 'invoke' above will be passed to the 'oraibridge.autoForward' invoke method
          // rejected promise
          onError: {
            target: "SendToCosmosEvmFailure",
            // rejected promise data is on event.data property
            actions: (ctx, event) => console.log("error storing data into evm state: ", event.data)
          }
        }
      },
      SendToCosmosEvmFailure: {}
    }
  });
  const intepreter = interpret(machine).onTransition((state) => console.log(state.value));
  return intepreter;
};
