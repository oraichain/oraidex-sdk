import { ethers } from "ethers";
import { Gravity__factory, Gravity, generateError } from "@oraichain/oraidex-common";
import { DuckDB } from "./db";
import { Tendermint37Client, WebsocketClient } from "@cosmjs/tendermint-rpc";
import { QueryTag, buildQuery } from "@cosmjs/tendermint-rpc/build/tendermint37/requests";
import { AnyInterpreter } from "xstate";
import { createEvmToEvmIntepreter } from "./machine";
import { TxEvent } from "@cosmjs/tendermint-rpc/build/tendermint37";
import { NetworkEventType, evmGravityEvents, invokableMachineStateKeys, sendToCosmosEvent } from "./constants";

export const keccak256HashString = (data: string): string => {
  return ethers.utils.keccak256(Buffer.from(data));
};

export class EventHandler {
  public intepreters: AnyInterpreter[] = [];
  constructor(public readonly db: DuckDB) {}

  public transitionIntepreters(type: string, payload: any) {
    for (let i = 0; i < this.intepreters.length; i++) {
      const currentState = this.intepreters[i].send({ type, payload });
      // this means that the entire state machine has reached the final state => done, we can remove the intepreter from the list (it is also stopped automatically as well)
      if (currentState.done) this.intepreters.splice(i, 1);
    }
  }

  handleEvent(networkEventType: NetworkEventType, eventData: any[]) {
    switch (networkEventType) {
      case NetworkEventType.EVM:
        const eventObject = eventData.find((data) => typeof data === "object" && data.topics);
        if (!eventObject)
          throw generateError(
            `There is something wrong with the evm event because it has no topics: ${JSON.stringify(eventData)}`
          );
        const topics: string[] = eventObject.topics;
        if (!topics)
          throw generateError(`There is no topics => something wrong with this event: ${JSON.stringify(eventData)}`);

        if (topics.includes(keccak256HashString(sendToCosmosEvent))) {
          // create new machine so we start a new context for the transaction
          const intepreter = createEvmToEvmIntepreter(this.db);
          this.intepreters.push(intepreter);
          intepreter.start();
          // we wont need to loop through the intepreter list because we know this event starts a new machine already
          intepreter.send({ type: invokableMachineStateKeys.STORE_SEND_TO_COSMOS, payload: eventData });
        } else {
          console.log("unrelated event data: ", eventData);
        }
        break;
      case NetworkEventType.ORAIBRIDGE:
        if (eventData.length === 0)
          throw generateError(`malformed OraiBridge event data: ${JSON.stringify(eventData)}`);
        // for intermediate states like OraiBridge, we will send the event to all intepreters. If the event matches then they will move on to the next state based on their logic
        this.transitionIntepreters(invokableMachineStateKeys.STORE_AUTO_FORWARD, eventData[0]);
        break;
      case NetworkEventType.ORAICHAIN:
        // TODO: we also have the transfer_back_to_remote_chain case where we need to create a new intepreter
        this.transitionIntepreters(invokableMachineStateKeys.STORE_ON_RECV_PACKET, eventData[0]);
        break;
      default:
        break;
    }
  }

  // TODO: in-case our server is down, we will be able to reconstruct the intepreters and their current contexts from our db
  async recoverIntepreters() {}
}

export class EthEvent {
  constructor(public readonly handler: EventHandler) {}

  listenToEthEvent = (provider: ethers.providers.JsonRpcProvider, gravityContract: string) => {
    const gravity: Gravity = Gravity__factory.connect(ethers.utils.getAddress(gravityContract), provider);
    // listen on topic so that we collect tx hash & height as well
    return gravity.on({ topics: evmGravityEvents.map((ev) => keccak256HashString(ev)) }, (...args) => {
      this.handler.handleEvent(NetworkEventType.EVM, args);
    });
  };
}

export abstract class CosmosEvent {
  constructor(public readonly db: DuckDB, protected readonly handler: EventHandler, public readonly baseUrl: string) {}

  // this function handles the websocket event after receiving. Each cosmos network has a different set of events needed to handle => this should be abstract
  abstract callback(eventData: TxEvent): void;

  connectCosmosSocket = async (tags: QueryTag[]) => {
    const client = await Tendermint37Client.create(new WebsocketClient(this.baseUrl));
    const stream = client.subscribeTx(
      buildQuery({
        tags
      })
    );
    try {
      stream.subscribe({
        next: (txEvent) => {
          this.callback(txEvent);
        },
        error: (err) => console.log("error while subscribing websocket: ", err),
        complete: () => console.log("completed")
      });
    } catch (error) {
      console.log("error listening: ", error);
    }
    return stream;
  };
}

export class OraiBridgeEvent extends CosmosEvent {
  callback(eventData: TxEvent): void {
    this.handler.handleEvent(NetworkEventType.ORAIBRIDGE, [eventData]);
  }
}

export class OraichainEvent extends CosmosEvent {
  callback(eventData: TxEvent): void {
    // TODO: consider parsing the OnRecvPacket here because it is a large tx
    this.handler.handleEvent(NetworkEventType.ORAICHAIN, [eventData]);
  }
}
