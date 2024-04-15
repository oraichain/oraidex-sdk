import { getSigners } from "hardhat";
import { InterpreterStatus } from "xstate";
// import { ChainId } from "../src/@types/chain";
import { COSMOS_CHAIN_ID_COMMON, EvmChainPrefix } from "@oraichain/oraidex-common";
import { expect } from "chai";
import { setTimeout } from "timers/promises";
import { waitFor } from "xstate/lib/waitFor";
import {
  autoForwardTag,
  batchSendToEthClaimTag,
  DatabaseEnum,
  invokableMachineStateKeys,
  onAcknowledgementTag,
  onExecuteContractTag,
  onRecvPacketTag,
  requestBatchTag
} from "../src/constants";
import { DuckDbNode } from "../src/db";
import { EthEvent, OraiBridgeEvent, OraichainEvent } from "../src/event";
import { CosmosHandler } from "../src/event-handlers/cosmos.handler";
import { EvmEventHandler } from "../src/event-handlers/evm.handler";
import { OraiBridgeHandler } from "../src/event-handlers/oraibridge.handler";
import { OraichainHandler } from "../src/event-handlers/oraichain.handler";
import { createCosmosIntepreter } from "../src/intepreters/cosmos.intepreter";
import { createEvmIntepreter } from "../src/intepreters/evm.intepreter";
import { createOraichainIntepreter } from "../src/intepreters/oraichain.intepreter";
import IntepreterManager from "../src/managers/intepreter.manager";
import { unmarshalTxEvent } from "./common";
import {
  BatchSendToEthClaimTxData as BatchSendToEthClaimTxDataC2E,
  IbcTransferTxData as IbcTransferTxDataC2E,
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
import {
  BatchSendToEthClaimTxData as BatchSendToEthClaimTxDataO2E,
  OnRecvPacketTxData as OnRecvPacketTxDataO2E,
  OnRequestBatchTxData as OnRequestBatchTxDataO2E,
  TransferBackToRemoteTxData as TransferBackToRemoteTxDataO2E
} from "./data/oraichain-to-evm";
const sleepTimeMs = 300;

// TODO: at each testcase, i should test the final stored database to make it more concise
describe("test-integration", () => {
  let duckDb: DuckDbNode;
  let evmHandler: EvmEventHandler;
  let oraibridgeHandler: OraiBridgeHandler;
  let oraichainHandler: OraichainHandler;
  let cosmosHandler: CosmosHandler;
  let im: IntepreterManager;

  beforeEach(async () => {
    duckDb = await DuckDbNode.create();
    await duckDb.createTable();

    im = new IntepreterManager(true);
    evmHandler = new EvmEventHandler(duckDb, im);
    oraibridgeHandler = new OraiBridgeHandler(duckDb, im);
    oraichainHandler = new OraichainHandler(duckDb, im);
    cosmosHandler = new CosmosHandler(duckDb, im);
  });

  afterEach(async () => {
    for (const table of Object.values(DatabaseEnum)) {
      await duckDb.dropTable(table);
    }
  });

  const [owner] = getSigners(1);

  it("[EVM->Oraichain] query happy test", async () => {
    // fixture, setup a successful ibc routing flow from evm -> oraichain
    const ethEvent = new EthEvent(evmHandler);
    const gravity = ethEvent.listenToEthEvent(
      owner.provider,
      "0xb40C364e70bbD98E8aaab707A41a52A2eAF5733f",
      EvmChainPrefix.BSC_MAINNET
    );
    gravity.emit("SendToCosmosEvent", ...SendToCosmosDataEvm2Oraichain);
    // TODO: how to wait for emit event to finish then start the next
    await setTimeout(sleepTimeMs);
    const oraiBridgeEvent = new OraiBridgeEvent(oraibridgeHandler, "localhost:26657");
    const stream = await oraiBridgeEvent.connectCosmosSocket([autoForwardTag]);
    const oraiEvent = new OraichainEvent(oraichainHandler, "localhost:26657");
    const oraiStream = await oraiEvent.connectCosmosSocket([onRecvPacketTag]);
    // has to convert back to bytes because javascript object is not friendly with Uint8Array
    stream.shamefullySendNext(unmarshalTxEvent(OraiBridgeAutoForwardTxDataEvm2Oraichain));
    await setTimeout(sleepTimeMs);
    oraiStream.shamefullySendNext(unmarshalTxEvent(OnRecvPacketTxDataEvm2Oraichain));
    await setTimeout(sleepTimeMs);

    // action. Create a new interpreter and try to invoke the query flow
    const interpreter = createEvmIntepreter(duckDb);
    const actor = interpreter.start();
    interpreter.send({
      type: invokableMachineStateKeys.QUERY_IBC_ROUTING_DATA,
      payload: {
        txHash: (SendToCosmosDataEvm2Oraichain[5] as any).transactionHash,
        evmChainPrefix: EvmChainPrefix.BSC_MAINNET
      }
    });
    const doneState = await waitFor(actor, (state) => state.done);
    console.log("done state: ", doneState.context.routingQueryData);
    const queryKeys = Object.keys(doneState.context.routingQueryData);
    expect(queryKeys.length).eq(3);
    expect(queryKeys[0]).eq(DatabaseEnum.Evm);
    expect(queryKeys[1]).eq(DatabaseEnum.OraiBridge);
    expect(queryKeys[2]).eq(DatabaseEnum.Oraichain);
  });

  it("[EVM->Oraichain] full-flow happy test", async () => {
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

    // TEST DATA
    expect(
      await duckDb.select(DatabaseEnum.Evm, {
        where: { txHash: "0xf55ed0825f55f18bd6ae618127e8cc0d889cc3253442ebe88c9280d669ebafb4" }
      })
    ).eql([
      {
        txHash: "0xf55ed0825f55f18bd6ae618127e8cc0d889cc3253442ebe88c9280d669ebafb4",
        height: 37469703,
        prevState: "",
        prevTxHash: "",
        nextState: "OraiBridgeState",
        destination:
          "channel-1/orai1rqhjqpaqrv26wuq627gav3ka4994u39e84lncy:CitvcmFpMXJxaGpxcGFxcnYyNnd1cTYyN2dhdjNrYTQ5OTR1MzllODRsbmN5EgAaK29yYWkxMmh6anhmaDc3d2w1NzJnZHpjdDJmeHYyYXJ4Y3doNmd5a2M3cWg=",
        fromAmount: "1783597583898563052",
        oraiBridgeChannelId: "channel-1",
        oraiReceiver: "orai1rqhjqpaqrv26wuq627gav3ka4994u39e84lncy",
        destinationDenom: "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh",
        destinationChannelId: "",
        destinationReceiver: "orai1rqhjqpaqrv26wuq627gav3ka4994u39e84lncy",
        eventNonce: 63593,
        evmChainPrefix: "oraib",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.OraiBridge, {
        where: {
          packetSequence: 18337
        }
      })
    ).eql([
      {
        txHash: "7CB195EFA9178EC2A1E06F8DCE1D4CEC7A760B0EFC4605E0FBFC87E999FD8B22",
        height: 11498709,
        prevState: "EvmState",
        prevTxHash: "0xf55ed0825f55f18bd6ae618127e8cc0d889cc3253442ebe88c9280d669ebafb4",
        nextState: "OraichainState",
        eventNonce: 63593,
        batchNonce: 0,
        txId: 0,
        evmChainPrefix: "oraib",
        packetSequence: 18337,
        amount: "1783597583898563052",
        denom: "oraib0x55d398326f99059fF775485246999027B3197955",
        memo: "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh",
        receiver: "orai1rqhjqpaqrv26wuq627gav3ka4994u39e84lncy",
        sender: "oraib1rqhjqpaqrv26wuq627gav3ka4994u39es5mlf8",
        srcPort: "transfer",
        srcChannel: "channel-1",
        dstPort: "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm",
        dstChannel: "channel-29",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.Oraichain, {
        where: {
          packetSequence: 18337
        }
      })
    ).eql([
      {
        txHash: "D8A6224EAB18B0195E7C26C567403F8481FCFB714C84636E4404592B1849F51C",
        height: 17439082,
        prevState: "OraiBridgeState",
        prevTxHash: "7CB195EFA9178EC2A1E06F8DCE1D4CEC7A760B0EFC4605E0FBFC87E999FD8B22",
        nextState: "",
        packetSequence: 18337,
        packetAck: "MQ==",
        sender: "",
        localReceiver: "orai1rqhjqpaqrv26wuq627gav3ka4994u39e84lncy",
        nextPacketSequence: 0,
        nextMemo: "",
        nextAmount: "0",
        nextReceiver: "",
        nextDestinationDenom: "",
        srcChannel: "channel-29",
        dstChannel: "",
        status: "FINISHED"
      }
    ]);

    const intepreterCount = im.getIntepreter(0);
    expect(intepreterCount.status).eql(InterpreterStatus.Stopped);
  });

  it("[EVM->Cosmos] query happy test", async () => {
    const ethEvent = new EthEvent(evmHandler);
    const gravity = ethEvent.listenToEthEvent(
      owner.provider,
      "0xb40C364e70bbD98E8aaab707A41a52A2eAF5733f",
      EvmChainPrefix.BSC_MAINNET
    );
    gravity.emit("SendToCosmosEvent", ...SendToCosmosDataEvm2Cosmos);
    // TODO: how to wait for emit event to finish then start the next
    await setTimeout(sleepTimeMs);
    const oraiBridgeEvent = new OraiBridgeEvent(oraibridgeHandler, "localhost:26657");
    const oraiBridgeStream = await oraiBridgeEvent.connectCosmosSocket([autoForwardTag]);
    const oraiEvent = new OraichainEvent(oraichainHandler, "localhost:26657");
    const oraiStream = await oraiEvent.connectCosmosSocket([onRecvPacketTag, onAcknowledgementTag]);
    // has to convert back to bytes because javascript object is not friendly with Uint8Array
    oraiBridgeStream.shamefullySendNext(unmarshalTxEvent(OraiBridgeAutoForwardTxDataEvm2Cosmos));
    await setTimeout(sleepTimeMs);
    oraiStream.shamefullySendNext(unmarshalTxEvent(OnRecvPacketTxDataEvm2Cosmos));
    await setTimeout(sleepTimeMs);
    oraiStream.shamefullySendNext(unmarshalTxEvent(OnAcknowledgementEvm2Cosmos));
    await setTimeout(sleepTimeMs);

    const interpreter = createEvmIntepreter(duckDb);
    const actor = interpreter.start();
    interpreter.send({
      type: invokableMachineStateKeys.QUERY_IBC_ROUTING_DATA,
      payload: {
        txHash: (SendToCosmosDataEvm2Cosmos[5] as any).transactionHash,
        evmChainPrefix: EvmChainPrefix.BSC_MAINNET
      }
    });
    const doneState = await waitFor(actor, (state) => state.done);
    console.log("done state: ", doneState.context.routingQueryData);
    const queryKeys = Object.keys(doneState.context.routingQueryData);
    expect(queryKeys.length).eq(4);
    expect(queryKeys[0]).eq(DatabaseEnum.Evm);
    expect(queryKeys[1]).eq(DatabaseEnum.OraiBridge);
    expect(queryKeys[2]).eq(DatabaseEnum.Oraichain);
    expect(queryKeys[3]).eq(DatabaseEnum.Cosmos);
  });

  it("[EVM->Cosmos] full-flow happy test", async () => {
    const ethEvent = new EthEvent(evmHandler);
    const gravity = ethEvent.listenToEthEvent(
      owner.provider,
      "0xb40C364e70bbD98E8aaab707A41a52A2eAF5733f",
      EvmChainPrefix.BSC_MAINNET
    );
    gravity.emit("SendToCosmosEvent", ...SendToCosmosDataEvm2Cosmos);
    // TODO: how to wait for emit event to finish then start the next
    await setTimeout(sleepTimeMs);
    const oraiBridgeEvent = new OraiBridgeEvent(oraibridgeHandler, "localhost:26657");
    const oraiBridgeStream = await oraiBridgeEvent.connectCosmosSocket([autoForwardTag]);
    const oraiEvent = new OraichainEvent(oraichainHandler, "localhost:26657");
    const oraiStream = await oraiEvent.connectCosmosSocket([onRecvPacketTag, onAcknowledgementTag]);
    // has to convert back to bytes because javascript object is not friendly with Uint8Array
    oraiBridgeStream.shamefullySendNext(unmarshalTxEvent(OraiBridgeAutoForwardTxDataEvm2Cosmos));
    await setTimeout(sleepTimeMs);
    oraiStream.shamefullySendNext(unmarshalTxEvent(OnRecvPacketTxDataEvm2Cosmos));
    await setTimeout(sleepTimeMs);
    oraiStream.shamefullySendNext(unmarshalTxEvent(OnAcknowledgementEvm2Cosmos));
    await setTimeout(sleepTimeMs);

    // Test Data
    expect(
      await duckDb.select(DatabaseEnum.Evm, {
        where: {
          txHash: "0xe551efd736461673ee952881c49923d2bb4fba538aa1771775d4d5bc02f97c8f"
        }
      })
    ).eql([
      {
        txHash: "0xe551efd736461673ee952881c49923d2bb4fba538aa1771775d4d5bc02f97c8f",
        height: 37505362,
        prevState: "",
        prevTxHash: "",
        nextState: "OraiBridgeState",
        destination:
          "channel-1/orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd:Ci1jb3Ntb3MxZWhtaHFjbjhlcmYzZGdhdnJjYTY5emdwNHJ0eGo1a3FtY3dzOTcSCmNoYW5uZWwtMTUaBXVhdG9t",
        fromAmount: "3000000000000000000",
        oraiBridgeChannelId: "channel-1",
        oraiReceiver: "orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd",
        destinationDenom: "uatom",
        destinationChannelId: "channel-15",
        destinationReceiver: "cosmos1ehmhqcn8erf3dgavrca69zgp4rtxj5kqmcws97",
        eventNonce: 63759,
        evmChainPrefix: "oraib",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.OraiBridge, {
        where: {
          eventNonce: 63759,
          evmChainPrefix: "oraib"
        },
        pagination: {
          limit: 1
        }
      })
    ).eql([
      {
        txHash: "7B1817348D6629758A56F2EDC45677F2E77A99850A60D363606E6ABC92A71428",
        height: 11570695,
        prevState: "EvmState",
        prevTxHash: "0xe551efd736461673ee952881c49923d2bb4fba538aa1771775d4d5bc02f97c8f",
        nextState: "OraichainState",
        eventNonce: 63759,
        batchNonce: 0,
        txId: 0,
        evmChainPrefix: "oraib",
        packetSequence: 18434,
        amount: "3000000000000000000",
        denom: "oraib0x55d398326f99059fF775485246999027B3197955",
        memo: "uatom",
        receiver: "orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd",
        sender: "oraib1ehmhqcn8erf3dgavrca69zgp4rtxj5kql2ul4w",
        srcPort: "transfer",
        srcChannel: "channel-1",
        dstPort: "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm",
        dstChannel: "channel-29",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.Oraichain, {
        where: {
          packetSequence: 18434
        }
      })
    ).eql([
      {
        txHash: "10A17F2AFC8D959272C038B5E2ECB39F26C62BD9EC44E76ED3D2F8B58AE863B2",
        height: 17519455,
        prevState: "OraiBridgeState",
        prevTxHash: "7B1817348D6629758A56F2EDC45677F2E77A99850A60D363606E6ABC92A71428",
        nextState: "",
        packetSequence: 18434,
        packetAck: "MQ==",
        sender: "orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd",
        localReceiver: "orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd",
        nextPacketSequence: 48599,
        nextMemo: "",
        nextAmount: "140410",
        nextReceiver: "cosmos1ehmhqcn8erf3dgavrca69zgp4rtxj5kqmcws97",
        nextDestinationDenom: "transfer/channel-15/uatom",
        srcChannel: "channel-15",
        dstChannel: "channel-301",
        status: "FINISHED"
      }
    ]);

    const intepreterCount = im.getIntepreter(0);
    expect(intepreterCount.status).eql(InterpreterStatus.Stopped);
  });

  it("[EVM->EVM] query happy test", async () => {
    const ethEvent = new EthEvent(evmHandler);
    const gravity = ethEvent.listenToEthEvent(
      owner.provider,
      "0xb40C364e70bbD98E8aaab707A41a52A2eAF5733f",
      EvmChainPrefix.BSC_MAINNET
    );
    gravity.emit("SendToCosmosEvent", ...SendToCosmosDataEvm2Evm);
    // TODO: how to wait for emit event to finish then start the next
    await setTimeout(sleepTimeMs);
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
    await setTimeout(sleepTimeMs);
    oraiStream.shamefullySendNext(unmarshalTxEvent(OnRecvPacketTxDataOraichainEvm2Evm));
    await setTimeout(sleepTimeMs);
    oraiBridgeStream.shamefullySendNext(unmarshalTxEvent(OnRecvPacketOraiBridgeTxDataEvm2Evm));
    await setTimeout(sleepTimeMs);
    oraiBridgeStream.shamefullySendNext(unmarshalTxEvent(OnRequestBatchTxDataEvm2Evm));
    await setTimeout(sleepTimeMs);
    oraiBridgeStream.shamefullySendNext(unmarshalTxEvent(BatchSendToEthClaimTxDataEvm2Evm));
    await setTimeout(sleepTimeMs);

    const interpreter = createEvmIntepreter(duckDb);
    const actor = interpreter.start();
    interpreter.send({
      type: invokableMachineStateKeys.QUERY_IBC_ROUTING_DATA,
      payload: {
        txHash: (SendToCosmosDataEvm2Evm[5] as any).transactionHash,
        evmChainPrefix: EvmChainPrefix.BSC_MAINNET
      }
    });
    const doneState = await waitFor(actor, (state) => state.done);
    console.log("done state: ", doneState.context.routingQueryData);
    const queryKeys = Object.keys(doneState.context.routingQueryData);
    expect(queryKeys.length).eq(5);
    expect(queryKeys[0]).eq(DatabaseEnum.Evm);
    expect(queryKeys[1]).eq(DatabaseEnum.OraiBridge);
    expect(queryKeys[2]).eq(DatabaseEnum.Oraichain);
    expect(queryKeys[3]).eq(`${DatabaseEnum.OraiBridge}_NEXT`);
    expect(queryKeys[4]).eq(`${DatabaseEnum.Evm}_NEXT`);
  });

  it("[EVM->EVM] full-flow happy test", async () => {
    const ethEvent = new EthEvent(evmHandler);
    const gravity = ethEvent.listenToEthEvent(
      owner.provider,
      "0xb40C364e70bbD98E8aaab707A41a52A2eAF5733f",
      EvmChainPrefix.BSC_MAINNET
    );
    gravity.emit("SendToCosmosEvent", ...SendToCosmosDataEvm2Evm);
    // TODO: how to wait for emit event to finish then start the next
    await setTimeout(sleepTimeMs);
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
    await setTimeout(sleepTimeMs);
    oraiStream.shamefullySendNext(unmarshalTxEvent(OnRecvPacketTxDataOraichainEvm2Evm));
    await setTimeout(sleepTimeMs);
    oraiBridgeStream.shamefullySendNext(unmarshalTxEvent(OnRecvPacketOraiBridgeTxDataEvm2Evm));
    await setTimeout(sleepTimeMs);
    oraiBridgeStream.shamefullySendNext(unmarshalTxEvent(OnRequestBatchTxDataEvm2Evm));
    await setTimeout(sleepTimeMs);
    oraiBridgeStream.shamefullySendNext(unmarshalTxEvent(BatchSendToEthClaimTxDataEvm2Evm));
    await setTimeout(sleepTimeMs);

    // TEST DATA
    expect(
      await duckDb.select(DatabaseEnum.Evm, {
        where: { txHash: "0xdb03f0cb45506b7725cf04c62035b38a8362a51bc15e24b3706cbc45a17ef27d" }
      })
    ).eql([
      {
        txHash: "0xdb03f0cb45506b7725cf04c62035b38a8362a51bc15e24b3706cbc45a17ef27d",
        height: 37534324,
        prevState: "",
        prevTxHash: "",
        nextState: "OraiBridgeState",
        destination:
          "channel-1/orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd:CjVldGgtbWFpbm5ldDB4MGRlQjUyNDk5QzJlOUYzOTIxYzYzMWNiNkFkMzUyMkM1NzZkNTQ4NBIKY2hhbm5lbC0yORo1ZXRoLW1haW5uZXQweGRBQzE3Rjk1OEQyZWU1MjNhMjIwNjIwNjk5NDU5N0MxM0Q4MzFlYzc=",
        fromAmount: "17000000000000000000",
        oraiBridgeChannelId: "channel-1",
        oraiReceiver: "orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd",
        destinationDenom: "eth-mainnet0xdAC17F958D2ee523a2206206994597C13D831ec7",
        destinationChannelId: "channel-29",
        destinationReceiver: "eth-mainnet0x0deB52499C2e9F3921c631cb6Ad3522C576d5484",
        eventNonce: 63870,
        evmChainPrefix: "oraib",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.OraiBridge, {
        where: {
          eventNonce: 63870,
          evmChainPrefix: "oraib"
        }
      })
    ).eql([
      {
        txHash: "7A82ABF78DF290B552D377BB002C5628C33F0859E1936550BA1D9254ED833B2E",
        height: 11628601,
        prevState: "EvmState",
        prevTxHash: "0xdb03f0cb45506b7725cf04c62035b38a8362a51bc15e24b3706cbc45a17ef27d",
        nextState: "OraichainState",
        eventNonce: 63870,
        batchNonce: 0,
        txId: 0,
        evmChainPrefix: "oraib",
        packetSequence: 18501,
        amount: "17000000000000000000",
        denom: "oraib0x55d398326f99059fF775485246999027B3197955",
        memo: "eth-mainnet0xdAC17F958D2ee523a2206206994597C13D831ec7",
        receiver: "orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd",
        sender: "oraib1ehmhqcn8erf3dgavrca69zgp4rtxj5kql2ul4w",
        srcPort: "transfer",
        srcChannel: "channel-1",
        dstPort: "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm",
        dstChannel: "channel-29",
        status: "FINISHED"
      }
    ]);
    expect(await duckDb.select(DatabaseEnum.Oraichain, { where: { packetSequence: 18501 } })).eql([
      {
        txHash: "1B3720C353EC5CC96AAB086ED210BED751357DE6B54C4AFCD93520EDABF7AE26",
        height: 17585180,
        prevState: "OraiBridgeState",
        prevTxHash: "7A82ABF78DF290B552D377BB002C5628C33F0859E1936550BA1D9254ED833B2E",
        nextState: "OraiBridgeState",
        packetSequence: 18501,
        packetAck: "MQ==",
        sender: "orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd",
        localReceiver: "orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd",
        nextPacketSequence: 21456,
        nextMemo: "eth-mainnet0x0deB52499C2e9F3921c631cb6Ad3522C576d5484",
        nextAmount: "1106616",
        nextReceiver: "oraib1ehmhqcn8erf3dgavrca69zgp4rtxj5kql2ul4w",
        nextDestinationDenom:
          "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm/channel-29/eth-mainnet0xdAC17F958D2ee523a2206206994597C13D831ec7",
        srcChannel: "channel-29",
        dstChannel: "channel-1",
        status: "FINISHED"
      }
    ]);
    expect(await duckDb.select(DatabaseEnum.OraiBridge, { where: { packetSequence: 21456 } })).eql([
      {
        txHash: "6A7A880277AE9CD0BAAA71FF9CD7127FC39B8E5AFD1B2F33F7016D117D7F0F55",
        height: 11628606,
        prevState: "OraichainState",
        prevTxHash: "1B3720C353EC5CC96AAB086ED210BED751357DE6B54C4AFCD93520EDABF7AE26",
        nextState: "EvmState",
        eventNonce: 6501,
        batchNonce: 4127,
        txId: 4197,
        evmChainPrefix: "eth-mainnet",
        packetSequence: 21456,
        amount: "1106616",
        denom:
          "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm/channel-29/eth-mainnet0xdAC17F958D2ee523a2206206994597C13D831ec7",
        memo: "eth-mainnet0x0deB52499C2e9F3921c631cb6Ad3522C576d5484",
        receiver: "oraib1ehmhqcn8erf3dgavrca69zgp4rtxj5kql2ul4w",
        sender: "orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm",
        srcPort: "transfer",
        srcChannel: "channel-1",
        dstPort: "",
        dstChannel: "",
        status: "FINISHED"
      }
    ]);
    expect(await duckDb.select(DatabaseEnum.Evm, { where: { eventNonce: 6501, evmChainPrefix: "eth-mainnet" } })).eql([
      {
        txHash: "",
        height: 0,
        prevState: "OraiBridgeState",
        prevTxHash: "6A7A880277AE9CD0BAAA71FF9CD7127FC39B8E5AFD1B2F33F7016D117D7F0F55",
        nextState: "",
        destination: "",
        fromAmount: "0",
        oraiBridgeChannelId: "",
        oraiReceiver: "",
        destinationDenom: "",
        destinationChannelId: "",
        destinationReceiver: "0x0deB52499C2e9F3921c631cb6Ad3522C576d5484",
        eventNonce: 6501,
        evmChainPrefix: "eth-mainnet",
        status: "FINISHED"
      }
    ]);

    const intepreterCount = im.getIntepreter(0);
    expect(intepreterCount.status).eql(InterpreterStatus.Stopped);
  });

  it("[Cosmos->EVM] query happy test", async () => {
    const oraiBridgeEvent = new OraiBridgeEvent(oraibridgeHandler, "localhost:26657");
    const oraiBridgeStream = await oraiBridgeEvent.connectCosmosSocket([
      autoForwardTag,
      requestBatchTag,
      batchSendToEthClaimTag
    ]);
    const oraiEvent = new OraichainEvent(oraichainHandler, "localhost:26657");
    cosmosHandler.handleEvent([
      {
        txEvent: IbcTransferTxDataC2E,
        chainId: COSMOS_CHAIN_ID_COMMON.COSMOSHUB_CHAIN_ID
      }
    ]);
    await setTimeout(300);

    const oraiStream = await oraiEvent.connectCosmosSocket([onRecvPacketTag]);
    await setTimeout(sleepTimeMs);
    oraiStream.shamefullySendNext(unmarshalTxEvent(OnRecvPacketOraichainTxDataC2E));
    await setTimeout(sleepTimeMs);
    oraiBridgeStream.shamefullySendNext(unmarshalTxEvent(OnRecvPacketOraiBridgeTxDataC2E));
    await setTimeout(sleepTimeMs);
    oraiBridgeStream.shamefullySendNext(unmarshalTxEvent(OnRequestBatchTxDataC2E));
    await setTimeout(sleepTimeMs);
    oraiBridgeStream.shamefullySendNext(unmarshalTxEvent(BatchSendToEthClaimTxDataC2E));
    await setTimeout(sleepTimeMs);

    // action. Create a new interpreter and try to invoke the query flow
    const interpreter = createCosmosIntepreter(duckDb);
    const actor = interpreter.start();
    interpreter.send({
      type: invokableMachineStateKeys.QUERY_IBC_ROUTING_DATA,
      payload: {
        txHash: IbcTransferTxDataC2E.hash,
        chainId: COSMOS_CHAIN_ID_COMMON.COSMOSHUB_CHAIN_ID
      }
    });
    const doneState = await waitFor(actor, (state) => state.done);
    console.log("done state: ", doneState.context.routingQueryData);
    const queryKeys = Object.keys(doneState.context.routingQueryData);
    expect(queryKeys.length).eq(4);
    expect(queryKeys[0]).eq(DatabaseEnum.Cosmos);
    expect(queryKeys[1]).eq(DatabaseEnum.Oraichain);
    expect(queryKeys[2]).eq(DatabaseEnum.OraiBridge);
    expect(queryKeys[3]).eq(DatabaseEnum.Evm);
  });

  it("[Cosmos->EVM] full-flow happy test", async () => {
    const oraiBridgeEvent = new OraiBridgeEvent(oraibridgeHandler, "localhost:26657");
    const oraiBridgeStream = await oraiBridgeEvent.connectCosmosSocket([
      autoForwardTag,
      requestBatchTag,
      batchSendToEthClaimTag
    ]);
    const oraiEvent = new OraichainEvent(oraichainHandler, "localhost:26657");
    cosmosHandler.handleEvent([
      {
        txEvent: IbcTransferTxDataC2E,
        chainId: COSMOS_CHAIN_ID_COMMON.COSMOSHUB_CHAIN_ID
      }
    ]);
    await setTimeout(300);

    const oraiStream = await oraiEvent.connectCosmosSocket([onRecvPacketTag]);
    await setTimeout(sleepTimeMs);
    oraiStream.shamefullySendNext(unmarshalTxEvent(OnRecvPacketOraichainTxDataC2E));
    await setTimeout(sleepTimeMs);
    oraiBridgeStream.shamefullySendNext(unmarshalTxEvent(OnRecvPacketOraiBridgeTxDataC2E));
    await setTimeout(sleepTimeMs);
    oraiBridgeStream.shamefullySendNext(unmarshalTxEvent(OnRequestBatchTxDataC2E));
    await setTimeout(sleepTimeMs);
    oraiBridgeStream.shamefullySendNext(unmarshalTxEvent(BatchSendToEthClaimTxDataC2E));
    await setTimeout(sleepTimeMs);

    // Test data test
    expect(
      await duckDb.select(DatabaseEnum.Cosmos, {
        where: {
          packetSequence: 64277
        }
      })
    ).eql([
      {
        txHash: "9EBDB3009802EEF7B85B0E64BD1CD20E3F05849C4918B241F3DD0649A07F2F36",
        height: 19897012,
        chainId: "cosmoshub-4",
        prevState: "",
        prevTxHash: "",
        nextState: "OraichainState",
        packetSequence: 64277,
        amount: "300000",
        denom: "uatom",
        memo: '{"wasm":{"contract":"orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm","msg":{"ibc_hooks_receive":{"func":"universal_swap","args":"ChTN93BiZ8jTFqOsHjuiiQGo1mlSwBIvb3JhaWIweDBkZUI1MjQ5OUMyZTlGMzkyMWM2MzFjYjZBZDM1MjJDNTc2ZDU0ODQaCmNoYW5uZWwtMjkiL29yYWliMHg1NWQzOTgzMjZmOTkwNTlmRjc3NTQ4NTI0Njk5OTAyN0IzMTk3OTU1"}}}}',
        receiver: "orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm",
        sender: "cosmos1ehmhqcn8erf3dgavrca69zgp4rtxj5kqmcws97",
        srcPort: "transfer",
        srcChannel: "channel-301",
        dstPort: "transfer",
        dstChannel: "channel-15",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.Oraichain, {
        where: {
          packetSequence: 64277
        }
      })
    ).eql([
      {
        txHash: "52FF42B92483D5BB85D876120E0BB60F728A5CD87BCDA4FBE44A1C79632592DA",
        height: 17854166,
        prevState: "CosmosState",
        prevTxHash: "9EBDB3009802EEF7B85B0E64BD1CD20E3F05849C4918B241F3DD0649A07F2F36",
        nextState: "OraiBridgeState",
        packetSequence: 64277,
        packetAck: "",
        sender: "cosmos1ehmhqcn8erf3dgavrca69zgp4rtxj5kqmcws97",
        localReceiver: "orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm",
        nextPacketSequence: 21698,
        nextMemo: "oraib0x0deB52499C2e9F3921c631cb6Ad3522C576d5484",
        nextAmount: "1940789000000000000",
        nextReceiver: "oraib1ehmhqcn8erf3dgavrca69zgp4rtxj5kql2ul4w",
        nextDestinationDenom:
          "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm/channel-29/oraib0x55d398326f99059fF775485246999027B3197955",
        status: "FINISHED",
        srcChannel: "channel-29",
        dstChannel: "channel-1"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.OraiBridge, {
        where: {
          packetSequence: 21698
        }
      })
    ).eql([
      {
        txHash: "4E5F68FB9D3355DC115B3C1DDEFCFD318D02D33B761A42D1266A4C7092F1BA61",
        height: 11868974,
        prevState: "OraichainState",
        prevTxHash: "52FF42B92483D5BB85D876120E0BB60F728A5CD87BCDA4FBE44A1C79632592DA",
        nextState: "EvmState",
        eventNonce: 64152,
        batchNonce: 31338,
        txId: 33193,
        evmChainPrefix: "oraib",
        packetSequence: 21698,
        amount: "1940789000000000000",
        denom:
          "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm/channel-29/oraib0x55d398326f99059fF775485246999027B3197955",
        memo: "oraib0x0deB52499C2e9F3921c631cb6Ad3522C576d5484",
        receiver: "oraib1ehmhqcn8erf3dgavrca69zgp4rtxj5kql2ul4w",
        sender: "orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm",
        srcPort: "transfer",
        srcChannel: "channel-1",
        dstPort: "",
        dstChannel: "",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.Evm, {
        where: { eventNonce: 64152, evmChainPrefix: "oraib" }
      })
    ).eql([
      {
        txHash: "",
        height: 0,
        prevState: "OraiBridgeState",
        prevTxHash: "4E5F68FB9D3355DC115B3C1DDEFCFD318D02D33B761A42D1266A4C7092F1BA61",
        nextState: "",
        destination: "",
        fromAmount: "0",
        oraiBridgeChannelId: "",
        oraiReceiver: "",
        destinationDenom: "",
        destinationChannelId: "",
        destinationReceiver: "0x0deB52499C2e9F3921c631cb6Ad3522C576d5484",
        eventNonce: 64152,
        evmChainPrefix: "oraib",
        status: "FINISHED"
      }
    ]);

    const intepreterCount = im.getIntepreter(0);
    expect(intepreterCount.status).eql(InterpreterStatus.Stopped);
  });

  it("[Oraichain->EVM] query happy test", async () => {
    const oraiBridgeEvent = new OraiBridgeEvent(oraibridgeHandler, "localhost:26657");
    const oraiBridgeStream = await oraiBridgeEvent.connectCosmosSocket([
      autoForwardTag,
      requestBatchTag,
      batchSendToEthClaimTag
    ]);
    const oraiEvent = new OraichainEvent(oraichainHandler, "localhost:26657");
    const oraiStream = await oraiEvent.connectCosmosSocket([onRecvPacketTag, onExecuteContractTag]);
    await setTimeout(sleepTimeMs);
    oraiStream.shamefullySendNext(unmarshalTxEvent(TransferBackToRemoteTxDataO2E));
    await setTimeout(sleepTimeMs);
    oraiBridgeStream.shamefullySendNext(unmarshalTxEvent(OnRecvPacketTxDataO2E));
    await setTimeout(sleepTimeMs);
    oraiBridgeStream.shamefullySendNext(unmarshalTxEvent(OnRequestBatchTxDataO2E));
    await setTimeout(sleepTimeMs);
    oraiBridgeStream.shamefullySendNext(unmarshalTxEvent(BatchSendToEthClaimTxDataO2E));
    await setTimeout(sleepTimeMs);

    // action. Create a new interpreter and try to invoke the query flow
    const interpreter = createOraichainIntepreter(duckDb);
    const actor = interpreter.start();
    interpreter.send({
      type: invokableMachineStateKeys.QUERY_IBC_ROUTING_DATA,
      payload: {
        txHash: TransferBackToRemoteTxDataO2E.hash
      }
    });
    const doneState = await waitFor(actor, (state) => state.done);
    console.log("done state: ", doneState.context.routingQueryData);
    const queryKeys = Object.keys(doneState.context.routingQueryData);
    expect(queryKeys.length).eq(3);
    expect(queryKeys[0]).eq(DatabaseEnum.Oraichain);
    expect(queryKeys[1]).eq(DatabaseEnum.OraiBridge);
    expect(queryKeys[2]).eq(DatabaseEnum.Evm);
  });

  it("[Oraichain->EVM] full-flow happy test", async () => {
    const oraiBridgeEvent = new OraiBridgeEvent(oraibridgeHandler, "localhost:26657");
    const oraiBridgeStream = await oraiBridgeEvent.connectCosmosSocket([
      autoForwardTag,
      requestBatchTag,
      batchSendToEthClaimTag
    ]);
    const oraiEvent = new OraichainEvent(oraichainHandler, "localhost:26657");
    const oraiStream = await oraiEvent.connectCosmosSocket([onRecvPacketTag, onExecuteContractTag]);
    await setTimeout(sleepTimeMs);
    oraiStream.shamefullySendNext(unmarshalTxEvent(TransferBackToRemoteTxDataO2E));
    await setTimeout(sleepTimeMs);
    oraiBridgeStream.shamefullySendNext(unmarshalTxEvent(OnRecvPacketTxDataO2E));
    await setTimeout(sleepTimeMs);
    oraiBridgeStream.shamefullySendNext(unmarshalTxEvent(OnRequestBatchTxDataO2E));
    await setTimeout(sleepTimeMs);
    oraiBridgeStream.shamefullySendNext(unmarshalTxEvent(BatchSendToEthClaimTxDataO2E));
    await setTimeout(sleepTimeMs);

    // Test Data
    expect(
      await duckDb.select(DatabaseEnum.Oraichain, {
        where: {
          packetSequence: 21688
        }
      })
    ).eql([
      {
        txHash: "EF7A547A72190EAFF43001E878697CA9C845A12746223340384899FC635E67FC",
        height: 17843438,
        prevState: "",
        prevTxHash: "",
        nextState: "OraiBridgeState",
        packetSequence: 21688,
        packetAck: "",
        sender: "orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd",
        localReceiver: "orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd",
        srcChannel: "channel-29",
        dstChannel: "channel-1",
        nextPacketSequence: 21688,
        nextMemo: "oraib0x0deB52499C2e9F3921c631cb6Ad3522C576d5484",
        nextAmount: "1388829000000000000",
        nextReceiver: "oraib1ehmhqcn8erf3dgavrca69zgp4rtxj5kql2ul4w",
        nextDestinationDenom:
          "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm/channel-29/oraib0x55d398326f99059fF775485246999027B3197955",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.OraiBridge, {
        where: {
          packetSequence: 21688
        }
      })
    ).eql([
      {
        txHash: "FBEE176EDB37A5620CA0FF47BB40FEFEB67FFDA111656701C4C9A457A2720230",
        height: 11859231,
        prevState: "OraichainState",
        prevTxHash: "EF7A547A72190EAFF43001E878697CA9C845A12746223340384899FC635E67FC",
        nextState: "EvmState",
        eventNonce: 64140,
        batchNonce: 31330,
        txId: 33185,
        evmChainPrefix: "oraib",
        packetSequence: 21688,
        amount: "1388829000000000000",
        denom:
          "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm/channel-29/oraib0x55d398326f99059fF775485246999027B3197955",
        memo: "oraib0x0deB52499C2e9F3921c631cb6Ad3522C576d5484",
        receiver: "oraib1ehmhqcn8erf3dgavrca69zgp4rtxj5kql2ul4w",
        sender: "orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd",
        srcPort: "transfer",
        srcChannel: "channel-1",
        dstPort: "",
        dstChannel: "",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.Evm, {
        where: {
          eventNonce: 64140,
          evmChainPrefix: "oraib"
        }
      })
    ).eql([
      {
        txHash: "",
        height: 0,
        prevState: "OraiBridgeState",
        prevTxHash: "FBEE176EDB37A5620CA0FF47BB40FEFEB67FFDA111656701C4C9A457A2720230",
        nextState: "",
        destination: "",
        fromAmount: "0",
        oraiBridgeChannelId: "",
        oraiReceiver: "",
        destinationDenom: "",
        destinationChannelId: "",
        destinationReceiver: "0x0deB52499C2e9F3921c631cb6Ad3522C576d5484",
        eventNonce: 64140,
        evmChainPrefix: "oraib",
        status: "FINISHED"
      }
    ]);

    const intepreterCount = im.getIntepreter(0);
    expect(intepreterCount.status).eql(InterpreterStatus.Stopped);
  });
});

describe("test-integration time-out", () => {
  let duckDb: DuckDbNode;
  let evmHandler: EvmEventHandler;
  let oraibridgeHandler: OraiBridgeHandler;
  let oraichainHandler: OraichainHandler;
  let cosmosHandler: CosmosHandler;
  let im: IntepreterManager;

  beforeEach(async () => {
    duckDb = await DuckDbNode.create();
    await duckDb.createTable();

    im = new IntepreterManager(true);
    evmHandler = new EvmEventHandler(duckDb, im);
    oraibridgeHandler = new OraiBridgeHandler(duckDb, im);
    oraichainHandler = new OraichainHandler(duckDb, im);
    cosmosHandler = new CosmosHandler(duckDb, im);
  });

  afterEach(async () => {
    for (const table of Object.values(DatabaseEnum)) {
      await duckDb.dropTable(table);
    }
  });

  const [owner] = getSigners(1);

  it("[EVM->EVM] testing timeout on missing event", async () => {
    const ethEvent = new EthEvent(evmHandler);
    const gravity = ethEvent.listenToEthEvent(
      owner.provider,
      "0xb40C364e70bbD98E8aaab707A41a52A2eAF5733f",
      EvmChainPrefix.BSC_MAINNET
    );
    gravity.emit("SendToCosmosEvent", ...SendToCosmosDataEvm2Evm);
    await setTimeout(30000);
    // TEST DATA
    expect(
      await duckDb.select(DatabaseEnum.Evm, {
        where: { txHash: "0xdb03f0cb45506b7725cf04c62035b38a8362a51bc15e24b3706cbc45a17ef27d" }
      })
    ).eql([
      {
        txHash: "0xdb03f0cb45506b7725cf04c62035b38a8362a51bc15e24b3706cbc45a17ef27d",
        height: 37534324,
        prevState: "",
        prevTxHash: "",
        nextState: "OraiBridgeState",
        destination:
          "channel-1/orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd:CjVldGgtbWFpbm5ldDB4MGRlQjUyNDk5QzJlOUYzOTIxYzYzMWNiNkFkMzUyMkM1NzZkNTQ4NBIKY2hhbm5lbC0yORo1ZXRoLW1haW5uZXQweGRBQzE3Rjk1OEQyZWU1MjNhMjIwNjIwNjk5NDU5N0MxM0Q4MzFlYzc=",
        fromAmount: "17000000000000000000",
        oraiBridgeChannelId: "channel-1",
        oraiReceiver: "orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd",
        destinationDenom: "eth-mainnet0xdAC17F958D2ee523a2206206994597C13D831ec7",
        destinationChannelId: "channel-29",
        destinationReceiver: "eth-mainnet0x0deB52499C2e9F3921c631cb6Ad3522C576d5484",
        eventNonce: 63870,
        evmChainPrefix: "oraib",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.OraiBridge, {
        where: {
          eventNonce: 63870,
          evmChainPrefix: "oraib"
        }
      })
    ).eql([
      {
        txHash: "7A82ABF78DF290B552D377BB002C5628C33F0859E1936550BA1D9254ED833B2E",
        height: 11628601,
        prevState: "EvmState",
        prevTxHash: "0xdb03f0cb45506b7725cf04c62035b38a8362a51bc15e24b3706cbc45a17ef27d",
        nextState: "OraichainState",
        eventNonce: 63870,
        batchNonce: 0,
        txId: 0,
        evmChainPrefix: "oraib",
        packetSequence: 18501,
        amount: "17000000000000000000",
        denom: "oraib0x55d398326f99059fF775485246999027B3197955",
        memo: "eth-mainnet0xdAC17F958D2ee523a2206206994597C13D831ec7",
        receiver: "orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd",
        sender: "oraib1ehmhqcn8erf3dgavrca69zgp4rtxj5kql2ul4w",
        srcPort: "transfer",
        srcChannel: "channel-1",
        dstPort: "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm",
        dstChannel: "channel-29",
        status: "FINISHED"
      }
    ]);
    expect(await duckDb.select(DatabaseEnum.Oraichain, { where: { packetSequence: 18501 } })).eql([
      {
        txHash: "1B3720C353EC5CC96AAB086ED210BED751357DE6B54C4AFCD93520EDABF7AE26",
        height: 17585180,
        prevState: "OraiBridgeState",
        prevTxHash: "7A82ABF78DF290B552D377BB002C5628C33F0859E1936550BA1D9254ED833B2E",
        nextState: "OraiBridgeState",
        packetSequence: 18501,
        packetAck: "MQ==",
        sender: "orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd",
        localReceiver: "orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd",
        nextPacketSequence: 21456,
        nextMemo: "eth-mainnet0x0deB52499C2e9F3921c631cb6Ad3522C576d5484",
        nextAmount: "1106616",
        nextReceiver: "oraib1ehmhqcn8erf3dgavrca69zgp4rtxj5kql2ul4w",
        nextDestinationDenom:
          "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm/channel-29/eth-mainnet0xdAC17F958D2ee523a2206206994597C13D831ec7",
        srcChannel: "channel-29",
        dstChannel: "channel-1",
        status: "FINISHED"
      }
    ]);
    expect(await duckDb.select(DatabaseEnum.OraiBridge, { where: { packetSequence: 21456 } })).eql([
      {
        txHash: "6A7A880277AE9CD0BAAA71FF9CD7127FC39B8E5AFD1B2F33F7016D117D7F0F55",
        height: 11628606,
        prevState: "OraichainState",
        prevTxHash: "1B3720C353EC5CC96AAB086ED210BED751357DE6B54C4AFCD93520EDABF7AE26",
        nextState: "EvmState",
        eventNonce: 6501,
        batchNonce: 4127,
        txId: 4197,
        evmChainPrefix: "eth-mainnet",
        packetSequence: 21456,
        amount: "1106616",
        denom:
          "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm/channel-29/eth-mainnet0xdAC17F958D2ee523a2206206994597C13D831ec7",
        memo: "eth-mainnet0x0deB52499C2e9F3921c631cb6Ad3522C576d5484",
        receiver: "oraib1ehmhqcn8erf3dgavrca69zgp4rtxj5kql2ul4w",
        sender: "orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm",
        srcPort: "transfer",
        srcChannel: "channel-1",
        dstPort: "",
        dstChannel: "",
        status: "FINISHED"
      }
    ]);
    expect(await duckDb.select(DatabaseEnum.Evm, { where: { eventNonce: 6501, evmChainPrefix: "eth-mainnet" } })).eql([
      {
        txHash: "",
        height: 0,
        prevState: "OraiBridgeState",
        prevTxHash: "6A7A880277AE9CD0BAAA71FF9CD7127FC39B8E5AFD1B2F33F7016D117D7F0F55",
        nextState: "",
        destination: "",
        fromAmount: "0",
        oraiBridgeChannelId: "",
        oraiReceiver: "",
        destinationDenom: "",
        destinationChannelId: "",
        destinationReceiver: "0x0deB52499C2e9F3921c631cb6Ad3522C576d5484",
        eventNonce: 6501,
        evmChainPrefix: "eth-mainnet",
        status: "FINISHED"
      }
    ]);

    const intepreterCount = im.getIntepreter(0);
    expect(intepreterCount.status).eql(InterpreterStatus.Stopped);
  }).timeout(60000);

  it("[EVM->Oraichain] testing timeout on missing event", async () => {
    const ethEvent = new EthEvent(evmHandler);
    const gravity = ethEvent.listenToEthEvent(
      owner.provider,
      "0xb40C364e70bbD98E8aaab707A41a52A2eAF5733f",
      EvmChainPrefix.BSC_MAINNET
    );
    gravity.emit("SendToCosmosEvent", ...SendToCosmosDataEvm2Oraichain);
    // TODO: how to wait for emit event to finish then start the next
    await setTimeout(sleepTimeMs);
    const oraiBridgeEvent = new OraiBridgeEvent(oraibridgeHandler, "localhost:26657");
    await oraiBridgeEvent.connectCosmosSocket([autoForwardTag]);
    const oraiEvent = new OraichainEvent(oraichainHandler, "localhost:26657");
    await oraiEvent.connectCosmosSocket([onRecvPacketTag]);
    await setTimeout(20000);

    // TEST DATA
    expect(
      await duckDb.select(DatabaseEnum.Evm, {
        where: { txHash: "0xf55ed0825f55f18bd6ae618127e8cc0d889cc3253442ebe88c9280d669ebafb4" }
      })
    ).eql([
      {
        txHash: "0xf55ed0825f55f18bd6ae618127e8cc0d889cc3253442ebe88c9280d669ebafb4",
        height: 37469703,
        prevState: "",
        prevTxHash: "",
        nextState: "OraiBridgeState",
        destination:
          "channel-1/orai1rqhjqpaqrv26wuq627gav3ka4994u39e84lncy:CitvcmFpMXJxaGpxcGFxcnYyNnd1cTYyN2dhdjNrYTQ5OTR1MzllODRsbmN5EgAaK29yYWkxMmh6anhmaDc3d2w1NzJnZHpjdDJmeHYyYXJ4Y3doNmd5a2M3cWg=",
        fromAmount: "1783597583898563052",
        oraiBridgeChannelId: "channel-1",
        oraiReceiver: "orai1rqhjqpaqrv26wuq627gav3ka4994u39e84lncy",
        destinationDenom: "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh",
        destinationChannelId: "",
        destinationReceiver: "orai1rqhjqpaqrv26wuq627gav3ka4994u39e84lncy",
        eventNonce: 63593,
        evmChainPrefix: "oraib",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.OraiBridge, {
        where: {
          packetSequence: 18337
        }
      })
    ).eql([
      {
        txHash: "7CB195EFA9178EC2A1E06F8DCE1D4CEC7A760B0EFC4605E0FBFC87E999FD8B22",
        height: 11498709,
        prevState: "EvmState",
        prevTxHash: "0xf55ed0825f55f18bd6ae618127e8cc0d889cc3253442ebe88c9280d669ebafb4",
        nextState: "OraichainState",
        eventNonce: 63593,
        batchNonce: 0,
        txId: 0,
        evmChainPrefix: "oraib",
        packetSequence: 18337,
        amount: "1783597583898563052",
        denom: "oraib0x55d398326f99059fF775485246999027B3197955",
        memo: "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh",
        receiver: "orai1rqhjqpaqrv26wuq627gav3ka4994u39e84lncy",
        sender: "oraib1rqhjqpaqrv26wuq627gav3ka4994u39es5mlf8",
        srcPort: "transfer",
        srcChannel: "channel-1",
        dstPort: "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm",
        dstChannel: "channel-29",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.Oraichain, {
        where: {
          packetSequence: 18337
        }
      })
    ).eql([
      {
        txHash: "D8A6224EAB18B0195E7C26C567403F8481FCFB714C84636E4404592B1849F51C",
        height: 17439082,
        prevState: "OraiBridgeState",
        prevTxHash: "7CB195EFA9178EC2A1E06F8DCE1D4CEC7A760B0EFC4605E0FBFC87E999FD8B22",
        nextState: "",
        packetSequence: 18337,
        packetAck: "MQ==",
        sender: "",
        localReceiver: "orai1rqhjqpaqrv26wuq627gav3ka4994u39e84lncy",
        nextPacketSequence: 0,
        nextMemo: "",
        nextAmount: "0",
        nextReceiver: "",
        nextDestinationDenom: "",
        srcChannel: "channel-29",
        dstChannel: "",
        status: "FINISHED"
      }
    ]);

    const intepreterCount = im.getIntepreter(0);
    expect(intepreterCount.status).eql(InterpreterStatus.Stopped);
  }).timeout(60000);

  it("[EVM->Cosmos] testing time-out case", async () => {
    const ethEvent = new EthEvent(evmHandler);
    const gravity = ethEvent.listenToEthEvent(
      owner.provider,
      "0xb40C364e70bbD98E8aaab707A41a52A2eAF5733f",
      EvmChainPrefix.BSC_MAINNET
    );
    gravity.emit("SendToCosmosEvent", ...SendToCosmosDataEvm2Cosmos);
    // TODO: how to wait for emit event to finish then start the next
    await setTimeout(sleepTimeMs);
    const oraiBridgeEvent = new OraiBridgeEvent(oraibridgeHandler, "localhost:26657");
    await oraiBridgeEvent.connectCosmosSocket([autoForwardTag]);
    const oraiEvent = new OraichainEvent(oraichainHandler, "localhost:26657");
    await oraiEvent.connectCosmosSocket([onRecvPacketTag, onAcknowledgementTag]);
    await setTimeout(30000);

    // Test Data
    expect(
      await duckDb.select(DatabaseEnum.Evm, {
        where: {
          txHash: "0xe551efd736461673ee952881c49923d2bb4fba538aa1771775d4d5bc02f97c8f"
        }
      })
    ).eql([
      {
        txHash: "0xe551efd736461673ee952881c49923d2bb4fba538aa1771775d4d5bc02f97c8f",
        height: 37505362,
        prevState: "",
        prevTxHash: "",
        nextState: "OraiBridgeState",
        destination:
          "channel-1/orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd:Ci1jb3Ntb3MxZWhtaHFjbjhlcmYzZGdhdnJjYTY5emdwNHJ0eGo1a3FtY3dzOTcSCmNoYW5uZWwtMTUaBXVhdG9t",
        fromAmount: "3000000000000000000",
        oraiBridgeChannelId: "channel-1",
        oraiReceiver: "orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd",
        destinationDenom: "uatom",
        destinationChannelId: "channel-15",
        destinationReceiver: "cosmos1ehmhqcn8erf3dgavrca69zgp4rtxj5kqmcws97",
        eventNonce: 63759,
        evmChainPrefix: "oraib",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.OraiBridge, {
        where: {
          eventNonce: 63759,
          evmChainPrefix: "oraib"
        },
        pagination: {
          limit: 1
        }
      })
    ).eql([
      {
        txHash: "7B1817348D6629758A56F2EDC45677F2E77A99850A60D363606E6ABC92A71428",
        height: 11570695,
        prevState: "EvmState",
        prevTxHash: "0xe551efd736461673ee952881c49923d2bb4fba538aa1771775d4d5bc02f97c8f",
        nextState: "OraichainState",
        eventNonce: 63759,
        batchNonce: 0,
        txId: 0,
        evmChainPrefix: "oraib",
        packetSequence: 18434,
        amount: "3000000000000000000",
        denom: "oraib0x55d398326f99059fF775485246999027B3197955",
        memo: "uatom",
        receiver: "orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd",
        sender: "oraib1ehmhqcn8erf3dgavrca69zgp4rtxj5kql2ul4w",
        srcPort: "transfer",
        srcChannel: "channel-1",
        dstPort: "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm",
        dstChannel: "channel-29",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.Oraichain, {
        where: {
          packetSequence: 18434
        }
      })
    ).eql([
      {
        txHash: "10A17F2AFC8D959272C038B5E2ECB39F26C62BD9EC44E76ED3D2F8B58AE863B2",
        height: 17519455,
        prevState: "OraiBridgeState",
        prevTxHash: "7B1817348D6629758A56F2EDC45677F2E77A99850A60D363606E6ABC92A71428",
        nextState: "",
        packetSequence: 18434,
        packetAck: "MQ==",
        sender: "orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd",
        localReceiver: "orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd",
        nextPacketSequence: 48599,
        nextMemo: "",
        nextAmount: "140410",
        nextReceiver: "cosmos1ehmhqcn8erf3dgavrca69zgp4rtxj5kqmcws97",
        nextDestinationDenom: "transfer/channel-15/uatom",
        srcChannel: "channel-15",
        dstChannel: "channel-301",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.Cosmos, {
        where: {
          prevTxHash: "10A17F2AFC8D959272C038B5E2ECB39F26C62BD9EC44E76ED3D2F8B58AE863B2"
        }
      })
    ).to.eql([
      {
        txHash: "",
        height: 0,
        prevState: "OraichainState",
        prevTxHash: "10A17F2AFC8D959272C038B5E2ECB39F26C62BD9EC44E76ED3D2F8B58AE863B2",
        packetSequence: 48599,
        nextState: "",
        srcPort: "transfer",
        srcChannel: "channel-301",
        dstPort: "",
        dstChannel: "",
        status: "FINISHED",
        sender: "orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm",
        receiver: "cosmos1ehmhqcn8erf3dgavrca69zgp4rtxj5kqmcws97",
        denom: "transfer/channel-15/uatom",
        amount: "140410",
        memo: "",
        chainId: "cosmoshub-4"
      }
    ]);

    const intepreterCount = im.getIntepreter(0);
    expect(intepreterCount.status).eql(InterpreterStatus.Stopped);
  }).timeout(45000);

  it("[Cosmos->EVM] testing time-out case", async () => {
    cosmosHandler.handleEvent([
      {
        txEvent: IbcTransferTxDataC2E,
        chainId: COSMOS_CHAIN_ID_COMMON.COSMOSHUB_CHAIN_ID
      }
    ]);
    await setTimeout(30000);
    // Test data test
    expect(
      await duckDb.select(DatabaseEnum.Cosmos, {
        where: {
          packetSequence: 64277
        }
      })
    ).eql([
      {
        txHash: "9EBDB3009802EEF7B85B0E64BD1CD20E3F05849C4918B241F3DD0649A07F2F36",
        height: 19897012,
        chainId: "cosmoshub-4",
        prevState: "",
        prevTxHash: "",
        nextState: "OraichainState",
        packetSequence: 64277,
        amount: "300000",
        denom: "uatom",
        memo: '{"wasm":{"contract":"orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm","msg":{"ibc_hooks_receive":{"func":"universal_swap","args":"ChTN93BiZ8jTFqOsHjuiiQGo1mlSwBIvb3JhaWIweDBkZUI1MjQ5OUMyZTlGMzkyMWM2MzFjYjZBZDM1MjJDNTc2ZDU0ODQaCmNoYW5uZWwtMjkiL29yYWliMHg1NWQzOTgzMjZmOTkwNTlmRjc3NTQ4NTI0Njk5OTAyN0IzMTk3OTU1"}}}}',
        receiver: "orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm",
        sender: "cosmos1ehmhqcn8erf3dgavrca69zgp4rtxj5kqmcws97",
        srcPort: "transfer",
        srcChannel: "channel-301",
        dstPort: "transfer",
        dstChannel: "channel-15",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.Oraichain, {
        where: {
          packetSequence: 64277
        }
      })
    ).eql([
      {
        txHash: "52FF42B92483D5BB85D876120E0BB60F728A5CD87BCDA4FBE44A1C79632592DA",
        height: 17854166,
        prevState: "CosmosState",
        prevTxHash: "9EBDB3009802EEF7B85B0E64BD1CD20E3F05849C4918B241F3DD0649A07F2F36",
        nextState: "OraiBridgeState",
        packetSequence: 64277,
        packetAck: "",
        sender: "cosmos1ehmhqcn8erf3dgavrca69zgp4rtxj5kqmcws97",
        localReceiver: "orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm",
        nextPacketSequence: 21698,
        nextMemo: "oraib0x0deB52499C2e9F3921c631cb6Ad3522C576d5484",
        nextAmount: "1940789000000000000",
        nextReceiver: "oraib1ehmhqcn8erf3dgavrca69zgp4rtxj5kql2ul4w",
        nextDestinationDenom:
          "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm/channel-29/oraib0x55d398326f99059fF775485246999027B3197955",
        status: "FINISHED",
        srcChannel: "channel-29",
        dstChannel: "channel-1"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.OraiBridge, {
        where: {
          packetSequence: 21698
        }
      })
    ).eql([
      {
        txHash: "4E5F68FB9D3355DC115B3C1DDEFCFD318D02D33B761A42D1266A4C7092F1BA61",
        height: 11868974,
        prevState: "OraichainState",
        prevTxHash: "52FF42B92483D5BB85D876120E0BB60F728A5CD87BCDA4FBE44A1C79632592DA",
        nextState: "EvmState",
        eventNonce: 64152,
        batchNonce: 31338,
        txId: 33193,
        evmChainPrefix: "oraib",
        packetSequence: 21698,
        amount: "1940789000000000000",
        denom:
          "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm/channel-29/oraib0x55d398326f99059fF775485246999027B3197955",
        memo: "oraib0x0deB52499C2e9F3921c631cb6Ad3522C576d5484",
        receiver: "oraib1ehmhqcn8erf3dgavrca69zgp4rtxj5kql2ul4w",
        sender: "orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm",
        srcPort: "transfer",
        srcChannel: "channel-1",
        dstPort: "",
        dstChannel: "",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.Evm, {
        where: { eventNonce: 64152, evmChainPrefix: "oraib" }
      })
    ).eql([
      {
        txHash: "",
        height: 0,
        prevState: "OraiBridgeState",
        prevTxHash: "4E5F68FB9D3355DC115B3C1DDEFCFD318D02D33B761A42D1266A4C7092F1BA61",
        nextState: "",
        destination: "",
        fromAmount: "0",
        oraiBridgeChannelId: "",
        oraiReceiver: "",
        destinationDenom: "",
        destinationChannelId: "",
        destinationReceiver: "0x0deB52499C2e9F3921c631cb6Ad3522C576d5484",
        eventNonce: 64152,
        evmChainPrefix: "oraib",
        status: "FINISHED"
      }
    ]);

    const intepreterCount = im.getIntepreter(0);
    expect(intepreterCount.status).eql(InterpreterStatus.Stopped);
  }).timeout(45000);

  it("[Oraichain->EVM] testing time-out case", async () => {
    const oraiBridgeEvent = new OraiBridgeEvent(oraibridgeHandler, "localhost:26657");
    await oraiBridgeEvent.connectCosmosSocket([autoForwardTag, requestBatchTag, batchSendToEthClaimTag]);
    const oraiEvent = new OraichainEvent(oraichainHandler, "localhost:26657");
    const oraiStream = await oraiEvent.connectCosmosSocket([onRecvPacketTag, onExecuteContractTag]);
    await setTimeout(sleepTimeMs);
    oraiStream.shamefullySendNext(unmarshalTxEvent(TransferBackToRemoteTxDataO2E));
    await setTimeout(30000);

    // Test Data
    expect(
      await duckDb.select(DatabaseEnum.Oraichain, {
        where: {
          packetSequence: 21688
        }
      })
    ).eql([
      {
        txHash: "EF7A547A72190EAFF43001E878697CA9C845A12746223340384899FC635E67FC",
        height: 17843438,
        prevState: "",
        prevTxHash: "",
        nextState: "OraiBridgeState",
        packetSequence: 21688,
        packetAck: "",
        sender: "orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd",
        localReceiver: "orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd",
        srcChannel: "channel-29",
        dstChannel: "channel-1",
        nextPacketSequence: 21688,
        nextMemo: "oraib0x0deB52499C2e9F3921c631cb6Ad3522C576d5484",
        nextAmount: "1388829000000000000",
        nextReceiver: "oraib1ehmhqcn8erf3dgavrca69zgp4rtxj5kql2ul4w",
        nextDestinationDenom:
          "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm/channel-29/oraib0x55d398326f99059fF775485246999027B3197955",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.OraiBridge, {
        where: {
          packetSequence: 21688
        }
      })
    ).eql([
      {
        txHash: "FBEE176EDB37A5620CA0FF47BB40FEFEB67FFDA111656701C4C9A457A2720230",
        height: 11859231,
        prevState: "OraichainState",
        prevTxHash: "EF7A547A72190EAFF43001E878697CA9C845A12746223340384899FC635E67FC",
        nextState: "EvmState",
        eventNonce: 64140,
        batchNonce: 31330,
        txId: 33185,
        evmChainPrefix: "oraib",
        packetSequence: 21688,
        amount: "1388829000000000000",
        denom:
          "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm/channel-29/oraib0x55d398326f99059fF775485246999027B3197955",
        memo: "oraib0x0deB52499C2e9F3921c631cb6Ad3522C576d5484",
        receiver: "oraib1ehmhqcn8erf3dgavrca69zgp4rtxj5kql2ul4w",
        sender: "orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd",
        srcPort: "transfer",
        srcChannel: "channel-1",
        dstPort: "",
        dstChannel: "",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.Evm, {
        where: {
          eventNonce: 64140,
          evmChainPrefix: "oraib"
        }
      })
    ).eql([
      {
        txHash: "",
        height: 0,
        prevState: "OraiBridgeState",
        prevTxHash: "FBEE176EDB37A5620CA0FF47BB40FEFEB67FFDA111656701C4C9A457A2720230",
        nextState: "",
        destination: "",
        fromAmount: "0",
        oraiBridgeChannelId: "",
        oraiReceiver: "",
        destinationDenom: "",
        destinationChannelId: "",
        destinationReceiver: "0x0deB52499C2e9F3921c631cb6Ad3522C576d5484",
        eventNonce: 64140,
        evmChainPrefix: "oraib",
        status: "FINISHED"
      }
    ]);

    const intepreterCount = im.getIntepreter(0);
    expect(intepreterCount.status).eql(InterpreterStatus.Stopped);
  }).timeout(45000);
});
