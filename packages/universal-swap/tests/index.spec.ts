import { CosmWasmClient, toBinary } from "@cosmjs/cosmwasm-stargate";
import { fromUtf8, toUtf8 } from "@cosmjs/encoding";
import { DirectSecp256k1HdWallet, EncodeObject, OfflineSigner } from "@cosmjs/proto-signing";
import { JsonRpcProvider, JsonRpcSigner } from "@ethersproject/providers";
import { CwIcs20LatestClient } from "@oraichain/common-contracts-sdk";
import { CWSimulateApp, GenericError, IbcOrder, IbcPacket, SimulateCosmWasmClient } from "@oraichain/cw-simulate";
import {
  AIRI_BSC_CONTRACT,
  AIRI_CONTRACT,
  CoinGeckoId,
  CosmosWallet,
  EvmWallet,
  IBC_TRANSFER_TIMEOUT,
  IBC_WASM_CONTRACT,
  IBC_WASM_CONTRACT_TEST,
  NetworkChainId,
  Networks,
  ORAI_BRIDGE_EVM_DENOM_PREFIX,
  ORAI_BRIDGE_EVM_TRON_DENOM_PREFIX,
  OSMOSIS_ORAICHAIN_DENOM,
  ROUTER_V2_CONTRACT,
  TokenItemType,
  USDC_CONTRACT,
  USDT_CONTRACT,
  buildCosmWasmAbciQueryResponse,
  flattenTokens,
  matchCosmWasmQueryRequest,
  mockJsonRpcServer,
  mockResponse,
  network,
  oraichain2osmosis,
  oraichainTokens,
  toAmount,
  toDisplay,
  toTokenInfo
} from "@oraichain/oraidex-common";
import * as dexCommonHelper from "@oraichain/oraidex-common/build/helper"; // import like this to enable jest.spyOn & avoid redefine property error
import { ibcInfos, oraichain2oraib } from "@oraichain/oraidex-common/build/ibc-info";
import { TronWeb as _TronWeb } from "@oraichain/oraidex-common/build/tronweb";
import * as oraidexArtifacts from "@oraichain/oraidex-contracts-build";
import {
  OraiswapFactoryClient,
  OraiswapOracleClient,
  OraiswapRouterClient,
  OraiswapRouterQueryClient,
  OraiswapTokenClient
} from "@oraichain/oraidex-contracts-sdk";
import bech32 from "bech32";
import { readFileSync } from "fs";
import Long from "long";
import TronWeb from "tronweb";
import { UniversalSwapHandler } from "../src/handler";
import {
  UniversalSwapHelper,
  checkBalanceChannelIbc,
  checkBalanceIBCOraichain,
  checkFeeRelayer,
  checkFeeRelayerNotOrai,
  getBalanceIBCOraichain,
  getIbcInfo,
  handleSimulateSwap,
  simulateSwap
} from "../src/helper";
import { UniversalSwapConfig, UniversalSwapData, UniversalSwapType } from "../src/types";
import { deployIcs20Token, deployToken, testSenderAddress } from "./test-common";

