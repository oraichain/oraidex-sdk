import { TxEvent } from "@cosmjs/tendermint-rpc/build/tendermint37";
import { createMachine, interpret } from "xstate";
import { invokableMachineStateKeys } from "../constants";
import { DuckDB } from "../db";
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
      oraiReceivePacketSequence: -1, // sequence when OnRecvPacket
      oraiBridgePendingTxId: -1,
      oraiBridgeBatchNonce: -1,
      evmChainPrefixOnRightTraverseOrder: ""
    },
    states: {
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
            events.forEach((event) => {
              console.log("=====", event.type, "=====");
              event.attributes.forEach((attr) => {
                console.log(attr.key, "-", attr.value);
              });
            });
          }
        }
      }
    }
  });
  const intepreter = interpret(machine).onTransition((state) => console.log(state.value));
  return intepreter;
};
