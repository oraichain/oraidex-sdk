import { TxEvent } from "@cosmjs/tendermint-rpc/build/tendermint37";
import { EvmChainPrefix, generateError } from "@oraichain/oraidex-common";
import { createMachine, interpret } from "xstate";
import {
  batchSendToEthClaimEventType,
  eventBatchCreatedEventType,
  invokableMachineStateKeys,
  outGoingTxIdEventType,
  StateDBStatus
} from "../constants";
import { DuckDB } from "../db";
import { convertTxHashToHex } from "../helpers";
import { parseRpcEvents } from "../utils/events";

export const createCosmosIntepreter = (db: DuckDB) => {
  const machine = createMachine({
    predictableActionArguments: true,
    preserveActionOrder: true,
    initial: "oraichain",
    context: {
      db,
      oraiBridgeEventNonce: -1,
      oraiBridgePacketSequence: -1,
      oraiSendPacketSequence: -1, // sequence when OnRecvPacket
      oraiBridgePendingTxId: -1,
      oraiBridgeBatchNonce: -1,
      evmChainPrefixOnRightTraverseOrder: ""
    },
    states: {
      oraichain: {
        on: {
          [invokableMachineStateKeys.STORE_ON_RECV_PACKET_ORAICHAIN]: "storeOnRecvPacketOraichain"
        }
      },
      storeOnRecvPacketOraichain: {
        invoke: {
          src: async (ctx, event) => {
            const txEvent: TxEvent = event.payload;
            const events = parseRpcEvents(txEvent.result.events);
            // events.forEach((event) => {
            //   console.log("=====", event.type, "=====");
            //   event.attributes.forEach((attr) => {
            //     console.log(attr.key, "-", attr.value);
            //   });
            // });
            const writeAckEvent = events.find((e) => e.type === "write_acknowledgement");
            if (!writeAckEvent)
              throw generateError("Could not find the write acknowledgement event in checkOnRecvPacketOraichain");
            const packetDataAttrStr = writeAckEvent.attributes.find((attr) => attr.key === "packet_data").value;
            const localReceiver = JSON.parse(packetDataAttrStr).receiver;
            const sender = JSON.parse(packetDataAttrStr).sender;

            let nextState = "";
            let nextPacketData = {
              nextPacketSequence: 0,
              nextMemo: "",
              nextAmount: "0",
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
                nextMemo: nextPacketJson?.memo || "",
                nextAmount: nextPacketJson.amount,
                nextDestinationDenom: nextPacketJson.denom,
                nextReceiver: nextPacketJson.receiver
              };
              ctx.oraiSendPacketSequence = nextPacketData.nextPacketSequence;
            }

            // const wasmData = events.find((e) => e.type === "wasm");
            // if (!wasmData) {
            //   throw generateError("there is no wasm data in storeOnRecvPacket");
            // }
            // const localReceiver = wasmData.attributes.find((attr) => attr.key == "from").value;

            const existEvmPath = Object.values(EvmChainPrefix).find((prefix) =>
              nextPacketData.nextDestinationDenom.includes(prefix)
            );
            nextState = existEvmPath ? "OraiBridgeState" : "";

            // we don't have previous packetSequence, so we save it as nextPacketSequence
            let onRecvPacketData = {
              txHash: convertTxHashToHex(txEvent.hash),
              height: txEvent.height,
              prevState: "",
              prevTxHash: "",
              nextState,
              packetSequence: ctx.oraiSendPacketSequence,
              packetAck: "",
              sender,
              localReceiver,
              // the below fields are reserved for cases if we send packet to another chain
              ...nextPacketData,
              status: StateDBStatus.PENDING
            };
            console.log("onRecvPacketData", onRecvPacketData);
            await ctx.db.insertData(onRecvPacketData, "OraichainState");

            // no next state, we move to final state of the machine
            return new Promise((resolve) => resolve(""));
          },
          onError: {
            actions: (ctx, event) => console.log("error on insert data on storeOnRecvPacketOraichain: ", event.data),
            target: "storeOnRecvPacketOraichainFailure"
          },
          onDone: [
            {
              target: "oraiBridgeForEvm",
              cond: (ctx, event) => {
                return true;
              }
            }
          ]
        }
      },
      storeOnRecvPacketOraichainFailure: {},
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
            console.log("Packet sequence:", packetSequence);

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
            if (prevOraichainState.length == 0) {
              throw generateError("Can not find previous oraichain state db.");
            }
            const packetData = JSON.parse(packetDataAttr.value);
            const memo = packetData.memo;
            const evmChainPrefix = Object.values(EvmChainPrefix).find((prefix) => memo.includes(prefix)) || "";
            ctx.evmChainPrefixOnRightTraverseOrder = evmChainPrefix;
            const oraiBridgeData = {
              txHash: convertTxHashToHex(txEvent.hash),
              height: txEvent.height,
              prevState: "OraichainState",
              prevTxHash: prevOraichainState.txHash,
              next_state: "EvmState",
              eventNonce: 0,
              batchNonce: 0,
              txId: ctx.oraiBridgePendingTxId,
              evmChainPrefix,
              packetSequence: packetSequence,
              amount: packetData.amount,
              denom: packetData.denom,
              memo: packetData.memo,
              receiver: packetData.receiver,
              sender: packetData.sender,
              srcPort,
              srcChannel,
              dstPort,
              dstChannel,
              status: StateDBStatus.PENDING
            };
            console.log("OraiBridgeData", oraiBridgeData);
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
            const batchTxIds = events.find((attr) => attr.type == "batched_tx_ids");
            if (!batchTxIds) {
              throw generateError("Batched tx ids not found on request batch event");
            }
            const batchNonceData = events
              .find((attr) => attr.type == eventBatchCreatedEventType)
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
            target: "checkOnRequestBatchFailure"
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
            const oraiBridgeData = await ctx.db.queryOraiBridgeByTxIdAndEvmChainPrefix(
              ctx.oraiBridgePendingTxId,
              ctx.evmChainPrefixOnRightTraverseOrder,
              1
            );
            if (oraiBridgeData.length == 0) {
              throw generateError("Error on saving data on onRecvPacketOnOraiBridge");
            }
            await ctx.db.updateOraiBridgeBatchNonceByTxIdAndEvmChainPrefix(
              event.data.batchNonce,
              ctx.oraiBridgePendingTxId,
              ctx.evmChainPrefixOnRightTraverseOrder
            );
            console.log(
              await ctx.db.queryOraiBridgeByTxIdAndEvmChainPrefix(
                ctx.oraiBridgePendingTxId,
                ctx.evmChainPrefixOnRightTraverseOrder,
                1
              )
            );
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
            const evmChainPrefix = batchSendToEthClaim.attributes.find((item) => item.key == "evm_chain_prefix").value;
            if (!evmChainPrefix) {
              throw generateError("evm chain prefix does not exist on checkOnBatchSendToETHClaim");
            }
            const eventNonce = batchSendToEthClaim.attributes.find((item) => item.key == "event_nonce").value;
            const batchNonceValue = parseInt(JSON.parse(batchNonceObject.value));
            return new Promise((resolve) =>
              resolve({
                batchNonce: batchNonceValue,
                evmChainPrefix: JSON.parse(evmChainPrefix),
                eventNonce: parseInt(JSON.parse(eventNonce))
              })
            );
          },
          onDone: [
            {
              target: "storeOnBatchSendToETHClaim",
              cond: (ctx, event) => {
                return (
                  event.data.batchNonce === ctx.oraiBridgeBatchNonce &&
                  ctx.evmChainPrefixOnRightTraverseOrder === event.data.evmChainPrefix
                );
              }
            },
            {
              target: "onBatchSendToETHClaim",
              cond: (ctx, event) => {
                console.log(event.data.batchNonce, ctx.oraiBridgeBatchNonce);
                console.log(ctx.evmChainPrefixOnRightTraverseOrder, event.data.evmChainPrefix);
                return (
                  event.data.batchNonce !== ctx.oraiBridgeBatchNonce ||
                  ctx.evmChainPrefixOnRightTraverseOrder !== event.data.evmChainPrefix
                );
              }
            }
          ]
        }
      },
      storeOnBatchSendToETHClaim: {
        invoke: {
          src: async (ctx, event) => {
            const oraiBridgeData = await ctx.db.queryOraiBridgeByTxIdAndEvmChainPrefix(
              ctx.oraiBridgePendingTxId,
              ctx.evmChainPrefixOnRightTraverseOrder,
              1
            );
            if (oraiBridgeData.length == 0) {
              throw generateError("error on saving batch nonce to eventNonce in OraiBridgeState");
            }
            await ctx.db.updateOraiBridgeStatusAndEventNonceByTxIdAndEvmChainPrefix(
              StateDBStatus.FINISHED,
              event.data.eventNonce,
              ctx.oraiBridgePendingTxId,
              ctx.evmChainPrefixOnRightTraverseOrder
            );
            // We don't care on everything without prevTxHash, eventNonce, evmChainPrefix
            const evmStateData = {
              txHash: "",
              height: 0,
              prevState: "OraiBridgeState",
              prevTxHash: oraiBridgeData[0].txHash,
              nextState: "",
              destination: "",
              fromAmount: 0,
              oraiBridgeChannelId: "",
              oraiReceiver: "",
              destinationDenom: "",
              destinationChannelId: "",
              destinationReceiver: `0x${oraiBridgeData[0].memo.split("0x")[1]}`,
              eventNonce: event.data.eventNonce,
              evmChainPrefix: ctx.evmChainPrefixOnRightTraverseOrder,
              status: StateDBStatus.FINISHED
            };
            console.log(evmStateData);
            await ctx.db.insertData(evmStateData, "EvmState");
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
