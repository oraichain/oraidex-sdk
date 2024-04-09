import { createMachine, interpret } from "xstate";
import { invokableMachineStateKeys } from "../constants";
import { DuckDB } from "../db";
import {
  handleCheckOnBatchSendToEthClaim,
  handleCheckOnRecvPacketOnOraiBridge,
  handleCheckOnRequestBatch,
  handleOnRecvPacketOnOraiBridge,
  handleStoreOnBatchSendToEthClaim,
  handleStoreOnRequestBatchOraiBridge,
  handleStoreOnTransferBackToRemoteChain
} from "./common.intepreter";

export const createOraichainIntepreter = (db: DuckDB) => {
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
          [invokableMachineStateKeys.STORE_ON_TRANSFER_BACK_TO_REMOTE_CHAIN]: "storeOnTransferBackToRemoteChain"
        }
      },
      storeOnTransferBackToRemoteChain: {
        invoke: {
          src: async (ctx, event) => {
            return handleStoreOnTransferBackToRemoteChain(ctx, event);
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
