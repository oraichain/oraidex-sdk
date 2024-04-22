import { StargateClient } from "@cosmjs/stargate";
import { QueryTag } from "@cosmjs/tendermint-rpc/build/tendermint37";
import { buildQuery } from "@cosmjs/tendermint-rpc/build/tendermint37/requests";
import { EvmChainPrefix, generateError, parseRpcEvents } from "@oraichain/oraidex-common";
import { createMachine, interpret } from "xstate";
import { config } from "../config";
import {
  FinalTag,
  ForwardTagOnOraichain,
  IntepreterType,
  TimeOut,
  executedIbcAutoForwardType,
  invokableMachineStateKeys
} from "../constants";
import { DuckDB } from "../db";
import { convertIndexedTxToTxEvent } from "../helpers";
import { IntepreterInterface } from "../managers/intepreter.manager";
import {
  handleCheckAutoForward,
  handleCheckOnAcknowledgementOnCosmos,
  handleCheckOnBatchSendToEthClaim,
  handleCheckOnRecvPacketOnOraiBridge,
  handleCheckOnRecvPacketOraichain,
  handleCheckOnRequestBatch,
  handleOnRecvPacketOnOraiBridge,
  handleQueryAutoForward,
  handleQueryOnBatchSendToEthClaim,
  handleQueryOnRecvCosmosPacket,
  handleQueryOnRecvOraiBridgePacket,
  handleQueryOnRecvPacketOraichain,
  handleQueryOnRequestBatch,
  handleQuerySendToCosmosEvm,
  handleSendToCosmosEvm,
  handleStoreAutoForward,
  handleStoreOnBatchSendToEthClaim,
  handleStoreOnRecvPacketOraichain,
  handleStoreOnRequestBatchOraiBridge,
  handleUpdateOnAcknowledgementOnCosmos,
  onDoneOnRecvPacketOraichain
} from "./handlers/common.handler";

