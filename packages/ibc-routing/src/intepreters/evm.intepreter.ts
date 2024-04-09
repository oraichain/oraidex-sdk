import { StargateClient } from "@cosmjs/stargate";
import { QueryTag } from "@cosmjs/tendermint-rpc/build/tendermint37";
import { buildQuery } from "@cosmjs/tendermint-rpc/build/tendermint37/requests";
import { EvmChainPrefix, generateError } from "@oraichain/oraidex-common";
import { createMachine, interpret } from "xstate";
import {
  autoForwardTag,
  executedIbcAutoForwardType,
  FinalTag,
  ForwardTagOnOraichain,
  invokableMachineStateKeys,
  TimeOut
} from "../constants";
import { DuckDB } from "../db";
import { convertIndexedTxToTxEvent } from "../helpers";
import { parseRpcEvents } from "../utils/events";
import {
  handleCheckAutoForward,
  handleCheckOnAcknowledgementOnCosmos,
  handleCheckOnBatchSendToEthClaim,
  handleCheckOnRecvPacketOnOraiBridge,
  handleCheckOnRecvPacketOraichain,
  handleCheckOnRequestBatch,
  handleOnRecvPacketOnOraiBridge,
  handleSendToCosmosEvm,
  handleStoreAutoForward,
  handleStoreOnBatchSendToEthClaim,
  handleStoreOnRecvPacketOraichain,
  handleStoreOnRequestBatchOraiBridge,
  handleUpdateOnAcknowledgementOnCosmos
} from "./common.intepreter";

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
            return handleSendToCosmosEvm(ctx, event);
          },
          onDone: { target: "oraibridge" }, // the resolved data from 'invoke' above will be passed to the 'oraibridge.autoForward' invoke method
          // rejected promise
          onError: {
            target: "sendToCosmosEvmFailure",
            // rejected promise data is on event.data property
            actions: (ctx, event) => console.log("error storing data into evm state: ", event.data)
          }
        }
      },
      sendToCosmosEvmFailure: {},
      oraibridge: {
        on: {
          [invokableMachineStateKeys.STORE_AUTO_FORWARD]: "checkAutoForward"
        },
        after: {
          [TimeOut]: {
            target: "oraiBridgeTimeOut",
            actions: (ctx, event) =>
              console.log("Move to timeout from oraiBridge: ", ctx.evmEventNonce, ctx.evmChainPrefixOnLeftTraverseOrder)
          }
        }
      },
      oraiBridgeTimeOut: {
        invoke: {
          src: async (ctx, event) => {
            const queryTags: QueryTag[] = [autoForwardTag];
            const query = buildQuery({
              tags: queryTags,
              raw: `${executedIbcAutoForwardType}.nonce=${ctx.evmEventNonce}`
            });
            const stargateClient = await StargateClient.connect("https://bridge-v2.rpc.orai.io");
            const txs = await stargateClient.searchTx(query);
            console.log(txs);
            let found = false;
            for (const tx of txs) {
              const events = parseRpcEvents(tx.events);
              const sendPacketEvent = events.find((e) => e.type === "send_packet");
              if (!sendPacketEvent) {
                break;
              }
              const packetSequenceAttr = sendPacketEvent.attributes.find((attr) => attr.key === "packet_sequence");
              if (!packetSequenceAttr) {
                break;
              }
              const packetDataAttr = sendPacketEvent.attributes.find((attr) => attr.key === "packet_data");
              if (!packetDataAttr) {
                break;
              }
              const packetData = JSON.parse(packetDataAttr.value);
              const denom: string = packetData.denom;
              const evmChainPrefix = Object.values(EvmChainPrefix).find((prefix) => denom.includes(prefix));
              if (evmChainPrefix == ctx.evmChainPrefixOnLeftTraverseOrder) {
                console.log("Passing", {
                  txEvent: convertIndexedTxToTxEvent(tx),
                  eventNonce: ctx.evmEventNonce,
                  evmChainPrefix: ctx.evmChainPrefixOnLeftTraverseOrder
                });
                return new Promise((resolve) =>
                  resolve({
                    txEvent: convertIndexedTxToTxEvent(tx),
                    eventNonce: ctx.evmEventNonce,
                    evmChainPrefix: ctx.evmChainPrefixOnLeftTraverseOrder
                  })
                );
              }
            }
            if (!found) {
              throw generateError("there is not event existing as we expected on oraibridgeTimeOut");
            }
          },
          onError: "oraibridge",
          onDone: "storeAutoForward"
        }
      },
      checkAutoForward: {
        invoke: {
          src: async (ctx, event) => {
            return handleCheckAutoForward(ctx, event);
          },
          onError: "checkAutoForwardFailure",
          onDone: [
            {
              target: "storeAutoForward",
              cond: (ctx, event) => {
                return (
                  event.data.eventNonce === ctx.evmEventNonce &&
                  event.data.evmChainPrefix === ctx.evmChainPrefixOnLeftTraverseOrder
                );
              }
            },
            {
              target: "oraibridge",
              cond: (ctx, event) => {
                console.log(event.data.evmChainPrefix, ctx.evmChainPrefixOnLeftTraverseOrder);
                return (
                  event.data.eventNonce !== ctx.evmEventNonce ||
                  event.data.evmChainPrefix !== ctx.evmChainPrefixOnLeftTraverseOrder
                );
              }
            }
          ]
        }
      },
      storeAutoForward: {
        invoke: {
          src: async (ctx, event) => {
            return handleStoreAutoForward(ctx, event);
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
            return handleCheckOnRecvPacketOraichain(ctx, event);
          },
          onError: {
            actions: (ctx, event) => console.log("error check on recv packet OraichainState: ", event.data),
            target: "checkOnRecvPacketFailure"
          },
          onDone: [
            {
              target: "storeOnRecvPacketOraichain",
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
      storeOnRecvPacketOraichain: {
        invoke: {
          src: async (ctx, event) => {
            return handleStoreOnRecvPacketOraichain(ctx, event);
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
            return handleCheckOnAcknowledgementOnCosmos(ctx, event);
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
            return handleUpdateOnAcknowledgementOnCosmos(ctx, events);
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
            return handleCheckOnRecvPacketOnOraiBridge(ctx, event);
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
            return handleOnRecvPacketOnOraiBridge(ctx, event);
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
            return handleCheckOnRequestBatch(ctx, event);
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
            return handleStoreOnRequestBatchOraiBridge(ctx, event);
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
            return handleCheckOnBatchSendToEthClaim(ctx, event);
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
            return handleStoreOnBatchSendToEthClaim(ctx, event);
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
