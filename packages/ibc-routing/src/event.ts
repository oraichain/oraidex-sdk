import { Tendermint37Client, WebsocketClient } from "@cosmjs/tendermint-rpc";
import { TxEvent } from "@cosmjs/tendermint-rpc/build/tendermint37";
import { QueryTag, buildQuery } from "@cosmjs/tendermint-rpc/build/tendermint37/requests";
import { Gravity, Gravity__factory } from "@oraichain/oraidex-common";
import { ethers } from "ethers";
import { ChainIdToEvmChainPredix, evmGravityEvents } from "./constants";
import { EventHandler } from "./event-handlers/event.handler";
import { keccak256HashString } from "./helpers";

export class EthEvent {
  constructor(public readonly handler: EventHandler) {}

  listenToEthEvent = (provider: ethers.providers.JsonRpcProvider, gravityContract: string, chainId: number) => {
    const evmChainPrefix = ChainIdToEvmChainPredix[chainId];
    const gravity: Gravity = Gravity__factory.connect(ethers.utils.getAddress(gravityContract), provider);
    // listen on topic so that we collect tx hash & height as well
    return gravity.on({ topics: evmGravityEvents.map((ev) => keccak256HashString(ev)) }, (...args) => {
      this.handler.handleEvent([...args, evmChainPrefix]);
    });
  };
}

export abstract class CosmosEvent {
  constructor(protected readonly handler: EventHandler, public readonly baseUrl: string) {}

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
    this.handler.handleEvent([eventData]);
  }
}

export class OraichainEvent extends CosmosEvent {
  callback(eventData: TxEvent): void {
    // TODO: consider parsing the OnRecvPacket here because it is a large tx
    this.handler.handleEvent([eventData]);
  }
}
