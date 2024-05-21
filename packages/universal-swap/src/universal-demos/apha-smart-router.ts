import "dotenv/config";
import { CosmosWalletImpl } from "./offline-wallet";
import { UniversalSwapHandler } from "../handler";
import { generateError, getTokenOnOraichain, toAmount } from "@oraichain/oraidex-common";

// ORAICHAIN -> ORAICHAIN
// ORAICHAIN -> COSMOS
// COSMOS -> COSMOS
// COSMOS -> ORAICHAIN

// const router = {
//   swapAmount: "10",
//   returnAmount: "147",
//   routes: [
//     {
//       swapAmount: "10",
//       returnAmount: "147",
//       paths: [
//         {
//           chainId: "Oraichain",
//           tokenIn: "orai",
//           tokenInAmount: "10",
//           tokenOut: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
//           tokenOutAmount: "147",
//           tokenOutChainId: "Oraichain",
//           actions: [
//             {
//               type: "Swap",
//               tokenIn: "orai",
//               tokenInAmount: "10",
//               tokenOut: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
//               tokenOutAmount: "147",
//               swapInfo: [
//                 {
//                   poolId: "orai19ttg0j7w5kr83js32tmwnwxxdq9rkmw4m3d7mn2j2hkpugwwa4tszwsnkg",
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

// {
//   "sourceAsset":"orai",
//   "sourceChainId": "Oraichain",
//   "destAsset": "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
//   "destChainId":"Oraichain",
//   "offerAmount": "10"
// }

// const router = {
//   swapAmount: "100",
//   returnAmount: "1464",
//   routes: [
//     {
//       swapAmount: "90",
//       returnAmount: "1318",
//       paths: [
//         {
//           chainId: "Oraichain",
//           tokenIn: "orai",
//           tokenInAmount: "90",
//           tokenOut: "uatom",
//           tokenOutAmount: "160",
//           tokenOutChainId: "cosmoshub-4",
//           actions: [
//             {
//               type: "Swap",
//               tokenIn: "orai",
//               tokenInAmount: "90",
//               tokenOut: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
//               tokenOutAmount: "160",
//               swapInfo: [
//                 {
//                   poolId: "orai1jf74ry4m0jcy9emsaudkhe7vte9l8qy8enakvs",
//                   tokenOut: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78"
//                 }
//               ]
//             },
//             {
//               type: "Bridge",
//               tokenIn: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
//               tokenInAmount: "160",
//               tokenOut: "uatom",
//               tokenOutAmount: "160",
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
//           tokenInAmount: "160",
//           tokenOut: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
//           tokenOutAmount: "160",
//           tokenOutChainId: "osmosis-1",
//           actions: [
//             {
//               type: "Bridge",
//               tokenIn: "uatom",
//               tokenInAmount: "160",
//               tokenOut: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
//               tokenOutAmount: "160",
//               tokenOutChainId: "osmosis-1",
//               bridgeInfo: {
//                 port: "transfer",
//                 channel: "channel-141"
//               }
//             }
//           ]
//         },

//         //----
//         // {
//         //   chainId: "cosmoshub-4",
//         //   tokenIn: "uatom",
//         //   tokenInAmount: "160",
//         //   // tokenOut: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
//         //   tokenOut: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
//         //   tokenOutAmount: "160",
//         //   // tokenOutChainId: "osmosis-1",
//         //   tokenOutChainId: "Oraichain",
//         //   actions: [
//         //     {
//         //       type: "Bridge",
//         //       tokenIn: "uatom",
//         //       tokenInAmount: "160",
//         //       // tokenOut: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
//         //       tokenOut: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
//         //       tokenOutAmount: "160",
//         //       // tokenOutChainId: "osmosis-1",
//         //       tokenOutChainId: "Oraichain",
//         //       bridgeInfo: {
//         //         port: "transfer",
//         //         // channel: "channel-141"
//         //         channel: "channel-301"
//         //       }
//         //     }
//         //   ]
//         // }
//         //-----

//         {
//           chainId: "osmosis-1",
//           tokenIn: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
//           tokenInAmount: "160",
//           tokenOut: "uusdc",
//           tokenOutAmount: "1320",
//           tokenOutChainId: "noble-1",
//           actions: [
//             {
//               type: "Swap",
//               tokenIn: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
//               tokenInAmount: "160",
//               tokenOut: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4",
//               tokenOutAmount: "1322",
//               swapInfo: [
//                 {
//                   poolId: "1135",
//                   tokenOut: "uosmo"
//                 },
//                 {
//                   poolId: "1464",
//                   tokenOut: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4"
//                 }
//               ]
//             },
//             {
//               type: "Bridge",
//               tokenIn: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4",
//               tokenInAmount: "1322",
//               tokenOut: "uusdc",
//               tokenOutAmount: "1320",
//               tokenOutChainId: "noble-1",
//               bridgeInfo: {
//                 port: "transfer",
//                 channel: "channel-750"
//               }
//             }
//           ]
//         }
//         // {
//         //   chainId: "noble-1",
//         //   tokenIn: "uusdc",
//         //   tokenInAmount: "1320",
//         //   tokenOut: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
//         //   tokenOutAmount: "1318",
//         //   tokenOutChainId: "Oraichain",
//         //   actions: [
//         //     {
//         //       type: "Bridge",
//         //       tokenIn: "uusdc",
//         //       tokenInAmount: "1320",
//         //       tokenOut: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
//         //       tokenOutAmount: "1318",
//         //       tokenOutChainId: "Oraichain",
//         //       bridgeInfo: {
//         //         port: "transfer",
//         //         channel: "channel-147"
//         //       }
//         //     }
//         //   ]
//         // }

