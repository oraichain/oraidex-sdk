import "dotenv/config";
import { CosmosWalletImpl } from "./offline-wallet";
import { UniversalSwapHandler } from "../handler";
import { cosmosTokens, generateError, getTokenOnOraichain, toAmount } from "@oraichain/oraidex-common";

// const router = {
//   swapAmount: "1000000000",
//   returnAmount: "16375767570",
//   routes: [
//     {
//       swapAmount: "600000000",
//       returnAmount: "9825302858",
//       paths: [
//         {
//           chainId: "Oraichain",
//           tokenIn: "orai",
//           tokenInAmount: "600000000",
//           tokenOut: "uatom",
//           tokenOutAmount: "781732133",
//           tokenOutChainId: "cosmoshub-4",
//           actions: [
//             {
//               type: "Swap",
//               tokenIn: "orai",
//               tokenInAmount: "600000000",
//               tokenOut: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
//               tokenOutAmount: "781732133",
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
//               tokenInAmount: "781732133",
//               tokenOut: "uatom",
//               tokenOutAmount: "781732133",
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
//           tokenInAmount: "781732133",
//           tokenOut: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
//           tokenOutAmount: "781732133",
//           tokenOutChainId: "osmosis-1",
//           actions: [
//             {
//               type: "Bridge",
//               tokenIn: "uatom",
//               tokenInAmount: "781732133",
//               tokenOut: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
//               tokenOutAmount: "781732133",
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
//           tokenInAmount: "781732133",
//           tokenOut: "uosmo",
//           tokenOutAmount: "9825302858",
//           tokenOutChainId: "osmosis-1",
//           actions: [
//             {
//               type: "Swap",
//               tokenIn: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
//               tokenInAmount: "781732133",
//               tokenOut: "uosmo",
//               tokenOutAmount: "9825302858",
//               swapInfo: [
//                 {
//                   poolId: "1135",
//                   tokenOut: "uosmo"
//                 }
//               ]
//             }
//           ]
//         }
//       ]
//     },
//     {
//       swapAmount: "200000000",
//       returnAmount: "3276268429",
//       paths: [
//         {
//           chainId: "Oraichain",
//           tokenIn: "orai",
//           tokenInAmount: "200000000",
//           tokenOut: "uusdc",
//           tokenOutAmount: "1733503520",
//           tokenOutChainId: "noble-1",
//           actions: [
//             {
//               type: "Swap",
//               tokenIn: "orai",
//               tokenInAmount: "200000000",
//               tokenOut: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
//               tokenOutAmount: "1737861370",
//               swapInfo: [
//                 {
//                   poolId: "orai19ttg0j7w5kr83js32tmwnwxxdq9rkmw4m3d7mn2j2hkpugwwa4tszwsnkg",
//                   tokenOut: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd"
//                 }
//               ]
//             },
//             {
//               type: "Bridge",
//               tokenIn: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
//               tokenInAmount: "1737861370",
//               tokenOut: "uusdc",
//               tokenOutAmount: "1733503520",
//               tokenOutChainId: "noble-1",
//               bridgeInfo: {
//                 port: "transfer",
//                 channel: "channel-147"
//               }
//             }
//           ]
//         },
//         {
//           chainId: "noble-1",
//           tokenIn: "uusdc",
//           tokenInAmount: "1733503520",
//           tokenOut: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4",
//           tokenOutAmount: "1731770016",
//           tokenOutChainId: "osmosis-1",
//           actions: [
//             {
//               type: "Bridge",
//               tokenIn: "uusdc",
//               tokenInAmount: "1733503520",
//               tokenOut: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4",
//               tokenOutAmount: "1731770016",
//               tokenOutChainId: "osmosis-1",
//               bridgeInfo: {
//                 port: "transfer",
//                 channel: "channel-1"
//               }
//             }
//           ]
//         },
//         {
//           chainId: "osmosis-1",
//           tokenIn: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4",
//           tokenInAmount: "1731770016",
//           tokenOut: "uosmo",
//           tokenOutAmount: "3276268429",
//           tokenOutChainId: "osmosis-1",
//           actions: [
//             {
//               type: "Swap",
//               tokenIn: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4",
//               tokenInAmount: "1731770016",
//               tokenOut: "uosmo",
//               tokenOutAmount: "3276268429",
//               swapInfo: [
//                 {
//                   poolId: "1464",
//                   tokenOut: "uosmo"
//                 }
//               ]
//             }
//           ]
//         }
//       ]
//     },
//     {
//       swapAmount: "100000000",
//       returnAmount: "1637648287",
//       paths: [
//         {
//           chainId: "Oraichain",
//           tokenIn: "orai",
//           tokenInAmount: "100000000",
//           tokenOut: "uosmo",
//           tokenOutAmount: "1637648287",
//           tokenOutChainId: "osmosis-1",
//           actions: [
//             {
//               type: "Swap",
//               tokenIn: "orai",
//               tokenInAmount: "100000000",
//               tokenOut: "ibc/9C4DCD21B48231D0BC2AC3D1B74A864746B37E4292694C93C617324250D002FC",
//               tokenOutAmount: "1637648287",
//               swapInfo: [
//                 {
//                   poolId: "orai1d37artrk4tkhz2qyjmaulc2jzjkx7206tmpfug",
//                   tokenOut: "ibc/9C4DCD21B48231D0BC2AC3D1B74A864746B37E4292694C93C617324250D002FC"
//                 }
//               ]
//             },
//             {
//               type: "Bridge",
//               tokenIn: "ibc/9C4DCD21B48231D0BC2AC3D1B74A864746B37E4292694C93C617324250D002FC",
//               tokenInAmount: "1637648287",
//               tokenOut: "uosmo",
//               tokenOutAmount: "1637648287",
//               tokenOutChainId: "osmosis-1",
//               bridgeInfo: {
//                 port: "transfer",
//                 channel: "channel-13"
//               }
//             }
//           ]
//         }
//       ]
//     },
//     {
//       swapAmount: "100000000",
//       returnAmount: "1636547996",
//       paths: [
//         {
//           chainId: "Oraichain",
//           tokenIn: "orai",
//           tokenInAmount: "100000000",
//           tokenOut: "uusdc",
//           tokenOutAmount: "866506508",
//           tokenOutChainId: "noble-1",
//           actions: [
//             {
//               type: "Swap",
//               tokenIn: "orai",
//               tokenInAmount: "100000000",
//               tokenOut: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
//               tokenOutAmount: "869996493",
//               swapInfo: [
//                 {
//                   poolId: "orai1m6q5k5nr2eh8q0rdrf57wr7phk7uvlpg7mwfv5",
//                   tokenOut: "orai1lus0f0rhx8s03gdllx2n6vhkmf0536dv57wfge"
//                 },
//                 {
//                   poolId: "orai1n4edv5h86rawzrvhy8lmrmnnmmherxnhuwqnk3yuvt0wgclh75usyn3md6",
//                   tokenOut: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd"
//                 }
//               ]
//             },
//             {
//               type: "Bridge",
//               tokenIn: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
//               tokenInAmount: "869996493",
//               tokenOut: "uusdc",
//               tokenOutAmount: "866506508",
//               tokenOutChainId: "noble-1",
//               bridgeInfo: {
//                 port: "transfer",
//                 channel: "channel-147"
//               }
//             }
//           ]
//         },
//         {
//           chainId: "noble-1",
//           tokenIn: "uusdc",
//           tokenInAmount: "866506508",
//           tokenOut: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4",
//           tokenOutAmount: "865640001",
//           tokenOutChainId: "osmosis-1",
//           actions: [
//             {
//               type: "Bridge",
//               tokenIn: "uusdc",
//               tokenInAmount: "866506508",
//               tokenOut: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4",
//               tokenOutAmount: "865640001",
//               tokenOutChainId: "osmosis-1",
//               bridgeInfo: {
//                 port: "transfer",
//                 channel: "channel-1"
//               }
//             }
//           ]
//         },
//         {
//           chainId: "osmosis-1",
//           tokenIn: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4",
//           tokenInAmount: "865640001",
//           tokenOut: "uosmo",
//           tokenOutAmount: "1636547996",
//           tokenOutChainId: "osmosis-1",
//           actions: [
//             {
//               type: "Swap",
//               tokenIn: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4",
//               tokenInAmount: "865640001",
//               tokenOut: "uosmo",
//               tokenOutAmount: "1636547996",
//               swapInfo: [
//                 {
//                   poolId: "1263",
//                   tokenOut: "uosmo"
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
//   swapAmount: "1000",
//   returnAmount: "45659896949856",
//   routes: [
//     {
//       swapAmount: "900",
//       returnAmount: "41000000000000",
//       paths: [
//         {
//           chainId: "Oraichain",
//           tokenIn: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
//           tokenInAmount: "900",
//           tokenOut: "inj",
//           tokenOutAmount: "41000000000000",
//           tokenOutChainId: "injective-1",
//           actions: [
//             {
//               type: "Swap",
//               tokenIn: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
//               tokenInAmount: "900",
//               tokenOut: "orai19rtmkk6sn4tppvjmp5d5zj6gfsdykrl5rw2euu5gwur3luheuuusesqn49",
//               tokenOutAmount: "41",
//               swapInfo: [
//                 {
//                   poolId: "orai19ttg0j7w5kr83js32tmwnwxxdq9rkmw4m3d7mn2j2hkpugwwa4tszwsnkg",
//                   tokenOut: "orai"
//                 },
//                 {
//                   poolId: "orai1le7w5dmd23ky8f6zgtgfnpdv269qs6ezgr839sm8kj24rwaqqnrs58wf4u",
//                   tokenOut: "orai19rtmkk6sn4tppvjmp5d5zj6gfsdykrl5rw2euu5gwur3luheuuusesqn49"
//                 }
//               ]
//             },
//             {
//               type: "Convert",
//               tokenIn: "orai19rtmkk6sn4tppvjmp5d5zj6gfsdykrl5rw2euu5gwur3luheuuusesqn49",
//               tokenInAmount: "41",
//               tokenOut: "ibc/49D820DFDE9F885D7081725A58202ABA2F465CAEE4AFBC683DFB79A8E013E83E",
//               tokenOutAmount: "41000000000000",
//               tokenOutChainId: "Oraichain",
//               bridgeInfo: {
//                 port: "",
//                 channel: ""
//               }
//             },
//             {
//               type: "Bridge",
//               tokenIn: "ibc/49D820DFDE9F885D7081725A58202ABA2F465CAEE4AFBC683DFB79A8E013E83E",
//               tokenInAmount: "41000000000000",
//               tokenOut: "inj",
//               tokenOutAmount: "41000000000000",
//               tokenOutChainId: "injective-1",
//               bridgeInfo: {
//                 port: "transfer",
//                 channel: "channel-146"
//               }
//             }
//           ]
//         }
//       ]
//     },
//     {
//       swapAmount: "100",
//       returnAmount: "4659896949856",
//       paths: [
//         {
//           chainId: "Oraichain",
//           tokenIn: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
//           tokenInAmount: "100",
//           tokenOut: "uosmo",
//           tokenOutAmount: "198",
//           tokenOutChainId: "osmosis-1",
//           actions: [
//             {
//               type: "Swap",
//               tokenIn: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
//               tokenInAmount: "100",
//               tokenOut: "ibc/9C4DCD21B48231D0BC2AC3D1B74A864746B37E4292694C93C617324250D002FC",
//               tokenOutAmount: "198",
//               swapInfo: [
//                 {
//                   poolId: "orai1n4edv5h86rawzrvhy8lmrmnnmmherxnhuwqnk3yuvt0wgclh75usyn3md6",
//                   tokenOut: "orai1lus0f0rhx8s03gdllx2n6vhkmf0536dv57wfge"
//                 },
//                 {
//                   poolId: "orai1m6q5k5nr2eh8q0rdrf57wr7phk7uvlpg7mwfv5",
//                   tokenOut: "orai"
//                 },
//                 {
//                   poolId: "orai1d37artrk4tkhz2qyjmaulc2jzjkx7206tmpfug",
//                   tokenOut: "ibc/9C4DCD21B48231D0BC2AC3D1B74A864746B37E4292694C93C617324250D002FC"
//                 }
//               ]
//             },
//             {
//               type: "Bridge",
//               tokenIn: "ibc/9C4DCD21B48231D0BC2AC3D1B74A864746B37E4292694C93C617324250D002FC",
//               tokenInAmount: "198",
//               tokenOut: "uosmo",
//               tokenOutAmount: "198",
//               tokenOutChainId: "osmosis-1",
//               bridgeInfo: {
//                 port: "transfer",
//                 channel: "channel-13"
//               }
//             }
//           ]
//         },
//         {
//           chainId: "osmosis-1",
//           tokenIn: "uosmo",
//           tokenInAmount: "198",
//           tokenOut: "inj",
//           tokenOutAmount: "4659896949856",
//           tokenOutChainId: "injective-1",
//           actions: [
//             {
//               type: "Swap",
//               tokenIn: "uosmo",
//               tokenInAmount: "198",
//               tokenOut: "ibc/64BA6E31FE887D66C6F8F31C7B1A80C7CA179239677B4088BB55F5EA07DBE273",
//               tokenOutAmount: "4659896949856",
//               swapInfo: [
//                 {
//                   poolId: "1134",
//                   tokenOut: "ibc/EA1D43981D5C9A1C4AAEA9C23BB1D4FA126BA9BC7020A25E0AE4AA841EA25DC5"
//                 },
//                 {
//                   poolId: "1637",
//                   tokenOut: "ibc/69110FF673D70B39904FF056CFDFD58A90BEC3194303F45C32CB91B8B0A738EA"
//                 },
//                 {
//                   poolId: "1698",
//                   tokenOut: "ibc/64BA6E31FE887D66C6F8F31C7B1A80C7CA179239677B4088BB55F5EA07DBE273"
//                 }
//               ]
//             },
//             {
//               type: "Bridge",
//               tokenIn: "ibc/64BA6E31FE887D66C6F8F31C7B1A80C7CA179239677B4088BB55F5EA07DBE273",
//               tokenInAmount: "4659896949856",
//               tokenOut: "inj",
//               tokenOutAmount: "4659896949856",
//               tokenOutChainId: "injective-1",
//               bridgeInfo: {
//                 port: "transfer",
//                 channel: "channel-122"
//               }
//             }
//           ]
//         }
//       ]
//     }
//   ]
// };

