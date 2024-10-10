import "dotenv/config";
import { CosmosWalletImpl } from "./offline-wallet";
import { UniversalSwapHandler } from "../handler";
import { cosmosTokens, flattenTokens, generateError, getTokenOnOraichain, toAmount } from "@oraichain/oraidex-common";

const router = {
  swapAmount: "10000000",
  returnAmount: "633497",
  routes: [
    {
      swapAmount: "10000000",
      returnAmount: "633497",
      paths: [
        {
          chainId: "0x01",
          tokenIn: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
          tokenInAmount: "10000000",
          tokenOut: "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh",
          tokenOutAmount: "3868034",
          tokenOutChainId: "Oraichain",
          actions: [
            {
              type: "Bridge",
              protocol: "Bridge",
              tokenIn: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
              tokenInAmount: "10000000",
              tokenOut: "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh",
              tokenOutAmount: "3868034",
              tokenOutChainId: "Oraichain",
              bridgeInfo: {
                port: "transfer",
                channel: "channel-1"
              }
            }
          ]
        },
        {
          chainId: "Oraichain",
          tokenIn: "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh",
          tokenInAmount: "3868034",
          tokenOut: "orai",
          tokenOutAmount: "633497",
          tokenOutChainId: "Oraichain",
          actions: [
            {
              type: "Swap",
              protocol: "OraidexV3",
              tokenIn: "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh",
              tokenInAmount: "3868034",
              tokenOut: "orai10g6frpysmdgw5tdqke47als6f97aqmr8s3cljsvjce4n5enjftcqtamzsd",
              tokenOutAmount: "63",
              swapInfo: [
                {
                  poolId:
                    "orai10g6frpysmdgw5tdqke47als6f97aqmr8s3cljsvjce4n5enjftcqtamzsd-orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh-3000000000-100",
                  tokenOut: "orai10g6frpysmdgw5tdqke47als6f97aqmr8s3cljsvjce4n5enjftcqtamzsd"
                }
              ]
            },
            {
              type: "Swap",
              protocol: "Oraidex",
              tokenIn: "orai10g6frpysmdgw5tdqke47als6f97aqmr8s3cljsvjce4n5enjftcqtamzsd",
              tokenInAmount: "63",
              tokenOut: "orai",
              tokenOutAmount: "633497",
              swapInfo: [
                {
                  poolId: "orai1fv5kwdv4z0gvp75ht378x8cg2j7prlywa0g35qmctez9q8u4xryspn6lrd",
                  tokenOut: "orai"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
};

const alphaSwapToOraichain = async () => {
  const wallet = new CosmosWalletImpl(process.env.MNEMONIC);
  const sender = await wallet.getKeplrAddr("Oraichain");
  const fromAmount = 10;
  console.log("sender: ", sender);
  const originalFromToken = flattenTokens.find((t) => t.coinGeckoId === "tether" && t.chainId === "0x01");
  const originalToToken = flattenTokens.find((t) => t.coinGeckoId === "oraichain-token" && t.chainId === "Oraichain");

  if (!originalToToken) throw generateError("Could not find original to token");
  if (!originalFromToken) throw generateError("Could not find original from token");

  const universalHandler = new UniversalSwapHandler(
    {
      originalFromToken,
      originalToToken,
      sender: { cosmos: sender, evm: "0x8c7E0A841269a01c0Ab389Ce8Fb3Cf150A94E797" },
      fromAmount,
      userSlippage: 1,
      relayerFee: {
        relayerAmount: "100000",
        relayerDecimals: 6
      },
      // recipientAddress: "orai1hvr9d72r5um9lvt0rpkd4r75vrsqtw6yujhqs2",
      // recipientAddress: "osmo12zyu8w93h0q2lcnt50g3fn0w3yqnhy4fh4twhr",
      // recipientAddress: "inj133lq4pqjdxspcz4n388glv70z59ffeuh3ktnaj",
      simulatePrice: "162461",
      simulateAmount: toAmount(fromAmount, originalToToken.decimals).toString(),
      alphaSmartRoutes: router
    },
    {
      cosmosWallet: wallet,
      swapOptions: { isIbcWasm: false, isAlphaIbcWasm: true }
    }
  );

  try {
    const result = await universalHandler.processUniversalSwap();
    console.log("result: ", result);
  } catch (error) {
    console.trace("error: ", error);
  }
};

(() => {
  alphaSwapToOraichain();
})();
