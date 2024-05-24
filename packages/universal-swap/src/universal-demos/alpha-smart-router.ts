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

// const router = {
//   swapAmount: "10000000",
//   returnAmount: "86063044",
//   routes: [
//     {
//       swapAmount: "10000000",
//       returnAmount: "86063044",
//       paths: [
//         {
//           chainId: "Oraichain",
//           tokenIn: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
//           tokenInAmount: "10000000",
//           tokenOut: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
//           tokenOutAmount: "86063044",
//           tokenOutChainId: "Oraichain",
//           actions: [
//             {
//               type: "Swap",
//               tokenIn: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
//               tokenInAmount: "10000000",
//               tokenOut: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
//               tokenOutAmount: "86063044",
//               swapInfo: [
//                 {
//                   poolId: "orai1jf74ry4m0jcy9emsaudkhe7vte9l8qy8enakvs",
//                   tokenOut: "orai"
//                 },
//                 {
//                   poolId: "orai1m6q5k5nr2eh8q0rdrf57wr7phk7uvlpg7mwfv5",
//                   tokenOut: "orai1lus0f0rhx8s03gdllx2n6vhkmf0536dv57wfge"
//                 },
//                 {
//                   poolId: "orai1n4edv5h86rawzrvhy8lmrmnnmmherxnhuwqnk3yuvt0wgclh75usyn3md6",
//                   tokenOut: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd"
//                 }
//               ]
//             }
//           ]
//         }
//       ]
//     }
//   ]
// };

