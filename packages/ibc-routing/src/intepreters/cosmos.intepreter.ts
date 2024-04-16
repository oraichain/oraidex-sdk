import { StargateClient } from "@cosmjs/stargate";
import { buildQuery } from "@cosmjs/tendermint-rpc/build/tendermint34/requests";
import { QueryTag } from "@cosmjs/tendermint-rpc/build/tendermint37";
import { EvmChainPrefix, generateError } from "@oraichain/oraidex-common";
import { createMachine, interpret } from "xstate";
import { config } from "../config";
import { TimeOut, invokableMachineStateKeys } from "../constants";
import { DuckDB } from "../db";
import { convertIndexedTxToTxEvent } from "../helpers";
import {
  handleCheckOnBatchSendToEthClaim,
  handleCheckOnRecvPacketOnOraiBridge,
  handleCheckOnRecvPacketOraichain,
  handleCheckOnRequestBatch,
  handleOnRecvPacketOnOraiBridge,
  handleQueryIbcTransferFromRemote,
  handleQueryOnBatchSendToEthClaim,
  handleQueryOnRecvOraiBridgePacket,
  handleQueryOnRecvPacketOraichain,
  handleQueryOnRequestBatch,
  handleStoreOnBatchSendToEthClaim,
  handleStoreOnIbcTransferFromRemote,
  handleStoreOnRecvPacketOraichainReverse,
  handleStoreOnRequestBatchOraiBridge
} from "./handlers/common.handler";

