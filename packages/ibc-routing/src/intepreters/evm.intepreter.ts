import { Event, TxEvent } from "@cosmjs/tendermint-rpc/build/tendermint37";
import { generateError } from "@oraichain/oraidex-common";
import { OraiBridgeRouteData } from "@oraichain/oraidex-universal-swap";
import { createMachine, interpret } from "xstate";
import { ForwardTagOnOraichain, StateDBStatus } from "../@types";
import {
  batchSendToEthClaimEventType,
  FinalTag,
  invokableMachineStateKeys,
  oraiBridgeAutoForwardEventType,
  outGoingTxIdEventType,
  PathsToEvm
} from "../constants";
import { DuckDB } from "../db";
import { convertTxHashToHex } from "../helpers";
import { parseRpcEvents } from "../utils/events";
import { unmarshalOraiBridgeRoute } from "../utils/marshal";
import { decodeIbcMemo } from "../utils/protobuf";

// TODO: add more cases for each state to make the machine more resistent. Eg: switch to polling state when idle at a state for too long
// TODO: add precheck correct type of evm handle case
export const createEvmIntepreter = (db: DuckDB) => {
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
      oraiSendPacketSequence: -1, // sequence when SendPacket,
      oraiBridgePendingTxId: -1,
      oraiBridgeBatchNonce: -1,
      evmChainPrefixOnLeftTraverseOrder: "",
      evmChainPrefixOnRightTraverseOrder: ""
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
              eventNonce: parseInt(eventData[4].toString()),
              status: StateDBStatus.PENDING
            };

            console.log("EvmState", sendToCosmosData);
            // this context data will be used for querying in the next state
            ctx.evmEventNonce = sendToCosmosData.eventNonce;
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

            await ctx.db.updateStatusByTxHash("EvmState", StateDBStatus.FINISHED, prevEvmState.txHash);
            let packetData = JSON.parse(packetDataAttr.value);
            packetData.memo = decodeIbcMemo(packetData.memo, false).destinationDenom;

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
              batchNonce: 0,
              txId: 0,
              packetSequence: packetSequence,
              ...packetData,
              amount: packetData.amount,
              srcPort,
              srcChannel,
              dstPort,
              dstChannel,
              status: StateDBStatus.PENDING
            };
            console.log("Autoforward data:", autoForwardData);
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
          [invokableMachineStateKeys.STORE_ON_RECV_PACKET_ORAICHAIN]: "checkOnRecvPacketOraichain"
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
            if (packetAck != "1") {
              throw generateError(`The packet ack is not successful: ${packetAck}`);
            }
            // try finding the previous state and collect its tx hash and compare with our received packet sequence
            // gotta switch case to see if the packet is from oraibridge or other cosmos based networks so that we know which table to query the packet sequence
            // collect packet sequence
            // now we try finding send_packet, if not found then we finalize the state
            let nextState = "";
            let nextPacketData = {
              nextPacketSequence: 0,
              nextMemo: "",
              nextAmount: 0,
              nextReceiver: "",
              nextDestinationDenom: ""
            };
            const sendPacketEvent = events.find((e) => e.type === "send_packet");
            if (sendPacketEvent) {
              let nextPacketJson = JSON.parse(
                sendPacketEvent.attributes.find((attr) => attr.key == "packet_data").value
              );
              nextPacketData = {
                ...nextPacketData,
                nextPacketSequence: parseInt(
                  sendPacketEvent.attributes.find((attr) => attr.key == "packet_sequence").value
                ),
                nextMemo: "",
                nextAmount: parseInt(nextPacketJson.amount),
                nextDestinationDenom: nextPacketJson.denom,
                nextReceiver: nextPacketJson.receiver
              };
              ctx.oraiSendPacketSequence = nextPacketData.nextPacketSequence;
            }
            const existEvmPath = PathsToEvm.find((item) => nextPacketData.nextDestinationDenom.includes(item));
            nextState = existEvmPath ? "OraiBridgeState" : "";

            const { tableName, state } = await ctx.db.findStateByPacketSequence(event.data.packetSequence);
            if (!tableName)
              throw generateError(
                `Could not find the row with packet sequence ${event.data.packetSequence} in any table`
              );
            await ctx.db.updateStatusByTxHash(tableName, StateDBStatus.FINISHED, state.txHash);
            let onRecvPacketData = {
              txHash: convertTxHashToHex(txEvent.hash),
              height: txEvent.height,
              prevState: tableName,
              prevTxHash: state.txHash,
              nextState,
              packetSequence: event.data.packetSequence,
              packetAck,
              // the below fields are reserved for cases if we send packet to another chain
              ...nextPacketData,
              status: nextPacketData.nextPacketSequence != 0 ? StateDBStatus.PENDING : StateDBStatus.FINISHED
            };
            console.log("onRecvPacketData", onRecvPacketData);
            await ctx.db.insertData(onRecvPacketData, "OraichainState");
            // now we have verified everything, lets store the result into the db
            // TODO: if there's a next state, prepare to return a valid result here
            if (nextState || nextPacketData.nextPacketSequence != 0) {
              if (nextState == "OraiBridgeState") {
                return new Promise((resolve) => resolve(ForwardTagOnOraichain.EVM));
              }
              return new Promise((resolve) => resolve(ForwardTagOnOraichain.COSMOS));
            }
            // no next state, we move to final state of the machine
            return new Promise((resolve) => resolve(FinalTag));
          },
          onDone: [
            {
              target: "cosmos",
              cond: (ctx, event) => {
                return event.data === ForwardTagOnOraichain.COSMOS;
              }
            },
            {
              target: "oraiBridgeForEvm",
              cond: (ctx, event) => {
                return event.data === ForwardTagOnOraichain.EVM;
              }
            },
            {
              target: "finalState",
              cond: (ctx, event) => {
                return event.data === FinalTag;
              }
            }
          ]
        }
      },
      checkOnRecvPacketFailure: {},
      cosmos: {
        on: {
          [invokableMachineStateKeys.STORE_ON_ACKNOWLEDGEMENT_ORAICHAIN]: "checkOnAcknowledgementOnCosmos"
        }
      },
      checkOnAcknowledgementOnCosmos: {
        invoke: {
          src: async (ctx, event) => {
            const events = parseRpcEvents(event.payload.result.events);
            const ackPacket = events.find((attr) => attr.type === "acknowledge_packet");
            if (!ackPacket) {
              throw generateError("Acknowledgement packet not found on step checkOnAcknowledgementOnCosmos");
            }
            const value = ackPacket.attributes.find((attr: any) => attr.key === "packet_sequence").value;
            const data = parseInt(value);
            return new Promise((resolve) => resolve({ packetSequence: data }));
          },
          onDone: [
            {
              target: "oraichain",
              cond: (ctx, event) => {
                return event.data.packetSequence !== ctx.oraiSendPacketSequence;
              }
            },
            {
              target: "updateOnAcknowledgementOnCosmos",
              cond: (ctx, event) => {
                return event.data.packetSequence === ctx.oraiSendPacketSequence;
              }
            }
          ]
        }
      },
      updateOnAcknowledgementOnCosmos: {
        invoke: {
          src: async (ctx, events) => {
            const packetSequence = events.data.packetSequence;
            let oraichainData = await ctx.db.queryOraichainStateByNextPacketSequence(packetSequence);
            if (!oraichainData) {
              throw generateError(
                "error on finding oraichain state by next packet sequence in updateOnAcknowledgementOnCosmos"
              );
            }
            await ctx.db.updateOraichainStatusByNextPacketSequence(parseInt(packetSequence), StateDBStatus.FINISHED);
            console.log(await ctx.db.queryOraichainStateByNextPacketSequence(packetSequence));
          },
          onError: {
            actions: (ctx, event) => console.log("error on update on acknowledgement on OraiBridgeDB: ", event.data),
            target: "updateOnAcknowledgementOnCosmosFailure"
          },
          onDone: [
            {
              target: "finalState",
              cond: (ctx, event) => {
                return true;
              }
            }
          ]
        }
      },
      updateOnAcknowledgementOnCosmosFailure: {},
      oraiBridgeForEvm: {
        on: {
          [invokableMachineStateKeys.STORE_ON_RECV_PACKET_ORAIBRIDGE]: "checkOnRecvPacketOnOraiBridge"
        }
      },
      checkOnRecvPacketOnOraiBridge: {
        invoke: {
          src: async (ctx, event: any) => {
            const txEvent = event.payload as TxEvent;
            const events = parseRpcEvents(txEvent.result.events);
            const recvPacket = events.find((attr) => attr.type == "recv_packet");
            if (!recvPacket) {
              throw generateError(
                "Could not find the recv packet event from the payload at checkOnRecvPacketOraichain"
              );
            }
            const packetSequenceAttr = recvPacket.attributes.find((attr) => attr.key === "packet_sequence");
            const packetSequence = parseInt(packetSequenceAttr.value);

            // Forward next event data
            return new Promise((resolve) => resolve({ packetSequence, txEvent: txEvent }));
          },
          onDone: [
            {
              target: "onRecvPacketOnOraiBridge",
              cond: (ctx, event) => event.data.packetSequence === ctx.oraiSendPacketSequence
            },
            {
              target: "oraiBridgeForEvm",
              cond: (ctx, event) => event.data.packetSequence !== ctx.oraiSendPacketSequence
            }
          ]
        }
      },
      onRecvPacketOnOraiBridge: {
        invoke: {
          src: async (ctx, event) => {
            const txEvent = event.data.txEvent as TxEvent;
            const events = parseRpcEvents(txEvent.result.events);
            const outGoingEvent = events.find((attr) => attr.type == outGoingTxIdEventType);
            if (!outGoingEvent) {
              throw generateError(
                "Could not find the recv packet event from the payload at checkOnRecvPacketOraichain"
              );
            }
            const txId = outGoingEvent.attributes.find((attr) => attr.key === "tx_id").value;
            ctx.oraiBridgePendingTxId = parseInt(JSON.parse(txId));

            // Store on Recv Packet
            const recvPacketEvent = events.find((e) => e.type === "recv_packet");
            const packetSequenceAttr = recvPacketEvent.attributes.find((attr) => attr.key === "packet_sequence");
            if (!packetSequenceAttr)
              throw generateError("Cannot find the packet sequence in send_packet of auto forward");
            const packetDataAttr = recvPacketEvent.attributes.find((attr) => attr.key === "packet_data");
            if (!packetDataAttr) {
              throw generateError("Cannot find the packet data in send_packet of auto forward");
            }
            const srcPort = recvPacketEvent.attributes.find((attr) => attr.key === "packet_src_port").value;
            const srcChannel = recvPacketEvent.attributes.find((attr) => attr.key === "packet_src_channel").value;
            const dstPort = recvPacketEvent.attributes.find((attr) => attr.key === "packet_dst_port").value;
            const dstChannel = recvPacketEvent.attributes.find((attr) => attr.key === "packet_dst_channel").value;
            const packetSequence = parseInt(packetSequenceAttr.value);
            const prevOraichainState = await ctx.db.queryOraichainStateByNextPacketSequence(packetSequence);
            if (!prevOraichainState) {
              throw generateError("Can not find previous oraichain state db.");
            }
            const packetData = JSON.parse(packetDataAttr.value);

            const oraiBridgeData = {
              txHash: convertTxHashToHex(txEvent.hash),
              height: txEvent.height,
              prevState: "OraichainState",
              prevTxHash: prevOraichainState.txHash,
              next_state: "EvmSstate",
              eventNonce: 0,
              batchNonce: 0,
              txId: ctx.oraiBridgePendingTxId,
              packetSequence: packetSequence,
              ...packetData,
              amount: packetData.amount,
              srcPort,
              srcChannel,
              dstPort,
              dstChannel,
              status: StateDBStatus.PENDING
            };
            await ctx.db.insertData(oraiBridgeData, "OraiBridgeState");
            // End of storing on Recv Packet
          },
          onError: {
            actions: (ctx, event) => console.log("error check on recv packet OraiBridgeState: ", event.data),
            target: "onRecvPacketOnOraiBridgeFailure"
          },
          onDone: [
            {
              target: "onRequestBatch",
              cond: (ctx, event) => {
                return true;
              }
            }
          ]
        }
      },
      onRecvPacketOnOraiBridgeFailure: {},
      onRequestBatch: {
        on: {
          [invokableMachineStateKeys.STORE_ON_REQUEST_BATCH]: "checkOnRequestBatch"
        }
      },
      checkOnRequestBatch: {
        invoke: {
          src: async (ctx, event) => {
            const txEvent: TxEvent = event.payload;
            const events = parseRpcEvents(txEvent.result.events);
            events.forEach((event) => {
              console.log("========", event.type, "========");
              event.attributes.forEach((attr) => {
                console.log(`Key: ${attr.key} - Value: ${attr.value}`);
              });
            });
            const batchTxIds = events.find((attr) => attr.type == "batched_tx_ids");
            if (!batchTxIds) {
              throw generateError("Batched tx ids not found on request batch event");
            }
            const batchNonceData = events
              .find((attr) => attr.type == "gravity.v1.EventBatchCreated")
              .attributes.find((item) => item.key == "batch_nonce");
            if (!batchNonceData) {
              throw generateError("Batch nonce is not found on request batch event");
            }
            const batchNonceValue = parseInt(JSON.parse(batchNonceData.value));
            const txIds = batchTxIds.attributes.map((item) => parseInt(item.value));
            return new Promise((resolve) => resolve({ batchNonce: batchNonceValue, txIds, events }));
          },
          onError: {
            actions: (ctx, event) => console.log("error check on request batch OraiBridgeState: ", event.data),
            target: "checkOnRecvPacketFailure"
          },
          onDone: [
            {
              target: "storeOnRequestBatch",
              cond: (ctx, event) => {
                return event.data.txIds.includes(ctx.oraiBridgePendingTxId);
              }
            },
            {
              target: "onRequestBatch",
              cond: (ctx, event) => {
                console.log(event.data.txIds, ctx.oraiBridgePendingTxId);
                return !event.data.txIds.includes(ctx.oraiBridgePendingTxId);
              }
            }
          ]
        }
      },
      checkOnRequestBatchFailure: {},
      storeOnRequestBatch: {
        invoke: {
          src: async (ctx, event) => {
            const oraiBridgeData = await ctx.db.queryOraiBridgeByTxIdAndBatchNonce(0, ctx.oraiBridgePendingTxId, 1);
            if (oraiBridgeData.length == 0) {
              throw generateError("Error on saving data on onRecvPacketOnOraiBridge");
            }
            await ctx.db.updateOraiBridgeBatchNonceByTxId(event.data.batchNonce, ctx.oraiBridgePendingTxId);
            ctx.oraiBridgeBatchNonce = event.data.batchNonce;
          },
          onError: {
            actions: (ctx, event) => console.log("error on store on request batch: ", event.data),
            target: "storeOnRequestBatchFailure"
          },
          onDone: [
            {
              target: "onBatchSendToETHClaim",
              cond: (ctx, event) => {
                return true;
              }
            }
          ]
        }
      },
      storeOnRequestBatchFailure: {},
      onBatchSendToETHClaim: {
        on: {
          [invokableMachineStateKeys.STORE_ON_BATCH_SEND_TO_ETH_CLAIM]: "checkOnBatchSendToETHClaim"
        }
      },
      checkOnBatchSendToETHClaim: {
        invoke: {
          src: async (ctx, event) => {
            const txEvent: TxEvent = event.payload;
            const events = parseRpcEvents(txEvent.result.events);
            const batchSendToEthClaim = events.find((attr) => attr.type == batchSendToEthClaimEventType);
            const batchNonceObject = batchSendToEthClaim.attributes.find((item) => item.key == "batch_nonce");
            if (!batchNonceObject) {
              throw generateError("batch nonce does not exist on checkOnBatchSendToETHClaim");
            }
            const batchNonceValue = parseInt(JSON.parse(batchNonceObject.value));
            return new Promise((resolve) => resolve({ batchNonce: batchNonceValue }));
          },
          onDone: [
            {
              target: "storeOnBatchSendToETHClaim",
              cond: (ctx, event) => {
                return event.data.batchNonce === ctx.oraiBridgeBatchNonce;
              }
            },
            {
              target: "onBatchSendToETHClaim",
              cond: (ctx, event) => {
                return event.data.batchNonce !== ctx.oraiBridgeBatchNonce;
              }
            }
          ]
        }
      },
      storeOnBatchSendToETHClaim: {
        invoke: {
          src: async (ctx, event) => {
            const oraiBridgeData = await ctx.db.queryOraiBridgeStateByNonce(event.data.batchNonce);
            if (!oraiBridgeData) {
              throw generateError("error on saving batch nonce to eventNonce in OraiBridgeState");
            }
            await ctx.db.updateOraiBridgeStatusByEventNonce(event.data.batchNonce, StateDBStatus.FINISHED);
          },
          onError: {
            actions: (ctx, event) => console.log("error on store on batch send to eth claim: ", event.data),
            target: "storeOnBatchSendToETHClaimFailure"
          },
          onDone: [
            {
              target: "finalState",
              cond: (ctx, event) => {
                return true;
              }
            }
          ]
        }
      },
      storeOnBatchSendToETHClaimFailure: {},
      finalState: {
        type: "final"
      }
    }
  });
  const intepreter = interpret(machine).onTransition((state) => console.log(state.value));
  return intepreter;
};