describe("test universal swap handler functions", () => {
  const client = new SimulateCosmWasmClient({
    chainId: "Oraichain",
    bech32Prefix: "orai"
  });
  let oraiPort: string;
  let lpId: number;
  const channel = "channel-29";
  const ibcTransferAmount = "100000000";
  const initialBalanceAmount = "10000000000000";
  const airiIbcDenom: string = "oraib0x7e2A35C746F2f7C240B664F1Da4DD100141AE71F";
  const bobAddress = "orai1ur2vsjrjarygawpdwtqteaazfchvw4fg6uql76";
  const oraiAddress = "orai12zyu8w93h0q2lcnt50g3fn0w3yqnhy4fvawaqz";
  const evmAddress = "0x8c7E0A841269a01c0Ab389Ce8Fb3Cf150A94E797";
  const tronAddress = "TEu6u8JLCFs6x1w5s8WosNqYqVx2JMC5hQ";
  const cosmosSenderAddress = bech32.encode("cosmos", bech32.decode(oraiAddress).words);
  const nobleSenderAddress = bech32.encode("noble", bech32.decode(oraiAddress).words);

  let ics20Contract: CwIcs20LatestClient;
  let factoryContract: OraiswapFactoryClient;
  let routerContract: OraiswapRouterClient;
  let oracleContract: OraiswapOracleClient;
  let airiToken: OraiswapTokenClient;

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  beforeAll(async () => {
    // deploy oracle addr
    const { codeId: pairCodeId } = await client.upload(
      testSenderAddress,
      readFileSync(oraidexArtifacts.getContractDir("oraiswap-pair")),
      "auto"
    );
    const { codeId: lpCodeId } = await client.upload(
      testSenderAddress,
      readFileSync(oraidexArtifacts.getContractDir("oraiswap-token")),
      "auto"
    );
    lpId = lpCodeId;
    const { contractAddress: oracleAddress } = await oraidexArtifacts.deployContract(
      client,
      testSenderAddress,
      {},
      "oraiswap-oracle",
      "oraiswap-oracle"
    );
    // deploy factory contract
    oracleContract = new OraiswapOracleClient(client, testSenderAddress, oracleAddress);
    const { contractAddress: factoryAddress } = await oraidexArtifacts.deployContract(
      client,
      testSenderAddress,
      {
        commission_rate: "0",
        oracle_addr: oracleAddress,
        pair_code_id: pairCodeId,
        token_code_id: lpCodeId
      },
      "oraiswap-factory",
      "oraiswap-factory"
    );
    const { contractAddress: routerAddress } = await oraidexArtifacts.deployContract(
      client,
      testSenderAddress,
      {
        factory_addr: factoryAddress,
        factory_addr_v2: factoryAddress
      },
      "oraiswap-router",
      "oraiswap-router"
    );
    factoryContract = new OraiswapFactoryClient(client, testSenderAddress, factoryAddress);
    routerContract = new OraiswapRouterClient(client, testSenderAddress, routerAddress);
    ics20Contract = await deployIcs20Token(client, { swap_router_contract: routerAddress });
    oraiPort = "wasm." + ics20Contract.contractAddress;
    const cosmosPort: string = "transfer";
    airiToken = await deployToken(client, {
      decimals: 6,
      symbol: "AIRI",
      name: "Airight token",
      initial_balances: [{ address: ics20Contract.contractAddress, amount: initialBalanceAmount }]
    });
    const cosmosChain = new CWSimulateApp({
      chainId: "cosmoshub-4",
      bech32Prefix: "cosmos"
    });

    const newPacketData = {
      src: {
        port_id: cosmosPort,
        channel_id: channel
      },
      dest: {
        port_id: oraiPort,
        channel_id: channel
      },
      sequence: 27,
      timeout: {
        block: {
          revision: 1,
          height: 12345678
        }
      }
    };
    newPacketData.dest.port_id = oraiPort;

    // init ibc channel between two chains
    client.app.ibc.relay(channel, oraiPort, channel, cosmosPort, cosmosChain);
    await cosmosChain.ibc.sendChannelOpen({
      open_init: {
        channel: {
          counterparty_endpoint: {
            port_id: oraiPort,
            channel_id: channel
          },
          endpoint: {
            port_id: cosmosPort,
            channel_id: channel
          },
          order: IbcOrder.Unordered,
          version: "ics20-1",
          connection_id: "connection-38"
        }
      }
    });
    await cosmosChain.ibc.sendChannelConnect({
      open_ack: {
        channel: {
          counterparty_endpoint: {
            port_id: oraiPort,
            channel_id: channel
          },
          endpoint: {
            port_id: cosmosPort,
            channel_id: channel
          },
          order: IbcOrder.Unordered,
          version: "ics20-1",
          connection_id: "connection-38"
        },
        counterparty_version: "ics20-1"
      }
    });

    cosmosChain.ibc.addMiddleWare((msg, app) => {
      const data = msg.data.packet as IbcPacket;
      if (Number(data.timeout.timestamp) < cosmosChain.time) {
        throw new GenericError("timeout at " + data.timeout.timestamp);
      }
    });

    await ics20Contract.updateMappingPair({
      localAssetInfo: {
        token: {
          contract_addr: airiToken.contractAddress
        }
      },
      localAssetInfoDecimals: 6,
      denom: airiIbcDenom,
      remoteDecimals: 6,
      localChannelId: channel
    });
  });
  class StubCosmosWallet extends CosmosWallet {
    getKeplrAddr(chainId?: NetworkChainId | undefined): Promise<string> {
      let addr: string = "orai1234";
      switch (chainId) {
        case "noble-1":
          addr = "noble1234";
          break;
        default:
          break;
      }
      return new Promise((resolve) => resolve(addr));
    }
    createCosmosSigner(chainId: string): Promise<OfflineSigner> {
      return DirectSecp256k1HdWallet.generate();
    }
  }

  class StubEvmWallet extends EvmWallet {
    private provider: JsonRpcProvider;
    constructor(rpc: string) {
      super();
      this.provider = new JsonRpcProvider(rpc);
      this.tronWeb = new TronWeb("foo", "foo");
    }

    switchNetwork(chainId: string | number): Promise<void> {
      return new Promise((resolve) => resolve(undefined));
    }
    getEthAddress(): Promise<string> {
      return new Promise((resolve) => resolve("0x1234"));
    }
    checkEthereum(): boolean {
      return true;
    }
    checkTron(): boolean {
      return true;
    }
    getSigner(): JsonRpcSigner {
      return this.provider.getSigner();
    }
  }

  const cosmosWallet = new StubCosmosWallet();
  const evmWallet = new StubEvmWallet("http://localhost:8545");
  const fromAmount = "100000";
  const simulateAmount = "100";
  const userSlippage = 1;
  const minimumReceive = "10000";
  const universalSwapData: UniversalSwapData = {
    sender: { cosmos: testSenderAddress, evm: "0x1234", tron: "TNJksEkvvdmae8uXYkNE9XKHbTDiSQrpbf" },
    originalFromToken: oraichainTokens[0],
    originalToToken: oraichainTokens[0],
    simulateAmount,
    simulatePrice: "0",
    userSlippage,
    fromAmount: toDisplay(fromAmount)
  };
  class FakeUniversalSwapHandler extends UniversalSwapHandler {
    constructor(data?: UniversalSwapData, config?: UniversalSwapConfig) {
      super(
        data ?? {
          sender: { cosmos: testSenderAddress },
          originalFromToken: oraichainTokens[0],
          originalToToken: oraichainTokens[1],
          simulateAmount: "0",
          simulatePrice: "0",
          userSlippage: 1,
          fromAmount: 1
        },
        config ?? { cosmosWallet, evmWallet }
      );
    }
  }

  it.each<[string, CoinGeckoId, CoinGeckoId, NetworkChainId, EncodeObject[]]>([
    [
      "from-and-to-is-have-same-coingecko-id",
      "osmosis",
      "osmosis",
      "osmosis-1",
      [
        {
          typeUrl: "/ibc.applications.transfer.v1.MsgTransfer",
          value: {
            sourcePort: "transfer",
            sourceChannel: "channel-13", // osmosis channel
            token: { denom: OSMOSIS_ORAICHAIN_DENOM, amount: simulateAmount }, //osmosis denom
            sender: testSenderAddress,
            receiver: "orai1234",
            timeoutHeight: undefined,
            timeoutTimestamp: new Long(0),
            memo: ""
          }
        }
      ]
    ],
    [
      "to-uses-ibc-wasm-instead-of-transfer-module",
      "usd-coin",
      "usd-coin",
      "noble-1",
      [
        {
          typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
          value: {
            sender: testSenderAddress,
            contract: USDC_CONTRACT,
            msg: JSON.stringify({
              send: {
                contract: IBC_WASM_CONTRACT,
                amount: simulateAmount,
                msg: toBinary({
                  local_channel_id: getIbcInfo("Oraichain", "noble-1").channel,
                  remote_address: "noble1234",
                  remote_denom: "uusdc",
                  timeout: IBC_TRANSFER_TIMEOUT,
                  memo: ""
                })
              }
            }),
            funds: []
          }
        }
      ]
    ],
    [
      "from-and-to-is-have-dont-have-same-coingecko-id",
      "tether",
      "osmosis",
      "osmosis-1",
      [
        {
          typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
          value: {
            sender: testSenderAddress,
            contract: USDT_CONTRACT,
            msg: JSON.stringify({
              send: {
                contract: ROUTER_V2_CONTRACT,
                amount: fromAmount,
                msg: toBinary({
                  execute_swap_operations: {
                    operations: [
                      {
                        orai_swap: {
                          offer_asset_info: {
                            token: { contract_addr: USDT_CONTRACT }
                          },
                          ask_asset_info: { native_token: { denom: "orai" } }
                        }
                      },
                      {
                        orai_swap: {
                          offer_asset_info: { native_token: { denom: "orai" } },
                          ask_asset_info: {
                            native_token: {
                              denom: OSMOSIS_ORAICHAIN_DENOM
                            }
                          }
                        }
                      }
                    ],
                    minimum_receive: minimumReceive
                  }
                })
              }
            }),
            funds: []
          }
        },
        {
          typeUrl: "/ibc.applications.transfer.v1.MsgTransfer",
          value: {
            sourcePort: "transfer",
            sourceChannel: oraichain2osmosis,
            token: { denom: OSMOSIS_ORAICHAIN_DENOM, amount: simulateAmount },
            sender: testSenderAddress,
            receiver: "orai1234",
            timeoutHeight: undefined,
            timeoutTimestamp: new Long(0),
            memo: ""
          }
        }
      ]
    ]
  ])(
    "test-combineSwapMsgOraichain-with-%s",
    async (_name: string, fromCoingeckoId, toCoingeckoId, toChainId, expectedTransferMsg) => {
      jest.spyOn(dexCommonHelper, "calculateMinReceive").mockReturnValue(minimumReceive);
      const universalSwap = new FakeUniversalSwapHandler({
        ...universalSwapData,
        originalFromToken: oraichainTokens.find((t) => t.coinGeckoId === fromCoingeckoId)!,
        originalToToken: flattenTokens.find((t) => t.coinGeckoId === toCoingeckoId && t.chainId === toChainId)!
      });
      const msg = await universalSwap.combineSwapMsgOraichain("0");
      expect(
        msg.map((m) => {
          if (m.value.msg) {
            return { typeUrl: m.typeUrl, value: { ...m.value, msg: fromUtf8(m.value.msg) } };
          }
          return m;
        })
      ).toEqual(expectedTransferMsg);
    }
  );

  it.each<[string, string, string, boolean]>([
    ["oraichain-token", "Oraichain", "0", true],
    ["oraichain-token", "Oraichain", "1000000", false],
    ["oraichain-token", "0x38", "100000", true],
    ["airight", "0x38", "100000", true],
    ["tether", "0x38", "10000000", true]
  ])(
    "test checkRelayerFee given token %s, chain id %s with from amount %d, is it sufficient for relayer fee?: %s",
    async (fromDenom, fromChainId, relayerFeeAmount, isSufficient) => {
      const originalFromToken = flattenTokens.find(
        (item) => item.coinGeckoId === fromDenom && item.chainId === fromChainId
      );
      // TODO: run tests without mocking to simulate actual swap logic
      jest.spyOn(UniversalSwapHelper, "simulateSwap").mockResolvedValue({ amount: relayerFeeAmount });
      const result = await checkFeeRelayer({
        originalFromToken: originalFromToken as TokenItemType,
        fromAmount: 1,
        relayerFee: {
          relayerAmount: relayerFeeAmount,
          relayerDecimals: 6
        },
        routerClient: routerContract
      });
      expect(result).toEqual(isSufficient);
    }
  );

  it.each<[string, string, string, boolean]>([
    ["tether", "100000", "1", true],
    ["tron", "10000000", "1000000000", false]
  ])(
    "test checkFeeRelayerNotOrai given denom %s with from amount %d, is it sufficient for relayer fee?: %s",
    async (fromDenom, mockSimulateAmount, mockRelayerFee, isSufficient) => {
      const originalFromToken = oraichainTokens.find((item) => item.coinGeckoId === fromDenom);
      // TODO: run tests without mocking to simulate actual swap
      jest.spyOn(UniversalSwapHelper, "simulateSwap").mockResolvedValue({ amount: mockSimulateAmount });
      const result = await checkFeeRelayerNotOrai({
        fromTokenInOrai: originalFromToken as TokenItemType,
        fromAmount: 1,
        relayerAmount: mockRelayerFee,
        routerClient: routerContract
      });
      expect(result).toEqual(isSufficient);
    }
  );

  it("test-getUniversalSwapToAddress", async () => {
    const universalSwap = new FakeUniversalSwapHandler();
    let result = await universalSwap.getUniversalSwapToAddress("0x01", {
      metamaskAddress: undefined,
      tronAddress: undefined
    });
    expect(result).toEqual("0x1234");
    result = await universalSwap.getUniversalSwapToAddress("cosmoshub-4", {
      metamaskAddress: undefined,
      tronAddress: undefined
    });
    expect(result).toEqual("orai1234");
    result = await universalSwap.getUniversalSwapToAddress("0x2b6653dc", {
      tronAddress: "TPwTVfDDvmWSawsP7Ki1t3ecSBmaFeMMXc"
    });
    expect(result).toEqual("0x993d06fc97f45f16e4805883b98a6c20bab54964");
    result = await universalSwap.getUniversalSwapToAddress("0x01", {
      metamaskAddress: "0x993d06fc97f45f16e4805883b98a6c20bab54964"
    });
    expect(result).toEqual("0x993d06fc97f45f16e4805883b98a6c20bab54964");
    const mockTronWeb: _TronWeb = new TronWeb("foo", "foo");
    mockTronWeb.defaultAddress.base58 = "TNJksEkvvdmae8uXYkNE9XKHbTDiSQrpbf";
    jest.replaceProperty(evmWallet, "tronWeb", mockTronWeb);
    result = await universalSwap.getUniversalSwapToAddress("0x2b6653dc", {
      metamaskAddress: undefined,
      tronAddress: undefined
    });
    expect(result).toEqual("0x8754032ac7966a909e2e753308df56bb08dabd69");
  });

  it.each([
    ["0x1234", "T123456789", flattenTokens.find((t) => t.prefix === ORAI_BRIDGE_EVM_TRON_DENOM_PREFIX)!, "0xae1ae6"],
    ["0x1234", "T123456789", flattenTokens.find((t) => t.prefix !== ORAI_BRIDGE_EVM_TRON_DENOM_PREFIX)!, "0x1234"],
    ["", "", flattenTokens.find((t) => t.prefix !== ORAI_BRIDGE_EVM_TRON_DENOM_PREFIX)!, "this-case-throw-error"]
  ])(
    "test getTranferAddress should return transferAddress correctly & throw error correctly",
    (metamaskAddress: string, tronAddress: string, toToken: TokenItemType, expectedTransferAddr: string) => {
      const universalSwap = new FakeUniversalSwapHandler({
        ...universalSwapData,
        originalToToken: toToken
      });
      const ibcInfo = ibcInfos["Oraichain"]["oraibridge-subnet-2"]!.channel;
      jest
        .spyOn(dexCommonHelper, "getTokenOnOraichain")
        .mockReturnValue(oraichainTokens.find((t) => t.coinGeckoId === "airight")!);
      try {
        const transferAddress = universalSwap.getTranferAddress(metamaskAddress, tronAddress, ibcInfo);
        expect(transferAddress).toEqual(expectedTransferAddr);
      } catch (error) {
        expect(error?.ex?.message).toEqual("Please login metamask / tronlink!");
      }
    }
  );

  it.each([
    ["0x1234", flattenTokens.find((t) => t.chainId !== "oraibridge-subnet-2")!, "0x38", "", ""],
    ["0x1234", flattenTokens.find((t) => t.chainId === "oraibridge-subnet-2")!, "0x38", "0x12345", "oraib0x12345"],
    ["0x1234", flattenTokens.find((t) => t.chainId === "oraibridge-subnet-2")!, "0x38", "", "oraib0x1234"]
  ])(
    "test getIbcMemo should return ibc memo correctly",
    (
      transferAddress: string,
      toToken: TokenItemType,
      originalChainId: string,
      recipientAddress: string,
      expectedIbcMemo: string
    ) => {
      const universalSwap = new FakeUniversalSwapHandler({
        ...universalSwapData,
        originalToToken: toToken
      });
      jest.spyOn(universalSwap, "getTranferAddress").mockReturnValue(transferAddress);
      jest.spyOn(dexCommonHelper, "checkValidateAddressWithNetwork").mockReturnValue({
        isValid: true,
        network: originalChainId
      });

      const ibcMemo = universalSwap.getIbcMemo(
        "john doe",
        "john doe",
        "john doe",
        {
          chainId: toToken.chainId,
          prefix: toToken.prefix!,
          originalChainId: originalChainId as NetworkChainId
        },
        recipientAddress
      );
      expect(ibcMemo).toEqual(expectedIbcMemo);
    }
  );

  it.each<[TokenItemType, TokenItemType, string, string, boolean]>([
    [
      flattenTokens.find((t) => t.chainId === "Oraichain" && t.coinGeckoId === "tether")!,
      flattenTokens.find((t) => t.chainId === "0x01" && t.coinGeckoId === "oraichain-token")!,
      simulateAmount,
      channel,
      true
    ],
    [
      flattenTokens.find((t) => t.chainId === "Oraichain" && t.coinGeckoId === "oraichain-token")!,
      flattenTokens.find((t) => t.chainId === "0x38" && t.coinGeckoId === "oraichain-token")!,
      simulateAmount,
      channel,
      false
    ]
  ])("test-universal-swap-checkBalanceChannelIbc-%", async (fromToken, toToken, amount, channel, willThrow) => {
    try {
      await checkBalanceChannelIbc(
        {
          source: oraiPort,
          channel: channel,
          timeout: 3600
        },
        fromToken,
        toToken,
        amount,
        client,
        IBC_WASM_CONTRACT_TEST
      );
      expect(willThrow).toEqual(false);
    } catch (error) {
      expect(willThrow).toEqual(true);
    }
  });

  it.each<[TokenItemType, TokenItemType, string, string, boolean]>([
    [
      flattenTokens.find((t) => t.chainId === "Oraichain" && t.coinGeckoId === "oraichain-token")!,
      flattenTokens.find((t) => t.chainId === "0x01" && t.coinGeckoId === "oraichain-token")!,
      simulateAmount,
      channel,
      false
    ],
    [
      flattenTokens.find((t) => t.chainId === "Oraichain" && t.coinGeckoId === "oraichain-token")!,
      flattenTokens.find((t) => t.chainId === "Oraichain" && t.coinGeckoId === "oraichain-token")!,
      toAmount(10).toString(),
      channel,
      true
    ]
  ])(
    "test-universal-swap-checkBalanceChannelIbc-with-mock-%",
    async (fromToken, toToken, amount, channel, willThrow) => {
      const mockServer = await mockJsonRpcServer();
      await mockServer
        .forJsonRpcRequest()
        .matching(async (request) =>
          matchCosmWasmQueryRequest(request, (queryData) => {
            return "channel_with_key" in queryData;
          })
        )
        .thenSendJsonRpcResult(
          buildCosmWasmAbciQueryResponse({
            balance: { native: { denom: fromToken.denom, amount: toAmount(1).toString() } }
          })
        );
      await mockServer
        .forJsonRpcRequest()
        .matching(async (request) =>
          matchCosmWasmQueryRequest(request, (queryData) => {
            return "pair_mapping" in queryData;
          })
        )
        .thenSendJsonRpcResult(buildCosmWasmAbciQueryResponse({ pair_mapping: { remote_decimals: 6 } }));
      try {
        const client = await CosmWasmClient.connect(mockServer.url);
        await checkBalanceChannelIbc(
          {
            source: "wasm." + IBC_WASM_CONTRACT,
            channel: channel,
            timeout: 3600
          },
          fromToken,
          toToken,
          amount,
          client,
          IBC_WASM_CONTRACT
        );
        expect(willThrow).toEqual(false);
      } catch (error) {
        expect(willThrow).toEqual(true);
      } finally {
        await mockServer.stop();
      }
    },
    50000
  );

  it.each([
    [oraichainTokens.find((t) => t.coinGeckoId === "airight")!, 10000000],
    [oraichainTokens.find((t) => t.coinGeckoId === "oraichain-token")!, 0]
  ])("test-universal-swap-getBalanceIBCOraichain-ibc-%", async (token: TokenItemType, expectedBalance: number) => {
    const mockToken = { ...token };
    if (mockToken.contractAddress) {
      if (mockToken.coinGeckoId === "airight") mockToken.contractAddress = airiToken.contractAddress;
    }
    const { balance } = await getBalanceIBCOraichain(mockToken, ics20Contract.client, ics20Contract.contractAddress);
    expect(balance).toEqual(expectedBalance);
  });

  it.each<[TokenItemType, TokenItemType, number, string, boolean]>([
    [
      oraichainTokens.find((t) => t.coinGeckoId === "oraichain-token")!, // ORAI (ORAICHAIN)
      oraichainTokens.find((t) => t.coinGeckoId === "airight")!, // AIRIGHT (ORAICHAIN)
      0,
      "0",
      false
    ],
    [
      flattenTokens.find((t) => t.coinGeckoId === "oraichain-token" && t.chainId === "0x01")!, // ORAI (ETH)
      flattenTokens.find((t) => t.coinGeckoId === "oraichain-token" && t.chainId === "0x38")!, // ORAI (BSC)
      10000000,
      "10000000",
      true
    ],
    [
      flattenTokens.find((t) => t.coinGeckoId === "oraichain-token" && t.chainId === "0x01")!, // ORAI (ETH)
      flattenTokens.find((t) => t.coinGeckoId === "airight" && t.chainId === "0x38")!, // AIRIGHT (BSC)
      10000000,
      "10000000",
      false
    ]
  ])(
    "test-universal-swap-checkBalanceIBCOraichain",
    async (from: TokenItemType, to: TokenItemType, fromAmount: number, toAmount: string, willThrow: boolean) => {
      try {
        jest
          .spyOn(UniversalSwapHelper, "getBalanceIBCOraichain")
          .mockReturnValue(new Promise((resolve) => resolve({ balance: +toAmount })));
        checkBalanceIBCOraichain(
          from,
          to,
          fromAmount,
          simulateAmount,
          ics20Contract.client,
          ics20Contract.contractAddress
        );
        expect(willThrow).toEqual(false);
      } catch (error) {
        expect(willThrow).toEqual(true);
      }
    }
  );

  it.each<[UniversalSwapType, string]>([
    ["oraichain-to-oraichain", "swap"],
    ["oraichain-to-evm", "swapAndTransferToOtherNetworks"],
    ["oraichain-to-cosmos", "swapAndTransferToOtherNetworks"],
    ["cosmos-to-others", "swapCosmosToOtherNetwork"]
  ])("test-processUniversalSwap", async (universalSwapType, expectedFunction) => {
    const fromToken = flattenTokens.find((item) => item.coinGeckoId === "airight" && item.chainId === "0x38")!;
    const toToken = flattenTokens.find((item) => item.coinGeckoId === "tether" && item.chainId === "0x2b6653dc")!;
    const spy = jest.spyOn(UniversalSwapHelper, "addOraiBridgeRoute");
    spy.mockReturnValue({ swapRoute: "", universalSwapType });
    const universalSwap = new FakeUniversalSwapHandler({
      ...universalSwapData,
      originalFromToken: fromToken,
      originalToToken: toToken
    });
    jest.spyOn(universalSwap, "swap").mockResolvedValue("swap" as any);
    jest
      .spyOn(universalSwap, "swapAndTransferToOtherNetworks")
      .mockResolvedValue("swapAndTransferToOtherNetworks" as any);
    jest.spyOn(universalSwap, "swapCosmosToOtherNetwork").mockResolvedValue("swapCosmosToOtherNetwork" as any);
    jest.spyOn(universalSwap, "transferAndSwap").mockResolvedValue("transferAndSwap" as any);
    const result = await universalSwap.processUniversalSwap();
    expect(spy).toHaveBeenCalled();
    expect(result).toEqual(expectedFunction);
  });

  it.each<[string, CoinGeckoId, CoinGeckoId, NetworkChainId, any, string, any]>([
    [
      "swap-tokens-that-both-belong-to-Oraichain-from-is-native-token",
      "oraichain-token",
      "airight",
      "Oraichain",
      {
        execute_swap_operations: {
          operations: [
            {
              orai_swap: {
                offer_asset_info: { native_token: { denom: "orai" } },
                ask_asset_info: { token: { contract_addr: AIRI_CONTRACT } }
              }
            }
          ],
          minimum_receive: minimumReceive
        }
      },
      ROUTER_V2_CONTRACT,
      { funds: [{ amount: fromAmount, denom: "orai" }] }
    ],
    [
      "swap-tokens-that-both-belong-to-Oraichain-from-is-cw20-token",
      "tether",
      "airight",
      "Oraichain",
      {
        send: {
          contract: "orai1j0r67r9k8t34pnhy00x3ftuxuwg0r6r4p8p6rrc8az0ednzr8y9s3sj2sf",
          amount: fromAmount,
          msg: toBinary({
            execute_swap_operations: {
              operations: [
                {
                  orai_swap: {
                    offer_asset_info: { token: { contract_addr: USDT_CONTRACT } },
                    ask_asset_info: { native_token: { denom: "orai" } }
                  }
                },
                {
                  orai_swap: {
                    offer_asset_info: { native_token: { denom: "orai" } },
                    ask_asset_info: { token: { contract_addr: AIRI_CONTRACT } }
                  }
                }
              ],
              minimum_receive: minimumReceive
            }
          })
        }
      },
      USDT_CONTRACT,
      { funds: null }
    ]
  ])(
    "test-generateMsgsSwap-for-%s",
    (_name, fromCoinGeckoId, toCoinGeckoId, toChainId, expectedSwapMsg, expectedSwapContractAddr, expectedFunds) => {
      // setup
      const universalSwap = new FakeUniversalSwapHandler({
        ...universalSwapData,
        originalFromToken: oraichainTokens.find((t) => t.coinGeckoId === fromCoinGeckoId)!,
        originalToToken: flattenTokens.find((t) => t.coinGeckoId === toCoinGeckoId && t.chainId === toChainId)!
      });
      jest.spyOn(dexCommonHelper, "calculateMinReceive").mockReturnValue(minimumReceive);

      // act
      const swapMsg = universalSwap.generateMsgsSwap();

      // assertion
      expect(swapMsg[0].contractAddress).toEqual(expectedSwapContractAddr);
      expect(swapMsg[0].msg).toEqual(expectedSwapMsg);
      expect(swapMsg[0].funds).toEqual(expectedFunds.funds);
    }
  );

  it.each([
    [
      "from-&-to-both-oraichain-token",
      "oraichain-token",
      {
        transfer_to_remote: {
          local_channel_id: oraichain2oraib,
          remote_address: "foobar",
          remote_denom: "john doe",
          timeout: 3600,
          memo: ""
        }
      },
      IBC_WASM_CONTRACT,
      { funds: [{ amount: simulateAmount, denom: "orai" }] }
    ],
    [
      "from-and-to-is-cw20-token-and-have-same-coingecko-id",
      "airight",
      {
        send: {
          contract: IBC_WASM_CONTRACT,
          amount: simulateAmount,
          msg: toBinary({
            local_channel_id: oraichain2oraib,
            remote_address: "foobar",
            remote_denom: "john doe",
            timeout: 3600,
            memo: ""
          })
        }
      },
      AIRI_CONTRACT, // contract of cw20 token to invoke send method.
      { funds: [] }
    ],
    [
      "from-token-in-orai-is-native-token",
      "oraichain-token",
      {
        transfer_to_remote: {
          local_channel_id: oraichain2oraib,
          remote_address: "foobar",
          remote_denom: "john doe",
          timeout: 3600,
          memo: ""
        }
      },
      IBC_WASM_CONTRACT,
      { funds: [{ amount: simulateAmount, denom: "orai" }] }
    ],
    [
      "from-is-cw20-token",
      "tether",
      {
        send: {
          contract: IBC_WASM_CONTRACT,
          amount: simulateAmount,
          msg: toBinary({
            local_channel_id: oraichain2oraib,
            remote_address: "foobar",
            remote_denom: "john doe",
            timeout: 3600,
            memo: ""
          })
        }
      },
      USDT_CONTRACT,
      { funds: [] }
    ]
  ])(
    "test-generateMsgsIbcWasm-with-%s",
    (_name: string, toCoingeckoId, expectedTransferMsg, expectedContractAddr, expectedFunds) => {
      const universalSwap = new FakeUniversalSwapHandler({
        ...universalSwapData,
        originalToToken: flattenTokens.find((t) => t.coinGeckoId === toCoingeckoId)!
      });
      const ibcInfo = getIbcInfo("Oraichain", "oraibridge-subnet-2");
      const toAddress = "foobar";
      const ibcMemo = "";
      const msg = universalSwap.generateMsgsIbcWasm(ibcInfo, toAddress, "john doe", ibcMemo)!;
      expect(msg[0].contractAddress.toString()).toEqual(expectedContractAddr);
      expect(msg[0].msg).toEqual(expectedTransferMsg);
      expect(msg[0].funds).toEqual(expectedFunds.funds);
    }
  );

  it.each<[string, CoinGeckoId, CoinGeckoId, string, any]>([
    [
      "from-and-to-is-have-same-coingecko-id-should-return-one-msg-to-ibc",
      "airight",
      "airight",
      "0x38",
      [
        {
          typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
          value: {
            sender: testSenderAddress,
            contract: AIRI_CONTRACT,
            msg: toUtf8(
              JSON.stringify({
                send: {
                  contract: IBC_WASM_CONTRACT,
                  amount: simulateAmount,
                  msg: toBinary({
                    local_channel_id: oraichain2oraib,
                    remote_address: "orai1234",
                    remote_denom: ORAI_BRIDGE_EVM_DENOM_PREFIX + AIRI_BSC_CONTRACT,
                    timeout: IBC_TRANSFER_TIMEOUT,
                    memo: "oraib0x1234"
                  })
                }
              })
            ),
            funds: []
          }
        }
      ]
    ],
    [
      "from-and-to-dont-have-same-coingecko-id-should-return-msg-swap-combined-with-msg-transfer-to-remote",
      "oraichain-token",
      "airight",
      "0x38",
      [
        {
          typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
          value: {
            sender: testSenderAddress,
            contract: ROUTER_V2_CONTRACT,
            msg: toUtf8(
              JSON.stringify({
                execute_swap_operations: {
                  operations: [
                    {
                      orai_swap: {
                        offer_asset_info: { native_token: { denom: "orai" } },
                        ask_asset_info: {
                          token: { contract_addr: AIRI_CONTRACT }
                        }
                      }
                    }
                  ],
                  minimum_receive: minimumReceive
                }
              })
            ),
            funds: [
              {
                amount: fromAmount,
                denom: "orai"
              }
            ]
          }
        },
        {
          typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
          value: {
            sender: testSenderAddress,
            contract: AIRI_CONTRACT,
            msg: toUtf8(
              JSON.stringify({
                send: {
                  contract: IBC_WASM_CONTRACT,
                  amount: simulateAmount,
                  msg: toBinary({
                    local_channel_id: oraichain2oraib,
                    remote_address: "orai1234",
                    remote_denom: ORAI_BRIDGE_EVM_DENOM_PREFIX + AIRI_BSC_CONTRACT,
                    timeout: IBC_TRANSFER_TIMEOUT,
                    memo: "oraib0x1234"
                  })
                }
              })
            ),
            funds: []
          }
        }
      ]
    ]
  ])("test-combineMsgEvm-with-%s", async (_name, fromCoingeckoId, toCoingeckoId, toChainId, expectedTransferMsg) => {
    //  setup mock
    const universalSwap = new FakeUniversalSwapHandler({
      ...universalSwapData,
      originalFromToken: oraichainTokens.find((t) => t.coinGeckoId === fromCoingeckoId)!,
      originalToToken: flattenTokens.find((t) => t.coinGeckoId === toCoingeckoId && t.chainId === toChainId)!
    });
    jest.spyOn(dexCommonHelper, "calculateMinReceive").mockReturnValue(minimumReceive);

    const msg = await universalSwap.combineMsgEvm("0x1234", "T1234");
    expect(msg).toEqual(expectedTransferMsg);
  });

  it("test-combineMsgEvm-should-throw-error", async () => {
    const universalSwap = new FakeUniversalSwapHandler({
      ...universalSwapData
    });
    jest
      .spyOn(universalSwap.config.cosmosWallet!, "getKeplrAddr")
      .mockReturnValue(new Promise((resolve) => resolve(undefined as any)));
    jest.spyOn(dexCommonHelper, "findToTokenOnOraiBridge").mockReturnValue(oraichainTokens[0]);
    try {
      await universalSwap.combineMsgEvm("0x1234", "T1234");
    } catch (error) {
      expect(error?.ex?.message).toEqual("Please login cosmos wallet!");
    }
  });

  it.each<[CoinGeckoId, CoinGeckoId, string, string]>([
    ["oraichain-token", "oraichain-token", "1000000", "1000000"],
    ["tron", "airight", "100000", "100000"]
  ])(
    "test simulateSwap-given-fromid-%s-toid-%s-input-amount-%d-returns-%d",
    async (fromCoingeckoId, toCoingeckoId, amount, expectedSimulateData) => {
      const fromToken = oraichainTokens.find((t) => t.coinGeckoId === fromCoingeckoId);
      const toToken = oraichainTokens.find((t) => t.coinGeckoId === toCoingeckoId);
      const routerClient = new OraiswapRouterClient(client, testSenderAddress, "foo");
      jest.spyOn(routerClient, "simulateSwapOperations").mockReturnValue(new Promise((resolve) => resolve({ amount })));
      const [fromInfo, toInfo] = [toTokenInfo(fromToken!), toTokenInfo(toToken!)];
      const query = { fromInfo, toInfo, amount, routerClient };
      const simulateData = await simulateSwap(query);
      expect(simulateData.amount).toEqual(expectedSimulateData);
    }
  );

  it.each<[CoinGeckoId, CoinGeckoId, string, string]>([
    ["oraichain-token", "oraichain-token", "1000000", "1000000"],
    ["tron", "airight", "100000", "100000"]
  ])(
    "test simulateSwapUsingSmartRoute-given-fromid-%s-toid-%s-input-amount-%d-returns-%d",
    async (fromCoingeckoId, toCoingeckoId, amount, expectedSimulateData) => {
      const fromToken = oraichainTokens.find((t) => t.coinGeckoId === fromCoingeckoId);
      const toToken = oraichainTokens.find((t) => t.coinGeckoId === toCoingeckoId);
      jest
        .spyOn(UniversalSwapHelper, "querySmartRoute")
        .mockResolvedValue({ swapAmount: amount, returnAmount: amount, routes: [] });
      const [fromInfo, toInfo] = [toTokenInfo(fromToken!), toTokenInfo(toToken!)];
      const query = { fromInfo, toInfo, amount };
      const simulateData = await UniversalSwapHelper.simulateSwapUsingSmartRoute(query);
      expect(simulateData.returnAmount).toEqual(expectedSimulateData);
    }
  );

  it.each<[boolean, boolean, boolean, string]>([
    [false, false, false, "1"],
    [false, true, false, "2"],
    [true, false, false, "2"],
    [true, true, false, "2"],
    [false, false, true, "3"]
  ])(
    "test handleSimulateSwap",
    async (isSupportedNoPoolSwapEvmRes, isEvmSwappableRes, useSmartRoute, expectedSimulateAmount) => {
      const simulateSwapSpy = jest.spyOn(UniversalSwapHelper, "simulateSwap");
      const simulateSwapEvmSpy = jest.spyOn(UniversalSwapHelper, "simulateSwapEvm");
      const simulateSwapUseSmartRoute = jest.spyOn(UniversalSwapHelper, "querySmartRoute");

      simulateSwapSpy.mockResolvedValue({ amount: "1" });
      simulateSwapEvmSpy.mockResolvedValue({ amount: "2", displayAmount: 2 });
      simulateSwapUseSmartRoute.mockResolvedValue({ returnAmount: "3", swapAmount: "3", routes: [] });

      const isSupportedNoPoolSwapEvmSpy = jest.spyOn(UniversalSwapHelper, "isSupportedNoPoolSwapEvm");
      const isEvmSwappableSpy = jest.spyOn(UniversalSwapHelper, "isEvmSwappable");
      isSupportedNoPoolSwapEvmSpy.mockReturnValue(isSupportedNoPoolSwapEvmRes);
      isEvmSwappableSpy.mockReturnValue(isEvmSwappableRes);
      const simulateData = await handleSimulateSwap({
        originalFromInfo: oraichainTokens[0],
        originalToInfo: oraichainTokens[1],
        originalAmount: 0,
        routerClient: new OraiswapRouterQueryClient(client, ""),
        useSmartRoute
      });
      expect(simulateData.amount).toEqual(expectedSimulateAmount);
    }
  );

  it.each<[boolean, string]>([
    [true, IBC_WASM_CONTRACT_TEST],
    [false, IBC_WASM_CONTRACT]
  ])("test-getIbcInfo", (testMode, ibcWasmContract) => {
    const universalSwap = new FakeUniversalSwapHandler(
      {
        ...universalSwapData
      },
      { swapOptions: { ibcInfoTestMode: testMode } }
    );
    const ibcInfo = universalSwap.getIbcInfo("Oraichain", "oraibridge-subnet-2");
    expect(ibcInfo.source).toEqual(`wasm.${ibcWasmContract}`);
  });

  it("test-processUniversalSwap-swap()-for-%s", async () => {
    const generateMsgsSwapMock = jest.fn(() => ["msg1", "msg2"]);
    const executeMultipleMock = jest.fn(() => Promise.resolve("executeMultipleMock"));
    const getCosmWasmClientMock = jest.fn(() => Promise.resolve({ client: { executeMultiple: executeMultipleMock } }));
    const cosmosWalletMock = { getCosmWasmClient: getCosmWasmClientMock };
    const networks = { rpc: network.rpc, fee: { gasPrice: network.fee.gasPrice, denom: network.denom } };
    const fromToken = flattenTokens.find((item) => item.coinGeckoId === "airight" && item.chainId === "Oraichain")!;
    const toToken = flattenTokens.find((item) => item.coinGeckoId === "tether" && item.chainId === "Oraichain")!;
    const sender = { cosmos: "orai1234" };
    const universalSwap = new FakeUniversalSwapHandler(
      {
        ...universalSwapData,
        originalFromToken: fromToken,
        originalToToken: toToken,
        sender
      },
      {
        cosmosWallet: cosmosWalletMock as any
      }
    );
    universalSwap.generateMsgsSwap = generateMsgsSwapMock as any;

    await universalSwap.swap();

    expect(generateMsgsSwapMock).toHaveBeenCalled();
    expect(getCosmWasmClientMock).toHaveBeenCalledWith(
      { chainId: "Oraichain", rpc: networks.rpc },
      { gasPrice: expect.any(Object) }
    );

    expect(executeMultipleMock).toHaveBeenCalledWith(sender.cosmos, ["msg1", "msg2"], "auto");
  });

  it.each<[TokenItemType, TokenItemType, string]>([
    [
      flattenTokens.find((t) => t.chainId === "Oraichain" && t.coinGeckoId === "tether")!,
      flattenTokens.find((t) => t.chainId === "cosmoshub-4" && t.coinGeckoId === "cosmos")!,
      "oraichain-to-cosmos"
    ],
    [
      flattenTokens.find((t) => t.chainId === "Oraichain" && t.coinGeckoId === "tether")!,
      flattenTokens.find((t) => t.chainId === "0x38" && t.coinGeckoId === "tether")!,
      "oraichain-to-evm"
    ]
  ])("test-processUniversalSwap-swapAndTransferToOtherNetworks()-for-%s", async (fromToken, toToken, swapRoute) => {
    const networks = { rpc: network.rpc, fee: { gasPrice: network.fee.gasPrice, denom: network.denom } };
    const combineSwapMsgOraichain = jest.fn(() => ["msg1", "msg2"]);
    const signAndBroadcastMock = jest.fn(() => Promise.resolve("signAndBroadcastMock"));
    const getCosmWasmClientMock = jest.fn(() =>
      Promise.resolve({
        client: { signAndBroadcast: signAndBroadcastMock }
      })
    );
    const cosmosWalletMock = {
      getCosmWasmClient: getCosmWasmClientMock,
      getKeplrAddr: () => {
        return "orai1234";
      }
    };

    const sender = {
      cosmos: "orai1234",
      evm: "0x1234"
    };
    const universalSwap = new FakeUniversalSwapHandler(
      {
        ...universalSwapData,
        originalFromToken: fromToken,
        originalToToken: toToken,
        sender
      },
      {
        cosmosWallet: cosmosWalletMock as any
      }
    );

    if (swapRoute === "oraichain-to-cosmos") universalSwap.combineSwapMsgOraichain = combineSwapMsgOraichain as any;
    if (swapRoute === "oraichain-to-evm") universalSwap.combineMsgEvm = combineSwapMsgOraichain as any;

    await universalSwap.swapAndTransferToOtherNetworks(swapRoute as UniversalSwapType);

    expect(combineSwapMsgOraichain).toHaveBeenCalled();
    expect(getCosmWasmClientMock).toHaveBeenCalledWith(
      { chainId: network.chainId, rpc: networks.rpc },
      { gasPrice: expect.any(Object) }
    );
    expect(signAndBroadcastMock).toHaveBeenCalledWith(sender.cosmos, ["msg1", "msg2"], "auto");
  });

  it.each<[TokenItemType, TokenItemType, string]>([
    [
      flattenTokens.find((t) => t.chainId === "cosmoshub-4" && t.coinGeckoId === "cosmos")!,
      flattenTokens.find((t) => t.chainId === "Oraichain" && t.coinGeckoId === "tether")!,
      cosmosSenderAddress
    ],
    [
      flattenTokens.find((t) => t.chainId === "noble-1" && t.coinGeckoId === "usd-coin")!,
      flattenTokens.find((t) => t.chainId === "Oraichain" && t.coinGeckoId === "tether")!,
      nobleSenderAddress
    ]
  ])("test-processUniversalSwap-swapCosmosToOtherNetwork()-for-%s", async (fromToken, toToken, destinationReceiver) => {
    const signAndBroadcastMock = jest.fn(() => Promise.resolve("signAndBroadcastMock"));
    const spy = jest.spyOn(UniversalSwapHelper, "getIbcInfo");
    spy.mockReturnValue(ibcInfos[fromToken.chainId][toToken.chainId]);
    const getCosmWasmClientMock = jest.fn(() =>
      Promise.resolve({
        client: { signAndBroadcast: signAndBroadcastMock }
      })
    );
    const cosmosWalletMock = {
      getCosmWasmClient: getCosmWasmClientMock,
      getKeplrAddr: () => {
        return destinationReceiver;
      }
    };
    const sender = {
      cosmos: destinationReceiver,
      evm: "0x1234"
    };
    const universalSwap = new FakeUniversalSwapHandler(
      {
        ...universalSwapData,
        originalFromToken: fromToken,
        originalToToken: toToken,
        sender
      },
      {
        cosmosWallet: cosmosWalletMock as any
      }
    );
    await universalSwap.swapCosmosToOtherNetwork(destinationReceiver);
    expect(spy).toHaveBeenCalled();
    expect(getCosmWasmClientMock).toHaveBeenCalledWith(
      { chainId: fromToken.chainId, rpc: fromToken.rpc },
      { gasPrice: expect.any(Object) }
    );
    expect(signAndBroadcastMock).toHaveBeenCalled();
  });

  it.each<[TokenItemType, TokenItemType, boolean]>([
    [
      flattenTokens.find((t) => t.chainId === "Oraichain" && t.coinGeckoId === "oraichain-token")!,
      flattenTokens.find((t) => t.chainId === "Oraichain" && t.coinGeckoId === "tether")!,
      false
    ]
  ])(
    "test-universal-swap-func-swap()-with-mock-%",
    async (fromToken, toToken, willThrow) => {
      const mockServer = await mockJsonRpcServer();
      const executeMultipleMock = jest.fn(() =>
        mockServer
          .forJsonRpcRequest({
            method: "broadcast_tx_sync"
          })
          .thenSendJsonRpcResult(mockResponse)
      );
      const getCosmWasmClientMock = jest.fn(() =>
        Promise.resolve({ client: { executeMultiple: executeMultipleMock } })
      );
      const cosmosWalletMock = { getCosmWasmClient: getCosmWasmClientMock };
      const universalSwap = new FakeUniversalSwapHandler(
        {
          ...universalSwapData,
          originalFromToken: fromToken,
          originalToToken: toToken,
          sender: { cosmos: "orai1234" }
        },
        {
          cosmosWallet: cosmosWalletMock as any
        }
      );
      try {
        await universalSwap.swap();
        expect(willThrow).toEqual(false);
      } catch (error) {
        expect(willThrow).toEqual(true);
      } finally {
        await mockServer.stop();
      }
    },
    50000
  );

  it.each<[TokenItemType, TokenItemType, string, boolean]>([
    [
      flattenTokens.find((t) => t.chainId === "Oraichain" && t.coinGeckoId === "tether")!,
      flattenTokens.find((t) => t.chainId === "cosmoshub-4" && t.coinGeckoId === "cosmos")!,
      "oraichain-to-cosmos",
      false
    ],
    [
      flattenTokens.find((t) => t.chainId === "Oraichain" && t.coinGeckoId === "tether")!,
      flattenTokens.find((t) => t.chainId === "0x38" && t.coinGeckoId === "tether")!,
      "oraichain-to-evm",
      false
    ]
  ])(
    "test-universal-swap-func-swapAndTransferToOtherNetworks()-with-mock-%",
    async (fromToken, toToken, swapRoute, willThrow) => {
      const mockServer = await mockJsonRpcServer();
      const signAndBroadcastMock = jest.fn(() =>
        mockServer
          .forJsonRpcRequest({
            method: "broadcast_tx_sync"
          })
          .thenSendJsonRpcResult(mockResponse)
      );

      const getCosmWasmClientMock = jest.fn(() =>
        Promise.resolve({
          client: { signAndBroadcast: signAndBroadcastMock }
        })
      );
      const cosmosWalletMock = {
        getCosmWasmClient: getCosmWasmClientMock,
        getKeplrAddr: () => {
          return "orai1234";
        }
      };

      const sender = {
        cosmos: "orai1234",
        evm: "0x1234"
      };

      const universalSwap = new FakeUniversalSwapHandler(
        {
          ...universalSwapData,
          originalFromToken: fromToken,
          originalToToken: toToken,
          sender
        },
        {
          cosmosWallet: cosmosWalletMock as any
        }
      );

      try {
        await universalSwap.swapAndTransferToOtherNetworks(swapRoute as UniversalSwapType);
        expect(willThrow).toEqual(false);
      } catch (error) {
        expect(willThrow).toEqual(true);
      } finally {
        await mockServer.stop();
      }
    },
    50000
  );

  it.each<[TokenItemType, TokenItemType, string, boolean]>([
    [
      flattenTokens.find((t) => t.chainId === "cosmoshub-4" && t.coinGeckoId === "cosmos")!,
      flattenTokens.find((t) => t.chainId === "Oraichain" && t.coinGeckoId === "tether")!,
      cosmosSenderAddress,
      false
    ],
    [
      flattenTokens.find((t) => t.chainId === "noble-1" && t.coinGeckoId === "usd-coin")!,
      flattenTokens.find((t) => t.chainId === "Oraichain" && t.coinGeckoId === "tether")!,
      nobleSenderAddress,
      false
    ]
  ])(
    "test-processUniversalSwap-swapCosmosToOtherNetwork()-with-mock-%s",
    async (fromToken, toToken, destinationReceiver, willThrow) => {
      const mockServer = await mockJsonRpcServer();
      const spy = jest.spyOn(UniversalSwapHelper, "getIbcInfo");
      spy.mockReturnValue(ibcInfos[fromToken.chainId][toToken.chainId]);
      const signAndBroadcastMock = jest.fn(() =>
        mockServer
          .forJsonRpcRequest({
            method: "broadcast_tx_sync"
          })
          .thenSendJsonRpcResult(mockResponse)
      );

      const getCosmWasmClientMock = jest.fn(() =>
        Promise.resolve({
          client: { signAndBroadcast: signAndBroadcastMock }
        })
      );
      const cosmosWalletMock = {
        getCosmWasmClient: getCosmWasmClientMock,
        getKeplrAddr: () => {
          return destinationReceiver;
        }
      };
      const sender = {
        cosmos: destinationReceiver,
        evm: "0x1234"
      };
      const universalSwap = new FakeUniversalSwapHandler(
        {
          ...universalSwapData,
          originalFromToken: fromToken,
          originalToToken: toToken,
          sender
        },
        {
          cosmosWallet: cosmosWalletMock as any
        }
      );

      try {
        await universalSwap.swapCosmosToOtherNetwork(destinationReceiver);
        expect(willThrow).toEqual(false);
      } catch (error) {
        expect(willThrow).toEqual(true);
      } finally {
        await mockServer.stop();
      }
    }
  );

  it.each<[TokenItemType, TokenItemType, boolean, boolean]>([
    [
      flattenTokens.find((t) => t.chainId === "0x01" && t.coinGeckoId === "tether")!,
      flattenTokens.find((t) => t.chainId === "Oraichain" && t.coinGeckoId === "tether")!,
      false,
      false
    ],
    [
      flattenTokens.find((t) => t.chainId === "0x2b6653dc" && t.coinGeckoId === "tron")!,
      flattenTokens.find((t) => t.chainId === "Oraichain" && t.coinGeckoId === "tether")!,
      true,
      false
    ]
  ])("test-transferToGravity()-for-%s", async (fromToken, toToken, isTron, willThrow) => {
    const evmWalletMock = {
      isTron: (chainId) => Number(chainId) == Networks.tron,
      checkTron: jest.fn().mockReturnValue(true),
      checkEthereum: jest.fn().mockReturnValue(true),
      submitTronSmartContract: jest.fn().mockResolvedValue({ transactionHash: "mockTransactionHash" }),
      ethToTronAddress: jest.fn().mockReturnValue(tronAddress),
      tronToEthAddress: jest.fn().mockReturnValue(evmAddress),
      getSigner: jest.fn().mockReturnValue("getSigner")
    };

    const sender = {
      cosmos: "orai1234",
      evm: evmAddress,
      tron: tronAddress
    };

    const universalSwap = new FakeUniversalSwapHandler(
      {
        ...universalSwapData,
        originalFromToken: fromToken,
        originalToToken: toToken,
        sender
      },
      {
        evmWallet: evmWalletMock as any
      }
    );

    const spy = jest.spyOn(universalSwap, "connectBridgeFactory");
    if (!isTron) {
      //@ts-ignore
      spy.mockReturnValue({
        sendToCosmos: jest.fn().mockResolvedValue({
          hash: "mockHash",
          blockNumber: 1,
          blockHash: "mockBlockHash",
          timestamp: 1,
          confirmations: 1,
          from: "mockFromAddress",
          raw: "mockRawTransaction",
          wait: jest.fn().mockResolvedValue("mockTransactionHash")
        })
      });
    }

    try {
      await universalSwap.transferToGravity(evmAddress);
      if (!isTron) expect(spy).toHaveBeenCalled();
      expect(willThrow).toBe(false);
    } catch (error) {
      expect(willThrow).toBe(true);
    }
  });

  it.each<[TokenItemType, TokenItemType, boolean]>([
    [
      flattenTokens.find((t) => t.chainId === "0x38" && t.coinGeckoId === "tether")!,
      flattenTokens.find((t) => t.chainId === "0x01" && t.coinGeckoId === "tether")!,
      false
    ],
    [
      flattenTokens.find((t) => t.chainId === "0x38" && t.coinGeckoId === "tether")!,
      flattenTokens.find((t) => t.chainId === "Oraichain" && t.coinGeckoId === "airight")!,
      false
    ],
    [
      flattenTokens.find((t) => t.chainId === "0x2b6653dc" && t.coinGeckoId === "tron")!,
      flattenTokens.find((t) => t.chainId === "Oraichain" && t.coinGeckoId === "tether")!,
      false
    ]
  ])("test-transferAndSwap()-for-%s", async (fromToken, toToken, willThrow) => {
    const evmWalletMock = {
      getFinalEvmAddress: jest.fn().mockReturnValue(fromToken.chainId === "0x2b6653dc" ? tronAddress : evmAddress),
      isTron: (chainId) => Number(chainId) == Networks.tron,
      switchNetwork: jest.fn().mockResolvedValue(true)
    };

    let mockValue = false;
    if (fromToken.chainId === toToken.chainId) mockValue = true;
    jest.spyOn(UniversalSwapHelper, "isEvmSwappable").mockReturnValue(mockValue);
    jest.spyOn(UniversalSwapHelper, "isSupportedNoPoolSwapEvm").mockReturnValue(mockValue);
    jest
      .spyOn(UniversalSwapHelper, "checkBalanceIBCOraichain")
      .mockReturnValue(new Promise((resolve) => resolve("checkBalanceIBCOraichain" as any)));
    jest.spyOn(UniversalSwapHelper, "checkFeeRelayer").mockReturnValue(new Promise((resolve) => resolve(true)));

    const getCosmWasmClientMock = jest.fn(() => Promise.resolve({ client: {} }));
    const cosmosWalletMock = { getCosmWasmClient: getCosmWasmClientMock };

    const sender = {
      cosmos: "orai1234",
      evm: evmAddress,
      tron: tronAddress
    };

    const universalSwap = new FakeUniversalSwapHandler(
      {
        ...universalSwapData,
        originalFromToken: fromToken,
        originalToToken: toToken,
        sender
      },
      {
        evmWallet: evmWalletMock as any,
        cosmosWallet: cosmosWalletMock as any
      }
    );

    jest
      .spyOn(universalSwap, "transferEvmToIBC")
      .mockReturnValue(new Promise((resolve) => resolve({ transactionHash: "transactionHash" })));

    try {
      const res = await universalSwap.transferAndSwap(fromToken.chainId === "0x2b6653dc" ? tronAddress : evmAddress);
      expect(res.transactionHash).toBe("transactionHash");
      expect(willThrow).toBe(false);
    } catch (error) {
      expect(willThrow).toBe(true);
    }
  });

  it.each<[TokenItemType, TokenItemType, boolean, boolean]>([
    [
      flattenTokens.find((t) => t.chainId === "0x01" && t.coinGeckoId === "tether")!,
      flattenTokens.find((t) => t.chainId === "Oraichain" && t.coinGeckoId === "tether")!,
      false,
      false
    ],
    [
      flattenTokens.find((t) => t.chainId === "0x2b6653dc" && t.coinGeckoId === "tron")!,
      flattenTokens.find((t) => t.chainId === "Oraichain" && t.coinGeckoId === "tether")!,
      true,
      false
    ]
  ])("test-transferEvmToIBC()-for-%s", async (fromToken, toToken, isTron, willThrow) => {
    const evmWalletMock = {
      checkOrIncreaseAllowance: jest.fn().mockReturnValue(true),
      getFinalEvmAddress: jest.fn().mockReturnValue(isTron ? tronAddress : evmAddress)
    };
    const sender = {
      cosmos: "orai1234",
      evm: evmAddress,
      tron: tronAddress
    };
    const universalSwap = new FakeUniversalSwapHandler(
      {
        ...universalSwapData,
        originalFromToken: fromToken,
        originalToToken: toToken,
        sender
      },
      {
        evmWallet: evmWalletMock as any
      }
    );

    jest
      .spyOn(universalSwap, "transferToGravity")
      .mockReturnValue(new Promise((resolve) => resolve({ transactionHash: "transactionHash" })));

    try {
      const res = await universalSwap.transferEvmToIBC(isTron ? tronAddress : evmAddress);
      expect(res.transactionHash).toBe("transactionHash");
      expect(willThrow).toBe(false);
    } catch (error) {
      expect(willThrow).toBe(true);
    }
  });

  // it("test-swap()", async () => {
  //   const universalSwap = new FakeUniversalSwapHandler({
  //     ...universalSwapData
  //   });
  //   // mock
  //   jest.replaceProperty(dexCommonNetwork.network, "router", routerContract.contractAddress);
  //   const result = universalSwap.swap();

  //   console.log("result: ", result);
  // });
});
