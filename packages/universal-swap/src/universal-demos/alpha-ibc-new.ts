import "dotenv/config";
import { CosmosWalletImpl } from "./offline-wallet";
import { UniversalSwapHandler } from "../handler";
import { cosmosTokens, flattenTokens, generateError, getTokenOnOraichain, toAmount } from "@oraichain/oraidex-common";

const router = {
  swapAmount: "100000",
  returnAmount: "9983",
  routes: [
    {
      swapAmount: "100000",
      returnAmount: "9983",
      paths: [
        {
          chainId: "osmosis-1",
          tokenIn: "uosmo",
          tokenInAmount: "100000",
          tokenOut: "utia",
          tokenOutAmount: "9983",
          tokenOutChainId: "celestia",
          actions: [
            {
              type: "Swap",
              protocol: "Osmosis",
              tokenIn: "uosmo",
              tokenInAmount: "100000",
              tokenOut: "ibc/D79E7D83AB399BFFF93433E54FAA480C191248FC556924A2A8351AE2638B3877",
              tokenOutAmount: "9983",
              swapInfo: [
                {
                  poolId: "1347",
                  tokenOut: "ibc/D79E7D83AB399BFFF93433E54FAA480C191248FC556924A2A8351AE2638B3877"
                }
              ]
            },
            {
              type: "Bridge",
              protocol: "Bridge",
              tokenIn: "ibc/D79E7D83AB399BFFF93433E54FAA480C191248FC556924A2A8351AE2638B3877",
              tokenInAmount: "9983",
              tokenOut: "utia",
              tokenOutAmount: "9983",
              tokenOutChainId: "celestia",
              bridgeInfo: {
                port: "transfer",
                channel: "channel-6994"
              }
            }
          ]
        }
      ]
    }
  ]
};

const alphaSwapToOraichain = async () => {
  const wallet = new CosmosWalletImpl(process.env.MNEMONIC);
  const sender = await wallet.getKeplrAddr("osmosis-1");

  const fromAmount = 0.1;
  console.log("sender: ", sender);
  const originalFromToken = flattenTokens.find((t) => t.coinGeckoId === "osmosis" && t.chainId === "osmosis-1");
  const originalToToken = flattenTokens.find((t) => t.coinGeckoId === "celestia" && t.chainId === "celestia");

  if (!originalToToken) throw generateError("Could not find original to token");
  if (!originalFromToken) throw generateError("Could not find original from token");

  const universalHandler = new UniversalSwapHandler(
    {
      originalFromToken,
      originalToToken,
      sender: { cosmos: sender, evm: "0x8c7E0A841269a01c0Ab389Ce8Fb3Cf150A94E797" },
      fromAmount,
      userSlippage: 1,
      // relayerFee: {
      //   relayerAmount: "100000",
      //   relayerDecimals: 6
      // },
      simulatePrice: "99956",
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