// const router = {
//   swapAmount: "1000000000",
//   returnAmount: "8518615211",
//   routes: [
//     {
//       swapAmount: "500000000",
//       returnAmount: "4259030486",
//       paths: [
//         {
//           chainId: "Oraichain",
//           tokenIn: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
//           tokenInAmount: "500000000",
//           tokenOut: "uatom",
//           tokenOutAmount: "500000000",
//           tokenOutChainId: "cosmoshub-4",
//           actions: [
//             {
//               type: "Bridge",
//               tokenIn: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
//               tokenInAmount: "500000000",
//               tokenOut: "uatom",
//               tokenOutAmount: "500000000",
//               tokenOutChainId: "cosmoshub-4",
//               bridgeInfo: {
//                 port: "transfer",
//                 channel: "channel-15"
//               }
//             }
//           ]
//         },
//         {
//           chainId: "cosmoshub-4",
//           tokenIn: "uatom",
//           tokenInAmount: "500000000",
//           tokenOut: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
//           tokenOutAmount: "500000000",
//           tokenOutChainId: "osmosis-1",
//           actions: [
//             {
//               type: "Bridge",
//               tokenIn: "uatom",
//               tokenInAmount: "500000000",
//               tokenOut: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
//               tokenOutAmount: "500000000",
//               tokenOutChainId: "osmosis-1",
//               bridgeInfo: {
//                 port: "transfer",
//                 channel: "channel-141"
//               }
//             }
//           ]
//         },
//         {
//           chainId: "osmosis-1",
//           tokenIn: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
//           tokenInAmount: "500000000",
//           tokenOut: "uusdc",
//           tokenOutAmount: "4267957444",
//           tokenOutChainId: "noble-1",
//           actions: [
//             {
//               type: "Swap",
//               tokenIn: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
//               tokenInAmount: "500000000",
//               tokenOut: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4",
//               tokenOutAmount: "4272229674",
//               swapInfo: [
//                 {
//                   poolId: "1282",
//                   tokenOut: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4"
//                 }
//               ]
//             },
//             {
//               type: "Bridge",
//               tokenIn: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4",
//               tokenInAmount: "4272229674",
//               tokenOut: "uusdc",
//               tokenOutAmount: "4267957444",
//               tokenOutChainId: "noble-1",
//               bridgeInfo: {
//                 port: "transfer",
//                 channel: "channel-750"
//               }
//             }
//           ]
//         },
//         {
//           chainId: "noble-1",
//           tokenIn: "uusdc",
//           tokenInAmount: "4267957444",
//           tokenOut: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
//           tokenOutAmount: "4259030486",
//           tokenOutChainId: "Oraichain",
//           actions: [
//             {
//               type: "Bridge",
//               tokenIn: "uusdc",
//               tokenInAmount: "4267957444",
//               tokenOut: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
//               tokenOutAmount: "4259030486",
//               tokenOutChainId: "Oraichain",
//               bridgeInfo: {
//                 port: "transfer",
//                 channel: "channel-34"
//               }
//             }
//           ]
//         }
//       ]
//     },
//     {
//       swapAmount: "400000000",
//       returnAmount: "3402135656",
//       paths: [
//         {
//           chainId: "Oraichain",
//           tokenIn: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
//           tokenInAmount: "400000000",
//           tokenOut: "uatom",
//           tokenOutAmount: "400000000",
//           tokenOutChainId: "cosmoshub-4",
//           actions: [
//             {
//               type: "Bridge",
//               tokenIn: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
//               tokenInAmount: "400000000",
//               tokenOut: "uatom",
//               tokenOutAmount: "400000000",
//               tokenOutChainId: "cosmoshub-4",
//               bridgeInfo: {
//                 port: "transfer",
//                 channel: "channel-15"
//               }
//             }
//           ]
//         },
//         {
//           chainId: "cosmoshub-4",
//           tokenIn: "uatom",
//           tokenInAmount: "400000000",
//           tokenOut: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
//           tokenOutAmount: "400000000",
//           tokenOutChainId: "osmosis-1",
//           actions: [
//             {
//               type: "Bridge",
//               tokenIn: "uatom",
//               tokenInAmount: "400000000",
//               tokenOut: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
//               tokenOutAmount: "400000000",
//               tokenOutChainId: "osmosis-1",
//               bridgeInfo: {
//                 port: "transfer",
//                 channel: "channel-141"
//               }
//             }
//           ]
//         },
//         {
//           chainId: "osmosis-1",
//           tokenIn: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
//           tokenInAmount: "400000000",
//           tokenOut: "uusdc",
//           tokenOutAmount: "3410204861",
//           tokenOutChainId: "noble-1",
//           actions: [
//             {
//               type: "Swap",
//               tokenIn: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
//               tokenInAmount: "400000000",
//               tokenOut: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4",
//               tokenOutAmount: "3413618480",
//               swapInfo: [
//                 {
//                   poolId: "1251",
//                   tokenOut: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4"
//                 }
//               ]
//             },
//             {
//               type: "Bridge",
//               tokenIn: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4",
//               tokenInAmount: "3413618480",
//               tokenOut: "uusdc",
//               tokenOutAmount: "3410204861",
//               tokenOutChainId: "noble-1",
//               bridgeInfo: {
//                 port: "transfer",
//                 channel: "channel-750"
//               }
//             }
//           ]
//         },
//         {
//           chainId: "noble-1",
//           tokenIn: "uusdc",
//           tokenInAmount: "3410204861",
//           tokenOut: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
//           tokenOutAmount: "3402135656",
//           tokenOutChainId: "Oraichain",
//           actions: [
//             {
//               type: "Bridge",
//               tokenIn: "uusdc",
//               tokenInAmount: "3410204861",
//               tokenOut: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
//               tokenOutAmount: "3402135656",
//               tokenOutChainId: "Oraichain",
//               bridgeInfo: {
//                 port: "transfer",
//                 channel: "channel-34"
//               }
//             }
//           ]
//         }
//       ]
//     },
//     {
//       swapAmount: "100000000",
//       returnAmount: "857449069",
//       paths: [
//         {
//           chainId: "Oraichain",
//           tokenIn: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
//           tokenInAmount: "100000000",
//           tokenOut: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
//           tokenOutAmount: "857449069",
//           tokenOutChainId: "Oraichain",
//           actions: [
//             {
//               type: "Swap",
//               tokenIn: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
//               tokenInAmount: "100000000",
//               tokenOut: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
//               tokenOutAmount: "857449069",
//               swapInfo: [
//                 {
//                   poolId: "orai1jf74ry4m0jcy9emsaudkhe7vte9l8qy8enakvs",
//                   tokenOut: "orai"
//                 },
//                 {
//                   poolId: "orai1m6q5k5nr2eh8q0rdrf57wr7phk7uvlpg7mwfv5",
//                   tokenOut: "orai1lus0f0rhx8s03gdllx2n6vhkmf0536dv57wfge"
//                 },
//                 {
//                   poolId: "orai1n4edv5h86rawzrvhy8lmrmnnmmherxnhuwqnk3yuvt0wgclh75usyn3md6",
//                   tokenOut: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd"
//                 }
//               ]
//             }
//           ]
//         }
//       ]
//     }
//   ]
// };

const alphaSwapToOraichain = async () => {
  const wallet = new CosmosWalletImpl(process.env.MNEMONIC);
  const sender = await wallet.getKeplrAddr("cosmoshub-4");
  const fromAmount = 0.1;
  console.log("sender: ", sender);
  const originalFromToken = cosmosTokens.find((t) => t.coinGeckoId === "cosmos" && t.chainId === "cosmoshub-4");

  const originalToToken = cosmosTokens.find((t) => t.coinGeckoId === "osmosis" && t.chainId === "osmosis-1");
  // const originalFromToken = getTokenOnOraichain("cosmos");
  // const originalToToken = getTokenOnOraichain("usd-coin");

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
