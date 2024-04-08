import { getSigners } from "hardhat";
import { InterpreterStatus } from "xstate";
// import { ChainId } from "../src/@types/chain";
import { EvmChainPrefix } from "@oraichain/oraidex-common";
import { setTimeout } from "timers/promises";
import {
  autoForwardTag,
  batchSendToEthClaimTag,
  onAcknowledgementTag,
  onRecvPacketTag,
  requestBatchTag
} from "../src/constants";
import { DuckDbNode } from "../src/db";
import { EthEvent, OraiBridgeEvent, OraichainEvent } from "../src/event";
import { EvmEventHandler } from "../src/event-handlers/evm.handler";
import { OraiBridgeHandler } from "../src/event-handlers/oraibridge.handler";
import { OraichainHandler } from "../src/event-handlers/oraichain.handler";
import IntepreterManager from "../src/managers/intepreter.manager";
import { unmarshalTxEvent } from "./common";
import {
  BatchSendToEthClaimTxData as BatchSendToEthClaimTxDataC2E,
  OnRecvPacketOraiBridgeTxData as OnRecvPacketOraiBridgeTxDataC2E,
  OnRecvPacketOraichainTxData as OnRecvPacketOraichainTxDataC2E,
  OnRequestBatchTxData as OnRequestBatchTxDataC2E
} from "./data/cosmos-to-evm";
import {
  OnAcknowledgement as OnAcknowledgementEvm2Cosmos,
  OnRecvPacketTxData as OnRecvPacketTxDataEvm2Cosmos,
  OraiBridgeAutoForwardTxData as OraiBridgeAutoForwardTxDataEvm2Cosmos,
  SendToCosmosData as SendToCosmosDataEvm2Cosmos
} from "./data/evm-to-cosmos";
import {
  BatchSendToEthClaimTxData as BatchSendToEthClaimTxDataEvm2Evm,
  OnRecvPacketOraiBridgeTxData as OnRecvPacketOraiBridgeTxDataEvm2Evm,
  OnRecvPacketOraichainTxData as OnRecvPacketTxDataOraichainEvm2Evm,
  OnRequestBatchTxData as OnRequestBatchTxDataEvm2Evm,
  OraiBridgeAutoForwardTxData as OraiBridgeAutoForwardTxDataEvm2Evm,
  SendToCosmosData as SendToCosmosDataEvm2Evm
} from "./data/evm-to-evm";
import {
  OnRecvPacketTxData as OnRecvPacketTxDataEvm2Oraichain,
  OraiBridgeAutoForwardTxData as OraiBridgeAutoForwardTxDataEvm2Oraichain,
  SendToCosmosData as SendToCosmosDataEvm2Oraichain
} from "./data/evm-to-oraichain";

