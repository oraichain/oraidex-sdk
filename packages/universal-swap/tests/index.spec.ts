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
  testSenderAddress,
  deployIcs20Token,
  deployToken,
  IBC_WASM_CONTRACT,
  CosmosChainId
} from "@oraichain/oraidex-common";
import * as dexCommonHelper from "@oraichain/oraidex-common/build/helper"; // import like this to enable jest.spyOn & avoid redefine property error
import { UniversalSwapHandler } from "../src/index";
import { AccountData, DirectSecp256k1HdWallet, OfflineSigner } from "@cosmjs/proto-signing";
import { JsonRpcProvider, JsonRpcSigner } from "@ethersproject/providers";
import TronWeb from "tronweb";
import Long from "long";
import { TronWeb as _TronWeb } from "@oraichain/oraidex-common/build/tronweb";
import { toUtf8 } from "@cosmjs/encoding";
import { SigningCosmWasmClient, SigningCosmWasmClientOptions, toBinary } from "@cosmjs/cosmwasm-stargate";
import { ibcInfos } from "@oraichain/oraidex-common/build/ibc-info";
import { OraiswapTokenClient, OraiswapTokenQueryClient } from "@oraichain/oraidex-contracts-sdk";
import { CWSimulateApp, GenericError, IbcOrder, IbcPacket, SimulateCosmWasmClient } from "@oraichain/cw-simulate";
import { CwIcs20LatestClient } from "@oraichain/common-contracts-sdk";
import bech32 from "bech32";