export const createCosmosIntepreter = (db: DuckDB) => {
  const machine = createMachine({
    predictableActionArguments: true,
    preserveActionOrder: true,
    initial: "cosmos",
    context: {
      db,
      oraiBridgeEventNonce: -1,
      oraiBridgePacketSequence: -1,
      oraiSendPacketSequence: -1, // sequence when OnRecvPacket
      oraiBridgePendingTxId: -1,
      oraiBridgeBatchNonce: -1,
      evmChainPrefixOnRightTraverseOrder: "",
      oraichainSrcChannel: "",
      oraichainDstChannel: "",
      cosmosPacketSequence: -1,
      cosmosSrcChannel: "",
      cosmosDstChannel: "",
      routingQueryData: {}
    },
    states: {
      cosmos: {
        on: {
          [invokableMachineStateKeys.STORE_ON_IBC_TRANSFER_FROM_REMOTE]: "storeOnIbcTransferFromRemote",
          [invokableMachineStateKeys.QUERY_IBC_ROUTING_DATA]: "queryIbcTransferFromRemote"
        }
      },
      queryIbcTransferFromRemote: {
        invoke: {
          src: handleQueryIbcTransferFromRemote,
          onError: "finalState",
          onDone: "queryOnRecvPacketOraichain"
        }
      },
      storeOnIbcTransferFromRemote: {
        invoke: {
          src: handleStoreOnIbcTransferFromRemote,
          onError: {
            actions: (ctx, event) => console.log("error on insert data on storeOnIbcTransferFromRemote: ", event.data),
            target: "storeOnIbcTransferFromRemoteFailure"
          },
          onDone: "oraichain"
        }
      },
      storeOnIbcTransferFromRemoteFailure: {},
      oraichain: {
        on: {
          [invokableMachineStateKeys.STORE_ON_RECV_PACKET_ORAICHAIN]: "checkOnRecvPacketOraichain"
        },
        after: {
          [TimeOut]: {
            target: "oraichainTimeout",
            actions: (ctx, event) => console.log("Move to timeout from oraiBridgeForEvm")
          }
        }
      },
      oraichainTimeout: {
        invoke: {
          src: async (ctx, event) => {
            const queryTags: QueryTag[] = [
              {
                key: "recv_packet.packet_sequence",
                value: ctx.cosmosPacketSequence.toString()
              },
              {
                key: "recv_packet.packet_dst_channel",
                value: ctx.cosmosDstChannel
              },
              {
                key: "recv_packet.packet_src_channel",
                value: ctx.cosmosSrcChannel
              }
            ];
            const query = buildQuery({
              tags: queryTags
            });
            const stargateClient = await StargateClient.connect(config.ORAICHAIN_RPC_URL);
            const txs = await stargateClient.searchTx(query);
            if (txs.length == 0) {
              throw generateError("tx does not exist on oraichain");
            }
            return handleStoreOnRecvPacketOraichainReverse(ctx, {
              ...event,
              data: {
                txEvent: convertIndexedTxToTxEvent(txs[0])
              }
            });
          },
          onError: {
            target: "oraichain",
            // rejected promise data is on event.data property
            actions: (ctx, event) => console.log("error on handling oraichain timeout", event.data)
          },
          onDone: "oraiBridgeForEvm"
        }
      },
      queryOnRecvPacketOraichain: {
        invoke: {
          src: async (ctx, event) => {
            return handleQueryOnRecvPacketOraichain(ctx, event);
          },
          onError: "finalState",
          onDone: "queryOnRecvOraiBridgePacket"
        }
      },
      checkOnRecvPacketOraichain: {
        invoke: {
          src: handleCheckOnRecvPacketOraichain,
          onError: {
            actions: (ctx, event) => console.log("error on checkOnRecvPacketOraichain: ", event.data),
            target: "checkOnRecvPacketOraichainFailure"
          },
          onDone: [
            {
              target: "storeOnRecvPacketOraichain",
              cond: (ctx, event) => {
                return (
                  event.data.packetSequence === ctx.cosmosPacketSequence &&
                  ctx.cosmosSrcChannel === event.data.recvSrcChannel &&
                  ctx.cosmosDstChannel === event.data.recvDstChannel
                );
              }
            },
            {
              target: "oraichain",
              cond: (ctx, event) => {
                console.log(event.data.packetSequence, ctx.cosmosPacketSequence);
                console.log(ctx.cosmosSrcChannel, event.data.recvSrcChannel);
                console.log(ctx.cosmosDstChannel, event.data.recvDstChannel);
                return (
                  event.data.packetSequence !== ctx.cosmosPacketSequence ||
                  ctx.cosmosSrcChannel !== event.data.recvSrcChannel ||
                  ctx.cosmosDstChannel !== event.data.recvDstChannel
                );
              }
            }
          ]
        }
      },
      checkOnRecvPacketOraichainFailure: {},
      queryOnRecvOraiBridgePacket: {
        invoke: {
          src: handleQueryOnRecvOraiBridgePacket,
          onDone: "queryOnRequestBatch",
          onError: "finalState"
        }
      },
      storeOnRecvPacketOraichain: {
        invoke: {
          src: handleStoreOnRecvPacketOraichainReverse,
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
          src: async (ctx, event) => {
            const queryTags: QueryTag[] = [
              {
                key: `recv_packet.packet_sequence`,
                value: `${ctx.oraiSendPacketSequence}`
              },
              {
                key: `recv_packet.packet_src_channel`,
                value: ctx.oraichainSrcChannel
              },
              {
                key: `recv_packet.packet_dst_channel`,
                value: ctx.oraichainDstChannel
              }
            ];
            const query = buildQuery({
              tags: queryTags
            });
            const stargateClient = await StargateClient.connect(config.ORAIBRIDGE_RPC_URL);
            const txs = await stargateClient.searchTx(query);
            if (txs.length == 0) {
              throw generateError("Can not find orai bridge data on oraiBridgeForEvmTimeout");
            }

            return handleOnRecvPacketOnOraiBridge(ctx, {
              ...event,
              data: {
                txEvent: convertIndexedTxToTxEvent(txs[0])
              }
            });
          },
          onError: {
            actions: (ctx, event) => {
              console.log("error handling orai bridge for evm timeout", event.data);
            },
            target: "oraiBridgeForEvm"
          },
          onDone: "onRequestBatch"
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
      queryOnRequestBatch: {
        invoke: {
          src: handleQueryOnRequestBatch,
          onDone: "queryOnBatchSendToEthClaim",
          onError: "finalState"
        }
      },
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
          src: async (ctx, event) => {
            const queryTags: QueryTag[] = [
              {
                key: `batched_tx_ids.batched_tx_id`,
                value: `${ctx.oraiBridgePendingTxId}`
              }
            ];
            const query = buildQuery({
              tags: queryTags
            });
            const stargateClient = await StargateClient.connect(config.ORAIBRIDGE_RPC_URL);
            const txs = await stargateClient.searchTx(query);
            if (txs.length == 0) {
              throw generateError("Can not find orai bridge data on onRequestBatchTimeout");
            }
            for (const tx of txs) {
              const evmChainPrefix = Object.values(EvmChainPrefix).find((prefix) => tx.rawLog.includes(prefix));
              if (evmChainPrefix === ctx.evmChainPrefixOnRightTraverseOrder) {
                return handleCheckOnRequestBatch(ctx, {
                  ...event,
                  payload: convertIndexedTxToTxEvent(tx)
                });
              }
            }
            throw generateError("there is no matching tx data on onRequestBatchTimeout");
          },
          onError: {
            actions: (ctx, event) => {
              console.log("error handling request batch timeout", event.data);
            },
            target: "onRequestBatch"
          },
          onDone: "storeOnRequestBatch"
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
      queryOnBatchSendToEthClaim: {
        invoke: {
          src: handleQueryOnBatchSendToEthClaim,
          onDone: "finalState",
          onError: "finalState"
        }
      },
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
          src: async (ctx, event) => {
            const queryTags: QueryTag[] = [
              {
                key: `gravity.v1.MsgBatchSendToEthClaim.batch_nonce`,
                value: `${ctx.oraiBridgeBatchNonce}`
              },
              {
                key: `gravity.v1.MsgBatchSendToEthClaim.evm_chain_prefix`,
                value: ctx.evmChainPrefixOnRightTraverseOrder
              }
            ];
            const query = buildQuery({
              tags: queryTags
            });
            const stargateClient = await StargateClient.connect(config.ORAIBRIDGE_RPC_URL);
            const txs = await stargateClient.searchTx(query);
            if (txs.length == 0) {
              throw generateError("Can not find orai bridge data on onBatchSendToETHClaimTimeout");
            }
            return handleCheckOnBatchSendToEthClaim(ctx, {
              ...event,
              payload: convertIndexedTxToTxEvent(txs[0])
            });
          },
          onError: {
            actions: (ctx, event) => {
              console.log("error handling batch send to eth timeout", event.data);
            },
            target: "onBatchSendToETHClaim"
          },
          onDone: "storeOnBatchSendToETHClaim"
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
  const intepreter = interpret(machine).onTransition((state) => {
    console.log("State:", state.value);
  });

  return intepreter;
};
