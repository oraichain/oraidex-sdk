import { CosmosWallet, EvmWallet, NetworkChainId, oraichainTokens } from "@oraichain/oraidex-common";
import { UniversalSwapHandler } from "../src/index";
import { DirectSecp256k1HdWallet, OfflineSigner } from "@cosmjs/proto-signing";
import { JsonRpcProvider, JsonRpcSigner } from "@ethersproject/providers";
import TronWeb from "tronweb";
import { TronWeb as _TronWeb } from "@oraichain/oraidex-common/build/tronweb";

describe("test universal swap handler functions", () => {
  class StubCosmosWallet extends CosmosWallet {
    getKeplrAddr(chainId?: NetworkChainId | undefined): Promise<string> {
      return new Promise((resolve) => resolve("orai1dshsfjqaysl4uvldc9utts32swcw0r4z5udn58"));
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
      return new Promise((resolve) => resolve("0xE0d4b2b3f8016f3fef8C9D8421C02F520cd04789"));
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
  const cosmosSender = "orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g";

  describe("test-non-transaction-functions-universal-swap-handler", () => {
    class FakeUniversalSwapHandler extends UniversalSwapHandler {
      constructor() {
        super(
          {
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
    it("test-getUniversalSwapToAddress", async () => {
      const universalSwap = new FakeUniversalSwapHandler();
      const cosmosWalletSpy = jest.spyOn(cosmosWallet, "getKeplrAddr");
      const evmWalletSpy = jest.spyOn(evmWallet, "getEthAddress");
      cosmosWalletSpy.mockImplementation(() => new Promise((resolve) => resolve("orai1234")));
      evmWalletSpy.mockImplementation(() => new Promise((resolve) => resolve("0x1234")));
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
