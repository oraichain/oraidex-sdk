import "dotenv/config";
import { CosmosWalletImpl } from "./offline-wallet";
import { UniversalSwapHandler } from "../handler";
import { cosmosTokens, flattenTokens, generateError, getTokenOnOraichain, toAmount } from "@oraichain/oraidex-common";

const router = {
  swapAmount: "2000000",
  returnAmount: "241755",
  routes: [
    {
      swapAmount: "2000000",
      returnAmount: "241755",
      paths: [
        {
          chainId: "0x38",
          tokenIn: "0x55d398326f99059fF775485246999027B3197955",
          tokenInAmount: "2000000",
          tokenOut: "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh",
          tokenOutAmount: "1366092",
          tokenOutChainId: "Oraichain",
          actions: [
            {
              type: "Bridge",
              protocol: "Bridge",
              tokenIn: "0x55d398326f99059fF775485246999027B3197955",
              tokenInAmount: "2000000",
              tokenOut: "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh",
              tokenOutAmount: "1366092",
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
          tokenInAmount: "1366092",
          tokenOut: "uosmo",
          tokenOutAmount: "2445755",
          tokenOutChainId: "osmosis-1",
          actions: [
            {
              type: "Swap",
              protocol: "OraidexV3",
              tokenIn: "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh",
              tokenInAmount: "1366092",
              tokenOut: "orai",
              tokenOutAmount: "214856",
              swapInfo: [
                {
                  poolId: "orai-orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh-3000000000-100",
                  tokenOut: "orai"
                }
              ]
            },
            {
              type: "Swap",
              protocol: "Oraidex",
              tokenIn: "orai",
              tokenInAmount: "214856",
              tokenOut: "ibc/9C4DCD21B48231D0BC2AC3D1B74A864746B37E4292694C93C617324250D002FC",
              tokenOutAmount: "2445755",
              swapInfo: [
                {
                  poolId: "orai1d37artrk4tkhz2qyjmaulc2jzjkx7206tmpfug",
                  tokenOut: "ibc/9C4DCD21B48231D0BC2AC3D1B74A864746B37E4292694C93C617324250D002FC"
                }
              ]
            },
            {
              type: "Bridge",
              protocol: "Bridge",
              tokenIn: "ibc/9C4DCD21B48231D0BC2AC3D1B74A864746B37E4292694C93C617324250D002FC",
              tokenInAmount: "2445755",
              tokenOut: "uosmo",
              tokenOutAmount: "2445755",
              tokenOutChainId: "osmosis-1",
              bridgeInfo: {
                port: "transfer",
                channel: "channel-13"
              }
            }
          ]
        },
        {
          chainId: "osmosis-1",
          tokenIn: "uosmo",
          tokenInAmount: "2445755",
          tokenOut: "utia",
          tokenOutAmount: "241755",
          tokenOutChainId: "celestia",
          actions: [
            {
              type: "Swap",
              protocol: "Osmosis",
              tokenIn: "uosmo",
              tokenInAmount: "2445755",
              tokenOut: "ibc/D79E7D83AB399BFFF93433E54FAA480C191248FC556924A2A8351AE2638B3877",
              tokenOutAmount: "241755",
              swapInfo: [
                {
                  poolId: "1263",
                  tokenOut: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4"
                },
                {
                  poolId: "1247",
                  tokenOut: "ibc/D79E7D83AB399BFFF93433E54FAA480C191248FC556924A2A8351AE2638B3877"
                }
              ]
            },
            {
              type: "Bridge",
              protocol: "Bridge",
              tokenIn: "ibc/D79E7D83AB399BFFF93433E54FAA480C191248FC556924A2A8351AE2638B3877",
              tokenInAmount: "241755",
              tokenOut: "utia",
              tokenOutAmount: "241755",
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
  const sender = await wallet.getKeplrAddr("Oraichain");

  const fromAmount = 2;
  console.log("sender: ", sender);
  const originalFromToken = flattenTokens.find((t) => t.coinGeckoId === "tether" && t.chainId === "0x38");
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
      relayerFee: {
        relayerAmount: "100000",
        relayerDecimals: 6
      },
      simulatePrice: "147161",
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
