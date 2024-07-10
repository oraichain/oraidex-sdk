import {
  CosmosWallet,
  EvmWallet,
  NetworkChainId,
  OSMOSIS_ORAICHAIN_DENOM,
  flattenTokens,
  oraichain2osmosis,
  oraichainTokens,
  USDT_CONTRACT,
  ROUTER_V2_CONTRACT,
  toDisplay,
  ORAI_BRIDGE_EVM_TRON_DENOM_PREFIX,
  TokenItemType,
  CosmosChainId,
  CoinGeckoId,
  AIRI_CONTRACT,
  IBC_WASM_CONTRACT,
  ORAI_BRIDGE_EVM_DENOM_PREFIX,
  AIRI_BSC_CONTRACT,
  IBC_TRANSFER_TIMEOUT,
  toTokenInfo,
  IBC_WASM_CONTRACT_TEST,
  USDC_CONTRACT,
  calculateTimeoutTimestamp,
  BigDecimal,
  OSMOSIS_ROUTER_CONTRACT
} from "@oraichain/oraidex-common";
import * as dexCommonHelper from "@oraichain/oraidex-common/build/helper"; // import like this to enable jest.spyOn & avoid redefine property error
import { DirectSecp256k1HdWallet, EncodeObject, OfflineSigner } from "@cosmjs/proto-signing";
import { JsonRpcProvider, JsonRpcSigner } from "@ethersproject/providers";
import TronWeb from "tronweb";
import Long from "long";
import { TronWeb as _TronWeb } from "@oraichain/oraidex-common/build/tronweb";
import { fromUtf8, toUtf8 } from "@cosmjs/encoding";
import { toBinary } from "@cosmjs/cosmwasm-stargate";
import { ibcInfos, oraichain2oraib } from "@oraichain/oraidex-common/build/ibc-info";
import {
  OraiswapFactoryClient,
  OraiswapOracleClient,
  OraiswapRouterClient,
  OraiswapRouterQueryClient,
  OraiswapTokenClient
} from "@oraichain/oraidex-contracts-sdk";
import { CWSimulateApp, GenericError, IbcOrder, IbcPacket, SimulateCosmWasmClient } from "@oraichain/cw-simulate";
import { CwIcs20LatestClient } from "@oraichain/common-contracts-sdk";
import bech32 from "bech32";
import { Route, Routes, UniversalSwapConfig, UniversalSwapData, UniversalSwapType } from "../src/types";
import { deployIcs20Token, deployToken, testSenderAddress } from "./test-common";
import * as oraidexArtifacts from "@oraichain/oraidex-contracts-build";
import { readFileSync } from "fs";
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
import {
  alphaSmartRoute,
  alphaSmartRoutes,
  flattenAlphaSmartRouters,
  objBridgeInSmartRoute,
  objSwapInOsmosis
} from "./smart-router-common";

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
  const cosmosSenderAddress = bech32.encode("cosmos", bech32.decode(oraiAddress).words);

  const smartRoutesOraiAddr = "orai12zyu8w93h0q2lcnt50g3fn0w3yqnhy4fvawaqz";
  const smartRoutesInjAddr = "inj172zx58jd47h28rqkvznpsfmavas9h544t024u3";
  const smartRoutesOsmoAddr = "osmo12zyu8w93h0q2lcnt50g3fn0w3yqnhy4fh4twhr";
  const osmosisContractRouter = OSMOSIS_ROUTER_CONTRACT;

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

  xit.each<[boolean, boolean, boolean, string]>([
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
        routerClient: new OraiswapRouterQueryClient(client, "")
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

  // it("test-swap()", async () => {
  //   const universalSwap = new FakeUniversalSwapHandler({
  //     ...universalSwapData
  //   });
  //   // mock
  //   jest.replaceProperty(dexCommonNetwork.network, "router", routerContract.contractAddress);
  //   const result = universalSwap.swap();

  //   console.log("result: ", result);
  // });

  it("test-flattenSmartRouters()", async () => {
    const universalSwap = new FakeUniversalSwapHandler({
      ...universalSwapData
    });

    const routesFlatten = universalSwap.flattenSmartRouters(alphaSmartRoutes.routes);
    expect(routesFlatten).toEqual(expect.any(Array));
    expect(routesFlatten).toHaveLength(2);
    expect(routesFlatten).toEqual(flattenAlphaSmartRouters);
  });

  it.each<[string, Routes, boolean, boolean, any]>([
    [
      smartRoutesOsmoAddr,
      objSwapInOsmosis,
      true,
      true,
      {
        msgActionSwap: {
          sender: smartRoutesOsmoAddr,
          contractAddress: osmosisContractRouter,
          funds: [
            {
              denom: objSwapInOsmosis.tokenIn,
              amount: objSwapInOsmosis.tokenInAmount
            }
          ],
          msg: {
            swap_and_action: {
              user_swap: {
                swap_exact_asset_in: {
                  swap_venue_name: "osmosis-poolmanager",
                  operations: [
                    {
                      denom_in: objSwapInOsmosis.tokenIn,
                      denom_out: objSwapInOsmosis.swapInfo[0].tokenOut,
                      pool: objSwapInOsmosis.swapInfo[0].poolId
                    },
                    {
                      denom_in: objSwapInOsmosis.swapInfo[0].tokenOut,
                      denom_out: objSwapInOsmosis.swapInfo[1].tokenOut,
                      pool: objSwapInOsmosis.swapInfo[1].poolId
                    },
                    {
                      denom_in: objSwapInOsmosis.swapInfo[1].tokenOut,
                      denom_out: objSwapInOsmosis.swapInfo[2].tokenOut,
                      pool: objSwapInOsmosis.swapInfo[2].poolId
                    }
                  ]
                }
              },
              min_asset: {
                native: {
                  denom: objSwapInOsmosis.tokenOut,
                  amount: Math.trunc(
                    new BigDecimal(objSwapInOsmosis.tokenInAmount).mul((100 - userSlippage) / 100).toNumber()
                  ).toString()
                }
              },
              timeout_timestamp: Number(calculateTimeoutTimestamp(3600)),
              post_swap_action: {
                transfer: {
                  to_address: smartRoutesOsmoAddr
                }
              },
              affiliates: []
            }
          }
        }
      }
    ],
    [
      smartRoutesOsmoAddr,
      objSwapInOsmosis,
      false,
      true,
      {
        msgActionSwap: {
          sender: smartRoutesOsmoAddr,
          contractAddress: osmosisContractRouter,
          funds: [
            {
              denom: objSwapInOsmosis.tokenIn,
              amount: objSwapInOsmosis.tokenInAmount
            }
          ],
          msg: {
            swap_and_action: {
              user_swap: {
                swap_exact_asset_in: {
                  swap_venue_name: "osmosis-poolmanager",
                  operations: [
                    {
                      denom_in: objSwapInOsmosis.tokenIn,
                      denom_out: objSwapInOsmosis.swapInfo[0].tokenOut,
                      pool: objSwapInOsmosis.swapInfo[0].poolId
                    },
                    {
                      denom_in: objSwapInOsmosis.swapInfo[0].tokenOut,
                      denom_out: objSwapInOsmosis.swapInfo[1].tokenOut,
                      pool: objSwapInOsmosis.swapInfo[1].poolId
                    },
                    {
                      denom_in: objSwapInOsmosis.swapInfo[1].tokenOut,
                      denom_out: objSwapInOsmosis.swapInfo[2].tokenOut,
                      pool: objSwapInOsmosis.swapInfo[2].poolId
                    }
                  ]
                }
              },
              min_asset: {
                native: {
                  denom: objSwapInOsmosis.tokenOut,
                  amount: Math.trunc(
                    new BigDecimal(objSwapInOsmosis.tokenInAmount).mul((100 - userSlippage) / 100).toNumber()
                  ).toString()
                }
              },
              timeout_timestamp: Number(calculateTimeoutTimestamp(3600)),
              post_swap_action: {},
              affiliates: []
            }
          }
        }
      }
    ],
    [
      smartRoutesOsmoAddr,
      objSwapInOsmosis,
      false,
      false,
      {
        msgActionSwap: {
          wasm: {
            contract: osmosisContractRouter,
            msg: {
              swap_and_action: {
                user_swap: {
                  swap_exact_asset_in: {
                    swap_venue_name: "osmosis-poolmanager",
                    operations: [
                      {
                        denom_in: objSwapInOsmosis.tokenIn,
                        denom_out: objSwapInOsmosis.swapInfo[0].tokenOut,
                        pool: objSwapInOsmosis.swapInfo[0].poolId
                      },
                      {
                        denom_in: objSwapInOsmosis.swapInfo[0].tokenOut,
                        denom_out: objSwapInOsmosis.swapInfo[1].tokenOut,
                        pool: objSwapInOsmosis.swapInfo[1].poolId
                      },
                      {
                        denom_in: objSwapInOsmosis.swapInfo[1].tokenOut,
                        denom_out: objSwapInOsmosis.swapInfo[2].tokenOut,
                        pool: objSwapInOsmosis.swapInfo[2].poolId
                      }
                    ]
                  }
                },
                min_asset: {
                  native: {
                    denom: objSwapInOsmosis.tokenOut,
                    amount: Math.trunc(
                      new BigDecimal(objSwapInOsmosis.tokenInAmount).mul((100 - userSlippage) / 100).toNumber()
                    ).toString()
                  }
                },
                timeout_timestamp: Number(calculateTimeoutTimestamp(3600)),
                post_swap_action: {},
                affiliates: []
              }
            }
          }
        }
      }
    ]
  ])("test-get-swap-and-ation-in-osmosis", (senderCosmos, route, isOnlySwap, isInitial, expectResult) => {
    const universalSwap = new FakeUniversalSwapHandler({
      ...universalSwapData,
      sender: {
        ...universalSwapData.sender,
        cosmos: senderCosmos
      }
    });

    const msgSwapAndAction = universalSwap.getSwapAndActionInOsmosis(
      route,
      {
        oraiAddress: smartRoutesOraiAddr,
        injAddress: smartRoutesInjAddr
      },
      isOnlySwap,
      isInitial
    );
    expect(msgSwapAndAction).toEqual(expectResult);
  });

  it.each<[string, any, any]>([
    [
      smartRoutesOsmoAddr,
      objBridgeInSmartRoute[0],
      {
        sourcePort: objBridgeInSmartRoute[0].bridgeInfo.port,
        sourceChannel: objBridgeInSmartRoute[0].bridgeInfo.channel,
        receiver: smartRoutesInjAddr,
        token: {
          amount: objBridgeInSmartRoute[0].tokenInAmount,
          denom: objBridgeInSmartRoute[0].tokenIn
        },
        sender: smartRoutesOsmoAddr,
        memo: "",
        timeoutTimestamp: Number(calculateTimeoutTimestamp(3600))
      }
    ],
    [
      smartRoutesOraiAddr,
      objBridgeInSmartRoute[1],
      {
        sourcePort: objBridgeInSmartRoute[1].bridgeInfo.port,
        sourceChannel: objBridgeInSmartRoute[1].bridgeInfo.channel,
        receiver: smartRoutesInjAddr,
        token: {
          amount: objBridgeInSmartRoute[1].tokenInAmount,
          denom: objBridgeInSmartRoute[1].tokenIn
        },
        sender: smartRoutesOraiAddr,
        memo: "",
        timeoutTimestamp: Number(calculateTimeoutTimestamp(3600))
      }
    ],
    [
      smartRoutesOraiAddr,
      objBridgeInSmartRoute[2],
      {
        sourcePort: objBridgeInSmartRoute[2].bridgeInfo.port,
        sourceChannel: objBridgeInSmartRoute[2].bridgeInfo.channel,
        receiver: smartRoutesOsmoAddr,
        token: {
          amount: objBridgeInSmartRoute[2].tokenInAmount,
          denom: objBridgeInSmartRoute[2].tokenIn
        },
        sender: smartRoutesOraiAddr,
        memo: "",
        timeoutTimestamp: Number(calculateTimeoutTimestamp(3600))
      }
    ],
    [
      smartRoutesOraiAddr,
      objBridgeInSmartRoute[3],
      {
        sourcePort: objBridgeInSmartRoute[3].bridgeInfo.port,
        sourceChannel: objBridgeInSmartRoute[3].bridgeInfo.channel,
        receiver: osmosisContractRouter,
        token: {
          amount: objBridgeInSmartRoute[3].tokenInAmount,
          denom: objBridgeInSmartRoute[3].tokenIn
        },
        sender: smartRoutesOraiAddr,
        memo: "",
        timeoutTimestamp: Number(calculateTimeoutTimestamp(3600))
      }
    ]
  ])("test-get-msg-transfer-with-smart-route", (sender, route, expectResult) => {
    const universalSwap = new FakeUniversalSwapHandler({
      ...universalSwapData,
      sender: {
        cosmos: sender
      }
    });

    const msgSwapAndAction = universalSwap.getMsgTransfer(
      route,
      {
        oraiAddress: smartRoutesOraiAddr,
        injAddress: smartRoutesInjAddr
      },
      route.isLastPath
    );

    expect(msgSwapAndAction).toEqual(expectResult);
  });

  it.each<[string, any, any]>([
    [
      smartRoutesOsmoAddr,
      objBridgeInSmartRoute[0],
      {
        msgForwardObject: {
          forward: {
            receiver: smartRoutesInjAddr,
            port: objBridgeInSmartRoute[0].bridgeInfo.port,
            channel: objBridgeInSmartRoute[0].bridgeInfo.channel,
            timeout: 0,
            retries: 2
          }
        }
      }
    ],
    [
      smartRoutesOraiAddr,
      objBridgeInSmartRoute[1],
      {
        msgForwardObject: {
          forward: {
            receiver: smartRoutesInjAddr,
            port: objBridgeInSmartRoute[1].bridgeInfo.port,
            channel: objBridgeInSmartRoute[1].bridgeInfo.channel,
            timeout: 0,
            retries: 2
          }
        }
      }
    ]
  ])("test-create-msg-forward-object-smart-route", (sender, route, expectResult) => {
    const universalSwap = new FakeUniversalSwapHandler({
      ...universalSwapData,
      sender: {
        cosmos: sender
      }
    });

    const msgSwapAndAction = universalSwap.createForwardObject(route, {
      oraiAddress: smartRoutesOraiAddr,
      injAddress: smartRoutesInjAddr
    });
    expect(msgSwapAndAction).toEqual(expectResult);
  });

  it.each<[string, any, any, any]>([
    [
      smartRoutesOraiAddr,
      alphaSmartRoute[0],
      [
        {
          contractAddress: "orai1j0r67r9k8t34pnhy00x3ftuxuwg0r6r4p8p6rrc8az0ednzr8y9s3sj2sf",
          msg: {
            execute_swap_operations: {
              operations: [
                {
                  orai_swap: {
                    offer_asset_info: {
                      native_token: { denom: alphaSmartRoute[0].routes[0].paths[0].actions[0].tokenIn }
                    },
                    ask_asset_info: {
                      native_token: {
                        denom: alphaSmartRoute[0].routes[0].paths[0].actions[0].tokenOut
                      }
                    }
                  }
                }
              ],
              minimum_receive: alphaSmartRoute[0].routes[0].paths[0].actions[0].tokenOutAmount,
              to: undefined
            }
          },
          funds: [
            {
              denom: alphaSmartRoute[0].routes[0].paths[0].actions[0].tokenIn,
              amount: alphaSmartRoute[0].routes[0].paths[0].actions[0].tokenInAmount
            }
          ]
        }
      ],
      [
        {
          memo: "",
          receiver: smartRoutesOsmoAddr,
          sender: smartRoutesOraiAddr,
          sourceChannel: alphaSmartRoute[0].routes[0].paths[0].actions[1].bridgeInfo?.channel,
          sourcePort: alphaSmartRoute[0].routes[0].paths[0].actions[1].bridgeInfo?.port,
          token: {
            amount: alphaSmartRoute[0].routes[0].paths[0].actions[1].tokenInAmount,
            denom: alphaSmartRoute[0].routes[0].paths[0].actions[1].tokenIn
          },
          timeoutTimestamp: Number(calculateTimeoutTimestamp(3600))
        }
      ]
    ]
    // [smartRoutesOraiAddr, alphaSmartRoute[1], [], []]
  ])("test-get-msg-and-object-msg-transfers", (sender, route, expectResultMessages, expectResultMsgTransfer) => {
    const universalSwap = new FakeUniversalSwapHandler({
      ...universalSwapData,
      userSlippage: 0,
      sender: {
        cosmos: sender
      }
    });
    const routesFlatten = universalSwap.flattenSmartRouters(route.routes);
    const { messages, msgTransfers } = universalSwap.getMessagesAndMsgTransfers(routesFlatten, {
      oraiAddress: smartRoutesOraiAddr,
      injAddress: smartRoutesInjAddr
    });

    expect(messages).toEqual(expectResultMessages);
    expect(msgTransfers).toEqual(expectResultMsgTransfer);
  });
});
