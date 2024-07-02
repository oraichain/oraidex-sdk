import "dotenv/config";
import { CosmosWalletImpl } from "./offline-wallet";
import { UniversalSwapHandler } from "../handler";
import { cosmosTokens, generateError, getTokenOnOraichain, toAmount } from "@oraichain/oraidex-common";

const router = {
  swapAmount: "100000",
  returnAmount: "40975008686170973",
  routes: [
    {
      swapAmount: "100000",
      returnAmount: "40975008686170973",
      paths: [
        {
          chainId: "Oraichain",
          tokenIn: "orai",
          tokenInAmount: "100000",
          tokenOut: "uatom",
          tokenOutAmount: "133950",
          tokenOutChainId: "cosmoshub-4",
          actions: [
            {
              type: "Swap",
              tokenIn: "orai",
              tokenInAmount: "100000",
              tokenOut: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
              tokenOutAmount: "133950",
              swapInfo: [
                {
                  poolId: "orai1jf74ry4m0jcy9emsaudkhe7vte9l8qy8enakvs",
                  tokenOut: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78"
                }
              ]
            },
            {
              type: "Bridge",
              tokenIn: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
              tokenInAmount: "133950",
              tokenOut: "uatom",
              tokenOutAmount: "133950",
              tokenOutChainId: "cosmoshub-4",
              bridgeInfo: {
                port: "transfer",
                channel: "channel-15"
              }
            }
          ]
        },
        {
          chainId: "cosmoshub-4",
          tokenIn: "uatom",
          tokenInAmount: "133950",
          tokenOut: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
          tokenOutAmount: "133950",
          tokenOutChainId: "osmosis-1",
          actions: [
            {
              type: "Bridge",
              tokenIn: "uatom",
              tokenInAmount: "133950",
              tokenOut: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
              tokenOutAmount: "133950",
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
          tokenInAmount: "133950",
          tokenOut: "inj",
          tokenOutAmount: "40975008686170973",
          tokenOutChainId: "injective-1",
          actions: [
            {
              type: "Swap",
              tokenIn: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
              tokenInAmount: "133950",
              tokenOut: "ibc/64BA6E31FE887D66C6F8F31C7B1A80C7CA179239677B4088BB55F5EA07DBE273",
              tokenOutAmount: "40975008686170973",
              swapInfo: [
                {
                  poolId: "1282",
                  tokenOut: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4"
                },
                {
                  poolId: "1464",
                  tokenOut: "uosmo"
                },
                {
                  poolId: "725",
                  tokenOut: "ibc/64BA6E31FE887D66C6F8F31C7B1A80C7CA179239677B4088BB55F5EA07DBE273"
                }
              ]
            },
            {
              type: "Bridge",
              tokenIn: "ibc/64BA6E31FE887D66C6F8F31C7B1A80C7CA179239677B4088BB55F5EA07DBE273",
              tokenInAmount: "40975008686170973",
              tokenOut: "inj",
              tokenOutAmount: "40975008686170973",
              tokenOutChainId: "injective-1",
              bridgeInfo: {
                port: "transfer",
                channel: "channel-122"
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
  const fromAmount = 0.1;
  console.log("sender: ", sender);
  const originalFromToken = cosmosTokens.find((t) => t.coinGeckoId === "oraichain-token" && t.chainId === "Oraichain");
  const originalToToken = cosmosTokens.find(
    (t) => t.coinGeckoId === "injective-protocol" && t.chainId === "injective-1"
  );

  if (!originalToToken) throw generateError("Could not find original to token");
  if (!originalFromToken) throw generateError("Could not find original from token");

  const universalHandler = new UniversalSwapHandler(
    {
      originalFromToken,
      originalToToken,
      sender: { cosmos: sender },
      fromAmount,
      userSlippage: 100,
      simulatePrice: "40976",
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