// TODO: add more cases for each state to make the machine more resistent. Eg: switch to polling state when idle at a state for too long
// TODO: add precheck correct type of evm handle case
export const createEvmIntepreter = (db: DuckDB) => {
  const machine = createMachine(
    {
      predictableActionArguments: true,
      preserveActionOrder: true,
      initial: "evm",
      // we only maintain important context attributes for events to identify which machine they belong to
      context: {
        db,
        evmEventNonce: -1,
        oraiBridgePacketSequence: -1,
        oraiSendPacketSequence: -1, // sequence when SendPacket,
        oraiBridgePendingTxId: -1,
        oraiBridgeBatchNonce: -1,
        evmChainPrefixOnLeftTraverseOrder: "",
        evmChainPrefixOnRightTraverseOrder: "",
        oraiBridgeSrcChannel: "",
        oraiBridgeDstChannel: "",
        oraichainSrcChannel: "",
        oraichainDstChannel: "",
        routingQueryData: []
      },
      states: {
        evm: {
          on: {
            // listen to event sent elsewhere. Once received 'STORE' type event, then it will move to 'storeDb' state
            [invokableMachineStateKeys.STORE_SEND_TO_COSMOS]: "sendToCosmosEvm",
            [invokableMachineStateKeys.QUERY_IBC_ROUTING_DATA]: "querySendToCosmosEvm"
          }
        },
        querySendToCosmosEvm: {
          invoke: {
            src: handleQuerySendToCosmosEvm,
            onDone: "queryAutoForward",
            onError: {
              target: "finalState",
              actions: (ctx, event) => {
                console.log("stopping on query send to cosmos evm: ", event.data);
              }
            }
          }
        },
        sendToCosmosEvm: {
          invoke: {
            // function that returns a promise
            src: handleSendToCosmosEvm,
            onDone: "oraibridge", // the resolved data from 'invoke' above will be passed to the 'oraibridge.autoForward' invoke method
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
                console.log(
                  "Move to timeout from oraiBridge: ",
                  ctx.evmEventNonce,
                  ctx.evmChainPrefixOnLeftTraverseOrder
                )
            }
          }
        },
        oraiBridgeTimeOut: {
          invoke: {
            src: async (ctx, event) => {
              const queryTags: QueryTag[] = [
                {
                  key: `${executedIbcAutoForwardType}.nonce`,
                  value: `${ctx.evmEventNonce}`
                }
              ];
              console.log(ctx.evmEventNonce);
              const query = buildQuery({
                tags: queryTags
              });
              const stargateClient = await StargateClient.connect(config.ORAIBRIDGE_RPC_URL);
              const txs = await stargateClient.searchTx(query);
              if (txs.length == 0) {
                throw generateError("there is no auto forward existed on orai bridge timeout");
              }
              for (const tx of txs) {
                try {
                  await handleStoreAutoForward(ctx, {
                    ...event,
                    data: {
                      txEvent: convertIndexedTxToTxEvent(tx),
                      eventNonce: ctx.evmEventNonce
                    }
                  });
                } catch (err) {
                  throw generateError(err?.message);
                }
              }
            },
            onError: {
              target: "oraibridge",
              // rejected promise data is on event.data property
              actions: (ctx, event) => console.log("error on handling oraibridge timeout", event.data)
            },
            onDone: "oraichain"
          }
        },
        queryAutoForward: {
          invoke: {
            src: handleQueryAutoForward,
            onDone: "queryOnRecvPacketOraichain",
            onError: {
              target: "finalState",
              actions: (ctx, event) => console.log("stopping on handle query auto forward: ", event.data)
            }
          }
        },
        checkAutoForward: {
          invoke: {
            src: handleCheckAutoForward,
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
            src: handleStoreAutoForward,
            onDone: "oraichain", // the resolved data from 'invoke' above will be passed to the 'oraibridge.autoForward' invoke method
            // rejected promise
            onError: {
              target: "storeAutoForwardFailure",
              // rejected promise data is on event.data property
              actions: (ctx, event) => console.log("error storing data into oraibridge state: ", event.data)
            }
          }
        },
        checkAutoForwardFailure: {
          invoke: {
            src: (ctx, event) => {
              console.log("error check auto forward failure: ", event.data);
              return Promise.resolve();
            },
            onDone: "oraibridge"
          }
        },
        storeAutoForwardFailure: {
          invoke: {
            src: (ctx, event) => {
              console.log("error check auto forward failure: ", event.data);
              return Promise.resolve();
            },
            onDone: "oraibridge"
          }
        },
        oraichain: {
          on: {
            [invokableMachineStateKeys.STORE_ON_RECV_PACKET_ORAICHAIN]: "checkOnRecvPacketOraichain"
          },
          after: {
            [TimeOut]: {
              target: "oraichainTimeOut",
              actions: (ctx, event) => console.log("Move to timeout from oraichain")
            }
          }
        },
        queryOnRecvPacketOraichain: {
          invoke: {
            src: handleQueryOnRecvPacketOraichain,
            onDone: [
              {
                target: "queryOnRecvCosmosPacket",
                cond: (_ctx, event) => event.data === ForwardTagOnOraichain.COSMOS
              },
              {
                target: "queryOnRecvOraiBridgePacket",
                cond: (_ctx, event) => event.data === ForwardTagOnOraichain.EVM
              },
              {
                target: "finalState",
                cond: (_ctx, event) => event.data === FinalTag
              }
            ],
            onError: {
              target: "finalState",
              actions: (ctx, event) => console.log("error queryOnRecvPacketOraichain: ", event.data)
            }
          }
        },
        oraichainTimeOut: {
          invoke: {
            src: async (ctx, event) => {
              const queryTags: QueryTag[] = [
                {
                  key: "recv_packet.packet_sequence",
                  value: ctx.oraiBridgePacketSequence.toString()
                },
                {
                  key: "recv_packet.packet_dst_channel",
                  value: ctx.oraiBridgeDstChannel
                },
                {
                  key: "recv_packet.packet_src_channel",
                  value: ctx.oraiBridgeSrcChannel
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
              return handleStoreOnRecvPacketOraichain(ctx, {
                ...event,
                data: {
                  txEvent: convertIndexedTxToTxEvent(txs[0]),
                  packetSequence: ctx.oraiBridgePacketSequence
                }
              });
            },
            onError: {
              target: "oraichain",
              // rejected promise data is on event.data property
              actions: (ctx, event) => console.log("error on handling oraichain timeout", event.data)
            },
            onDone: onDoneOnRecvPacketOraichain
          }
        },
        checkOnRecvPacketOraichain: {
          invoke: {
            src: handleCheckOnRecvPacketOraichain,
            onError: {
              actions: (ctx, event) => console.log("error check on recv packet OraichainState: ", event.data),
              target: "checkOnRecvPacketFailure"
            },
            onDone: [
              {
                target: "storeOnRecvPacketOraichain",
                cond: (ctx, event) =>
                  event.data.packetSequence === ctx.oraiBridgePacketSequence &&
                  ctx.oraiBridgeSrcChannel === event.data.recvSrcChannel &&
                  ctx.oraiBridgeDstChannel === event.data.recvDstChannel
              },
              {
                target: "oraichain",
                cond: (ctx, event) =>
                  event.data.packetSequence !== ctx.oraiBridgePacketSequence ||
                  ctx.oraiBridgeSrcChannel !== event.data.recvSrcChannel ||
                  ctx.oraiBridgeDstChannel !== event.data.recvDstChannel
              }
            ]
          }
        },
        storeOnRecvPacketOraichain: {
          invoke: {
            src: handleStoreOnRecvPacketOraichain,
            onDone: onDoneOnRecvPacketOraichain
          }
        },
        checkOnRecvPacketFailure: {},
        cosmos: {
          on: {
            [invokableMachineStateKeys.STORE_ON_ACKNOWLEDGEMENT_ORAICHAIN]: "checkOnAcknowledgementOnCosmos"
          },
          after: {
            [TimeOut]: {
              target: "cosmosTimeout",
              actions: (ctx, event) => console.log("Move to timeout from cosmosTimeout")
            }
          }
        },
        cosmosTimeout: {
          invoke: {
            src: async (ctx, event) => {
              const queryTags: QueryTag[] = [
                {
                  key: `acknowledge_packet.packet_sequence`,
                  value: `${ctx.oraiSendPacketSequence}`
                },
                {
                  key: `acknowledge_packet.packet_dst_channel`,
                  value: ctx.oraichainDstChannel
                },
                {
                  key: `acknowledge_packet.packet_src_channel`,
                  value: ctx.oraichainSrcChannel
                }
              ];
              const query = buildQuery({
                tags: queryTags
              });
              const stargateClient = await StargateClient.connect(config.ORAICHAIN_RPC_URL);
              const txs = await stargateClient.searchTx(query);
              if (txs.length == 0) {
                throw generateError("[EVM INTEPRETER] Can not find orai bridge data on oraiBridgeForEvmTimeout");
              }
              return handleUpdateOnAcknowledgementOnCosmos(ctx, {
                ...event,
                data: {
                  events: parseRpcEvents(convertIndexedTxToTxEvent(txs[0]).result.events)
                }
              });
            },
            onError: {
              actions: (ctx, event) => {
                console.log("error handling on cosmos", event.data);
              },
              target: "cosmos"
            },
            onDone: "finalState"
          }
        },
        queryOnRecvCosmosPacket: {
          invoke: {
            src: handleQueryOnRecvCosmosPacket,
            onDone: "finalState",
            onError: "finalState"
          }
        },
        checkOnAcknowledgementOnCosmos: {
          invoke: {
            src: handleCheckOnAcknowledgementOnCosmos,
            onDone: [
              {
                target: "oraichain",
                cond: (ctx, event) =>
                  event.data.packetSequence !== ctx.oraiSendPacketSequence ||
                  ctx.oraichainSrcChannel !== event.data.ackSrcChannel ||
                  ctx.oraichainDstChannel !== event.data.ackDstChannel
              },
              {
                target: "updateOnAcknowledgementOnCosmos",
                cond: (ctx, event) =>
                  event.data.packetSequence === ctx.oraiSendPacketSequence &&
                  ctx.oraichainSrcChannel === event.data.ackSrcChannel &&
                  ctx.oraichainDstChannel === event.data.ackDstChannel
              }
            ]
          }
        },
        updateOnAcknowledgementOnCosmos: {
          invoke: {
            src: handleUpdateOnAcknowledgementOnCosmos,
            onError: {
              actions: (ctx, event) => console.log("error on update on acknowledgement on OraiBridgeDB: ", event.data),
              target: "updateOnAcknowledgementOnCosmosFailure"
            },
            onDone: "finalState"
          }
        },
        updateOnAcknowledgementOnCosmosFailure: {},
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
        queryOnRecvOraiBridgePacket: {
          invoke: {
            src: handleQueryOnRecvOraiBridgePacket,
            onDone: "queryOnRequestBatch",
            onError: "finalState"
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
                cond: (ctx, event) =>
                  event.data.packetSequence !== ctx.oraiSendPacketSequence ||
                  event.data.recvSrcChannel !== ctx.oraichainSrcChannel ||
                  event.data.recvDstChannel !== ctx.oraichainDstChannel
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
                cond: (ctx, event) => event.data.txIds.includes(ctx.oraiBridgePendingTxId)
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
                cond: (ctx, event) =>
                  event.data.batchNonce === ctx.oraiBridgeBatchNonce &&
                  ctx.evmChainPrefixOnRightTraverseOrder === event.data.evmChainPrefix
              },
              {
                target: "onBatchSendToETHClaim",
                cond: (ctx, event) =>
                  event.data.batchNonce !== ctx.oraiBridgeBatchNonce ||
                  ctx.evmChainPrefixOnRightTraverseOrder !== event.data.evmChainPrefix
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
    },
    {}
  );
  const intepreter = interpret(machine).onTransition((state) => {
    // console.log("Snapshot", intepreter.getSnapshot());
    console.log("State:", state.value);
  });
  return {
    _inner: intepreter,
    type: IntepreterType.EVM
  } as IntepreterInterface;
};