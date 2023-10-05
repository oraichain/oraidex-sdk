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
  toDisplay
} from "@oraichain/oraidex-common";
import * as dexCommonHelper from "@oraichain/oraidex-common/build/helper"; // import like this to enable jest.spyOn & avoid redefine property error
import { UniversalSwapHandler } from "../src/index";
import { DirectSecp256k1HdWallet, OfflineSigner } from "@cosmjs/proto-signing";
import { JsonRpcProvider, JsonRpcSigner } from "@ethersproject/providers";
import TronWeb from "tronweb";
import Long from "long";
import { TronWeb as _TronWeb } from "@oraichain/oraidex-common/build/tronweb";
import { toUtf8 } from "@cosmjs/encoding";
import { toBinary } from "@cosmjs/cosmwasm-stargate";

describe("test universal swap handler functions", () => {
  class StubCosmosWallet extends CosmosWallet {
    getKeplrAddr(chainId?: NetworkChainId | undefined): Promise<string> {
      return new Promise((resolve) => resolve("orai1234"));
    }
    collectCosmosWallet(chainId: string): Promise<OfflineSigner> {
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
  const senderAddress = "orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g";

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
          { cosmosWallet, evmWallet }
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
              sender: senderAddress,
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
              sender: senderAddress,
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
              sender: senderAddress,
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
          cosmosSender: senderAddress,
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
  });
});
