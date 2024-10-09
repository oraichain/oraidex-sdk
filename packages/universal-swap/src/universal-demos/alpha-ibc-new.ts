import "dotenv/config";
import { CosmosWalletImpl } from "./offline-wallet";
import { UniversalSwapHandler } from "../handler";
import { cosmosTokens, flattenTokens, generateError, getTokenOnOraichain, toAmount } from "@oraichain/oraidex-common";

const router = {
  swapAmount: "79297000000000000",
  returnAmount: "310968",
  routes: [
    {
      swapAmount: "79297000000000000",
      returnAmount: "310968",
      paths: [
        {
          chainId: "injective-1",
          tokenIn: "inj",
          tokenInAmount: "79297000000000000",
          tokenOut: "ibc/64BA6E31FE887D66C6F8F31C7B1A80C7CA179239677B4088BB55F5EA07DBE273",
          tokenOutAmount: "79297000000000000",
          tokenOutChainId: "osmosis-1",
          actions: [
            {
              type: "Bridge",
              protocol: "Bridge",
              tokenIn: "inj",
              tokenInAmount: "79297000000000000",
              tokenOut: "ibc/64BA6E31FE887D66C6F8F31C7B1A80C7CA179239677B4088BB55F5EA07DBE273",
              tokenOutAmount: "79297000000000000",
              tokenOutChainId: "osmosis-1",
              bridgeInfo: {
                port: "transfer",
                channel: "channel-8"
              }
            }
          ]
        },
        {
          chainId: "osmosis-1",
          tokenIn: "ibc/64BA6E31FE887D66C6F8F31C7B1A80C7CA179239677B4088BB55F5EA07DBE273",
          tokenInAmount: "79297000000000000",
          tokenOut: "utia",
          tokenOutAmount: "310968",
          tokenOutChainId: "celestia",
          actions: [
            {
              type: "Swap",
              protocol: "Osmosis",
              tokenIn: "ibc/64BA6E31FE887D66C6F8F31C7B1A80C7CA179239677B4088BB55F5EA07DBE273",
              tokenInAmount: "79297000000000000",
              tokenOut: "ibc/D79E7D83AB399BFFF93433E54FAA480C191248FC556924A2A8351AE2638B3877",
              tokenOutAmount: "310968",
              swapInfo: [
                {
                  poolId: "725",
                  tokenOut: "uosmo"
                },
                {
                  poolId: "1249",
                  tokenOut: "ibc/D79E7D83AB399BFFF93433E54FAA480C191248FC556924A2A8351AE2638B3877"
                }
              ]
            },
            {
              type: "Bridge",
              protocol: "Bridge",
              tokenIn: "ibc/D79E7D83AB399BFFF93433E54FAA480C191248FC556924A2A8351AE2638B3877",
              tokenInAmount: "310968",
              tokenOut: "utia",
              tokenOutAmount: "310968",
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
  const sender = await wallet.getKeplrAddr("injective-1");

  const fromAmount = 0.079297;
  console.log("sender: ", sender);
  const originalFromToken = flattenTokens.find(
    (t) => t.coinGeckoId === "injective-protocol" && t.chainId === "injective-1"
  );
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
      recipientAddress: "celestia13lpgsy2dk9ftwac2uagw7fc2fw35cdp00xucfz",
      simulatePrice: "3921560",
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
