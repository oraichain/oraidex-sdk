import { ethers, EventFilter } from "ethers";
import { Gravity__factory, Gravity, generateError, parseRpcEvents } from "@oraichain/oraidex-common";
import { DuckDB } from "./db";
import { Tendermint37Client, TxData, WebsocketClient } from "@cosmjs/tendermint-rpc";
import { QueryTag, buildQuery } from "@cosmjs/tendermint-rpc/build/tendermint37/requests";
import { AnyInterpreter, interpret } from "xstate";
import { createEvmToEvmMachine } from "./machine";
// import { OraiBridgeRouteData, unmarshalOraiBridgeRoute } from "@oraichain/oraidex-universal-swap";
import { Event, TxEvent } from "@cosmjs/tendermint-rpc/build/tendermint37";

export const sendToCosmosEvent = "SendToCosmosEvent(address,address,string,uint256,uint256)";

export const oraiBridgeAutoForwardEvent = {
  type: "message",
  attribute: { key: "action", value: "/gravity.v1.MsgExecuteIbcAutoForwards" }
};
export const evmGravityEvents = [sendToCosmosEvent];

export enum EVMEventType {
  SEND_TO_COSMOS = "SendToCosmosEvent(address,address,string,uint256,uint256)",
  TRANSACTION_BATCH_EXECUTED_EVENT = "TransactionBatchExecutedEvent(uint256, address,uint256,)"
}

export enum OraiBridgeAction {
  AUTO_FORWARD_EVENT = "/gravity.v1.MsgExecuteIbcAutoForwards"
}
export enum OraiBridgeEventType {
  EVENT_SEND_TO_COSMOS_EXECUTED_IBC_AUTO_FORWARD = "gravity.v1.EventSendToCosmosExecutedIbcAutoForward"
}

export enum IBCEventType {
  SEND_PACKET = "send_packet",
  RECEIVE_PACKET = "recv_packet",
  IBC_TRANSFER = "ibc_transfer",
  ACKNOWLEDGE_PACKET = "acknowledge_packet"
}

export enum OraichainEventType { }

export enum NetworkEventType {
  EVM,
  ORAIBRIDGE,
  ORAICHAIN,
  COSMOS
}

export const keccak256HashString = (data: string): string => {
  return ethers.utils.keccak256(Buffer.from(data));
};

export class EventHandler {
  public intepreters: AnyInterpreter[] = [];
  constructor(public readonly db: DuckDB) { }

  processAutoForwardEvent(events: Event[], txEvent: TxEvent) {
    const autoForwardEvent = events.find((event) => event.type === OraiBridgeAction.AUTO_FORWARD_EVENT);
    if (!autoForwardEvent) {
      console.log("not autoforward event");
      return;
    }
    const nonceAttr = autoForwardEvent.attributes.find((attr) => attr.key === "nonce");
    if (!nonceAttr) {
      console.log("There is no event nonce attribute.");
      return;
    }
    const eventNonce = parseInt(JSON.parse(nonceAttr.value));
    const intepreter = this.intepreters.find((inte) => inte.machine.context.evmEventNonce && inte.machine.context.evmEventNonce === eventNonce);
    if (!intepreter) {
      console.log("found no intepreter that has the same evm event nonce as given: ", eventNonce);
      return;
    }
    intepreter.send({ type: "STORE_AUTO_FORWARD", payload: { events, txEvent } });
  }

  handleEvent(networkEventType: NetworkEventType, eventData: TxEvent[] | EventFilter[]) {
    switch (networkEventType) {
      case NetworkEventType.EVM:
        const eventObject = (eventData as EventFilter[]).find((data) => typeof data === "object" && data.topics);
        if (!eventObject) throw generateError(`There is something wrong with the evm event because it has no topics: ${JSON.stringify(eventData)}`);
        const topics = eventObject.topics;
        if (!topics) throw generateError(`There is no topics => something wrong with this event: ${JSON.stringify(eventData)}`);

        if (topics.includes(keccak256HashString(sendToCosmosEvent))) {
          // create new machine so we start a new context for the transaction
          const machine = createEvmToEvmMachine(this.db);
          const intepreter = interpret(machine).start();
          this.intepreters.push(intepreter);
          intepreter.send({ type: "STORE_SEND_TO_COSMOS", payload: eventData });
        } else {
          console.log("unrelated event data: ", eventData);
        }
        break;
      case NetworkEventType.ORAIBRIDGE:
        if (eventData.length === 0) throw generateError(`malformed OraiBridge event data: ${JSON.stringify(eventData)}`);
        const txEvent: TxEvent = (eventData as TxEvent[])[0];
        const events = parseRpcEvents(txEvent.result.events);
        // auto forward case, we handle it by forwarding to the evm case
        if (
          events.some(
            (event) =>
              event.type === oraiBridgeAutoForwardEvent.type &&
              event.attributes.some((attr) => JSON.stringify(attr) === JSON.stringify(oraiBridgeAutoForwardEvent.attribute))
          )
        ) {
          this.processAutoForwardEvent(events, txEvent);
          break;
        }
        break;
      case NetworkEventType.ORAICHAIN:
        break;
      default:
        break;
    }
  }

  // TODO: in-case our server is down, we will be able to reconstruct the intepreters and their current contexts from our db
  async recoverIntepreters() { }
}

export class EthEvent {
  constructor(public readonly handler: EventHandler) { }

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

export abstract class CosmosEvent {
  tendermintClient: Tendermint37Client;
  constructor(
    public readonly db: DuckDB,
    protected readonly handler: EventHandler,
    public readonly baseUrl: string
  ) { }

  // this function handles the websocket event after receiving. Each cosmos network has a different set of events needed to handle => this should be abstract
  abstract callback(eventData: TxEvent): void;

  connectCosmosSocket = async () => {
    const socketConnection = new WebsocketClient(this.baseUrl);
    this.tendermintClient = await Tendermint37Client.create(socketConnection);
  };

  subcribeTx = async (tags: QueryTag[]) => {
    if (!this.tendermintClient) {
      await this.connectCosmosSocket();
    }
    const stream = this.tendermintClient.subscribeTx(
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
  constructor(db: DuckDB, handler: EventHandler, baseUrl: string) {
    super(db, handler, baseUrl);
  }

  callback(eventData: TxEvent): void {
    this.handler.handleEvent(NetworkEventType.ORAIBRIDGE, [eventData]);
  }
}

export class OraichainEvent extends CosmosEvent {
  callback(eventData: TxEvent): void {
    this.handler.handleEvent(NetworkEventType.ORAICHAIN, [eventData]);
  }
}
