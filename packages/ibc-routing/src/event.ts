import { ethers } from "ethers";
import { Gravity__factory, Gravity, generateError } from "@oraichain/oraidex-common";
import { DuckDB } from "./db";
import { Tendermint37Client, WebsocketClient } from "@cosmjs/tendermint-rpc";
import { QueryTag, buildQuery } from "@cosmjs/tendermint-rpc/build/tendermint37/requests";
import { AnyInterpreter, interpret } from "xstate";
import { createEvmToEvmMachine } from "./machine";
import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
// import { OraiBridgeRouteData, unmarshalOraiBridgeRoute } from "@oraichain/oraidex-universal-swap";

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
  public intepreters: AnyInterpreter[] = [];
  constructor(public readonly db: DuckDB) { }
  handleEvent(networkEventType: NetworkEventType, eventData: any[]) {
    switch (networkEventType) {
      case NetworkEventType.EVM:
        const eventObject = eventData.find((data) => typeof data === "object" && data.topics);
        if (!eventObject) throw generateError(`There is something wrong with the evm event because it has no topics: ${JSON.stringify(eventData)}`);
        const topics: string[] = eventObject.topics;
        if (!topics) throw generateError(`There is no topics => something wrong with this event: ${JSON.stringify(eventData)}`);

        if (topics.includes(keccak256HashString(sendToCosmosEvent))) {
          // create new machine so we start a new context for the transaction
          const machine = createEvmToEvmMachine(this.db);
          const intepreter = interpret(machine).start();
          this.intepreters.push(intepreter);
          intepreter.send({ type: "STORE", payload: eventData });
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
  constructor(public readonly handler: ContextHandler) { }

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
  tendermintClient: Tendermint37Client;
  cosmWasmClient: CosmWasmClient;
  constructor(
    public readonly db: DuckDB,
    private readonly handler: ContextHandler,
    public readonly baseUrl: string
  ) { }

  connectCosmosSocket = async () => {
    const socketConnection = new WebsocketClient(this.baseUrl);
    this.cosmWasmClient = await CosmWasmClient.connect(this.baseUrl);
    // this.tendermintClient = await Tendermint37Client.create(socketConnection);
  };

  subcribeTx = async (tags: QueryTag[], next: (event) => any) => {
    if (!this.tendermintClient) {
      await this.connectCosmosSocket();
    }

    const stream = this.tendermintClient.subscribeTx(
      buildQuery({
        tags
      })
    );
    stream.subscribe({
      next
    });
  };
}

export class OraiBridgeEvent extends CosmosEvent {
  constructor(db: DuckDB, handler: ContextHandler, baseUrl: string) {
    super(db, handler, baseUrl);
  }

  listenToOraiBridgeEvent = async () => {
    if (!this.tendermintClient) {
      await this.connectCosmosSocket();
    }
    const query = buildQuery({
      tags: [
        {
          key: "gravity.v1.EventSendToCosmosExecutedIbcAutoForward.nonce",
          value: "583"
        }
      ]
      // raw: "gravity.v1.EventSendToCosmosExecutedIbcAutoForward.nonce='113'"
    });

    const result = await this.cosmWasmClient.searchTx({
      tags: [
        {
          key: "gravity.v1.EventSendToCosmosExecutedIbcAutoForward.receiver",
          value: "orai1u3ucyql6deplaxdv67an2k709vkhfvpmhezrm0"
        }
      ]
    });
    // const result = await this.tendermintClient.txSearch({
    //   page: 1,
    //   query
    // });
    console.log(
      result
      //.txs
      // .map((r) => r.result.events)
      // .find((e) => e.type === "gravity.v1.EventSendToCosmosExecutedIbcAutoForward")
      // .attributes.map(({ key, value }) => {
      //   return { key: Buffer.from(key, "base64").toString(), value: Buffer.from(value, "base64").toString() };
      // })
    );
  };
}

export class OraichainEvent extends CosmosEvent { }
