import { getSigners } from "hardhat";
import { InterpreterStatus } from "xstate";
// import { ChainId } from "../src/@types/chain";
import { COSMOS_CHAIN_ID_COMMON, EvmChainPrefix } from "@oraichain/oraidex-common/build/constant";
import { expect } from "chai";
import { setTimeout } from "timers/promises";
import {
  autoForwardTag,
  batchSendToEthClaimTag,
  DatabaseEnum,
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
import { createEvmIntepreter } from "../src/intepreters/evm.intepreter";
import { createOraichainIntepreter } from "../src/intepreters/oraichain.intepreter";
import IntepreterManager from "../src/managers/intepreter.manager";
import { unmarshalTxEvent } from "./common";
import { IbcTransferTxData as IbcTransferTxDataC2E } from "./data/single/cosmos-to-evm";
import { SendToCosmosData as SendToCosmosDataEvm2Evm } from "./data/single/evm-to-evm";
import { TransferBackToRemoteTxData as TransferBackToRemoteTxDataO2E } from "./data/single/oraichain-to-evm";

describe("test recover case", () => {
  let duckDb: DuckDbNode;
  let evmHandler: EvmEventHandler;
  let oraibridgeHandler: OraiBridgeHandler;
  let oraichainHandler: OraichainHandler;
  let cosmosHandler: CosmosHandler;
  let im: IntepreterManager;

  beforeEach(async () => {
    duckDb = await DuckDbNode.create();
    await duckDb.createTable();

    // Test recover need a file to reed
    im = new IntepreterManager(false, "test/data");
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
  it("[ORAICHAIN->EVM] try to test recover state of one intepreter after server down", async () => {
    const oraiBridgeEvent = new OraiBridgeEvent(oraibridgeHandler, "localhost:26657");
    oraiBridgeEvent.connectCosmosSocket([autoForwardTag, requestBatchTag, batchSendToEthClaimTag]);
    const oraiEvent = new OraichainEvent(oraichainHandler, "localhost:26657");
    const oraiStream = await oraiEvent.connectCosmosSocket([onRecvPacketTag, onExecuteContractTag]);
    await setTimeout(300);
    oraiStream.shamefullySendNext(unmarshalTxEvent(TransferBackToRemoteTxDataO2E));
    await setTimeout(300);

    // at this time state of intepreter is onRequestBatch
    await setTimeout(5000);

    // trying to remove intepreter and create new one again
    console.log("Removing intepreter");
    const intepreter = im.getIntepreter(0)._inner;
    const previousState = intepreter.getSnapshot();
    intepreter.stop();
    // assume we use the case store all state on localStorage for example
    const stringifyState = JSON.stringify(previousState);
    im.deleteIntepreter(0);
    await setTimeout(100);
    expect(im.getLengthIntepreters()).to.be.eq(0);

    console.log("Starting with recover intepreters");
    const newIntepreter = createOraichainIntepreter(duckDb);
    let initialState = JSON.parse(stringifyState);
    initialState = {
      ...initialState,
      context: {
        ...initialState.context,
        db: duckDb
      }
    };
    newIntepreter._inner.start(initialState);
    im.appendIntepreter(newIntepreter);
    await setTimeout(100);
    expect(im.getLengthIntepreters()).to.be.eq(1);
    await setTimeout(15000);
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

    const intepreterCount = im.getIntepreter(0)._inner;
    expect(intepreterCount.status).eql(InterpreterStatus.Stopped);
  }).timeout(30000);

  it("[EVM->EVM] try to test recover state of one intepreter after server down", async () => {
    const ethEvent = new EthEvent(evmHandler);
    const gravity = ethEvent.listenToEthEvent(
      owner.provider,
      "0xb40C364e70bbD98E8aaab707A41a52A2eAF5733f",
      EvmChainPrefix.BSC_MAINNET
    );
    gravity.emit("SendToCosmosEvent", ...SendToCosmosDataEvm2Evm);

    // at this time state of intepreter is onRequestBatch
    await setTimeout(5000);

    // trying to remove intepreter and create new one again
    console.log("Removing intepreter");
    const intepreter = im.getIntepreter(0);
    const previousState = intepreter._inner.getSnapshot();
    // assume we use the case store all state on localStorage for example
    const stringifyState = JSON.stringify(previousState);
    im.deleteIntepreter(0);
    intepreter._inner.stop();
    await setTimeout(100);
    expect(im.getLengthIntepreters()).to.be.eq(0);

    console.log("Starting with recover intepreters");
    const newIntepreter = createEvmIntepreter(duckDb);
    im.appendIntepreter(intepreter);
    await setTimeout(100);
    expect(im.getLengthIntepreters()).to.be.eq(1);
    let initialState = JSON.parse(stringifyState);
    initialState = {
      ...initialState,
      context: {
        ...initialState.context,
        db: duckDb
      }
    };
    newIntepreter._inner.start(initialState);
    await setTimeout(24000);

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

    const intepreterCount = im.getIntepreter(0)._inner;
    expect(intepreterCount.status).eql(InterpreterStatus.Stopped);
  }).timeout(35000);

  it("Testing 2 cases at one and do recoverIntepreters", async () => {
    const evmIntepreter = async () => {
      const ethEvent = new EthEvent(evmHandler);
      const gravity = ethEvent.listenToEthEvent(
        owner.provider,
        "0xb40C364e70bbD98E8aaab707A41a52A2eAF5733f",
        EvmChainPrefix.BSC_MAINNET
      );
      gravity.emit("SendToCosmosEvent", ...SendToCosmosDataEvm2Evm);
    };
    const oraiIntepreter = async () => {
      const oraiBridgeEvent = new OraiBridgeEvent(oraibridgeHandler, "localhost:26657");
      oraiBridgeEvent.connectCosmosSocket([autoForwardTag, requestBatchTag, batchSendToEthClaimTag]);
      const oraiEvent = new OraichainEvent(oraichainHandler, "localhost:26657");
      const oraiStream = await oraiEvent.connectCosmosSocket([onRecvPacketTag, onExecuteContractTag]);
      await setTimeout(300);
      oraiStream.shamefullySendNext(unmarshalTxEvent(TransferBackToRemoteTxDataO2E));
      await setTimeout(300);
    };
    const cosmosIntepreter = async () => {
      cosmosHandler.handleEvent([
        {
          txEvent: IbcTransferTxDataC2E,
          chainId: COSMOS_CHAIN_ID_COMMON.COSMOSHUB_CHAIN_ID
        }
      ]);
      await setTimeout(300);
    };

    cosmosIntepreter();
    evmIntepreter();
    oraiIntepreter();
    await setTimeout(5000);
    // trying to remove intepreter and create new one again
    console.log("Removing intepreter");
    // assume we use the case store all state on localStorage for example
    let intepreter = im.getIntepreter(0);
    intepreter._inner.stop();
    im.deleteIntepreter(0);
    intepreter = im.getIntepreter(0);
    intepreter._inner.stop();
    im.deleteIntepreter(0);
    intepreter = im.getIntepreter(0);
    intepreter._inner.stop();
    im.deleteIntepreter(0);

    await setTimeout(800);

    expect(im.getLengthIntepreters()).to.be.eq(0);
    console.log("Recover intepreter");
    im.recoverInterpreters();
    await setTimeout(1000);
    expect(im.getLengthIntepreters()).to.be.eq(3);
    await setTimeout(30000);

    // TEST EVM DATA
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

    // TEST ORAI DATA
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

    // TEST COSMOS DATA
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
  }).timeout(60000);
});
