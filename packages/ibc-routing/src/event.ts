import { Tendermint37Client, WebsocketClient } from "@cosmjs/tendermint-rpc";
import { TxEvent } from "@cosmjs/tendermint-rpc/build/tendermint37";
import { QueryTag, buildQuery } from "@cosmjs/tendermint-rpc/build/tendermint37/requests";
import { Gravity, Gravity__factory } from "@oraichain/oraidex-common";
import { ethers } from "ethers";
import { evmGravityEvents } from "./constants";
import { EventHandler } from "./event-handlers/event.handler";
import { convertTxHashToHex, keccak256HashString } from "./helpers";

export class EthEvent {
  constructor(public readonly handler: EventHandler) {}

  listenToEthEvent = (provider: ethers.providers.JsonRpcProvider, gravityContract: string, evmChainPrefix: string) => {
    const gravity: Gravity = Gravity__factory.connect(ethers.utils.getAddress(gravityContract), provider);
    // listen on topic so that we collect tx hash & height as well
    return gravity.on({ topics: evmGravityEvents.map((ev) => keccak256HashString(ev)) }, (...args) => {
      console.log("[EVM] Txhash: ", args[5].transactionHash);
      this.handler.handleEvent([...args, evmChainPrefix]);
    });
  };
}

export abstract class BaseCosmosEvent {
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
          console.log("[Cosmos] Txhash:", convertTxHashToHex(txEvent.hash));
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

export class OraiBridgeEvent extends BaseCosmosEvent {
  callback(eventData: TxEvent): void {
    this.handler.handleEvent([eventData]);
  }
}

export class OraichainEvent extends BaseCosmosEvent {
  callback(eventData: TxEvent): void {
    // TODO: consider parsing the OnRecvPacket here because it is a large tx
    this.handler.handleEvent([eventData]);
  }
}