describe("test-integration", () => {
  let duckDb: DuckDbNode;
  let evmHandler: EvmEventHandler;
  let oraibridgeHandler: OraiBridgeHandler;
  let oraichainHandler: OraichainHandler;
  let im: IntepreterManager;

  beforeEach(async () => {
    duckDb = await DuckDbNode.create();
    await duckDb.createTable();

    im = new IntepreterManager();
    evmHandler = new EvmEventHandler(duckDb, im);
    oraibridgeHandler = new OraiBridgeHandler(duckDb, im);
    oraichainHandler = new OraichainHandler(duckDb, im);
  });

  const [owner] = getSigners(1);
  xit("[EVM->Oraichain] full-flow happy test", async () => {
    const ethEvent = new EthEvent(evmHandler);
    const gravity = ethEvent.listenToEthEvent(
      owner.provider,
      "0xb40C364e70bbD98E8aaab707A41a52A2eAF5733f",
      EvmChainPrefix.BSC_MAINNET
    );
    gravity.emit("SendToCosmosEvent", ...SendToCosmosDataEvm2Oraichain);
    // TODO: how to wait for emit event to finish then start the next
    await setTimeout(300);
    const oraiBridgeEvent = new OraiBridgeEvent(oraibridgeHandler, "localhost:26657");
    const stream = await oraiBridgeEvent.connectCosmosSocket([autoForwardTag]);
    const oraiEvent = new OraichainEvent(oraichainHandler, "localhost:26657");
    const oraiStream = await oraiEvent.connectCosmosSocket([onRecvPacketTag]);
    // has to convert back to bytes because javascript object is not friendly with Uint8Array
    stream.shamefullySendNext(unmarshalTxEvent(OraiBridgeAutoForwardTxDataEvm2Oraichain));
    await setTimeout(300);
    oraiStream.shamefullySendNext(unmarshalTxEvent(OnRecvPacketTxDataEvm2Oraichain));
    await setTimeout(300);

    const intepreterCount = im.getIntepreter(0);
    expect(intepreterCount.status).toBe(InterpreterStatus.Stopped);
  });

  xit("[EVM->Cosmos] full-flow happy test", async () => {
    const ethEvent = new EthEvent(evmHandler);
    const gravity = ethEvent.listenToEthEvent(
      owner.provider,
      "0xb40C364e70bbD98E8aaab707A41a52A2eAF5733f",
      EvmChainPrefix.BSC_MAINNET
    );
    gravity.emit("SendToCosmosEvent", ...SendToCosmosDataEvm2Cosmos);
    // TODO: how to wait for emit event to finish then start the next
    await setTimeout(300);
    const oraiBridgeEvent = new OraiBridgeEvent(oraibridgeHandler, "localhost:26657");
    const oraiBridgeStream = await oraiBridgeEvent.connectCosmosSocket([autoForwardTag]);
    const oraiEvent = new OraichainEvent(oraichainHandler, "localhost:26657");
    const oraiStream = await oraiEvent.connectCosmosSocket([onRecvPacketTag, onAcknowledgementTag]);
    // has to convert back to bytes because javascript object is not friendly with Uint8Array
    oraiBridgeStream.shamefullySendNext(unmarshalTxEvent(OraiBridgeAutoForwardTxDataEvm2Cosmos));
    await setTimeout(300);
    oraiStream.shamefullySendNext(unmarshalTxEvent(OnRecvPacketTxDataEvm2Cosmos));
    await setTimeout(300);
    oraiStream.shamefullySendNext(unmarshalTxEvent(OnAcknowledgementEvm2Cosmos));
    await setTimeout(300);

    const intepreterCount = im.getIntepreter(0);
    expect(intepreterCount.status).toBe(InterpreterStatus.Stopped);
  });

  xit("[EVM->EVM] full-flow happy test", async () => {
    const ethEvent = new EthEvent(evmHandler);
    const gravity = ethEvent.listenToEthEvent(
      owner.provider,
      "0xb40C364e70bbD98E8aaab707A41a52A2eAF5733f",
      EvmChainPrefix.BSC_MAINNET
    );
    gravity.emit("SendToCosmosEvent", ...SendToCosmosDataEvm2Evm);
    // TODO: how to wait for emit event to finish then start the next
    await setTimeout(300);
    const oraiBridgeEvent = new OraiBridgeEvent(oraibridgeHandler, "localhost:26657");
    const oraiBridgeStream = await oraiBridgeEvent.connectCosmosSocket([
      autoForwardTag,
      requestBatchTag,
      batchSendToEthClaimTag
    ]);
    const oraiEvent = new OraichainEvent(oraichainHandler, "localhost:26657");
    const oraiStream = await oraiEvent.connectCosmosSocket([onRecvPacketTag]);
    // has to convert back to bytes because javascript object is not friendly with Uint8Array
    oraiBridgeStream.shamefullySendNext(unmarshalTxEvent(OraiBridgeAutoForwardTxDataEvm2Evm));
    await setTimeout(300);
    oraiStream.shamefullySendNext(unmarshalTxEvent(OnRecvPacketTxDataOraichainEvm2Evm));
    await setTimeout(300);
    oraiBridgeStream.shamefullySendNext(unmarshalTxEvent(OnRecvPacketOraiBridgeTxDataEvm2Evm));
    await setTimeout(300);
    oraiBridgeStream.shamefullySendNext(unmarshalTxEvent(OnRequestBatchTxDataEvm2Evm));
    await setTimeout(300);
    oraiBridgeStream.shamefullySendNext(unmarshalTxEvent(BatchSendToEthClaimTxDataEvm2Evm));
    await setTimeout(300);

    const intepreterCount = im.getIntepreter(0);
    expect(intepreterCount.status).toBe(InterpreterStatus.Stopped);
  });

  it("[Cosmos->EVM] full-flow happy test", async () => {
    const oraiBridgeEvent = new OraiBridgeEvent(oraibridgeHandler, "localhost:26657");
    const oraiBridgeStream = await oraiBridgeEvent.connectCosmosSocket([
      autoForwardTag,
      requestBatchTag,
      batchSendToEthClaimTag
    ]);
    const oraiEvent = new OraichainEvent(oraichainHandler, "localhost:26657");
    const oraiStream = await oraiEvent.connectCosmosSocket([onRecvPacketTag]);
    await setTimeout(300);
    oraiStream.shamefullySendNext(unmarshalTxEvent(OnRecvPacketOraichainTxDataC2E));
    await setTimeout(300);
    oraiBridgeStream.shamefullySendNext(unmarshalTxEvent(OnRecvPacketOraiBridgeTxDataC2E));
    await setTimeout(300);
    oraiBridgeStream.shamefullySendNext(unmarshalTxEvent(OnRequestBatchTxDataC2E));
    await setTimeout(300);
    oraiBridgeStream.shamefullySendNext(unmarshalTxEvent(BatchSendToEthClaimTxDataC2E));
    await setTimeout(300);

    // const intepreterCount = im.getIntepreter(0);
    // expect(intepreterCount.status).toBe(InterpreterStatus.Stopped);
  });

  xit("[Oraichain->EVM] full-flow happy test when existing a swap", async () => {});
  xit("[Oraichain->EVM] full-flow happy test when not existing a swap", async () => {});
});
