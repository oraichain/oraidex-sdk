import { BigNumber, ethers } from "ethers";
import { Gravity__factory, Gravity, generateError } from "@oraichain/oraidex-common";
import { DuckDB } from "./db";
import { Tendermint37Client, WebsocketClient } from "@cosmjs/tendermint-rpc";
import { QueryTag, buildQuery } from "@cosmjs/tendermint-rpc/build/tendermint37/requests";
import { AnyStateMachine, State } from "xstate";
import { createEvmToEvmMachine } from "./machine";
import { OraiBridgeRouteData, unmarshalOraiBridgeRoute } from "@oraichain/oraidex-universal-swap";

export const sendToCosmosEvent = "SendToCosmosEvent(address,address,string,uint256,uint256)";
export const evmGravityEvents = [sendToCosmosEvent];
export enum NetworkEventType {
  EVM,
  ORAIBRIDGE,
  ORAICHAIN,
  COSMOS
}

export const keccak256HashString = (data: string): string => {
  return ethers.utils.keccak256(Buffer.from(data));
};

export class ContextHandler {
  public machines: { txHash: string; machine: { instance: AnyStateMachine; currentState: any } }[];
  constructor(public readonly db: DuckDB) {}
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
          // TODO: this work can be delegated to the state machine
          const { transactionHash: txHash, blockNumber: height } = eventData[5];
          const routeData: OraiBridgeRouteData = unmarshalOraiBridgeRoute(eventData[2]);
          const sendToCosmosData = {
            txHash,
            height,
            prevState: "",
            destination: eventData[2],
            fromAmount: eventData[3].toString(),
            oraiBridgeChannelId: routeData.oraiBridgeChannel,
            oraiReceiver: routeData.oraiReceiver,
            destinationDenom: routeData.tokenIdentifier,
            destinationChannel: routeData.finalDestinationChannel,
            destinationReceiver: routeData.finalReceiver,
            eventNonce: parseInt(eventData[4].toString())
          };
          console.log("send to cosmos data: ", sendToCosmosData);
          // create new machine so we start a new context for the transaction
          // const machine = createEvmToEvmMachine(this.db);
          // const currentState = machine.transition(machine.initialState, { type: "STORE", payload: eventData });
          // this.machines.push({
          //   txHash: eventData.txHash,
          //   machine: { instance: machine, currentState }
          // });
        } else {
          console.log("unrelated event data: ", eventData);
        }
        break;
      case NetworkEventType.ORAIBRIDGE:
        break;
      case NetworkEventType.ORAICHAIN:
        break;
      default:
        break;
    }
  }
}

export class EthEvent {
  constructor(public readonly handler: ContextHandler) {}

  listenToEthEvent = (provider: ethers.providers.JsonRpcProvider, gravityContract: string) => {
    const gravity: Gravity = Gravity__factory.connect(ethers.utils.getAddress(gravityContract), provider);
    // listen on topic so that we collect tx hash & height as well
    return gravity.on({ topics: evmGravityEvents.map((ev) => keccak256HashString(ev)) }, (...args) => {
      this.handler.handleEvent(NetworkEventType.EVM, args);
    });
    // gravity.on(
    //   gravity.filters.SendToCosmosEvent(),
    //   (fromTokenAddr, sender, destination, fromAmount, eventNonce) => {
    //     console.log(fromTokenAddr, sender, destination, fromAmount, eventNonce);
    //     // this.db.insertData({})
    //     // create new evm machine,
    //   }
    // );
  };
}

export class CosmosEvent {
  constructor(public readonly db: DuckDB, private readonly handler: ContextHandler, public readonly baseUrl: string) {}

  connectCosmosSocket = async (tags: QueryTag[]) => {
    const client = await Tendermint37Client.create(new WebsocketClient(this.baseUrl));
    const stream = client.subscribeTx(
      buildQuery({
        tags
      })
    );
    stream.subscribe({
      next: async (event) => {
        const txHash = Buffer.from(event.hash).toString("hex").toUpperCase();
        // console.log("new tx hash: ", txHash);
        // txMachine.send({ type: "STORE", txHash });
        // const parsedEvents = parseRpcEvents(event.result.events);
        // console.log("tx list: ", txList);
        // console.dir(parsedEvents, { depth: null });
      }
    });
  };
}

export class OraiBridgeEvent extends CosmosEvent {}

export class OraichainEvent extends CosmosEvent {}
