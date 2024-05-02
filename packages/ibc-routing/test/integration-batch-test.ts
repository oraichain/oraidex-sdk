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
  IbcTransferTxData1 as IbcTransferTxData1C2E,
  IbcTransferTxData2 as IbcTransferTxData2C2E,
  OnRecvPacketOraiBridgeTxData as OnRecvPacketOraiBridgeTxDataC2E,
  OnRecvPacketOraichainTxData as OnRecvPacketOraichainTxDataC2E,
  OnRequestBatchTxData as OnRequestBatchTxDataC2E
} from "./data/batch/cosmos-to-evm";
import {
  OnAcknowledgementTxData as OnAcknowledgementTxDataEvm2Cosmos,
  OnRecvPacketTxData as OnRecvPacketTxDataEvm2Cosmos,
  OraiBridgeAutoForwardTxData as OraiBridgeAutoForwardTxDataEvm2Cosmos,
  SendToCosmosData1 as SendToCosmosDataEvm2Cosmos1,
  SendToCosmosData2 as SendToCosmosDataEvm2Cosmos2
} from "./data/batch/evm-to-cosmos";
import {
  BatchSendToEthClaimTxData as BatchSendToEthClaimTxDataEvm2Evm,
  OnRecvPacketOraiBridgeTxData as OnRecvPacketOraiBridgeTxDataEvm2Evm,
  OnRecvPacketOraichainTxData as OnRecvPacketOraichainTxDataEvm2Evm,
  OnRequestBatchTxData as OnRequestBatchTxDataEvm2Evm,
  OraiBridgeAutoForwardTxData as OraiBridgeAutoForwardTxDataEvm2Evm,
  SendToCosmosData1 as SendToCosmosDataEvm2Evm1,
  SendToCosmosData2 as SendToCosmosDataEvm2Evm2
} from "./data/batch/evm-to-evm";
import {
  OnRecvPacketTxData as OnRecvPacketTxDataEvm2Oraichain,
  OraiBridgeAutoForwardTxData as OraiBridgeAutoForwardTxDataEvm2Oraichain,
  SendToCosmosData1 as SendToCosmosDataEvm2Oraichain1,
  SendToCosmosData2 as SendToCosmosDataEvm2Oraichain2
} from "./data/batch/evm-to-oraichain";
import {
  BatchSendToEthClaimTxData as BatchSendToEthClaimTxDataO2E,
  OnRecvPacketTxData as OnRecvPacketTxDataO2E,
  OnRequestBatchTxData as OnRequestBatchTxDataO2E,
  TransferBackToRemoteTxData1 as TransferBackToRemoteTxData1O2E,
  TransferBackToRemoteTxData2 as TransferBackToRemoteTxData2O2E
} from "./data/batch/oraichain-to-evm";
const sleepTimeMs = 300;

