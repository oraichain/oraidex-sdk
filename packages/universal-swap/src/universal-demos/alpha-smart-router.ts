import "dotenv/config";
import { CosmosWalletImpl } from "./offline-wallet";
import { UniversalSwapHandler } from "../handler";
import { cosmosTokens, generateError, getTokenOnOraichain, toAmount } from "@oraichain/oraidex-common";

const router = {
  swapAmount: "100000",
  returnAmount: "978854",
  routes: [
    {
      swapAmount: "100000",
      returnAmount: "978854",
      paths: [
        {
          chainId: "cosmoshub-4",
          tokenIn: "uatom",
          tokenInAmount: "100000",
          tokenOut: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
          tokenOutAmount: "100000",
          tokenOutChainId: "osmosis-1",
          actions: [
            {
              type: "Bridge",
              tokenIn: "uatom",
              tokenInAmount: "100000",
              tokenOut: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
              tokenOutAmount: "100000",
              tokenOutChainId: "osmosis-1",
              bridgeInfo: {
                port: "transfer",
                channel: "channel-141"
              }
            }
          ]
        },
        {
          chainId: "osmosis-1",
          tokenIn: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
          tokenInAmount: "100000",
          tokenOut: "uosmo",
          tokenOutAmount: "978854",
          tokenOutChainId: "osmosis-1",
          actions: [
            {
              type: "Swap",
              tokenIn: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
              tokenInAmount: "100000",
              tokenOut: "uosmo",
              tokenOutAmount: "978854",
              swapInfo: [
                {
                  poolId: "1135",
                  tokenOut: "uosmo"
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
  const sender = await wallet.getKeplrAddr("cosmoshub-4");
  const fromAmount = 0.1;
  console.log("sender: ", sender);
  const originalFromToken = cosmosTokens.find((t) => t.coinGeckoId === "cosmos" && t.chainId === "cosmoshub-4");
  const originalToToken = cosmosTokens.find((t) => t.coinGeckoId === "osmosis" && t.chainId === "osmosis-1");

  if (!originalToToken) throw generateError("Could not find original to token");
  if (!originalFromToken) throw generateError("Could not find original from token");

  const universalHandler = new UniversalSwapHandler(
    {
      originalFromToken,
      originalToToken,
      sender: { cosmos: sender },
      fromAmount,
      userSlippage: 100,
      simulatePrice: "9834300",
      simulateAmount: toAmount(fromAmount, originalToToken.decimals).toString(),
      alphaSmartRoutes: router
    },
    { cosmosWallet: wallet, swapOptions: { isAlphaSmartRouter: true } }
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
