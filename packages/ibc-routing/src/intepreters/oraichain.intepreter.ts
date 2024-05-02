import { createMachine, interpret } from "xstate";
import { IntepreterType, TimeOut, invokableMachineStateKeys } from "../constants";
import { DuckDB } from "../db";
import { IntepreterInterface } from "../managers/intepreter.manager";
import {
  handleCheckOnBatchSendToEthClaim,
  handleCheckOnRecvPacketOnOraiBridge,
  handleCheckOnRequestBatch,
  handleOnRecvPacketOnOraiBridge,
  handleQueryOnBatchSendToEthClaim,
  handleQueryOnRecvOraiBridgePacket,
  handleQueryOnRequestBatch,
  handleQueryOnTransferBackToRemoteChain,
  handleStoreOnBatchSendToEthClaim,
  handleStoreOnRequestBatchOraiBridge,
  handleStoreOnTransferBackToRemoteChain
} from "./handlers/common.handler";
import {
  handleOnBatchSendToETHClaimTimeout,
  handleOnRequestBatchTimeout,
  handleOraiBridgeForEvmTimeout
} from "./handlers/timeout.handler";

export const createOraichainIntepreter = (db: DuckDB) => {
  const machine = createMachine({
    predictableActionArguments: true,
    preserveActionOrder: true,
    initial: "oraichain",
    context: {
      db,
      oraiSendPacketSequence: -1, // sequence when OnRecvPacket
      oraiBridgePendingTxId: -1,
      oraiBridgeBatchNonce: -1,
      evmChainPrefixOnRightTraverseOrder: "",
      oraiBridgeSrcChannel: "",
      oraiBridgeDstChannel: "",
      oraichainSrcChannel: "",
      oraichainDstChannel: "",
      routingQueryData: []
    },
    states: {
      oraichain: {
        on: {
          [invokableMachineStateKeys.STORE_ON_TRANSFER_BACK_TO_REMOTE_CHAIN]: "storeOnTransferBackToRemoteChain",
          [invokableMachineStateKeys.QUERY_IBC_ROUTING_DATA]: "queryOnTransferBackToRemoteChain"
        }
      },
      queryOnTransferBackToRemoteChain: {
        invoke: {
          src: handleQueryOnTransferBackToRemoteChain,
          onError: "finalState",
          onDone: "queryOnRecvPacketOnOraiBridge"
        }
      },
      storeOnTransferBackToRemoteChain: {
        invoke: {
          src: handleStoreOnTransferBackToRemoteChain,
          onError: {
            actions: (ctx, event) => console.log("error on insert data on storeOnRecvPacketOraichain: ", event.data),
            target: "storeOnRecvPacketOraichainFailure"
          },
          onDone: "oraiBridgeForEvm"
        }
      },
      storeOnRecvPacketOraichainFailure: {},
      oraiBridgeForEvm: {
        on: {
          [invokableMachineStateKeys.STORE_ON_RECV_PACKET_ORAIBRIDGE]: "checkOnRecvPacketOnOraiBridge"
        },
        after: {
          [TimeOut]: {
            target: "oraiBridgeForEvmTimeout",
            actions: (ctx, event) => console.log("Move to timeout from oraiBridgeForEvm")
          }
        }
      },
      oraiBridgeForEvmTimeout: {
        invoke: {
          src: handleOraiBridgeForEvmTimeout,
          onError: {
            actions: (ctx, event) => {
              console.log("error handling orai bridge for evm timeout", event.data);
            },
            target: "oraiBridgeForEvm"
          },
          onDone: "onRequestBatch"
        }
      },
      queryOnRecvPacketOnOraiBridge: {
        invoke: {
          src: handleQueryOnRecvOraiBridgePacket,
          onError: "finalState",
          onDone: "queryOnRequestBatch"
        }
      },
      checkOnRecvPacketOnOraiBridge: {
        invoke: {
          src: handleCheckOnRecvPacketOnOraiBridge,
          onDone: [
            {
              target: "onRecvPacketOnOraiBridge",
              cond: (ctx, event) =>
                event.data.packetSequence === ctx.oraiSendPacketSequence &&
                event.data.recvSrcChannel === ctx.oraichainSrcChannel &&
                event.data.recvDstChannel === ctx.oraichainDstChannel
            },
            {
              target: "oraiBridgeForEvm",
              cond: (ctx, event) => {
                return (
                  event.data.packetSequence !== ctx.oraiSendPacketSequence ||
                  event.data.recvSrcChannel !== ctx.oraichainSrcChannel ||
                  event.data.recvDstChannel !== ctx.oraichainDstChannel
                );
              }
            }
          ]
        }
      },
      onRecvPacketOnOraiBridge: {
        invoke: {
          src: handleOnRecvPacketOnOraiBridge,
          onError: {
            actions: (ctx, event) => console.log("error check on recv packet OraiBridgeState: ", event.data),
            target: "onRecvPacketOnOraiBridgeFailure"
          },
          onDone: "onRequestBatch"
        }
      },
      onRecvPacketOnOraiBridgeFailure: {},
      onRequestBatch: {
        on: {
          [invokableMachineStateKeys.STORE_ON_REQUEST_BATCH]: "checkOnRequestBatch"
        },
        after: {
          [TimeOut]: {
            target: "onRequestBatchTimeout",
            actions: (ctx, event) => console.log("Move to timeout from onRequestBatch")
          }
        }
      },
      onRequestBatchTimeout: {
        invoke: {
          src: handleOnRequestBatchTimeout,
          onError: {
            actions: (ctx, event) => {
              console.log("error handling request batch timeout", event.data);
            },
            target: "onRequestBatch"
          },
          onDone: "storeOnRequestBatch"
        }
      },
      queryOnRequestBatch: {
        invoke: {
          src: handleQueryOnRequestBatch,
          onDone: "queryOnBatchSendToEthClaim",
          onError: "finalState"
        }
      },
      checkOnRequestBatch: {
        invoke: {
          src: handleCheckOnRequestBatch,
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
          src: handleStoreOnRequestBatchOraiBridge,
          onError: {
            actions: (ctx, event) => console.log("error on store on request batch: ", event.data),
            target: "storeOnRequestBatchFailure"
          },
          onDone: "onBatchSendToETHClaim"
        }
      },
      storeOnRequestBatchFailure: {},
      onBatchSendToETHClaim: {
        on: {
          [invokableMachineStateKeys.STORE_ON_BATCH_SEND_TO_ETH_CLAIM]: "checkOnBatchSendToETHClaim"
        },
        after: {
          [TimeOut]: {
            target: "onBatchSendToETHClaimTimeout",
            actions: (ctx, event) => console.log("Move to timeout from onBatchSendToETHClaim")
          }
        }
      },
      onBatchSendToETHClaimTimeout: {
        invoke: {
          src: handleOnBatchSendToETHClaimTimeout,
          onError: {
            actions: (ctx, event) => {
              console.log("error handling batch send to eth timeout", event.data);
            },
            target: "onBatchSendToETHClaim"
          },
          onDone: "storeOnBatchSendToETHClaim"
        }
      },
      queryOnBatchSendToEthClaim: {
        invoke: {
          src: handleQueryOnBatchSendToEthClaim,
          onDone: "finalState",
          onError: "finalState"
        }
      },
      checkOnBatchSendToETHClaim: {
        invoke: {
          src: handleCheckOnBatchSendToEthClaim,
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
          src: handleStoreOnBatchSendToEthClaim,
          onError: {
            actions: (ctx, event) => console.log("error on store on batch send to eth claim: ", event.data),
            target: "storeOnBatchSendToETHClaimFailure"
          },
          onDone: "finalState"
        }
      },
      storeOnBatchSendToETHClaimFailure: {},
      finalState: {
        type: "final"
      }
    }
  });
  const intepreter = interpret(machine).onTransition((state) => console.log("State:", state.value));
  return {
    _inner: intepreter,
    type: IntepreterType.ORAICHAIN
  } as IntepreterInterface;
};
