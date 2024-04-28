import { getSigners } from "hardhat";
import { InterpreterStatus } from "xstate";
// import { ChainId } from "../src/@types/chain";
import { EvmChainPrefix } from "@oraichain/oraidex-common";
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
import { createOraichainIntepreter } from "../src/intepreters/oraichain.intepreter";
import IntepreterManager from "../src/managers/intepreter.manager";
import { unmarshalTxEvent } from "./common";
import {
  BatchSendToEthClaimTxData as BatchSendToEthClaimTxDataO2E,
  OnRecvPacketTxData as OnRecvPacketTxDataO2E,
  OnRequestBatchTxData as OnRequestBatchTxDataO2E,
  TransferBackToRemoteTxData1 as TransferBackToRemoteTxData1O2E,
  TransferBackToRemoteTxData2 as TransferBackToRemoteTxData2O2E
} from "./data/batch/oraichain-to-evm";
import {
  OnRecvPacketTxData as OnRecvPacketTxDataEvm2Oraichain,
  OraiBridgeAutoForwardTxData as OraiBridgeAutoForwardTxDataEvm2Oraichain,
  SendToCosmosData as SendToCosmosDataEvm2Oraichain
} from "./data/evm-to-oraichain";
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

    const intepreterCount = im.getIntepreter(0)._inner;
    expect(intepreterCount.status).eql(InterpreterStatus.Stopped);
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
          txHash: TransferBackToRemoteTxData1O2E.hash
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
          destinationReceiver: "0x8163B6142d701E671a7c39aD9C14eB2c0A51aa00"
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
        fromAmount: "0",
        oraiBridgeChannelId: "",
        oraiReceiver: "",
        destinationDenom: "",
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
          destinationReceiver: "0x8163B6142d701E671a7c39aD9C14eB2c0A51aa00"
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
        fromAmount: "0",
        oraiBridgeChannelId: "",
        oraiReceiver: "",
        destinationDenom: "",
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
