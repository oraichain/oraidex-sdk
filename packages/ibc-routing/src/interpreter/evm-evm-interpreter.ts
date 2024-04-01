import { Event, TxEvent } from "@cosmjs/tendermint-rpc/build/tendermint37";
import { generateError, parseRpcEvents } from "@oraichain/oraidex-common";
import { OraiBridgeRouteData, unmarshalOraiBridgeRoute } from "@oraichain/oraidex-universal-swap";
import { createMachine, interpret } from "xstate";
import { invokableMachineStateKeys, oraiBridgeAutoForwardEventType } from "../constants";
import { DuckDB } from "../db";
import { convertTxHashToHex } from "../helpers";

// TODO: add more cases for each state to make the machine more resistent. Eg: switch to polling state when idle at a state for too long
export const createEvmToEvmInterpreter = (db: DuckDB) => {
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
          [invokableMachineStateKeys.STORE_SEND_TO_COSMOS]: "sendToCosmosEvm"
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
              nextState: "OraiBridgeState",
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
            await ctx.db.insertData(sendToCosmosData, "EvmState");
            return new Promise((resolve) => resolve(sendToCosmosData.eventNonce));
          },
          onDone: { target: "oraibridge" }, // the resolved data from 'invoke' above will be passed to the 'oraibridge.autoForward' invoke method
          // rejected promise
          onError: {
            target: "SendToCosmosEvmFailure",
            // rejected promise data is on event.data property
            actions: (ctx, event) => console.log("error storing data into evm state: ", event.data)
          }
        },
        // after 1 min, if still at sendToCosmosEvm -> we move to timeout state and actively poll data instead of websocket
        after: {
          60000: {
            target: "SendToCosmosEvmTimeout",
            actions: (ctx, event) => console.log("Timeout evm state: ", event.data)
          }
        }
      },
      SendToCosmosEvmFailure: {},
      SendToCosmosEvmTimeout: {},
      oraibridge: {
        on: {
          [invokableMachineStateKeys.STORE_AUTO_FORWARD]: "checkAutoForward"
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
            const events = parseRpcEvents(txEvent.result.events);
            const prevEvmState = await ctx.db.queryInitialEvmStateByNonce(event.data.eventNonce);
            if (!prevEvmState) throw generateError("Cannot find the previous evm state data");
            // collect packet sequence
            const sendPacketEvent = events.find((e) => e.type === "send_packet");
            if (!sendPacketEvent) throw generateError("Cannot find the send packet event in auto forward message");
            const packetSequenceAttr = sendPacketEvent.attributes.find((attr) => attr.key === "packet_sequence");
            if (!packetSequenceAttr)
              throw generateError("Cannot find the packet sequence in send_packet of auto forward");
            const packetDataAttr = sendPacketEvent.attributes.find((attr) => attr.key === "packet_data");
            if (!packetDataAttr) {
              throw generateError("Cannot find the packet data in send_packet of auto forward");
            }
            const packetData = JSON.parse(packetDataAttr.value);
            // double down that given packet sequence & packet data, the event is surely send_packet of ibc => no need to guard check other attrs
            const srcPort = sendPacketEvent.attributes.find((attr) => attr.key === "packet_src_port").value;
            const srcChannel = sendPacketEvent.attributes.find((attr) => attr.key === "packet_src_channel").value;
            const dstPort = sendPacketEvent.attributes.find((attr) => attr.key === "packet_dst_port").value;
            const dstChannel = sendPacketEvent.attributes.find((attr) => attr.key === "packet_dst_channel").value;
            const packetSequence = parseInt(packetSequenceAttr.value);
            const autoForwardData = {
              txHash: convertTxHashToHex(txEvent.hash),
              height: txEvent.height,
              prevState: "EvmState",
              prevTxHash: prevEvmState.txHash,
              next_state: "OraichainState",
              eventNonce: event.data.eventNonce,
              packetSequence: packetSequence,
              ...packetData,
              amount: packetData.amount,
              srcPort,
              srcChannel,
              dstPort,
              dstChannel
            };
            console.log("auto forward data: ", autoForwardData);
            await ctx.db.insertData(autoForwardData, "OraiBridgeState");
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
          [invokableMachineStateKeys.STORE_ON_RECV_PACKET]: "checkOnRecvPacketOraichain"
        }
      },
      checkOnRecvPacketOraichain: {
        invoke: {
          src: async (ctx, event) => {
            const txEvent: TxEvent = event.payload;
            const events = parseRpcEvents(txEvent.result.events);
            const recvPacketEvent = events.find((e) => e.type === "recv_packet");
            if (!recvPacketEvent)
              throw generateError(
                "Could not find the recv packet event from the payload at checkOnRecvPacketOraichain"
              );
            const packetSequenceAttr = recvPacketEvent.attributes.find((attr) => attr.key === "packet_sequence");
            if (!packetSequenceAttr)
              throw generateError("Could not find packet sequence attr in checkOnRecvPacketOraichain");
            const packetSequence = parseInt(packetSequenceAttr.value);
            return new Promise((resolve) => resolve({ packetSequence, events, txEvent }));
          },
          onError: {
            actions: (ctx, event) => console.log("error check on recv packet OraichainState: ", event.data),
            target: "checkOnRecvPacketFailure"
          },
          onDone: [
            {
              target: "storeOnRecvPacket",
              cond: (ctx, event) => {
                return event.data.packetSequence === ctx.oraiBridgePacketSequence;
              }
            },
            {
              target: "oraichain",
              cond: (ctx, event) => {
                return event.data.packetSequence !== ctx.oraiBridgePacketSequence;
              }
            }
          ]
        }
      },
      storeOnRecvPacket: {
        invoke: {
          src: async (ctx, event) => {
            const txEvent: TxEvent = event.data.txEvent;
            const events: Event[] = event.data.events;
            const writeAckEvent = events.find((e) => e.type === "write_acknowledgement");
            if (!writeAckEvent)
              throw generateError("Could not find the write acknowledgement event in checkOnRecvPacketOraichain");
            const packetAckAttr = writeAckEvent.attributes.find((attr) => attr.key === "packet_ack");
            if (!packetAckAttr) throw generateError("Could not find packet ack attr in checkOnRecvPacketOraichain");
            // packet ack format: {"result":"MQ=="} or {"result":"<something-else-in-base-64"}
            const packetAck = Buffer.from(JSON.parse(packetAckAttr.value).result, "base64").toString("ascii");
            // if equals 1 it means the ack is successful. Otherwise, this packet has some errors
            console.log("packet ack: ", packetAck);
            if (packetAck != "1") {
              console.log("in here");
              throw generateError(`The packet ack is not successful: ${packetAck}`);
            }
            // try finding the previous state and collect its tx hash and compare with our received packet sequence
            // gotta switch case to see if the packet is from oraibridge or other cosmos based networks so that we know which table to query the packet sequence
            // collect packet sequence
            // now we try finding send_packet, if not found then we finalize the state
            let nextState = "";
            const sendPacketEvent = events.find((e) => e.type === "send_packet");
            if (sendPacketEvent) {
              // TODO: do something here to move to the next state
            }
            const { tableName, state } = await ctx.db.findStateByPacketSequence(event.data.packetSequence);
            if (!tableName)
              throw generateError(
                `Could not find the row with packet sequence ${event.data.packetSequence} in any table`
              );
            let onRecvPacketData = {
              txHash: convertTxHashToHex(txEvent.hash),
              height: txEvent.height,
              prevState: tableName,
              prevTxHash: state.txHash,
              nextState,
              packetSequence: event.data.packetSequence,
              packetAck,
              // the below fields are reserved for cases if we send packet to another chain
              nextPacketSequence: 0,
              nextMemo: "",
              nextAmount: 0,
              nextReceiver: "",
              nextDestinationDenom: ""
            };
            await ctx.db.insertData(onRecvPacketData, "OraichainState");
            // now we have verified everything, lets store the result into the db
            // TODO: if there's a next state, prepare to return a valid result here
            if (nextState) return new Promise((resolve) => resolve(""));
            // no next state, we move to final state of the machine
            return new Promise((resolve) => resolve("final"));
          },
          onDone: [
            {
              target: "cosmos",
              cond: (ctx, event) => {
                return event.data === "";
              }
            },
            {
              target: "finalState",
              cond: (ctx, event) => {
                return event.data === "final";
              }
            }
          ]
        }
      },
      checkOnRecvPacketFailure: {},
      cosmos: {},
      finalState: {
        type: "final"
      }
    }
  });
  const intepreter = interpret(machine).onTransition((state) => console.log(state.value));
  return intepreter;
};