// TODO: at each testcase, i should test the final stored database to make it more concise
describe("test-batch-integration", () => {
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
    const ethEvent = new EthEvent(evmHandler);
    const gravity = ethEvent.listenToEthEvent(
      owner.provider,
      "0xb40C364e70bbD98E8aaab707A41a52A2eAF5733f",
      EvmChainPrefix.BSC_MAINNET
    );
    gravity.emit("SendToCosmosEvent", ...SendToCosmosDataEvm2Oraichain1);
    gravity.emit("SendToCosmosEvent", ...SendToCosmosDataEvm2Oraichain2);
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
    await (async () => {
      const interpreter = createEvmIntepreter(duckDb);
      const actor = interpreter._inner.start();
      interpreter._inner.send({
        type: invokableMachineStateKeys.QUERY_IBC_ROUTING_DATA,
        payload: {
          txHash: "0x4f857ebe31d8e0e73757796052c7c2736495bda7f854824e1a8185139e31decc",
          evmChainPrefix: EvmChainPrefix.BSC_MAINNET
        }
      });
      const doneState = await waitFor(actor, (state) => state.done);
      console.log("done state: ", doneState.context.routingQueryData);
      const queryKeys = doneState.context.routingQueryData.map((item) => item.type);
      expect(queryKeys.length).eq(3);
      expect(queryKeys[0]).eq(DatabaseEnum.Evm);
      expect(queryKeys[1]).eq(DatabaseEnum.OraiBridge);
      expect(queryKeys[2]).eq(DatabaseEnum.Oraichain);
    })();
    await (async () => {
      const interpreter = createEvmIntepreter(duckDb);
      const actor = interpreter._inner.start();
      interpreter._inner.send({
        type: invokableMachineStateKeys.QUERY_IBC_ROUTING_DATA,
        payload: {
          txHash: "0xf80b880b1f302fd4e94be7d4c98e2f331cfe3744b4b02e55e606a79a7c400d18",
          evmChainPrefix: EvmChainPrefix.BSC_MAINNET
        }
      });
      const doneState = await waitFor(actor, (state) => state.done);
      console.log("done state: ", doneState.context.routingQueryData);
      const queryKeys = doneState.context.routingQueryData.map((item) => item.type);
      expect(queryKeys.length).eq(3);
      expect(queryKeys[0]).eq(DatabaseEnum.Evm);
      expect(queryKeys[1]).eq(DatabaseEnum.OraiBridge);
      expect(queryKeys[2]).eq(DatabaseEnum.Oraichain);
    })();
  });

  it("[EVM->Oraichain] full-flow happy test", async () => {
    const ethEvent = new EthEvent(evmHandler);
    const gravity = ethEvent.listenToEthEvent(
      owner.provider,
      "0xb40C364e70bbD98E8aaab707A41a52A2eAF5733f",
      EvmChainPrefix.BSC_MAINNET
    );
    gravity.emit("SendToCosmosEvent", ...SendToCosmosDataEvm2Oraichain1);
    gravity.emit("SendToCosmosEvent", ...SendToCosmosDataEvm2Oraichain2);
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

    expect(
      await duckDb.select(DatabaseEnum.Evm, {
        where: {
          txHash: "0x4f857ebe31d8e0e73757796052c7c2736495bda7f854824e1a8185139e31decc"
        }
      })
    ).eql([
      {
        txHash: "0x4f857ebe31d8e0e73757796052c7c2736495bda7f854824e1a8185139e31decc",
        height: 38194529,
        prevState: "",
        prevTxHash: "",
        nextState: "OraiBridgeState",
        destination:
          "channel-1/orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd:CitvcmFpMWVobWhxY244ZXJmM2RnYXZyY2E2OXpncDRydHhqNWtxZ3RjbnlkEgAaAA==",
        fromAmount: "3484735000000000000",
        oraiBridgeChannelId: "channel-1",
        oraiReceiver: "orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd",
        destinationDenom: "",
        destinationChannelId: "",
        destinationReceiver: "orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd",
        eventNonce: 65355,
        evmChainPrefix: "oraib",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.Evm, {
        where: {
          txHash: "0xf80b880b1f302fd4e94be7d4c98e2f331cfe3744b4b02e55e606a79a7c400d18"
        }
      })
    ).eql([
      {
        txHash: "0xf80b880b1f302fd4e94be7d4c98e2f331cfe3744b4b02e55e606a79a7c400d18",
        height: 38194529,
        prevState: "",
        prevTxHash: "",
        nextState: "OraiBridgeState",
        destination:
          "channel-1/orai1rqhjqpaqrv26wuq627gav3ka4994u39e84lncy:CitvcmFpMXJxaGpxcGFxcnYyNnd1cTYyN2dhdjNrYTQ5OTR1MzllODRsbmN5EgAaAA==",
        fromAmount: "2154324000000000000",
        oraiBridgeChannelId: "channel-1",
        oraiReceiver: "orai1rqhjqpaqrv26wuq627gav3ka4994u39e84lncy",
        destinationDenom: "",
        destinationChannelId: "",
        destinationReceiver: "orai1rqhjqpaqrv26wuq627gav3ka4994u39e84lncy",
        eventNonce: 65356,
        evmChainPrefix: "oraib",
        status: "FINISHED"
      }
    ]);
    // ORAIBRIDGE
    expect(
      await duckDb.select(DatabaseEnum.OraiBridge, {
        where: {
          eventNonce: 65355
        }
      })
    ).eql([
      {
        txHash: "16416F42BB94346E859D09036E18AC78F85FF509F3617CF648FED5B406ECC785",
        height: 12961046,
        prevState: "EvmState",
        prevTxHash: "0x4f857ebe31d8e0e73757796052c7c2736495bda7f854824e1a8185139e31decc",
        nextState: "OraichainState",
        eventNonce: 65355,
        batchNonce: 0,
        txId: 0,
        evmChainPrefix: "oraib",
        packetSequence: 19320,
        amount: "3484735000000000000",
        denom: "oraib0x55d398326f99059fF775485246999027B3197955",
        memo: "",
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
      await duckDb.select(DatabaseEnum.OraiBridge, {
        where: {
          eventNonce: 65356
        }
      })
    ).eql([
      {
        txHash: "16416F42BB94346E859D09036E18AC78F85FF509F3617CF648FED5B406ECC785",
        height: 12961046,
        prevState: "EvmState",
        prevTxHash: "0xf80b880b1f302fd4e94be7d4c98e2f331cfe3744b4b02e55e606a79a7c400d18",
        nextState: "OraichainState",
        eventNonce: 65356,
        batchNonce: 0,
        txId: 0,
        evmChainPrefix: "oraib",
        packetSequence: 19321,
        amount: "2154324000000000000",
        denom: "oraib0x55d398326f99059fF775485246999027B3197955",
        memo: "",
        receiver: "orai1rqhjqpaqrv26wuq627gav3ka4994u39e84lncy",
        sender: "oraib1rqhjqpaqrv26wuq627gav3ka4994u39es5mlf8",
        srcPort: "transfer",
        srcChannel: "channel-1",
        dstPort: "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm",
        dstChannel: "channel-29",
        status: "FINISHED"
      }
    ]);
    // ORAICHAIN
    expect(
      await duckDb.select(DatabaseEnum.Oraichain, {
        where: {
          packetSequence: 19320
        }
      })
    ).eql([
      {
        txHash: "B1468B5DEEE12C4205820DE26DAE977B24A8C3EC163B27F889B3A746C690651F",
        height: 19088216,
        prevState: "OraiBridgeState",
        prevTxHash: "16416F42BB94346E859D09036E18AC78F85FF509F3617CF648FED5B406ECC785",
        nextState: "",
        packetSequence: 19320,
        packetAck: "MQ==",
        sender: "",
        localReceiver: "orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd",
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
    expect(
      await duckDb.select(DatabaseEnum.Oraichain, {
        where: {
          packetSequence: 19321
        }
      })
    ).eql([
      {
        txHash: "B1468B5DEEE12C4205820DE26DAE977B24A8C3EC163B27F889B3A746C690651F",
        height: 19088216,
        prevState: "OraiBridgeState",
        prevTxHash: "16416F42BB94346E859D09036E18AC78F85FF509F3617CF648FED5B406ECC785",
        nextState: "",
        packetSequence: 19321,
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

    const intepreterCount1 = im.getIntepreter(0)._inner;
    expect(intepreterCount1.status).eql(InterpreterStatus.Stopped);
    const intepreterCount2 = im.getIntepreter(1)._inner;
    expect(intepreterCount2.status).eql(InterpreterStatus.Stopped);
  });

  it("[EVM->Cosmos] query happy test", async () => {
    const ethEvent = new EthEvent(evmHandler);
    const gravity = ethEvent.listenToEthEvent(
      owner.provider,
      "0xb40C364e70bbD98E8aaab707A41a52A2eAF5733f",
      EvmChainPrefix.BSC_MAINNET
    );
    gravity.emit("SendToCosmosEvent", ...SendToCosmosDataEvm2Cosmos1);
    gravity.emit("SendToCosmosEvent", ...SendToCosmosDataEvm2Cosmos2);
    // TODO: how to wait for emit event to finish then start the next
    await setTimeout(sleepTimeMs);
    const oraiBridgeEvent = new OraiBridgeEvent(oraibridgeHandler, "localhost:26657");
    const stream = await oraiBridgeEvent.connectCosmosSocket([autoForwardTag]);
    const oraiEvent = new OraichainEvent(oraichainHandler, "localhost:26657");
    const oraiStream = await oraiEvent.connectCosmosSocket([onRecvPacketTag]);
    // has to convert back to bytes because javascript object is not friendly with Uint8Array
    stream.shamefullySendNext(unmarshalTxEvent(OraiBridgeAutoForwardTxDataEvm2Cosmos));
    await setTimeout(sleepTimeMs);
    oraiStream.shamefullySendNext(unmarshalTxEvent(OnRecvPacketTxDataEvm2Cosmos));
    await setTimeout(sleepTimeMs);
    oraiStream.shamefullySendNext(unmarshalTxEvent(OnAcknowledgementTxDataEvm2Cosmos));
    await setTimeout(sleepTimeMs);

    await (async () => {
      const interpreter = createEvmIntepreter(duckDb);
      const actor = interpreter._inner.start();
      interpreter._inner.send({
        type: invokableMachineStateKeys.QUERY_IBC_ROUTING_DATA,
        payload: {
          txHash: "0xe2a7936af07fccca94da0f8f33d4e74418fcc5dc6c651ca3187fa4437d6eb402",
          evmChainPrefix: EvmChainPrefix.BSC_MAINNET
        }
      });
      const doneState = await waitFor(actor, (state) => state.done);
      console.log("done state: ", doneState.context.routingQueryData);
      const queryKeys = doneState.context.routingQueryData.map((item) => item.type);
      expect(queryKeys.length).eq(4);
      expect(queryKeys[0]).eq(DatabaseEnum.Evm);
      expect(queryKeys[1]).eq(DatabaseEnum.OraiBridge);
      expect(queryKeys[2]).eq(DatabaseEnum.Oraichain);
      expect(queryKeys[3]).eq(DatabaseEnum.Cosmos);
    })();
    await (async () => {
      const interpreter = createEvmIntepreter(duckDb);
      const actor = interpreter._inner.start();
      interpreter._inner.send({
        type: invokableMachineStateKeys.QUERY_IBC_ROUTING_DATA,
        payload: {
          txHash: "0x6cf401683f3afbca5130d6d35795e473dab2cda63e8021e94bf6ca498303b267",
          evmChainPrefix: EvmChainPrefix.BSC_MAINNET
        }
      });
      const doneState = await waitFor(actor, (state) => state.done);
      console.log("done state: ", doneState.context.routingQueryData);
      const queryKeys = doneState.context.routingQueryData.map((item) => item.type);
      expect(queryKeys.length).eq(4);
      expect(queryKeys[0]).eq(DatabaseEnum.Evm);
      expect(queryKeys[1]).eq(DatabaseEnum.OraiBridge);
      expect(queryKeys[2]).eq(DatabaseEnum.Oraichain);
      expect(queryKeys[3]).eq(DatabaseEnum.Cosmos);
    })();
  });

  it("[EVM->Cosmos] full-flow happy test", async () => {
    const ethEvent = new EthEvent(evmHandler);
    const gravity = ethEvent.listenToEthEvent(
      owner.provider,
      "0xb40C364e70bbD98E8aaab707A41a52A2eAF5733f",
      EvmChainPrefix.BSC_MAINNET
    );
    gravity.emit("SendToCosmosEvent", ...SendToCosmosDataEvm2Cosmos1);
    gravity.emit("SendToCosmosEvent", ...SendToCosmosDataEvm2Cosmos2);
    // TODO: how to wait for emit event to finish then start the next
    await setTimeout(sleepTimeMs);
    const oraiBridgeEvent = new OraiBridgeEvent(oraibridgeHandler, "localhost:26657");
    const stream = await oraiBridgeEvent.connectCosmosSocket([autoForwardTag]);
    const oraiEvent = new OraichainEvent(oraichainHandler, "localhost:26657");
    const oraiStream = await oraiEvent.connectCosmosSocket([onRecvPacketTag]);
    // has to convert back to bytes because javascript object is not friendly with Uint8Array
    stream.shamefullySendNext(unmarshalTxEvent(OraiBridgeAutoForwardTxDataEvm2Cosmos));
    await setTimeout(sleepTimeMs);
    oraiStream.shamefullySendNext(unmarshalTxEvent(OnRecvPacketTxDataEvm2Cosmos));
    await setTimeout(sleepTimeMs);
    oraiStream.shamefullySendNext(unmarshalTxEvent(OnAcknowledgementTxDataEvm2Cosmos));
    await setTimeout(sleepTimeMs);

    expect(
      await duckDb.select(DatabaseEnum.Evm, {
        where: {
          txHash: "0xe2a7936af07fccca94da0f8f33d4e74418fcc5dc6c651ca3187fa4437d6eb402"
        }
      })
    ).eql([
      {
        txHash: "0xe2a7936af07fccca94da0f8f33d4e74418fcc5dc6c651ca3187fa4437d6eb402",
        height: 38317410,
        prevState: "",
        prevTxHash: "",
        nextState: "OraiBridgeState",
        destination:
          "channel-1/orai1rchnkdpsxzhquu63y6r4j4t57pnc9w8ehdhedx:Ci1jb3Ntb3MxcmNobmtkcHN4emhxdXU2M3k2cjRqNHQ1N3BuYzl3OGV5N3A2djQSCmNoYW5uZWwtMTUaBXVhdG9t",
        fromAmount: "3000000000000000000",
        oraiBridgeChannelId: "channel-1",
        oraiReceiver: "orai1rchnkdpsxzhquu63y6r4j4t57pnc9w8ehdhedx",
        destinationDenom: "uatom",
        destinationChannelId: "channel-15",
        destinationReceiver: "cosmos1rchnkdpsxzhquu63y6r4j4t57pnc9w8ey7p6v4",
        eventNonce: 65539,
        evmChainPrefix: "oraib",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.Evm, {
        where: {
          txHash: "0x6cf401683f3afbca5130d6d35795e473dab2cda63e8021e94bf6ca498303b267"
        }
      })
    ).eql([
      {
        txHash: "0x6cf401683f3afbca5130d6d35795e473dab2cda63e8021e94bf6ca498303b267",
        height: 38317410,
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
        eventNonce: 65540,
        evmChainPrefix: "oraib",
        status: "FINISHED"
      }
    ]);
    // ORAIBRIDGE
    expect(
      await duckDb.select(DatabaseEnum.OraiBridge, {
        where: {
          txHash: "3E6E9DFCF7560FFD9EF0AE4D7AF5D5B0D617D85AA82242C693C7CDA80297DB30",
          packetSequence: 19401
        }
      })
    ).eql([
      {
        txHash: "3E6E9DFCF7560FFD9EF0AE4D7AF5D5B0D617D85AA82242C693C7CDA80297DB30",
        height: 13209293,
        prevState: "EvmState",
        prevTxHash: "0xe2a7936af07fccca94da0f8f33d4e74418fcc5dc6c651ca3187fa4437d6eb402",
        nextState: "OraichainState",
        eventNonce: 65539,
        batchNonce: 0,
        txId: 0,
        evmChainPrefix: "oraib",
        packetSequence: 19401,
        amount: "3000000000000000000",
        denom: "oraib0x55d398326f99059fF775485246999027B3197955",
        memo: "uatom",
        receiver: "orai1rchnkdpsxzhquu63y6r4j4t57pnc9w8ehdhedx",
        sender: "oraib1rchnkdpsxzhquu63y6r4j4t57pnc9w8eqvn4u9",
        srcPort: "transfer",
        srcChannel: "channel-1",
        dstPort: "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm",
        dstChannel: "channel-29",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.OraiBridge, {
        where: {
          txHash: "3E6E9DFCF7560FFD9EF0AE4D7AF5D5B0D617D85AA82242C693C7CDA80297DB30",
          packetSequence: 19402
        }
      })
    ).eql([
      {
        txHash: "3E6E9DFCF7560FFD9EF0AE4D7AF5D5B0D617D85AA82242C693C7CDA80297DB30",
        height: 13209293,
        prevState: "EvmState",
        prevTxHash: "0x6cf401683f3afbca5130d6d35795e473dab2cda63e8021e94bf6ca498303b267",
        nextState: "OraichainState",
        eventNonce: 65540,
        batchNonce: 0,
        txId: 0,
        evmChainPrefix: "oraib",
        packetSequence: 19402,
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
    // Oraichain
    expect(
      await duckDb.select(DatabaseEnum.Oraichain, {
        where: {
          txHash: "E522853FA3A5C0B6FF21F6FEC04B5B6B05C7A636D5F4352D19CDE18CA20D19AF",
          packetSequence: 19401
        }
      })
    ).eql([
      {
        txHash: "E522853FA3A5C0B6FF21F6FEC04B5B6B05C7A636D5F4352D19CDE18CA20D19AF",
        height: 19508309,
        prevState: "OraiBridgeState",
        prevTxHash: "3E6E9DFCF7560FFD9EF0AE4D7AF5D5B0D617D85AA82242C693C7CDA80297DB30",
        nextState: "",
        packetSequence: 19401,
        packetAck: "MQ==",
        sender: "orai1rchnkdpsxzhquu63y6r4j4t57pnc9w8ehdhedx",
        localReceiver: "orai1rchnkdpsxzhquu63y6r4j4t57pnc9w8ehdhedx",
        nextPacketSequence: 50440,
        nextMemo: "",
        nextAmount: "261948",
        nextReceiver: "cosmos1rchnkdpsxzhquu63y6r4j4t57pnc9w8ey7p6v4",
        nextDestinationDenom: "transfer/channel-15/uatom",
        srcChannel: "channel-15",
        dstChannel: "channel-301",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.Oraichain, {
        where: {
          txHash: "E522853FA3A5C0B6FF21F6FEC04B5B6B05C7A636D5F4352D19CDE18CA20D19AF",
          packetSequence: 19402
        }
      })
    ).eql([
      {
        txHash: "E522853FA3A5C0B6FF21F6FEC04B5B6B05C7A636D5F4352D19CDE18CA20D19AF",
        height: 19508309,
        prevState: "OraiBridgeState",
        prevTxHash: "3E6E9DFCF7560FFD9EF0AE4D7AF5D5B0D617D85AA82242C693C7CDA80297DB30",
        nextState: "",
        packetSequence: 19402,
        packetAck: "MQ==",
        sender: "orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd",
        localReceiver: "orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd",
        nextPacketSequence: 50439,
        nextMemo: "",
        nextAmount: "261948",
        nextReceiver: "cosmos1ehmhqcn8erf3dgavrca69zgp4rtxj5kqmcws97",
        nextDestinationDenom: "transfer/channel-15/uatom",
        srcChannel: "channel-15",
        dstChannel: "channel-301",
        status: "FINISHED"
      }
    ]);
    // COSMOS
    expect(
      await duckDb.select(DatabaseEnum.Cosmos, {
        where: {
          packetSequence: 50439
        }
      })
    ).eql([
      {
        txHash: "",
        height: 0,
        prevState: "OraichainState",
        prevTxHash: "E522853FA3A5C0B6FF21F6FEC04B5B6B05C7A636D5F4352D19CDE18CA20D19AF",
        packetSequence: 50439,
        nextState: "",
        srcPort: "transfer",
        srcChannel: "channel-301",
        dstPort: "",
        dstChannel: "",
        status: "FINISHED",
        sender: "orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm",
        receiver: "cosmos1ehmhqcn8erf3dgavrca69zgp4rtxj5kqmcws97",
        denom: "transfer/channel-15/uatom",
        amount: "261948",
        memo: "",
        chainId: "cosmoshub-4"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.Cosmos, {
        where: {
          packetSequence: 50440
        }
      })
    ).eql([
      {
        txHash: "",
        height: 0,
        prevState: "OraichainState",
        prevTxHash: "E522853FA3A5C0B6FF21F6FEC04B5B6B05C7A636D5F4352D19CDE18CA20D19AF",
        packetSequence: 50440,
        nextState: "",
        srcPort: "transfer",
        srcChannel: "channel-301",
        dstPort: "",
        dstChannel: "",
        status: "FINISHED",
        sender: "orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm",
        receiver: "cosmos1rchnkdpsxzhquu63y6r4j4t57pnc9w8ey7p6v4",
        denom: "transfer/channel-15/uatom",
        amount: "261948",
        memo: "",
        chainId: "cosmoshub-4"
      }
    ]);

    const intepreterCount1 = im.getIntepreter(0)._inner;
    expect(intepreterCount1.status).eql(InterpreterStatus.Stopped);
    const intepreterCount2 = im.getIntepreter(1)._inner;
    expect(intepreterCount2.status).eql(InterpreterStatus.Stopped);
  });

  it("[EVM->EVM] query happy test", async () => {
    const ethEvent = new EthEvent(evmHandler);
    const gravity = ethEvent.listenToEthEvent(
      owner.provider,
      "0xb40C364e70bbD98E8aaab707A41a52A2eAF5733f",
      EvmChainPrefix.BSC_MAINNET
    );
    gravity.emit("SendToCosmosEvent", ...SendToCosmosDataEvm2Evm1);
    gravity.emit("SendToCosmosEvent", ...SendToCosmosDataEvm2Evm2);
    // TODO: how to wait for emit event to finish then start the next
    await setTimeout(sleepTimeMs);
    const oraiBridgeEvent = new OraiBridgeEvent(oraibridgeHandler, "localhost:26657");
    const obStream = await oraiBridgeEvent.connectCosmosSocket([autoForwardTag]);
    const oraiEvent = new OraichainEvent(oraichainHandler, "localhost:26657");
    const oraiStream = await oraiEvent.connectCosmosSocket([onRecvPacketTag]);
    // has to convert back to bytes because javascript object is not friendly with Uint8Array
    obStream.shamefullySendNext(unmarshalTxEvent(OraiBridgeAutoForwardTxDataEvm2Evm));
    await setTimeout(sleepTimeMs);
    oraiStream.shamefullySendNext(unmarshalTxEvent(OnRecvPacketOraichainTxDataEvm2Evm));
    await setTimeout(sleepTimeMs);
    obStream.shamefullySendNext(unmarshalTxEvent(OnRecvPacketOraiBridgeTxDataEvm2Evm));
    await setTimeout(sleepTimeMs);
    obStream.shamefullySendNext(unmarshalTxEvent(OnRequestBatchTxDataEvm2Evm));
    await setTimeout(sleepTimeMs);
    obStream.shamefullySendNext(unmarshalTxEvent(BatchSendToEthClaimTxDataEvm2Evm));
    await setTimeout(sleepTimeMs);

    await (async () => {
      const interpreter = createEvmIntepreter(duckDb);
      const actor = interpreter._inner.start();
      interpreter._inner.send({
        type: invokableMachineStateKeys.QUERY_IBC_ROUTING_DATA,
        payload: {
          txHash: "0x1d41acf070f7a6c164857f5971ddd344a4a734a33ae09c411e3c80a9e2b8628a",
          evmChainPrefix: EvmChainPrefix.BSC_MAINNET
        }
      });
      const doneState = await waitFor(actor, (state) => state.done);
      console.log("done state: ", doneState.context.routingQueryData);
      const queryKeys = doneState.context.routingQueryData.map((item) => item.type);
      expect(queryKeys.length).eq(5);
      expect(queryKeys[0]).eq(DatabaseEnum.Evm);
      expect(queryKeys[1]).eq(DatabaseEnum.OraiBridge);
      expect(queryKeys[2]).eq(DatabaseEnum.Oraichain);
      expect(queryKeys[3]).eq(DatabaseEnum.OraiBridge);
      expect(queryKeys[4]).eq(DatabaseEnum.Evm);
    })();
    await (async () => {
      const interpreter = createEvmIntepreter(duckDb);
      const actor = interpreter._inner.start();
      interpreter._inner.send({
        type: invokableMachineStateKeys.QUERY_IBC_ROUTING_DATA,
        payload: {
          txHash: "0x5b9be0596126de413c41bf6793fae3de8cfbea14a385932667a10eea3d4c1512",
          evmChainPrefix: EvmChainPrefix.BSC_MAINNET
        }
      });
      const doneState = await waitFor(actor, (state) => state.done);
      console.log("done state: ", doneState.context.routingQueryData);
      const queryKeys = doneState.context.routingQueryData.map((item) => item.type);
      expect(queryKeys.length).eq(5);
      expect(queryKeys[0]).eq(DatabaseEnum.Evm);
      expect(queryKeys[1]).eq(DatabaseEnum.OraiBridge);
      expect(queryKeys[2]).eq(DatabaseEnum.Oraichain);
      expect(queryKeys[3]).eq(DatabaseEnum.OraiBridge);
      expect(queryKeys[4]).eq(DatabaseEnum.Evm);
    })();

    const intepreterCount1 = im.getIntepreter(0)._inner;
    expect(intepreterCount1.status).eql(InterpreterStatus.Stopped);
    const intepreterCount2 = im.getIntepreter(1)._inner;
    expect(intepreterCount2.status).eql(InterpreterStatus.Stopped);
  });

  it("[EVM->EVM] full-flow happy test", async () => {
    const ethEvent = new EthEvent(evmHandler);
    const gravity = ethEvent.listenToEthEvent(
      owner.provider,
      "0xb40C364e70bbD98E8aaab707A41a52A2eAF5733f",
      EvmChainPrefix.BSC_MAINNET
    );
    gravity.emit("SendToCosmosEvent", ...SendToCosmosDataEvm2Evm1);
    gravity.emit("SendToCosmosEvent", ...SendToCosmosDataEvm2Evm2);
    // TODO: how to wait for emit event to finish then start the next
    await setTimeout(sleepTimeMs);
    const oraiBridgeEvent = new OraiBridgeEvent(oraibridgeHandler, "localhost:26657");
    const obStream = await oraiBridgeEvent.connectCosmosSocket([autoForwardTag]);
    const oraiEvent = new OraichainEvent(oraichainHandler, "localhost:26657");
    const oraiStream = await oraiEvent.connectCosmosSocket([onRecvPacketTag]);
    // has to convert back to bytes because javascript object is not friendly with Uint8Array
    obStream.shamefullySendNext(unmarshalTxEvent(OraiBridgeAutoForwardTxDataEvm2Evm));
    await setTimeout(sleepTimeMs);
    oraiStream.shamefullySendNext(unmarshalTxEvent(OnRecvPacketOraichainTxDataEvm2Evm));
    await setTimeout(sleepTimeMs);
    obStream.shamefullySendNext(unmarshalTxEvent(OnRecvPacketOraiBridgeTxDataEvm2Evm));
    await setTimeout(sleepTimeMs);
    obStream.shamefullySendNext(unmarshalTxEvent(OnRequestBatchTxDataEvm2Evm));
    await setTimeout(sleepTimeMs);
    obStream.shamefullySendNext(unmarshalTxEvent(BatchSendToEthClaimTxDataEvm2Evm));
    await setTimeout(sleepTimeMs);

    // EVM
    expect(
      await duckDb.select(DatabaseEnum.Evm, {
        where: {
          txHash: "0x5b9be0596126de413c41bf6793fae3de8cfbea14a385932667a10eea3d4c1512"
        }
      })
    ).eql([
      {
        txHash: "0x5b9be0596126de413c41bf6793fae3de8cfbea14a385932667a10eea3d4c1512",
        height: 38318558,
        prevState: "",
        prevTxHash: "",
        nextState: "OraiBridgeState",
        destination:
          "channel-1/orai1rchnkdpsxzhquu63y6r4j4t57pnc9w8ehdhedx:CjVldGgtbWFpbm5ldDB4YjFBREU4NDU2NmRCMTE3QjRCMjQxZkM0NDZjZWIxYzQ2NjE2ZTE3MhIKY2hhbm5lbC0yORo1ZXRoLW1haW5uZXQweGRBQzE3Rjk1OEQyZWU1MjNhMjIwNjIwNjk5NDU5N0MxM0Q4MzFlYzc=",
        fromAmount: "13000000000000000000",
        oraiBridgeChannelId: "channel-1",
        oraiReceiver: "orai1rchnkdpsxzhquu63y6r4j4t57pnc9w8ehdhedx",
        destinationDenom: "eth-mainnet0xdAC17F958D2ee523a2206206994597C13D831ec7",
        destinationChannelId: "channel-29",
        destinationReceiver: "eth-mainnet0xb1ADE84566dB117B4B241fC446ceb1c46616e172",
        eventNonce: 65545,
        evmChainPrefix: "oraib",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.Evm, {
        where: {
          txHash: "0x1d41acf070f7a6c164857f5971ddd344a4a734a33ae09c411e3c80a9e2b8628a"
        }
      })
    ).eql([
      {
        txHash: "0x1d41acf070f7a6c164857f5971ddd344a4a734a33ae09c411e3c80a9e2b8628a",
        height: 38318558,
        prevState: "",
        prevTxHash: "",
        nextState: "OraiBridgeState",
        destination:
          "channel-1/orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd:CjVldGgtbWFpbm5ldDB4MGRlQjUyNDk5QzJlOUYzOTIxYzYzMWNiNkFkMzUyMkM1NzZkNTQ4NBIKY2hhbm5lbC0yORo1ZXRoLW1haW5uZXQweGRBQzE3Rjk1OEQyZWU1MjNhMjIwNjIwNjk5NDU5N0MxM0Q4MzFlYzc=",
        fromAmount: "15000000000000000000",
        oraiBridgeChannelId: "channel-1",
        oraiReceiver: "orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd",
        destinationDenom: "eth-mainnet0xdAC17F958D2ee523a2206206994597C13D831ec7",
        destinationChannelId: "channel-29",
        destinationReceiver: "eth-mainnet0x0deB52499C2e9F3921c631cb6Ad3522C576d5484",
        eventNonce: 65546,
        evmChainPrefix: "oraib",
        status: "FINISHED"
      }
    ]);
    // OraiBridge
    expect(
      await duckDb.select(DatabaseEnum.OraiBridge, {
        where: {
          txHash: "62ED77318512AC4F26D168B49147CA38A13538F212D01575002D37C3BF947DBB",
          packetSequence: 19403
        }
      })
    ).eql([
      {
        txHash: "62ED77318512AC4F26D168B49147CA38A13538F212D01575002D37C3BF947DBB",
        height: 13211573,
        prevState: "EvmState",
        prevTxHash: "0x5b9be0596126de413c41bf6793fae3de8cfbea14a385932667a10eea3d4c1512",
        nextState: "OraichainState",
        eventNonce: 65545,
        batchNonce: 0,
        txId: 0,
        evmChainPrefix: "oraib",
        packetSequence: 19403,
        amount: "13000000000000000000",
        denom: "oraib0x55d398326f99059fF775485246999027B3197955",
        memo: "eth-mainnet0xdAC17F958D2ee523a2206206994597C13D831ec7",
        receiver: "orai1rchnkdpsxzhquu63y6r4j4t57pnc9w8ehdhedx",
        sender: "oraib1rchnkdpsxzhquu63y6r4j4t57pnc9w8eqvn4u9",
        srcPort: "transfer",
        srcChannel: "channel-1",
        dstPort: "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm",
        dstChannel: "channel-29",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.OraiBridge, {
        where: {
          txHash: "62ED77318512AC4F26D168B49147CA38A13538F212D01575002D37C3BF947DBB",
          packetSequence: 19404
        }
      })
    ).eql([
      {
        txHash: "62ED77318512AC4F26D168B49147CA38A13538F212D01575002D37C3BF947DBB",
        height: 13211573,
        prevState: "EvmState",
        prevTxHash: "0x1d41acf070f7a6c164857f5971ddd344a4a734a33ae09c411e3c80a9e2b8628a",
        nextState: "OraichainState",
        eventNonce: 65546,
        batchNonce: 0,
        txId: 0,
        evmChainPrefix: "oraib",
        packetSequence: 19404,
        amount: "15000000000000000000",
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
    // Oraichain
    expect(
      await duckDb.select(DatabaseEnum.Oraichain, {
        where: {
          txHash: "920DD08567842D3B9C927C0C56CA584082B3DCD8C38229CD55820D3FBED04ED6",
          packetSequence: 19403
        }
      })
    ).eql([
      {
        txHash: "920DD08567842D3B9C927C0C56CA584082B3DCD8C38229CD55820D3FBED04ED6",
        height: 19512334,
        prevState: "OraiBridgeState",
        prevTxHash: "62ED77318512AC4F26D168B49147CA38A13538F212D01575002D37C3BF947DBB",
        nextState: "OraiBridgeState",
        packetSequence: 19403,
        packetAck: "MQ==",
        sender: "orai1rchnkdpsxzhquu63y6r4j4t57pnc9w8ehdhedx",
        localReceiver: "orai1rchnkdpsxzhquu63y6r4j4t57pnc9w8ehdhedx",
        nextPacketSequence: 22780,
        nextMemo: "eth-mainnet0xb1ADE84566dB117B4B241fC446ceb1c46616e172",
        nextAmount: "2442556",
        nextReceiver: "oraib1rchnkdpsxzhquu63y6r4j4t57pnc9w8eqvn4u9",
        nextDestinationDenom:
          "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm/channel-29/eth-mainnet0xdAC17F958D2ee523a2206206994597C13D831ec7",
        srcChannel: "channel-29",
        dstChannel: "channel-1",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.Oraichain, {
        where: {
          txHash: "920DD08567842D3B9C927C0C56CA584082B3DCD8C38229CD55820D3FBED04ED6",
          packetSequence: 19404
        }
      })
    ).eql([
      {
        txHash: "920DD08567842D3B9C927C0C56CA584082B3DCD8C38229CD55820D3FBED04ED6",
        height: 19512334,
        prevState: "OraiBridgeState",
        prevTxHash: "62ED77318512AC4F26D168B49147CA38A13538F212D01575002D37C3BF947DBB",
        nextState: "OraiBridgeState",
        packetSequence: 19404,
        packetAck: "MQ==",
        sender: "orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd",
        localReceiver: "orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd",
        nextPacketSequence: 22781,
        nextMemo: "eth-mainnet0x0deB52499C2e9F3921c631cb6Ad3522C576d5484",
        nextAmount: "4438556",
        nextReceiver: "oraib1ehmhqcn8erf3dgavrca69zgp4rtxj5kql2ul4w",
        nextDestinationDenom:
          "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm/channel-29/eth-mainnet0xdAC17F958D2ee523a2206206994597C13D831ec7",
        srcChannel: "channel-29",
        dstChannel: "channel-1",
        status: "FINISHED"
      }
    ]);
    // ORAIBRIDGE
    expect(
      await duckDb.select(DatabaseEnum.OraiBridge, {
        where: {
          txHash: "8979A718511CF608EB7C3AC2368D666F58414649923322589D71D1DC27EEF05A",
          txId: 4456
        }
      })
    ).eql([
      {
        txHash: "8979A718511CF608EB7C3AC2368D666F58414649923322589D71D1DC27EEF05A",
        height: 13211578,
        prevState: "OraichainState",
        prevTxHash: "920DD08567842D3B9C927C0C56CA584082B3DCD8C38229CD55820D3FBED04ED6",
        nextState: "EvmState",
        eventNonce: 6954,
        batchNonce: 4385,
        txId: 4456,
        evmChainPrefix: "eth-mainnet",
        packetSequence: 22780,
        amount: "2442556",
        denom:
          "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm/channel-29/eth-mainnet0xdAC17F958D2ee523a2206206994597C13D831ec7",
        memo: "eth-mainnet0xb1ADE84566dB117B4B241fC446ceb1c46616e172",
        receiver: "oraib1rchnkdpsxzhquu63y6r4j4t57pnc9w8eqvn4u9",
        sender: "orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm",
        srcPort: "transfer",
        srcChannel: "channel-1",
        dstPort: "",
        dstChannel: "",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.OraiBridge, {
        where: {
          txHash: "8979A718511CF608EB7C3AC2368D666F58414649923322589D71D1DC27EEF05A",
          txId: 4457
        }
      })
    ).eql([
      {
        txHash: "8979A718511CF608EB7C3AC2368D666F58414649923322589D71D1DC27EEF05A",
        height: 13211578,
        prevState: "OraichainState",
        prevTxHash: "920DD08567842D3B9C927C0C56CA584082B3DCD8C38229CD55820D3FBED04ED6",
        nextState: "EvmState",
        eventNonce: 6954,
        batchNonce: 4385,
        txId: 4457,
        evmChainPrefix: "eth-mainnet",
        packetSequence: 22781,
        amount: "4438556",
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
    // EVM
    expect(
      await duckDb.select(DatabaseEnum.Evm, {
        where: {
          destinationReceiver: "0xb1ADE84566dB117B4B241fC446ceb1c46616e172",
          eventNonce: 6954
        }
      })
    ).eql([
      {
        txHash: "",
        height: 0,
        prevState: "OraiBridgeState",
        prevTxHash: "8979A718511CF608EB7C3AC2368D666F58414649923322589D71D1DC27EEF05A",
        nextState: "",
        destination: "",
        fromAmount: "2442556",
        oraiBridgeChannelId: "",
        oraiReceiver: "",
        destinationDenom: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        destinationChannelId: "",
        destinationReceiver: "0xb1ADE84566dB117B4B241fC446ceb1c46616e172",
        eventNonce: 6954,
        evmChainPrefix: "eth-mainnet",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.Evm, {
        where: {
          destinationReceiver: "0x0deB52499C2e9F3921c631cb6Ad3522C576d5484",
          eventNonce: 6954
        }
      })
    ).eql([
      {
        txHash: "",
        height: 0,
        prevState: "OraiBridgeState",
        prevTxHash: "8979A718511CF608EB7C3AC2368D666F58414649923322589D71D1DC27EEF05A",
        nextState: "",
        destination: "",
        fromAmount: "4438556",
        oraiBridgeChannelId: "",
        oraiReceiver: "",
        destinationDenom: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        destinationChannelId: "",
        destinationReceiver: "0x0deB52499C2e9F3921c631cb6Ad3522C576d5484",
        eventNonce: 6954,
        evmChainPrefix: "eth-mainnet",
        status: "FINISHED"
      }
    ]);

    const intepreterCount1 = im.getIntepreter(0)._inner;
    expect(intepreterCount1.status).eql(InterpreterStatus.Stopped);
    const intepreterCount2 = im.getIntepreter(1)._inner;
    expect(intepreterCount2.status).eql(InterpreterStatus.Stopped);
  });

  it("[Cosmos->EVM] query happy", async () => {
    const oraiBridgeEvent = new OraiBridgeEvent(oraibridgeHandler, "localhost:26657");
    const oraiBridgeStream = await oraiBridgeEvent.connectCosmosSocket([
      autoForwardTag,
      requestBatchTag,
      batchSendToEthClaimTag
    ]);
    const oraiEvent = new OraichainEvent(oraichainHandler, "localhost:26657");
    cosmosHandler.handleEvent([
      {
        txEvent: IbcTransferTxData1C2E,
        chainId: COSMOS_CHAIN_ID_COMMON.COSMOSHUB_CHAIN_ID
      }
    ]);
    cosmosHandler.handleEvent([
      {
        txEvent: IbcTransferTxData2C2E,
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

    await (async () => {
      const interpreter = createCosmosIntepreter(duckDb);
      const actor = interpreter._inner.start();
      interpreter._inner.send({
        type: invokableMachineStateKeys.QUERY_IBC_ROUTING_DATA,
        payload: {
          txHash: "DFEBDFE952C113936AA1F7CE63966C9076F54EB061C51A7C9A134607E1E6ADF6",
          chainId: COSMOS_CHAIN_ID_COMMON.COSMOSHUB_CHAIN_ID
        }
      });
      const doneState = await waitFor(actor, (state) => state.done);
      console.log("done state: ", doneState.context.routingQueryData);
      const queryKeys = doneState.context.routingQueryData.map((item) => item.type);
      expect(queryKeys.length).eq(4);
      expect(queryKeys[0]).eq(DatabaseEnum.Cosmos);
      expect(queryKeys[1]).eq(DatabaseEnum.Oraichain);
      expect(queryKeys[2]).eq(DatabaseEnum.OraiBridge);
      expect(queryKeys[3]).eq(DatabaseEnum.Evm);
    })();
    await (async () => {
      const interpreter = createCosmosIntepreter(duckDb);
      const actor = interpreter._inner.start();
      interpreter._inner.send({
        type: invokableMachineStateKeys.QUERY_IBC_ROUTING_DATA,
        payload: {
          txHash: "DB75E50D97C904D258C8683F97DFAF1334081E6FCB1702A03BBC9D05509AF40B",
          chainId: COSMOS_CHAIN_ID_COMMON.COSMOSHUB_CHAIN_ID
        }
      });
      const doneState = await waitFor(actor, (state) => state.done);
      console.log("done state: ", doneState.context.routingQueryData);
      const queryKeys = doneState.context.routingQueryData.map((item) => item.type);
      expect(queryKeys.length).eq(4);
      expect(queryKeys[0]).eq(DatabaseEnum.Cosmos);
      expect(queryKeys[1]).eq(DatabaseEnum.Oraichain);
      expect(queryKeys[2]).eq(DatabaseEnum.OraiBridge);
      expect(queryKeys[3]).eq(DatabaseEnum.Evm);
    })();
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
        txEvent: IbcTransferTxData1C2E,
        chainId: COSMOS_CHAIN_ID_COMMON.COSMOSHUB_CHAIN_ID
      }
    ]);
    cosmosHandler.handleEvent([
      {
        txEvent: IbcTransferTxData2C2E,
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

    // COSMOS
    expect(
      await duckDb.select(DatabaseEnum.Cosmos, {
        where: {
          txHash: "DFEBDFE952C113936AA1F7CE63966C9076F54EB061C51A7C9A134607E1E6ADF6"
        }
      })
    ).eql([
      {
        txHash: "DFEBDFE952C113936AA1F7CE63966C9076F54EB061C51A7C9A134607E1E6ADF6",
        height: 20226577,
        chainId: "cosmoshub-4",
        prevState: "",
        prevTxHash: "",
        nextState: "OraichainState",
        packetSequence: 65362,
        amount: "1587568",
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
      await duckDb.select(DatabaseEnum.Cosmos, {
        where: {
          txHash: "DB75E50D97C904D258C8683F97DFAF1334081E6FCB1702A03BBC9D05509AF40B"
        }
      })
    ).eql([
      {
        txHash: "DB75E50D97C904D258C8683F97DFAF1334081E6FCB1702A03BBC9D05509AF40B",
        height: 20226577,
        chainId: "cosmoshub-4",
        prevState: "",
        prevTxHash: "",
        nextState: "OraichainState",
        packetSequence: 65363,
        amount: "274039",
        denom: "uatom",
        memo: '{"wasm":{"contract":"orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm","msg":{"ibc_hooks_receive":{"func":"universal_swap","args":"ChQeLzs0MDCuDnNRJodZVXTwZ4K4+RIvb3JhaWIweGIxQURFODQ1NjZkQjExN0I0QjI0MWZDNDQ2Y2ViMWM0NjYxNmUxNzIaCmNoYW5uZWwtMjkiL29yYWliMHg1NWQzOTgzMjZmOTkwNTlmRjc3NTQ4NTI0Njk5OTAyN0IzMTk3OTU1"}}}}',
        receiver: "orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm",
        sender: "cosmos1rchnkdpsxzhquu63y6r4j4t57pnc9w8ey7p6v4",
        srcPort: "transfer",
        srcChannel: "channel-301",
        dstPort: "transfer",
        dstChannel: "channel-15",
        status: "FINISHED"
      }
    ]);
    // ORAICHAIN
    expect(
      await duckDb.select(DatabaseEnum.Oraichain, {
        where: {
          txHash: "72BD571D1047F1A2162E272199AE3D93317E485111491D0AB63AE52390F7AB1A",
          packetSequence: 65362
        }
      })
    ).eql([
      {
        txHash: "72BD571D1047F1A2162E272199AE3D93317E485111491D0AB63AE52390F7AB1A",
        height: 19505710,
        prevState: "CosmosState",
        prevTxHash: "DFEBDFE952C113936AA1F7CE63966C9076F54EB061C51A7C9A134607E1E6ADF6",
        nextState: "OraiBridgeState",
        packetSequence: 65362,
        packetAck: "",
        sender: "cosmos1ehmhqcn8erf3dgavrca69zgp4rtxj5kqmcws97",
        localReceiver: "orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm",
        nextPacketSequence: 22773,
        nextMemo: "oraib0x0deB52499C2e9F3921c631cb6Ad3522C576d5484",
        nextAmount: "11370620000000000000",
        nextReceiver: "oraib1ehmhqcn8erf3dgavrca69zgp4rtxj5kql2ul4w",
        nextDestinationDenom:
          "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm/channel-29/oraib0x55d398326f99059fF775485246999027B3197955",
        srcChannel: "channel-29",
        dstChannel: "channel-1",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.Oraichain, {
        where: {
          txHash: "72BD571D1047F1A2162E272199AE3D93317E485111491D0AB63AE52390F7AB1A",
          packetSequence: 65363
        }
      })
    ).eql([
      {
        txHash: "72BD571D1047F1A2162E272199AE3D93317E485111491D0AB63AE52390F7AB1A",
        height: 19505710,
        prevState: "CosmosState",
        prevTxHash: "DB75E50D97C904D258C8683F97DFAF1334081E6FCB1702A03BBC9D05509AF40B",
        nextState: "OraiBridgeState",
        packetSequence: 65363,
        packetAck: "",
        sender: "cosmos1rchnkdpsxzhquu63y6r4j4t57pnc9w8ey7p6v4",
        localReceiver: "orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm",
        nextPacketSequence: 22774,
        nextMemo: "oraib0xb1ADE84566dB117B4B241fC446ceb1c46616e172",
        nextAmount: "1166126000000000000",
        nextReceiver: "oraib1rchnkdpsxzhquu63y6r4j4t57pnc9w8eqvn4u9",
        nextDestinationDenom:
          "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm/channel-29/oraib0x55d398326f99059fF775485246999027B3197955",
        srcChannel: "channel-29",
        dstChannel: "channel-1",
        status: "FINISHED"
      }
    ]);
    // ORAIBRIDGE
    expect(
      await duckDb.select(DatabaseEnum.OraiBridge, {
        where: {
          txHash: "DE564B9FE14D60F583CFA7AE3F5B4A14AE004D434F6329EC6307D6B70F30DF1C",
          packetSequence: 22773
        }
      })
    ).eql([
      {
        txHash: "DE564B9FE14D60F583CFA7AE3F5B4A14AE004D434F6329EC6307D6B70F30DF1C",
        height: 13207849,
        prevState: "OraichainState",
        prevTxHash: "72BD571D1047F1A2162E272199AE3D93317E485111491D0AB63AE52390F7AB1A",
        nextState: "EvmState",
        eventNonce: 65538,
        batchNonce: 32179,
        txId: 34055,
        evmChainPrefix: "oraib",
        packetSequence: 22773,
        amount: "11370620000000000000",
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
      await duckDb.select(DatabaseEnum.OraiBridge, {
        where: {
          txHash: "DE564B9FE14D60F583CFA7AE3F5B4A14AE004D434F6329EC6307D6B70F30DF1C",
          packetSequence: 22774
        }
      })
    ).eql([
      {
        txHash: "DE564B9FE14D60F583CFA7AE3F5B4A14AE004D434F6329EC6307D6B70F30DF1C",
        height: 13207849,
        prevState: "OraichainState",
        prevTxHash: "72BD571D1047F1A2162E272199AE3D93317E485111491D0AB63AE52390F7AB1A",
        nextState: "EvmState",
        eventNonce: 65538,
        batchNonce: 32179,
        txId: 34056,
        evmChainPrefix: "oraib",
        packetSequence: 22774,
        amount: "1166126000000000000",
        denom:
          "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm/channel-29/oraib0x55d398326f99059fF775485246999027B3197955",
        memo: "oraib0xb1ADE84566dB117B4B241fC446ceb1c46616e172",
        receiver: "oraib1rchnkdpsxzhquu63y6r4j4t57pnc9w8eqvn4u9",
        sender: "orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm",
        srcPort: "transfer",
        srcChannel: "channel-1",
        dstPort: "",
        dstChannel: "",
        status: "FINISHED"
      }
    ]);
    // EVM
    expect(
      await duckDb.select(DatabaseEnum.Evm, {
        where: {
          destinationReceiver: "0x0deB52499C2e9F3921c631cb6Ad3522C576d5484",
          eventNonce: 65538
        }
      })
    ).eql([
      {
        txHash: "",
        height: 0,
        prevState: "OraiBridgeState",
        prevTxHash: "DE564B9FE14D60F583CFA7AE3F5B4A14AE004D434F6329EC6307D6B70F30DF1C",
        nextState: "",
        destination: "",
        fromAmount: "11370620000000000000",
        oraiBridgeChannelId: "",
        oraiReceiver: "",
        destinationDenom: "0x55d398326f99059fF775485246999027B3197955",
        destinationChannelId: "",
        destinationReceiver: "0x0deB52499C2e9F3921c631cb6Ad3522C576d5484",
        eventNonce: 65538,
        evmChainPrefix: "oraib",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.Evm, {
        where: {
          destinationReceiver: "0xb1ADE84566dB117B4B241fC446ceb1c46616e172",
          eventNonce: 65538
        }
      })
    ).eql([
      {
        txHash: "",
        height: 0,
        prevState: "OraiBridgeState",
        prevTxHash: "DE564B9FE14D60F583CFA7AE3F5B4A14AE004D434F6329EC6307D6B70F30DF1C",
        nextState: "",
        destination: "",
        fromAmount: "1166126000000000000",
        oraiBridgeChannelId: "",
        oraiReceiver: "",
        destinationDenom: "0x55d398326f99059fF775485246999027B3197955",
        destinationChannelId: "",
        destinationReceiver: "0xb1ADE84566dB117B4B241fC446ceb1c46616e172",
        eventNonce: 65538,
        evmChainPrefix: "oraib",
        status: "FINISHED"
      }
    ]);

    const intepreterCount1 = im.getIntepreter(0)._inner;
    expect(intepreterCount1.status).eql(InterpreterStatus.Stopped);
    const intepreterCount2 = im.getIntepreter(1)._inner;
    expect(intepreterCount2.status).eql(InterpreterStatus.Stopped);
  });

  it("[Oraichain->EVM] query happy", async () => {
    const oraiBridgeEvent = new OraiBridgeEvent(oraibridgeHandler, "localhost:26657");
    const oraiBridgeStream = await oraiBridgeEvent.connectCosmosSocket([
      autoForwardTag,
      requestBatchTag,
      batchSendToEthClaimTag
    ]);
    const oraiEvent = new OraichainEvent(oraichainHandler, "localhost:26657");
    const oraiStream = await oraiEvent.connectCosmosSocket([onRecvPacketTag, onExecuteContractTag]);
    await setTimeout(sleepTimeMs);
    oraiStream.shamefullySendNext(unmarshalTxEvent(TransferBackToRemoteTxData1O2E));
    oraiStream.shamefullySendNext(unmarshalTxEvent(TransferBackToRemoteTxData2O2E));
    await setTimeout(sleepTimeMs);
    oraiBridgeStream.shamefullySendNext(unmarshalTxEvent(OnRecvPacketTxDataO2E));
    await setTimeout(sleepTimeMs);
    oraiBridgeStream.shamefullySendNext(unmarshalTxEvent(OnRequestBatchTxDataO2E));
    await setTimeout(sleepTimeMs);
    oraiBridgeStream.shamefullySendNext(unmarshalTxEvent(BatchSendToEthClaimTxDataO2E));
    await setTimeout(sleepTimeMs);

    // action. Create a new interpreter and try to invoke the query flow
    await (async () => {
      const interpreter = createOraichainIntepreter(duckDb);
      const actor = interpreter._inner.start();
      interpreter._inner.send({
        type: invokableMachineStateKeys.QUERY_IBC_ROUTING_DATA,
        payload: {
          txHash: TransferBackToRemoteTxData1O2E.hash,
          evmChainPrefix: EvmChainPrefix.BSC_MAINNET
        }
      });
      const doneState = await waitFor(actor, (state) => state.done);
      console.log("done state: ", doneState.context.routingQueryData);
      const queryKeys = doneState.context.routingQueryData.map((item) => item.type);
      expect(queryKeys.length).eq(3);
      expect(queryKeys[0]).eq(DatabaseEnum.Oraichain);
      expect(queryKeys[1]).eq(DatabaseEnum.OraiBridge);
      expect(queryKeys[2]).eq(DatabaseEnum.Evm);
    })();
    await (async () => {
      const interpreter = createOraichainIntepreter(duckDb);
      const actor = interpreter._inner.start();
      interpreter._inner.send({
        type: invokableMachineStateKeys.QUERY_IBC_ROUTING_DATA,
        payload: {
          txHash: TransferBackToRemoteTxData2O2E.hash
        }
      });
      const doneState = await waitFor(actor, (state) => state.done);
      console.log("done state: ", doneState.context.routingQueryData);
      const queryKeys = doneState.context.routingQueryData.map((item) => item.type);
      expect(queryKeys.length).eq(3);
      expect(queryKeys[0]).eq(DatabaseEnum.Oraichain);
      expect(queryKeys[1]).eq(DatabaseEnum.OraiBridge);
      expect(queryKeys[2]).eq(DatabaseEnum.Evm);
    })();
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
    oraiStream.shamefullySendNext(unmarshalTxEvent(TransferBackToRemoteTxData1O2E));
    oraiStream.shamefullySendNext(unmarshalTxEvent(TransferBackToRemoteTxData2O2E));
    await setTimeout(sleepTimeMs);
    oraiBridgeStream.shamefullySendNext(unmarshalTxEvent(OnRecvPacketTxDataO2E));
    await setTimeout(sleepTimeMs);
    oraiBridgeStream.shamefullySendNext(unmarshalTxEvent(OnRequestBatchTxDataO2E));
    await setTimeout(sleepTimeMs);
    oraiBridgeStream.shamefullySendNext(unmarshalTxEvent(BatchSendToEthClaimTxDataO2E));
    await setTimeout(sleepTimeMs);

    // Test Data
    // ORAICHAIN
    expect(
      await duckDb.select(DatabaseEnum.Oraichain, {
        where: {
          txHash: "18390B6E2A17BF19A44B9ED8B76F20113969A5AA37F376936C4BE41AD80FFA47",
          packetSequence: 22607
        }
      })
    ).eql([
      {
        txHash: "18390B6E2A17BF19A44B9ED8B76F20113969A5AA37F376936C4BE41AD80FFA47",
        height: 19080362,
        prevState: "",
        prevTxHash: "",
        nextState: "OraiBridgeState",
        packetSequence: 22607,
        packetAck: "",
        sender: "orai1zzdhs7cmfxrpx9mgxysncvpzn3h6tagy39cx0lq6ykz8s29007wq8sxd0t",
        localReceiver: "orai1zzdhs7cmfxrpx9mgxysncvpzn3h6tagy39cx0lq6ykz8s29007wq8sxd0t",
        nextPacketSequence: 22607,
        nextMemo: "oraib0x8163B6142d701E671a7c39aD9C14eB2c0A51aa00",
        nextAmount: "570339000000000000",
        nextReceiver: "oraib1ehmhqcn8erf3dgavrca69zgp4rtxj5kql2ul4w",
        nextDestinationDenom:
          "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm/channel-29/oraib0x55d398326f99059fF775485246999027B3197955",
        srcChannel: "channel-29",
        dstChannel: "channel-1",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.Oraichain, {
        where: {
          txHash: "7E121B8A2DAB36CD4BC8CC4E766C4DD21BF43A5D3FB6F70AEE2C95D0DF93DBBB",
          packetSequence: 22608
        }
      })
    ).eql([
      {
        txHash: "7E121B8A2DAB36CD4BC8CC4E766C4DD21BF43A5D3FB6F70AEE2C95D0DF93DBBB",
        height: 19080362,
        prevState: "",
        prevTxHash: "",
        nextState: "OraiBridgeState",
        packetSequence: 22608,
        packetAck: "",
        sender: "orai1zzdhs7cmfxrpx9mgxysncvpzn3h6tagy39cx0lq6ykz8s29007wq8sxd0t",
        localReceiver: "orai1zzdhs7cmfxrpx9mgxysncvpzn3h6tagy39cx0lq6ykz8s29007wq8sxd0t",
        nextPacketSequence: 22608,
        nextMemo: "oraib0x8163B6142d701E671a7c39aD9C14eB2c0A51aa00",
        nextAmount: "124142000000000000",
        nextReceiver: "oraib1hvr9d72r5um9lvt0rpkd4r75vrsqtw6ytnnvpf",
        nextDestinationDenom:
          "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm/channel-29/oraib0x55d398326f99059fF775485246999027B3197955",
        srcChannel: "channel-29",
        dstChannel: "channel-1",
        status: "FINISHED"
      }
    ]);
    // ORAIBRIDGE
    expect(
      await duckDb.select(DatabaseEnum.OraiBridge, {
        where: {
          txHash: "6FC035DF8F555C502B8706AF5AEE4761E597AAF869E43F1370B9FF02A82D12CC",
          txId: 33922
        }
      })
    ).eql([
      {
        txHash: "6FC035DF8F555C502B8706AF5AEE4761E597AAF869E43F1370B9FF02A82D12CC",
        height: 12955723,
        prevState: "OraichainState",
        prevTxHash: "18390B6E2A17BF19A44B9ED8B76F20113969A5AA37F376936C4BE41AD80FFA47",
        nextState: "EvmState",
        eventNonce: 65347,
        batchNonce: 32048,
        txId: 33922,
        evmChainPrefix: "oraib",
        packetSequence: 22607,
        amount: "570339000000000000",
        denom:
          "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm/channel-29/oraib0x55d398326f99059fF775485246999027B3197955",
        memo: "oraib0x8163B6142d701E671a7c39aD9C14eB2c0A51aa00",
        receiver: "oraib1ehmhqcn8erf3dgavrca69zgp4rtxj5kql2ul4w",
        sender: "orai1zzdhs7cmfxrpx9mgxysncvpzn3h6tagy39cx0lq6ykz8s29007wq8sxd0t",
        srcPort: "transfer",
        srcChannel: "channel-1",
        dstPort: "",
        dstChannel: "",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.OraiBridge, {
        where: {
          txHash: "6FC035DF8F555C502B8706AF5AEE4761E597AAF869E43F1370B9FF02A82D12CC",
          txId: 33923
        }
      })
    ).eql([
      {
        txHash: "6FC035DF8F555C502B8706AF5AEE4761E597AAF869E43F1370B9FF02A82D12CC",
        height: 12955723,
        prevState: "OraichainState",
        prevTxHash: "7E121B8A2DAB36CD4BC8CC4E766C4DD21BF43A5D3FB6F70AEE2C95D0DF93DBBB",
        nextState: "EvmState",
        eventNonce: 65347,
        batchNonce: 32048,
        txId: 33923,
        evmChainPrefix: "oraib",
        packetSequence: 22608,
        amount: "124142000000000000",
        denom:
          "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm/channel-29/oraib0x55d398326f99059fF775485246999027B3197955",
        memo: "oraib0x8163B6142d701E671a7c39aD9C14eB2c0A51aa00",
        receiver: "oraib1hvr9d72r5um9lvt0rpkd4r75vrsqtw6ytnnvpf",
        sender: "orai1zzdhs7cmfxrpx9mgxysncvpzn3h6tagy39cx0lq6ykz8s29007wq8sxd0t",
        srcPort: "transfer",
        srcChannel: "channel-1",
        dstPort: "",
        dstChannel: "",
        status: "FINISHED"
      }
    ]);
    // EVM
    expect(
      await duckDb.select(DatabaseEnum.Evm, {
        where: {
          eventNonce: 65347,
          destinationReceiver: "0x8163B6142d701E671a7c39aD9C14eB2c0A51aa00",
          fromAmount: "570339000000000000"
        }
      })
    ).eql([
      {
        txHash: "",
        height: 0,
        prevState: "OraiBridgeState",
        prevTxHash: "6FC035DF8F555C502B8706AF5AEE4761E597AAF869E43F1370B9FF02A82D12CC",
        nextState: "",
        destination: "",
        fromAmount: "570339000000000000",
        oraiBridgeChannelId: "",
        oraiReceiver: "",
        destinationDenom: "0x55d398326f99059fF775485246999027B3197955",
        destinationChannelId: "",
        destinationReceiver: "0x8163B6142d701E671a7c39aD9C14eB2c0A51aa00",
        eventNonce: 65347,
        evmChainPrefix: "oraib",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.Evm, {
        where: {
          eventNonce: 65347,
          destinationReceiver: "0x8163B6142d701E671a7c39aD9C14eB2c0A51aa00",
          fromAmount: "124142000000000000"
        }
      })
    ).eql([
      {
        txHash: "",
        height: 0,
        prevState: "OraiBridgeState",
        prevTxHash: "6FC035DF8F555C502B8706AF5AEE4761E597AAF869E43F1370B9FF02A82D12CC",
        nextState: "",
        destination: "",
        fromAmount: "124142000000000000",
        oraiBridgeChannelId: "",
        oraiReceiver: "",
        destinationDenom: "0x55d398326f99059fF775485246999027B3197955",
        destinationChannelId: "",
        destinationReceiver: "0x8163B6142d701E671a7c39aD9C14eB2c0A51aa00",
        eventNonce: 65347,
        evmChainPrefix: "oraib",
        status: "FINISHED"
      }
    ]);

    const intepreterCount1 = im.getIntepreter(0)._inner;
    expect(intepreterCount1.status).eql(InterpreterStatus.Stopped);
    const intepreterCount2 = im.getIntepreter(1)._inner;
    expect(intepreterCount2.status).eql(InterpreterStatus.Stopped);
  });
});

describe("test-batch-integration-timeout", () => {
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

  it("[EVM->Oraichain] time-out happy test", async () => {
    const ethEvent = new EthEvent(evmHandler);
    const gravity = ethEvent.listenToEthEvent(
      owner.provider,
      "0xb40C364e70bbD98E8aaab707A41a52A2eAF5733f",
      EvmChainPrefix.BSC_MAINNET
    );
    gravity.emit("SendToCosmosEvent", ...SendToCosmosDataEvm2Oraichain1);
    gravity.emit("SendToCosmosEvent", ...SendToCosmosDataEvm2Oraichain2);
    // TODO: how to wait for emit event to finish then start the next
    await setTimeout(sleepTimeMs);
    await setTimeout(20000);

    expect(
      await duckDb.select(DatabaseEnum.Evm, {
        where: {
          txHash: "0x4f857ebe31d8e0e73757796052c7c2736495bda7f854824e1a8185139e31decc"
        }
      })
    ).eql([
      {
        txHash: "0x4f857ebe31d8e0e73757796052c7c2736495bda7f854824e1a8185139e31decc",
        height: 38194529,
        prevState: "",
        prevTxHash: "",
        nextState: "OraiBridgeState",
        destination:
          "channel-1/orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd:CitvcmFpMWVobWhxY244ZXJmM2RnYXZyY2E2OXpncDRydHhqNWtxZ3RjbnlkEgAaAA==",
        fromAmount: "3484735000000000000",
        oraiBridgeChannelId: "channel-1",
        oraiReceiver: "orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd",
        destinationDenom: "",
        destinationChannelId: "",
        destinationReceiver: "orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd",
        eventNonce: 65355,
        evmChainPrefix: "oraib",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.Evm, {
        where: {
          txHash: "0xf80b880b1f302fd4e94be7d4c98e2f331cfe3744b4b02e55e606a79a7c400d18"
        }
      })
    ).eql([
      {
        txHash: "0xf80b880b1f302fd4e94be7d4c98e2f331cfe3744b4b02e55e606a79a7c400d18",
        height: 38194529,
        prevState: "",
        prevTxHash: "",
        nextState: "OraiBridgeState",
        destination:
          "channel-1/orai1rqhjqpaqrv26wuq627gav3ka4994u39e84lncy:CitvcmFpMXJxaGpxcGFxcnYyNnd1cTYyN2dhdjNrYTQ5OTR1MzllODRsbmN5EgAaAA==",
        fromAmount: "2154324000000000000",
        oraiBridgeChannelId: "channel-1",
        oraiReceiver: "orai1rqhjqpaqrv26wuq627gav3ka4994u39e84lncy",
        destinationDenom: "",
        destinationChannelId: "",
        destinationReceiver: "orai1rqhjqpaqrv26wuq627gav3ka4994u39e84lncy",
        eventNonce: 65356,
        evmChainPrefix: "oraib",
        status: "FINISHED"
      }
    ]);
    // ORAIBRIDGE
    expect(
      await duckDb.select(DatabaseEnum.OraiBridge, {
        where: {
          eventNonce: 65355
        }
      })
    ).eql([
      {
        txHash: "16416F42BB94346E859D09036E18AC78F85FF509F3617CF648FED5B406ECC785",
        height: 12961046,
        prevState: "EvmState",
        prevTxHash: "0x4f857ebe31d8e0e73757796052c7c2736495bda7f854824e1a8185139e31decc",
        nextState: "OraichainState",
        eventNonce: 65355,
        batchNonce: 0,
        txId: 0,
        evmChainPrefix: "oraib",
        packetSequence: 19320,
        amount: "3484735000000000000",
        denom: "oraib0x55d398326f99059fF775485246999027B3197955",
        memo: "",
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
      await duckDb.select(DatabaseEnum.OraiBridge, {
        where: {
          eventNonce: 65356
        }
      })
    ).eql([
      {
        txHash: "16416F42BB94346E859D09036E18AC78F85FF509F3617CF648FED5B406ECC785",
        height: 12961046,
        prevState: "EvmState",
        prevTxHash: "0xf80b880b1f302fd4e94be7d4c98e2f331cfe3744b4b02e55e606a79a7c400d18",
        nextState: "OraichainState",
        eventNonce: 65356,
        batchNonce: 0,
        txId: 0,
        evmChainPrefix: "oraib",
        packetSequence: 19321,
        amount: "2154324000000000000",
        denom: "oraib0x55d398326f99059fF775485246999027B3197955",
        memo: "",
        receiver: "orai1rqhjqpaqrv26wuq627gav3ka4994u39e84lncy",
        sender: "oraib1rqhjqpaqrv26wuq627gav3ka4994u39es5mlf8",
        srcPort: "transfer",
        srcChannel: "channel-1",
        dstPort: "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm",
        dstChannel: "channel-29",
        status: "FINISHED"
      }
    ]);
    // ORAICHAIN
    expect(
      await duckDb.select(DatabaseEnum.Oraichain, {
        where: {
          packetSequence: 19320
        }
      })
    ).eql([
      {
        txHash: "B1468B5DEEE12C4205820DE26DAE977B24A8C3EC163B27F889B3A746C690651F",
        height: 19088216,
        prevState: "OraiBridgeState",
        prevTxHash: "16416F42BB94346E859D09036E18AC78F85FF509F3617CF648FED5B406ECC785",
        nextState: "",
        packetSequence: 19320,
        packetAck: "MQ==",
        sender: "",
        localReceiver: "orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd",
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
    expect(
      await duckDb.select(DatabaseEnum.Oraichain, {
        where: {
          packetSequence: 19321
        }
      })
    ).eql([
      {
        txHash: "B1468B5DEEE12C4205820DE26DAE977B24A8C3EC163B27F889B3A746C690651F",
        height: 19088216,
        prevState: "OraiBridgeState",
        prevTxHash: "16416F42BB94346E859D09036E18AC78F85FF509F3617CF648FED5B406ECC785",
        nextState: "",
        packetSequence: 19321,
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

    const intepreterCount1 = im.getIntepreter(0)._inner;
    expect(intepreterCount1.status).eql(InterpreterStatus.Stopped);
    const intepreterCount2 = im.getIntepreter(1)._inner;
    expect(intepreterCount2.status).eql(InterpreterStatus.Stopped);
  }).timeout(30000);

  it("[Oraichain->EVM] time-out happy test", async () => {
    const oraiBridgeEvent = new OraiBridgeEvent(oraibridgeHandler, "localhost:26657");
    const oraiBridgeStream = await oraiBridgeEvent.connectCosmosSocket([
      autoForwardTag,
      requestBatchTag,
      batchSendToEthClaimTag
    ]);
    const oraiEvent = new OraichainEvent(oraichainHandler, "localhost:26657");
    const oraiStream = await oraiEvent.connectCosmosSocket([onRecvPacketTag, onExecuteContractTag]);
    await setTimeout(sleepTimeMs);
    oraiStream.shamefullySendNext(unmarshalTxEvent(TransferBackToRemoteTxData1O2E));
    oraiStream.shamefullySendNext(unmarshalTxEvent(TransferBackToRemoteTxData2O2E));
    await setTimeout(30000);

    // Test Data
    // ORAICHAIN
    expect(
      await duckDb.select(DatabaseEnum.Oraichain, {
        where: {
          txHash: "18390B6E2A17BF19A44B9ED8B76F20113969A5AA37F376936C4BE41AD80FFA47",
          packetSequence: 22607
        }
      })
    ).eql([
      {
        txHash: "18390B6E2A17BF19A44B9ED8B76F20113969A5AA37F376936C4BE41AD80FFA47",
        height: 19080362,
        prevState: "",
        prevTxHash: "",
        nextState: "OraiBridgeState",
        packetSequence: 22607,
        packetAck: "",
        sender: "orai1zzdhs7cmfxrpx9mgxysncvpzn3h6tagy39cx0lq6ykz8s29007wq8sxd0t",
        localReceiver: "orai1zzdhs7cmfxrpx9mgxysncvpzn3h6tagy39cx0lq6ykz8s29007wq8sxd0t",
        nextPacketSequence: 22607,
        nextMemo: "oraib0x8163B6142d701E671a7c39aD9C14eB2c0A51aa00",
        nextAmount: "570339000000000000",
        nextReceiver: "oraib1ehmhqcn8erf3dgavrca69zgp4rtxj5kql2ul4w",
        nextDestinationDenom:
          "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm/channel-29/oraib0x55d398326f99059fF775485246999027B3197955",
        srcChannel: "channel-29",
        dstChannel: "channel-1",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.Oraichain, {
        where: {
          txHash: "7E121B8A2DAB36CD4BC8CC4E766C4DD21BF43A5D3FB6F70AEE2C95D0DF93DBBB",
          packetSequence: 22608
        }
      })
    ).eql([
      {
        txHash: "7E121B8A2DAB36CD4BC8CC4E766C4DD21BF43A5D3FB6F70AEE2C95D0DF93DBBB",
        height: 19080362,
        prevState: "",
        prevTxHash: "",
        nextState: "OraiBridgeState",
        packetSequence: 22608,
        packetAck: "",
        sender: "orai1zzdhs7cmfxrpx9mgxysncvpzn3h6tagy39cx0lq6ykz8s29007wq8sxd0t",
        localReceiver: "orai1zzdhs7cmfxrpx9mgxysncvpzn3h6tagy39cx0lq6ykz8s29007wq8sxd0t",
        nextPacketSequence: 22608,
        nextMemo: "oraib0x8163B6142d701E671a7c39aD9C14eB2c0A51aa00",
        nextAmount: "124142000000000000",
        nextReceiver: "oraib1hvr9d72r5um9lvt0rpkd4r75vrsqtw6ytnnvpf",
        nextDestinationDenom:
          "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm/channel-29/oraib0x55d398326f99059fF775485246999027B3197955",
        srcChannel: "channel-29",
        dstChannel: "channel-1",
        status: "FINISHED"
      }
    ]);
    // ORAIBRIDGE
    expect(
      await duckDb.select(DatabaseEnum.OraiBridge, {
        where: {
          txHash: "6FC035DF8F555C502B8706AF5AEE4761E597AAF869E43F1370B9FF02A82D12CC",
          txId: 33922
        }
      })
    ).eql([
      {
        txHash: "6FC035DF8F555C502B8706AF5AEE4761E597AAF869E43F1370B9FF02A82D12CC",
        height: 12955723,
        prevState: "OraichainState",
        prevTxHash: "18390B6E2A17BF19A44B9ED8B76F20113969A5AA37F376936C4BE41AD80FFA47",
        nextState: "EvmState",
        eventNonce: 65347,
        batchNonce: 32048,
        txId: 33922,
        evmChainPrefix: "oraib",
        packetSequence: 22607,
        amount: "570339000000000000",
        denom:
          "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm/channel-29/oraib0x55d398326f99059fF775485246999027B3197955",
        memo: "oraib0x8163B6142d701E671a7c39aD9C14eB2c0A51aa00",
        receiver: "oraib1ehmhqcn8erf3dgavrca69zgp4rtxj5kql2ul4w",
        sender: "orai1zzdhs7cmfxrpx9mgxysncvpzn3h6tagy39cx0lq6ykz8s29007wq8sxd0t",
        srcPort: "transfer",
        srcChannel: "channel-1",
        dstPort: "",
        dstChannel: "",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.OraiBridge, {
        where: {
          txHash: "6FC035DF8F555C502B8706AF5AEE4761E597AAF869E43F1370B9FF02A82D12CC",
          txId: 33923
        }
      })
    ).eql([
      {
        txHash: "6FC035DF8F555C502B8706AF5AEE4761E597AAF869E43F1370B9FF02A82D12CC",
        height: 12955723,
        prevState: "OraichainState",
        prevTxHash: "7E121B8A2DAB36CD4BC8CC4E766C4DD21BF43A5D3FB6F70AEE2C95D0DF93DBBB",
        nextState: "EvmState",
        eventNonce: 65347,
        batchNonce: 32048,
        txId: 33923,
        evmChainPrefix: "oraib",
        packetSequence: 22608,
        amount: "124142000000000000",
        denom:
          "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm/channel-29/oraib0x55d398326f99059fF775485246999027B3197955",
        memo: "oraib0x8163B6142d701E671a7c39aD9C14eB2c0A51aa00",
        receiver: "oraib1hvr9d72r5um9lvt0rpkd4r75vrsqtw6ytnnvpf",
        sender: "orai1zzdhs7cmfxrpx9mgxysncvpzn3h6tagy39cx0lq6ykz8s29007wq8sxd0t",
        srcPort: "transfer",
        srcChannel: "channel-1",
        dstPort: "",
        dstChannel: "",
        status: "FINISHED"
      }
    ]);
    // EVM
    expect(
      await duckDb.select(DatabaseEnum.Evm, {
        where: {
          eventNonce: 65347,
          destinationReceiver: "0x8163B6142d701E671a7c39aD9C14eB2c0A51aa00",
          fromAmount: "124142000000000000"
        }
      })
    ).eql([
      {
        txHash: "",
        height: 0,
        prevState: "OraiBridgeState",
        prevTxHash: "6FC035DF8F555C502B8706AF5AEE4761E597AAF869E43F1370B9FF02A82D12CC",
        nextState: "",
        destination: "",
        fromAmount: "124142000000000000",
        oraiBridgeChannelId: "",
        oraiReceiver: "",
        destinationDenom: "0x55d398326f99059fF775485246999027B3197955",
        destinationChannelId: "",
        destinationReceiver: "0x8163B6142d701E671a7c39aD9C14eB2c0A51aa00",
        eventNonce: 65347,
        evmChainPrefix: "oraib",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.Evm, {
        where: {
          eventNonce: 65347,
          destinationReceiver: "0x8163B6142d701E671a7c39aD9C14eB2c0A51aa00",
          fromAmount: "570339000000000000"
        }
      })
    ).eql([
      {
        txHash: "",
        height: 0,
        prevState: "OraiBridgeState",
        prevTxHash: "6FC035DF8F555C502B8706AF5AEE4761E597AAF869E43F1370B9FF02A82D12CC",
        nextState: "",
        destination: "",
        fromAmount: "570339000000000000",
        oraiBridgeChannelId: "",
        oraiReceiver: "",
        destinationDenom: "0x55d398326f99059fF775485246999027B3197955",
        destinationChannelId: "",
        destinationReceiver: "0x8163B6142d701E671a7c39aD9C14eB2c0A51aa00",
        eventNonce: 65347,
        evmChainPrefix: "oraib",
        status: "FINISHED"
      }
    ]);

    const intepreterCount1 = im.getIntepreter(0)._inner;
    expect(intepreterCount1.status).eql(InterpreterStatus.Stopped);
    const intepreterCount2 = im.getIntepreter(1)._inner;
    expect(intepreterCount2.status).eql(InterpreterStatus.Stopped);
  }).timeout(40000);

  it("[EVM->Cosmos] full-flow happy test", async () => {
    const ethEvent = new EthEvent(evmHandler);
    const gravity = ethEvent.listenToEthEvent(
      owner.provider,
      "0xb40C364e70bbD98E8aaab707A41a52A2eAF5733f",
      EvmChainPrefix.BSC_MAINNET
    );
    gravity.emit("SendToCosmosEvent", ...SendToCosmosDataEvm2Cosmos1);
    gravity.emit("SendToCosmosEvent", ...SendToCosmosDataEvm2Cosmos2);
    // TODO: how to wait for emit event to finish then start the next
    await setTimeout(36000);

    expect(
      await duckDb.select(DatabaseEnum.Evm, {
        where: {
          txHash: "0xe2a7936af07fccca94da0f8f33d4e74418fcc5dc6c651ca3187fa4437d6eb402"
        }
      })
    ).eql([
      {
        txHash: "0xe2a7936af07fccca94da0f8f33d4e74418fcc5dc6c651ca3187fa4437d6eb402",
        height: 38317410,
        prevState: "",
        prevTxHash: "",
        nextState: "OraiBridgeState",
        destination:
          "channel-1/orai1rchnkdpsxzhquu63y6r4j4t57pnc9w8ehdhedx:Ci1jb3Ntb3MxcmNobmtkcHN4emhxdXU2M3k2cjRqNHQ1N3BuYzl3OGV5N3A2djQSCmNoYW5uZWwtMTUaBXVhdG9t",
        fromAmount: "3000000000000000000",
        oraiBridgeChannelId: "channel-1",
        oraiReceiver: "orai1rchnkdpsxzhquu63y6r4j4t57pnc9w8ehdhedx",
        destinationDenom: "uatom",
        destinationChannelId: "channel-15",
        destinationReceiver: "cosmos1rchnkdpsxzhquu63y6r4j4t57pnc9w8ey7p6v4",
        eventNonce: 65539,
        evmChainPrefix: "oraib",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.Evm, {
        where: {
          txHash: "0x6cf401683f3afbca5130d6d35795e473dab2cda63e8021e94bf6ca498303b267"
        }
      })
    ).eql([
      {
        txHash: "0x6cf401683f3afbca5130d6d35795e473dab2cda63e8021e94bf6ca498303b267",
        height: 38317410,
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
        eventNonce: 65540,
        evmChainPrefix: "oraib",
        status: "FINISHED"
      }
    ]);
    // ORAIBRIDGE
    expect(
      await duckDb.select(DatabaseEnum.OraiBridge, {
        where: {
          txHash: "3E6E9DFCF7560FFD9EF0AE4D7AF5D5B0D617D85AA82242C693C7CDA80297DB30",
          packetSequence: 19401
        }
      })
    ).eql([
      {
        txHash: "3E6E9DFCF7560FFD9EF0AE4D7AF5D5B0D617D85AA82242C693C7CDA80297DB30",
        height: 13209293,
        prevState: "EvmState",
        prevTxHash: "0xe2a7936af07fccca94da0f8f33d4e74418fcc5dc6c651ca3187fa4437d6eb402",
        nextState: "OraichainState",
        eventNonce: 65539,
        batchNonce: 0,
        txId: 0,
        evmChainPrefix: "oraib",
        packetSequence: 19401,
        amount: "3000000000000000000",
        denom: "oraib0x55d398326f99059fF775485246999027B3197955",
        memo: "uatom",
        receiver: "orai1rchnkdpsxzhquu63y6r4j4t57pnc9w8ehdhedx",
        sender: "oraib1rchnkdpsxzhquu63y6r4j4t57pnc9w8eqvn4u9",
        srcPort: "transfer",
        srcChannel: "channel-1",
        dstPort: "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm",
        dstChannel: "channel-29",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.OraiBridge, {
        where: {
          txHash: "3E6E9DFCF7560FFD9EF0AE4D7AF5D5B0D617D85AA82242C693C7CDA80297DB30",
          packetSequence: 19402
        }
      })
    ).eql([
      {
        txHash: "3E6E9DFCF7560FFD9EF0AE4D7AF5D5B0D617D85AA82242C693C7CDA80297DB30",
        height: 13209293,
        prevState: "EvmState",
        prevTxHash: "0x6cf401683f3afbca5130d6d35795e473dab2cda63e8021e94bf6ca498303b267",
        nextState: "OraichainState",
        eventNonce: 65540,
        batchNonce: 0,
        txId: 0,
        evmChainPrefix: "oraib",
        packetSequence: 19402,
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
    // Oraichain
    expect(
      await duckDb.select(DatabaseEnum.Oraichain, {
        where: {
          txHash: "E522853FA3A5C0B6FF21F6FEC04B5B6B05C7A636D5F4352D19CDE18CA20D19AF",
          packetSequence: 19401
        }
      })
    ).eql([
      {
        txHash: "E522853FA3A5C0B6FF21F6FEC04B5B6B05C7A636D5F4352D19CDE18CA20D19AF",
        height: 19508309,
        prevState: "OraiBridgeState",
        prevTxHash: "3E6E9DFCF7560FFD9EF0AE4D7AF5D5B0D617D85AA82242C693C7CDA80297DB30",
        nextState: "",
        packetSequence: 19401,
        packetAck: "MQ==",
        sender: "orai1rchnkdpsxzhquu63y6r4j4t57pnc9w8ehdhedx",
        localReceiver: "orai1rchnkdpsxzhquu63y6r4j4t57pnc9w8ehdhedx",
        nextPacketSequence: 50440,
        nextMemo: "",
        nextAmount: "261948",
        nextReceiver: "cosmos1rchnkdpsxzhquu63y6r4j4t57pnc9w8ey7p6v4",
        nextDestinationDenom: "transfer/channel-15/uatom",
        srcChannel: "channel-15",
        dstChannel: "channel-301",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.Oraichain, {
        where: {
          txHash: "E522853FA3A5C0B6FF21F6FEC04B5B6B05C7A636D5F4352D19CDE18CA20D19AF",
          packetSequence: 19402
        }
      })
    ).eql([
      {
        txHash: "E522853FA3A5C0B6FF21F6FEC04B5B6B05C7A636D5F4352D19CDE18CA20D19AF",
        height: 19508309,
        prevState: "OraiBridgeState",
        prevTxHash: "3E6E9DFCF7560FFD9EF0AE4D7AF5D5B0D617D85AA82242C693C7CDA80297DB30",
        nextState: "",
        packetSequence: 19402,
        packetAck: "MQ==",
        sender: "orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd",
        localReceiver: "orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd",
        nextPacketSequence: 50439,
        nextMemo: "",
        nextAmount: "261948",
        nextReceiver: "cosmos1ehmhqcn8erf3dgavrca69zgp4rtxj5kqmcws97",
        nextDestinationDenom: "transfer/channel-15/uatom",
        srcChannel: "channel-15",
        dstChannel: "channel-301",
        status: "FINISHED"
      }
    ]);
    // COSMOS
    expect(
      await duckDb.select(DatabaseEnum.Cosmos, {
        where: {
          packetSequence: 50439
        }
      })
    ).eql([
      {
        txHash: "",
        height: 0,
        prevState: "OraichainState",
        prevTxHash: "E522853FA3A5C0B6FF21F6FEC04B5B6B05C7A636D5F4352D19CDE18CA20D19AF",
        packetSequence: 50439,
        nextState: "",
        srcPort: "transfer",
        srcChannel: "channel-301",
        dstPort: "",
        dstChannel: "",
        status: "FINISHED",
        sender: "orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm",
        receiver: "cosmos1ehmhqcn8erf3dgavrca69zgp4rtxj5kqmcws97",
        denom: "transfer/channel-15/uatom",
        amount: "261948",
        memo: "",
        chainId: "cosmoshub-4"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.Cosmos, {
        where: {
          packetSequence: 50440
        }
      })
    ).eql([
      {
        txHash: "",
        height: 0,
        prevState: "OraichainState",
        prevTxHash: "E522853FA3A5C0B6FF21F6FEC04B5B6B05C7A636D5F4352D19CDE18CA20D19AF",
        packetSequence: 50440,
        nextState: "",
        srcPort: "transfer",
        srcChannel: "channel-301",
        dstPort: "",
        dstChannel: "",
        status: "FINISHED",
        sender: "orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm",
        receiver: "cosmos1rchnkdpsxzhquu63y6r4j4t57pnc9w8ey7p6v4",
        denom: "transfer/channel-15/uatom",
        amount: "261948",
        memo: "",
        chainId: "cosmoshub-4"
      }
    ]);

    const intepreterCount1 = im.getIntepreter(0)._inner;
    expect(intepreterCount1.status).eql(InterpreterStatus.Stopped);
    const intepreterCount2 = im.getIntepreter(1)._inner;
    expect(intepreterCount2.status).eql(InterpreterStatus.Stopped);
  }).timeout(40000);

  it("[Cosmos->EVM] full-flow happy test", async () => {
    cosmosHandler.handleEvent([
      {
        txEvent: IbcTransferTxData1C2E,
        chainId: COSMOS_CHAIN_ID_COMMON.COSMOSHUB_CHAIN_ID
      }
    ]);
    cosmosHandler.handleEvent([
      {
        txEvent: IbcTransferTxData2C2E,
        chainId: COSMOS_CHAIN_ID_COMMON.COSMOSHUB_CHAIN_ID
      }
    ]);
    await setTimeout(30000);

    // COSMOS
    expect(
      await duckDb.select(DatabaseEnum.Cosmos, {
        where: {
          txHash: "DFEBDFE952C113936AA1F7CE63966C9076F54EB061C51A7C9A134607E1E6ADF6"
        }
      })
    ).eql([
      {
        txHash: "DFEBDFE952C113936AA1F7CE63966C9076F54EB061C51A7C9A134607E1E6ADF6",
        height: 20226577,
        chainId: "cosmoshub-4",
        prevState: "",
        prevTxHash: "",
        nextState: "OraichainState",
        packetSequence: 65362,
        amount: "1587568",
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
      await duckDb.select(DatabaseEnum.Cosmos, {
        where: {
          txHash: "DB75E50D97C904D258C8683F97DFAF1334081E6FCB1702A03BBC9D05509AF40B"
        }
      })
    ).eql([
      {
        txHash: "DB75E50D97C904D258C8683F97DFAF1334081E6FCB1702A03BBC9D05509AF40B",
        height: 20226577,
        chainId: "cosmoshub-4",
        prevState: "",
        prevTxHash: "",
        nextState: "OraichainState",
        packetSequence: 65363,
        amount: "274039",
        denom: "uatom",
        memo: '{"wasm":{"contract":"orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm","msg":{"ibc_hooks_receive":{"func":"universal_swap","args":"ChQeLzs0MDCuDnNRJodZVXTwZ4K4+RIvb3JhaWIweGIxQURFODQ1NjZkQjExN0I0QjI0MWZDNDQ2Y2ViMWM0NjYxNmUxNzIaCmNoYW5uZWwtMjkiL29yYWliMHg1NWQzOTgzMjZmOTkwNTlmRjc3NTQ4NTI0Njk5OTAyN0IzMTk3OTU1"}}}}',
        receiver: "orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm",
        sender: "cosmos1rchnkdpsxzhquu63y6r4j4t57pnc9w8ey7p6v4",
        srcPort: "transfer",
        srcChannel: "channel-301",
        dstPort: "transfer",
        dstChannel: "channel-15",
        status: "FINISHED"
      }
    ]);
    // ORAICHAIN
    expect(
      await duckDb.select(DatabaseEnum.Oraichain, {
        where: {
          txHash: "72BD571D1047F1A2162E272199AE3D93317E485111491D0AB63AE52390F7AB1A",
          packetSequence: 65362
        }
      })
    ).eql([
      {
        txHash: "72BD571D1047F1A2162E272199AE3D93317E485111491D0AB63AE52390F7AB1A",
        height: 19505710,
        prevState: "CosmosState",
        prevTxHash: "DFEBDFE952C113936AA1F7CE63966C9076F54EB061C51A7C9A134607E1E6ADF6",
        nextState: "OraiBridgeState",
        packetSequence: 65362,
        packetAck: "",
        sender: "cosmos1ehmhqcn8erf3dgavrca69zgp4rtxj5kqmcws97",
        localReceiver: "orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm",
        nextPacketSequence: 22773,
        nextMemo: "oraib0x0deB52499C2e9F3921c631cb6Ad3522C576d5484",
        nextAmount: "11370620000000000000",
        nextReceiver: "oraib1ehmhqcn8erf3dgavrca69zgp4rtxj5kql2ul4w",
        nextDestinationDenom:
          "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm/channel-29/oraib0x55d398326f99059fF775485246999027B3197955",
        srcChannel: "channel-29",
        dstChannel: "channel-1",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.Oraichain, {
        where: {
          txHash: "72BD571D1047F1A2162E272199AE3D93317E485111491D0AB63AE52390F7AB1A",
          packetSequence: 65363
        }
      })
    ).eql([
      {
        txHash: "72BD571D1047F1A2162E272199AE3D93317E485111491D0AB63AE52390F7AB1A",
        height: 19505710,
        prevState: "CosmosState",
        prevTxHash: "DB75E50D97C904D258C8683F97DFAF1334081E6FCB1702A03BBC9D05509AF40B",
        nextState: "OraiBridgeState",
        packetSequence: 65363,
        packetAck: "",
        sender: "cosmos1rchnkdpsxzhquu63y6r4j4t57pnc9w8ey7p6v4",
        localReceiver: "orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm",
        nextPacketSequence: 22774,
        nextMemo: "oraib0xb1ADE84566dB117B4B241fC446ceb1c46616e172",
        nextAmount: "1166126000000000000",
        nextReceiver: "oraib1rchnkdpsxzhquu63y6r4j4t57pnc9w8eqvn4u9",
        nextDestinationDenom:
          "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm/channel-29/oraib0x55d398326f99059fF775485246999027B3197955",
        srcChannel: "channel-29",
        dstChannel: "channel-1",
        status: "FINISHED"
      }
    ]);
    // ORAIBRIDGE
    expect(
      await duckDb.select(DatabaseEnum.OraiBridge, {
        where: {
          txHash: "DE564B9FE14D60F583CFA7AE3F5B4A14AE004D434F6329EC6307D6B70F30DF1C",
          packetSequence: 22773
        }
      })
    ).eql([
      {
        txHash: "DE564B9FE14D60F583CFA7AE3F5B4A14AE004D434F6329EC6307D6B70F30DF1C",
        height: 13207849,
        prevState: "OraichainState",
        prevTxHash: "72BD571D1047F1A2162E272199AE3D93317E485111491D0AB63AE52390F7AB1A",
        nextState: "EvmState",
        eventNonce: 65538,
        batchNonce: 32179,
        txId: 34055,
        evmChainPrefix: "oraib",
        packetSequence: 22773,
        amount: "11370620000000000000",
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
      await duckDb.select(DatabaseEnum.OraiBridge, {
        where: {
          txHash: "DE564B9FE14D60F583CFA7AE3F5B4A14AE004D434F6329EC6307D6B70F30DF1C",
          packetSequence: 22774
        }
      })
    ).eql([
      {
        txHash: "DE564B9FE14D60F583CFA7AE3F5B4A14AE004D434F6329EC6307D6B70F30DF1C",
        height: 13207849,
        prevState: "OraichainState",
        prevTxHash: "72BD571D1047F1A2162E272199AE3D93317E485111491D0AB63AE52390F7AB1A",
        nextState: "EvmState",
        eventNonce: 65538,
        batchNonce: 32179,
        txId: 34056,
        evmChainPrefix: "oraib",
        packetSequence: 22774,
        amount: "1166126000000000000",
        denom:
          "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm/channel-29/oraib0x55d398326f99059fF775485246999027B3197955",
        memo: "oraib0xb1ADE84566dB117B4B241fC446ceb1c46616e172",
        receiver: "oraib1rchnkdpsxzhquu63y6r4j4t57pnc9w8eqvn4u9",
        sender: "orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm",
        srcPort: "transfer",
        srcChannel: "channel-1",
        dstPort: "",
        dstChannel: "",
        status: "FINISHED"
      }
    ]);
    // EVM
    expect(
      await duckDb.select(DatabaseEnum.Evm, {
        where: {
          destinationReceiver: "0x0deB52499C2e9F3921c631cb6Ad3522C576d5484",
          eventNonce: 65538
        }
      })
    ).eql([
      {
        txHash: "",
        height: 0,
        prevState: "OraiBridgeState",
        prevTxHash: "DE564B9FE14D60F583CFA7AE3F5B4A14AE004D434F6329EC6307D6B70F30DF1C",
        nextState: "",
        destination: "",
        fromAmount: "11370620000000000000",
        oraiBridgeChannelId: "",
        oraiReceiver: "",
        destinationDenom: "0x55d398326f99059fF775485246999027B3197955",
        destinationChannelId: "",
        destinationReceiver: "0x0deB52499C2e9F3921c631cb6Ad3522C576d5484",
        eventNonce: 65538,
        evmChainPrefix: "oraib",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.Evm, {
        where: {
          destinationReceiver: "0xb1ADE84566dB117B4B241fC446ceb1c46616e172",
          eventNonce: 65538
        }
      })
    ).eql([
      {
        txHash: "",
        height: 0,
        prevState: "OraiBridgeState",
        prevTxHash: "DE564B9FE14D60F583CFA7AE3F5B4A14AE004D434F6329EC6307D6B70F30DF1C",
        nextState: "",
        destination: "",
        fromAmount: "1166126000000000000",
        oraiBridgeChannelId: "",
        oraiReceiver: "",
        destinationDenom: "0x55d398326f99059fF775485246999027B3197955",
        destinationChannelId: "",
        destinationReceiver: "0xb1ADE84566dB117B4B241fC446ceb1c46616e172",
        eventNonce: 65538,
        evmChainPrefix: "oraib",
        status: "FINISHED"
      }
    ]);

    const intepreterCount1 = im.getIntepreter(0)._inner;
    expect(intepreterCount1.status).eql(InterpreterStatus.Stopped);
    const intepreterCount2 = im.getIntepreter(1)._inner;
    expect(intepreterCount2.status).eql(InterpreterStatus.Stopped);
  }).timeout(40000);

  it("[EVM->EVM] full-flow happy test", async () => {
    const ethEvent = new EthEvent(evmHandler);
    const gravity = ethEvent.listenToEthEvent(
      owner.provider,
      "0xb40C364e70bbD98E8aaab707A41a52A2eAF5733f",
      EvmChainPrefix.BSC_MAINNET
    );
    gravity.emit("SendToCosmosEvent", ...SendToCosmosDataEvm2Evm1);
    gravity.emit("SendToCosmosEvent", ...SendToCosmosDataEvm2Evm2);
    // TODO: how to wait for emit event to finish then start the next
    await setTimeout(45000);

    // EVM
    expect(
      await duckDb.select(DatabaseEnum.Evm, {
        where: {
          txHash: "0x5b9be0596126de413c41bf6793fae3de8cfbea14a385932667a10eea3d4c1512"
        }
      })
    ).eql([
      {
        txHash: "0x5b9be0596126de413c41bf6793fae3de8cfbea14a385932667a10eea3d4c1512",
        height: 38318558,
        prevState: "",
        prevTxHash: "",
        nextState: "OraiBridgeState",
        destination:
          "channel-1/orai1rchnkdpsxzhquu63y6r4j4t57pnc9w8ehdhedx:CjVldGgtbWFpbm5ldDB4YjFBREU4NDU2NmRCMTE3QjRCMjQxZkM0NDZjZWIxYzQ2NjE2ZTE3MhIKY2hhbm5lbC0yORo1ZXRoLW1haW5uZXQweGRBQzE3Rjk1OEQyZWU1MjNhMjIwNjIwNjk5NDU5N0MxM0Q4MzFlYzc=",
        fromAmount: "13000000000000000000",
        oraiBridgeChannelId: "channel-1",
        oraiReceiver: "orai1rchnkdpsxzhquu63y6r4j4t57pnc9w8ehdhedx",
        destinationDenom: "eth-mainnet0xdAC17F958D2ee523a2206206994597C13D831ec7",
        destinationChannelId: "channel-29",
        destinationReceiver: "eth-mainnet0xb1ADE84566dB117B4B241fC446ceb1c46616e172",
        eventNonce: 65545,
        evmChainPrefix: "oraib",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.Evm, {
        where: {
          txHash: "0x1d41acf070f7a6c164857f5971ddd344a4a734a33ae09c411e3c80a9e2b8628a"
        }
      })
    ).eql([
      {
        txHash: "0x1d41acf070f7a6c164857f5971ddd344a4a734a33ae09c411e3c80a9e2b8628a",
        height: 38318558,
        prevState: "",
        prevTxHash: "",
        nextState: "OraiBridgeState",
        destination:
          "channel-1/orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd:CjVldGgtbWFpbm5ldDB4MGRlQjUyNDk5QzJlOUYzOTIxYzYzMWNiNkFkMzUyMkM1NzZkNTQ4NBIKY2hhbm5lbC0yORo1ZXRoLW1haW5uZXQweGRBQzE3Rjk1OEQyZWU1MjNhMjIwNjIwNjk5NDU5N0MxM0Q4MzFlYzc=",
        fromAmount: "15000000000000000000",
        oraiBridgeChannelId: "channel-1",
        oraiReceiver: "orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd",
        destinationDenom: "eth-mainnet0xdAC17F958D2ee523a2206206994597C13D831ec7",
        destinationChannelId: "channel-29",
        destinationReceiver: "eth-mainnet0x0deB52499C2e9F3921c631cb6Ad3522C576d5484",
        eventNonce: 65546,
        evmChainPrefix: "oraib",
        status: "FINISHED"
      }
    ]);
    // OraiBridge
    expect(
      await duckDb.select(DatabaseEnum.OraiBridge, {
        where: {
          txHash: "62ED77318512AC4F26D168B49147CA38A13538F212D01575002D37C3BF947DBB",
          packetSequence: 19403
        }
      })
    ).eql([
      {
        txHash: "62ED77318512AC4F26D168B49147CA38A13538F212D01575002D37C3BF947DBB",
        height: 13211573,
        prevState: "EvmState",
        prevTxHash: "0x5b9be0596126de413c41bf6793fae3de8cfbea14a385932667a10eea3d4c1512",
        nextState: "OraichainState",
        eventNonce: 65545,
        batchNonce: 0,
        txId: 0,
        evmChainPrefix: "oraib",
        packetSequence: 19403,
        amount: "13000000000000000000",
        denom: "oraib0x55d398326f99059fF775485246999027B3197955",
        memo: "eth-mainnet0xdAC17F958D2ee523a2206206994597C13D831ec7",
        receiver: "orai1rchnkdpsxzhquu63y6r4j4t57pnc9w8ehdhedx",
        sender: "oraib1rchnkdpsxzhquu63y6r4j4t57pnc9w8eqvn4u9",
        srcPort: "transfer",
        srcChannel: "channel-1",
        dstPort: "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm",
        dstChannel: "channel-29",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.OraiBridge, {
        where: {
          txHash: "62ED77318512AC4F26D168B49147CA38A13538F212D01575002D37C3BF947DBB",
          packetSequence: 19404
        }
      })
    ).eql([
      {
        txHash: "62ED77318512AC4F26D168B49147CA38A13538F212D01575002D37C3BF947DBB",
        height: 13211573,
        prevState: "EvmState",
        prevTxHash: "0x1d41acf070f7a6c164857f5971ddd344a4a734a33ae09c411e3c80a9e2b8628a",
        nextState: "OraichainState",
        eventNonce: 65546,
        batchNonce: 0,
        txId: 0,
        evmChainPrefix: "oraib",
        packetSequence: 19404,
        amount: "15000000000000000000",
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
    // Oraichain
    expect(
      await duckDb.select(DatabaseEnum.Oraichain, {
        where: {
          txHash: "920DD08567842D3B9C927C0C56CA584082B3DCD8C38229CD55820D3FBED04ED6",
          packetSequence: 19403
        }
      })
    ).eql([
      {
        txHash: "920DD08567842D3B9C927C0C56CA584082B3DCD8C38229CD55820D3FBED04ED6",
        height: 19512334,
        prevState: "OraiBridgeState",
        prevTxHash: "62ED77318512AC4F26D168B49147CA38A13538F212D01575002D37C3BF947DBB",
        nextState: "OraiBridgeState",
        packetSequence: 19403,
        packetAck: "MQ==",
        sender: "orai1rchnkdpsxzhquu63y6r4j4t57pnc9w8ehdhedx",
        localReceiver: "orai1rchnkdpsxzhquu63y6r4j4t57pnc9w8ehdhedx",
        nextPacketSequence: 22780,
        nextMemo: "eth-mainnet0xb1ADE84566dB117B4B241fC446ceb1c46616e172",
        nextAmount: "2442556",
        nextReceiver: "oraib1rchnkdpsxzhquu63y6r4j4t57pnc9w8eqvn4u9",
        nextDestinationDenom:
          "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm/channel-29/eth-mainnet0xdAC17F958D2ee523a2206206994597C13D831ec7",
        srcChannel: "channel-29",
        dstChannel: "channel-1",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.Oraichain, {
        where: {
          txHash: "920DD08567842D3B9C927C0C56CA584082B3DCD8C38229CD55820D3FBED04ED6",
          packetSequence: 19404
        }
      })
    ).eql([
      {
        txHash: "920DD08567842D3B9C927C0C56CA584082B3DCD8C38229CD55820D3FBED04ED6",
        height: 19512334,
        prevState: "OraiBridgeState",
        prevTxHash: "62ED77318512AC4F26D168B49147CA38A13538F212D01575002D37C3BF947DBB",
        nextState: "OraiBridgeState",
        packetSequence: 19404,
        packetAck: "MQ==",
        sender: "orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd",
        localReceiver: "orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd",
        nextPacketSequence: 22781,
        nextMemo: "eth-mainnet0x0deB52499C2e9F3921c631cb6Ad3522C576d5484",
        nextAmount: "4438556",
        nextReceiver: "oraib1ehmhqcn8erf3dgavrca69zgp4rtxj5kql2ul4w",
        nextDestinationDenom:
          "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm/channel-29/eth-mainnet0xdAC17F958D2ee523a2206206994597C13D831ec7",
        srcChannel: "channel-29",
        dstChannel: "channel-1",
        status: "FINISHED"
      }
    ]);
    // ORAIBRIDGE
    expect(
      await duckDb.select(DatabaseEnum.OraiBridge, {
        where: {
          txHash: "8979A718511CF608EB7C3AC2368D666F58414649923322589D71D1DC27EEF05A",
          txId: 4456
        }
      })
    ).eql([
      {
        txHash: "8979A718511CF608EB7C3AC2368D666F58414649923322589D71D1DC27EEF05A",
        height: 13211578,
        prevState: "OraichainState",
        prevTxHash: "920DD08567842D3B9C927C0C56CA584082B3DCD8C38229CD55820D3FBED04ED6",
        nextState: "EvmState",
        eventNonce: 6954,
        batchNonce: 4385,
        txId: 4456,
        evmChainPrefix: "eth-mainnet",
        packetSequence: 22780,
        amount: "2442556",
        denom:
          "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm/channel-29/eth-mainnet0xdAC17F958D2ee523a2206206994597C13D831ec7",
        memo: "eth-mainnet0xb1ADE84566dB117B4B241fC446ceb1c46616e172",
        receiver: "oraib1rchnkdpsxzhquu63y6r4j4t57pnc9w8eqvn4u9",
        sender: "orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm",
        srcPort: "transfer",
        srcChannel: "channel-1",
        dstPort: "",
        dstChannel: "",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.OraiBridge, {
        where: {
          txHash: "8979A718511CF608EB7C3AC2368D666F58414649923322589D71D1DC27EEF05A",
          txId: 4457
        }
      })
    ).eql([
      {
        txHash: "8979A718511CF608EB7C3AC2368D666F58414649923322589D71D1DC27EEF05A",
        height: 13211578,
        prevState: "OraichainState",
        prevTxHash: "920DD08567842D3B9C927C0C56CA584082B3DCD8C38229CD55820D3FBED04ED6",
        nextState: "EvmState",
        eventNonce: 6954,
        batchNonce: 4385,
        txId: 4457,
        evmChainPrefix: "eth-mainnet",
        packetSequence: 22781,
        amount: "4438556",
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
    // EVM
    expect(
      await duckDb.select(DatabaseEnum.Evm, {
        where: {
          destinationReceiver: "0xb1ADE84566dB117B4B241fC446ceb1c46616e172",
          eventNonce: 6954
        }
      })
    ).eql([
      {
        txHash: "",
        height: 0,
        prevState: "OraiBridgeState",
        prevTxHash: "8979A718511CF608EB7C3AC2368D666F58414649923322589D71D1DC27EEF05A",
        nextState: "",
        destination: "",
        fromAmount: "2442556",
        oraiBridgeChannelId: "",
        oraiReceiver: "",
        destinationDenom: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        destinationChannelId: "",
        destinationReceiver: "0xb1ADE84566dB117B4B241fC446ceb1c46616e172",
        eventNonce: 6954,
        evmChainPrefix: "eth-mainnet",
        status: "FINISHED"
      }
    ]);
    expect(
      await duckDb.select(DatabaseEnum.Evm, {
        where: {
          destinationReceiver: "0x0deB52499C2e9F3921c631cb6Ad3522C576d5484",
          eventNonce: 6954
        }
      })
    ).eql([
      {
        txHash: "",
        height: 0,
        prevState: "OraiBridgeState",
        prevTxHash: "8979A718511CF608EB7C3AC2368D666F58414649923322589D71D1DC27EEF05A",
        nextState: "",
        destination: "",
        fromAmount: "4438556",
        oraiBridgeChannelId: "",
        oraiReceiver: "",
        destinationDenom: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        destinationChannelId: "",
        destinationReceiver: "0x0deB52499C2e9F3921c631cb6Ad3522C576d5484",
        eventNonce: 6954,
        evmChainPrefix: "eth-mainnet",
        status: "FINISHED"
      }
    ]);

    const intepreterCount1 = im.getIntepreter(0)._inner;
    expect(intepreterCount1.status).eql(InterpreterStatus.Stopped);
    const intepreterCount2 = im.getIntepreter(1)._inner;
    expect(intepreterCount2.status).eql(InterpreterStatus.Stopped);
  }).timeout(60000);
});