//         // {
//         //   chainId: "noble-1",
//         //   tokenIn: "uusdc",
//         //   tokenInAmount: "1320",
//         //   tokenOut: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
//         //   tokenOutAmount: "1318",
//         //   tokenOutChainId: "Oraichain",
//         //   actions: [
//         //     {
//         //       type: "Bridge",
//         //       tokenIn: "uusdc",
//         //       tokenInAmount: "1320",
//         //       tokenOut: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
//         //       tokenOutAmount: "1318",
//         //       tokenOutChainId: "Oraichain",
//         //       bridgeInfo: {
//         //         port: "transfer",
//         //         channel: "channel-147"
//         //       }
//         //     }
//         //   ]
//         // }
//       ]
//     },
//     {
//       swapAmount: "10",
//       returnAmount: "146",
//       paths: [
//         {
//           chainId: "Oraichain",
//           tokenIn: "orai",
//           tokenInAmount: "10",
//           tokenOut: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
//           tokenOutAmount: "146",
//           tokenOutChainId: "Oraichain",
//           actions: [
//             {
//               type: "Swap",
//               tokenIn: "orai",
//               tokenInAmount: "10",
//               tokenOut: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
//               tokenOutAmount: "146",
//               swapInfo: [
//                 {
//                   poolId: "orai19ttg0j7w5kr83js32tmwnwxxdq9rkmw4m3d7mn2j2hkpugwwa4tszwsnkg",
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
//   swapAmount: "100000",
//   returnAmount: "880721",
//   routes: [
//     {
//       swapAmount: "100000",
//       returnAmount: "880721",
//       paths: [
//         {
//           chainId: "Oraichain",
//           tokenIn: "ibc/a2e2eec9057a4a1c2c0a6a4c78b0239118df5f278830f50b4a6bdd7a66506b78",
//           tokenInAmount: "100000",
//           tokenOut: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
//           tokenOutAmount: "880721",
//           tokenOutChainId: "Oraichain",
//           actions: [
//             {
//               type: "Swap",
//               tokenIn: "ibc/a2e2eec9057a4a1c2c0a6a4c78b0239118df5f278830f50b4a6bdd7a66506b78",
//               tokenInAmount: "100000",
//               tokenOut: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
//               tokenOutAmount: "880721",
//               swapInfo: [
//                 {
//                   poolId: "orai1jf74ry4m0jcy9emsaudkhe7vte9l8qy8enakvs",
//                   tokenOut: "orai"
//                 },
//                 {
//                   poolId: "orai19ttg0j7w5kr83js32tmwnwxxdq9rkmw4m3d7mn2j2hkpugwwa4tszwsnkg",
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

const router = {
  swapAmount: "10000",
  returnAmount: "88913",
  routes: [
    {
      swapAmount: "10000",
      returnAmount: "88913",
      paths: [
        {
          chainId: "Oraichain",
          tokenIn: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
          tokenInAmount: "10000",
          tokenOut: "uatom",
          tokenOutAmount: "10000",
          tokenOutChainId: "cosmoshub-4",
          actions: [
            {
              type: "Bridge",
              tokenIn: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
              tokenInAmount: "10000",
              tokenOut: "uatom",
              tokenOutAmount: "10000",
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
          tokenInAmount: "10000",
          tokenOut: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
          tokenOutAmount: "10000",
          tokenOutChainId: "osmosis-1",
          actions: [
            {
              type: "Bridge",
              tokenIn: "uatom",
              tokenInAmount: "10000",
              tokenOut: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
              tokenOutAmount: "10000",
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
          tokenInAmount: "10000",
          tokenOut: "uusdc",
          tokenOutAmount: "89003",
          tokenOutChainId: "noble-1",
          actions: [
            {
              type: "Swap",
              tokenIn: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
              tokenInAmount: "10000",
              tokenOut: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4",
              tokenOutAmount: "89093",
              swapInfo: [
                {
                  poolId: "1282",
                  tokenOut: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4"
                }
              ]
            },
            {
              type: "Bridge",
              tokenIn: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4",
              tokenInAmount: "89093",
              tokenOut: "uusdc",
              tokenOutAmount: "89003",
              tokenOutChainId: "noble-1",
              bridgeInfo: {
                port: "transfer",
                channel: "channel-750"
              }
            }
          ]
        }
        // {
        //   chainId: "noble-1",
        //   tokenIn: "uusdc",
        //   tokenInAmount: "89003",
        //   tokenOut: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
        //   tokenOutAmount: "88913",
        //   tokenOutChainId: "Oraichain",
        //   actions: [
        //     {
        //       type: "Bridge",
        //       tokenIn: "uusdc",
        //       tokenInAmount: "89003",
        //       tokenOut: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
        //       tokenOutAmount: "88913",
        //       tokenOutChainId: "Oraichain",
        //       bridgeInfo: {
        //         port: "transfer",
        //         channel: "channel-147"
        //       }
        //     }
        //   ]
        // }
      ]
    }
  ]
};

const alphaSwapToOraichain = async () => {
  const wallet = new CosmosWalletImpl(process.env.MNEMONIC);
  const sender = await wallet.getKeplrAddr("Oraichain");
  const fromAmount = 0.01;
  console.log("sender: ", sender);
  // const originalFromToken = cosmosTokens.find((t) => t.coinGeckoId === "oraichain-token" && t.chainId === "Oraichain");
  const originalFromToken = getTokenOnOraichain("cosmos");
  const originalToToken = getTokenOnOraichain("usd-coin");

  if (!originalToToken) throw generateError("Could not find original to token");
  if (!originalFromToken) throw generateError("Could not find original from token");

  const universalHandler = new UniversalSwapHandler(
    {
      originalFromToken,
      originalToToken,
      sender: { cosmos: sender },
      fromAmount,
      userSlippage: 1,
      simulatePrice: "16604436",
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