describe("test universal swap handler functions", () => {
  const client = new SimulateCosmWasmClient({
    chainId: "Oraichain",
    bech32Prefix: "orai"
  });
  let oraiPort: string;
  let channel = "channel-29";
  let routerContractAddress = "placeholder";
  let ibcTransferAmount = "100000000";
  let initialBalanceAmount = "10000000000000";
  let airiIbcDenom: string = "oraib0x7e2A35C746F2f7C240B664F1Da4DD100141AE71F";
  let bobAddress = "orai1ur2vsjrjarygawpdwtqteaazfchvw4fg6uql76";
  let oraiAddress = "orai12zyu8w93h0q2lcnt50g3fn0w3yqnhy4fvawaqz";
  let cosmosSenderAddress = bech32.encode("cosmos", bech32.decode(oraiAddress).words);

  let ics20Contract: CwIcs20LatestClient;
  let airiToken: OraiswapTokenClient;

  beforeAll(async () => {
    ics20Contract = await deployIcs20Token(client, { swap_router_contract: routerContractAddress });
    oraiPort = "wasm." + ics20Contract.contractAddress;
    let cosmosPort: string = "transfer";
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

    let newPacketData = {
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
      return new Promise((resolve) => resolve("orai1234"));
    }
    collectCosmosWallet(chainId: string): Promise<OfflineSigner> {
      return DirectSecp256k1HdWallet.generate();
    }

    getCosmWasmClient(
      config: { signer?: OfflineSigner; rpc?: string; chainId: CosmosChainId },
      options?: SigningCosmWasmClientOptions
    ): Promise<{ wallet: OfflineSigner; client: SigningCosmWasmClient; defaultAddress: AccountData }> {
      return new Promise((resolve) =>
        resolve({
          client,
          wallet: config.signer!,
          defaultAddress: { address: "", algo: "secp256k1", pubkey: Uint8Array.from([]) }
        })
      );
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

  describe("test-non-transaction-functions-universal-swap-handler", () => {
    const fromAmount = "100000";
    const simulateAmount = "100";
    const userSlippage = 1;
    const minimumReceive = "10000";
    class FakeUniversalSwapHandler extends UniversalSwapHandler {
      constructor(data?: any) {
        super(
          data ?? {
            cosmosSender: "",
            originalFromToken: oraichainTokens[0],
            originalToToken: oraichainTokens[1],
            simulateAmount: "0",
            simulateAverage: "0",
            userSlippage: 1,
            fromAmount: 1
          },
          { cosmosWallet, evmWallet, cwIcs20LatestClient: ics20Contract }
        );
      }
    }

    it.each([
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
              msg: toUtf8(
                JSON.stringify({
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
                })
              ),
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
      "test-combineMsgCosmos-with-%s",
      async (_name: string, fromCoingeckoId, toCoingeckoId, toChainId, expectedTransferMsg) => {
        jest.spyOn(dexCommonHelper, "calculateMinReceive").mockReturnValue(minimumReceive);
        const universalSwap = new FakeUniversalSwapHandler({
          cosmosSender: testSenderAddress,
          originalFromToken: oraichainTokens.find((t) => t.coinGeckoId === fromCoingeckoId),
          originalToToken: flattenTokens.find((t) => t.coinGeckoId === toCoingeckoId && t.chainId === toChainId),
          simulateAmount,
          simulateAverage: "0",
          userSlippage,
          fromAmount: toDisplay(fromAmount)
        });
        universalSwap.toTokenInOrai = oraichainTokens.find((t) => t.coinGeckoId === toCoingeckoId)!;
        const msg = await universalSwap.combineMsgCosmos("0");
        expect(msg).toEqual(expectedTransferMsg);
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
          cosmosSender: testSenderAddress,
          originalFromToken: oraichainTokens[0],
          originalToToken: toToken,
          simulateAmount,
          simulateAverage: "0",
          userSlippage,
          fromAmount: toDisplay(fromAmount)
        });
        const ibcInfo = ibcInfos["Oraichain"]["oraibridge-subnet-2"]!.channel;
        universalSwap.toTokenInOrai = oraichainTokens.find((t) => t.coinGeckoId === "airight")!;
        try {
          const transferAddress = universalSwap.getTranferAddress(metamaskAddress, tronAddress, ibcInfo);
          expect(transferAddress).toEqual(expectedTransferAddr);
        } catch (error) {
          expect(error?.ex?.message).toEqual("Please login metamask / tronlink!");
        }
      }
    );

    it.each([
      ["0x1234", flattenTokens.find((t) => t.chainId === "oraibridge-subnet-2")!, "oraib0x1234"],
      ["0x1234", flattenTokens.find((t) => t.chainId !== "oraibridge-subnet-2")!, ""]
    ])(
      "test getIbcMemo should return ibc memo correctly",
      (transferAddress: string, toToken: TokenItemType, expectedIbcMemo: string) => {
        const universalSwap = new FakeUniversalSwapHandler({
          cosmosSender: testSenderAddress,
          originalFromToken: oraichainTokens[0],
          originalToToken: toToken,
          simulateAmount,
          simulateAverage: "0",
          userSlippage,
          fromAmount: toDisplay(fromAmount)
        });
        jest.spyOn(universalSwap, "getTranferAddress").mockReturnValue(transferAddress);
        const ibcMemo = universalSwap.getIbcMemo("john doe", "john doe", "john doe", {
          chainId: toToken.chainId,
          prefix: toToken.prefix!
        });
        expect(ibcMemo).toEqual(expectedIbcMemo);
      }
    );

    it.each<[string, TokenItemType, string, boolean]>([
      [
        "1000000000000000000000000000000000000000",
        flattenTokens.find((t) => t.chainId === "0x38" && t.coinGeckoId === "airight")!,
        channel,
        true
      ],
      ["10", flattenTokens.find((t) => t.chainId === "0x38" && t.coinGeckoId === "airight")!, channel, false]
    ])("test-universal-swap-checkBalanceChannelIbc-%", async (amount, toToken, channel, willThrow) => {
      const universalSwap = new FakeUniversalSwapHandler({
        cosmosSender: testSenderAddress,
        originalFromToken: oraichainTokens[0],
        originalToToken: toToken,
        simulateAmount,
        simulateAverage: "0",
        userSlippage,
        fromAmount: toDisplay(fromAmount)
      });
      try {
        await universalSwap.checkBalanceChannelIbc(
          {
            source: oraiPort,
            channel: channel,
            timeout: 3600
          },
          toToken
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
      const universalSwap = new FakeUniversalSwapHandler({
        cosmosSender: testSenderAddress,
        originalFromToken: oraichainTokens[0],
        originalToToken: oraichainTokens[0],
        simulateAmount: "0",
        simulateAverage: "0",
        userSlippage,
        fromAmount: 0
      });
      let mockToken = { ...token };
      if (mockToken.contractAddress) {
        if (mockToken.coinGeckoId === "airight") mockToken.contractAddress = airiToken.contractAddress;
      }
      const { balance } = await universalSwap.getBalanceIBCOraichain(mockToken);
      expect(balance).toEqual(expectedBalance);
    });
  });
});