const router = {
  swapAmount: "1000000",
  returnAmount: "92048909",
  routes: [
    {
      swapAmount: "1000000",
      returnAmount: "92048909",
      paths: [
        {
          chainId: "Oraichain",
          tokenIn: "ibc/9C4DCD21B48231D0BC2AC3D1B74A864746B37E4292694C93C617324250D002FC",
          tokenInAmount: "1000000",
          tokenOut: "orai1lus0f0rhx8s03gdllx2n6vhkmf0536dv57wfge",
          tokenOutAmount: "92048909",
          tokenOutChainId: "Oraichain",
          actions: [
            {
              type: "Swap",
              protocol: "Oraidex",
              tokenIn: "ibc/9C4DCD21B48231D0BC2AC3D1B74A864746B37E4292694C93C617324250D002FC",
              tokenInAmount: "1000000",
              tokenOut: "orai1lus0f0rhx8s03gdllx2n6vhkmf0536dv57wfge",
              tokenOutAmount: "92048909",
              swapInfo: [
                {
                  poolId: "orai1d37artrk4tkhz2qyjmaulc2jzjkx7206tmpfug",
                  tokenOut: "orai"
                },
                {
                  poolId: "orai19ttg0j7w5kr83js32tmwnwxxdq9rkmw4m3d7mn2j2hkpugwwa4tszwsnkg",
                  tokenOut: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd"
                },
                {
                  poolId: "orai1n4edv5h86rawzrvhy8lmrmnnmmherxnhuwqnk3yuvt0wgclh75usyn3md6",
                  tokenOut: "orai1lus0f0rhx8s03gdllx2n6vhkmf0536dv57wfge"
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
  const sender = await wallet.getKeplrAddr("osmosis-1");
  const fromAmount = 1;
  console.log("sender: ", sender);
  const originalFromToken = cosmosTokens.find((t) => t.coinGeckoId === "osmosis" && t.chainId === "osmosis-1");
  const originalToToken = cosmosTokens.find((t) => t.coinGeckoId === "oraidex" && t.chainId === "Oraichain");

  if (!originalToToken) throw generateError("Could not find original to token");
  if (!originalFromToken) throw generateError("Could not find original from token");

  const universalHandler = new UniversalSwapHandler(
    {
      originalFromToken,
      originalToToken,
      sender: { cosmos: sender },
      fromAmount,
      userSlippage: 50,
      relayerFee: 0n as any,
      // relayerFee: {
      //   relayerAmount: "100000",
      //   relayerDecimals: 6
      // },
      // recipientAddress: "orai1hvr9d72r5um9lvt0rpkd4r75vrsqtw6yujhqs2",
      // recipientAddress: "osmo12zyu8w93h0q2lcnt50g3fn0w3yqnhy4fh4twhr",
      // recipientAddress: "inj133lq4pqjdxspcz4n388glv70z59ffeuh3ktnaj",
      simulatePrice: "91825481",
      simulateAmount: toAmount(fromAmount, originalToToken.decimals).toString(),
      alphaSmartRoutes: router
    },
    {
      cosmosWallet: wallet,
      swapOptions: { isAlphaSmartRouter: true, isIbcWasm: true, isSourceReceiverTest: true, ibcInfoTestMode: true }
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
