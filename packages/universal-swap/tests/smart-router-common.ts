export const alphaSmartRoutes = {
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
        }
      ]
    }
  ]
};

export const flattenAlphaSmartRouters = [
  {
    type: "Bridge",
    tokenIn: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
    tokenInAmount: "133950",
    tokenOut: "uatom",
    tokenOutAmount: "133950",
    tokenOutChainId: "cosmoshub-4",
    bridgeInfo: { port: "transfer", channel: "channel-15" },
    path: 0,
    chainId: "Oraichain",
    isLastPath: false
  },
  {
    type: "Bridge",
    tokenIn: "uatom",
    tokenInAmount: "133950",
    tokenOut: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
    tokenOutAmount: "133950",
    tokenOutChainId: "osmosis-1",
    bridgeInfo: { port: "transfer", channel: "channel-141" },
    path: 0,
    chainId: "cosmoshub-4",
    isLastPath: true
  }
];

export const objSwapInOsmosis = {
  type: "Swap",
  chainId: "osmosis-1",
  tokenIn: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
  tokenInAmount: "133950",
  tokenOut: "ibc/64BA6E31FE887D66C6F8F31C7B1A80C7CA179239677B4088BB55F5EA07DBE273",
  tokenOutAmount: "133950",
  tokenOutChainId: "osmosis-1",
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
  ],
  path: 0,
  isLastPath: true
};

export const objBridgeInSmartRoute = [
  {
    type: "Bridge",
    chainId: "osmosis-1",
    tokenInAmount: "133950",
    tokenIn: "ibc/64BA6E31FE887D66C6F8F31C7B1A80C7CA179239677B4088BB55F5EA07DBE273",
    tokenOutAmount: "40975008686170973",
    tokenOutChainId: "injective-1",
    bridgeInfo: {
      port: "transfer",
      channel: "channel-122"
    },
    path: 0,
    isLastPath: false
  },
  {
    type: "Bridge",
    chainId: "Oraichain",
    tokenInAmount: "133950",
    tokenIn: "ibc/64BA6E31FE887D66C6F8F31C7B1A80C7CA179239677B4088BB55F5EA07DBE273",
    tokenOutAmount: "40975008686170973",
    tokenOutChainId: "injective-1",
    bridgeInfo: {
      port: "transfer",
      channel: "channel-122"
    },
    path: 0,
    isLastPath: true
  },
  {
    type: "Bridge",
    chainId: "Oraichain",
    tokenInAmount: "133950",
    tokenIn: "ibc/9C4DCD21B48231D0BC2AC3D1B74A864746B37E4292694C93C617324250D002FC",
    tokenOutAmount: "133950",
    tokenOutChainId: "osmosis-1",
    bridgeInfo: {
      port: "transfer",
      channel: "channel-13"
    },
    path: 0,
    isLastPath: true
  },
  {
    type: "Bridge",
    chainId: "Oraichain",
    tokenInAmount: "133950",
    tokenIn: "ibc/9C4DCD21B48231D0BC2AC3D1B74A864746B37E4292694C93C617324250D002FC",
    tokenOutAmount: "133950",
    tokenOutChainId: "osmosis-1",
    bridgeInfo: {
      port: "transfer",
      channel: "channel-13"
    },
    path: 0,
    isLastPath: false
  }
];

export const alphaSmartRoute = [
  {
    swapAmount: "1000000",
    returnAmount: "14390702",
    routes: [
      {
        swapAmount: "1000000",
        returnAmount: "14390702",
        paths: [
          {
            chainId: "Oraichain",
            tokenIn: "orai",
            tokenInAmount: "1000000",
            tokenOut: "uosmo",
            tokenOutAmount: "14390702",
            tokenOutChainId: "osmosis-1",
            actions: [
              {
                type: "Swap",
                tokenIn: "orai",
                tokenInAmount: "1000000",
                tokenOut: "ibc/9C4DCD21B48231D0BC2AC3D1B74A864746B37E4292694C93C617324250D002FC",
                tokenOutAmount: "14390702",
                swapInfo: [
                  {
                    poolId: "orai1d37artrk4tkhz2qyjmaulc2jzjkx7206tmpfug",
                    tokenOut: "ibc/9C4DCD21B48231D0BC2AC3D1B74A864746B37E4292694C93C617324250D002FC"
                  }
                ]
              },
              {
                type: "Bridge",
                tokenIn: "ibc/9C4DCD21B48231D0BC2AC3D1B74A864746B37E4292694C93C617324250D002FC",
                tokenInAmount: "14390702",
                tokenOut: "uosmo",
                tokenOutAmount: "14390702",
                tokenOutChainId: "osmosis-1",
                bridgeInfo: {
                  port: "transfer",
                  channel: "channel-13"
                }
              }
            ]
          }
        ]
      }
    ]
  },
  {
    swapAmount: "1000000000",
    returnAmount: "16375767570",
    routes: [
      {
        swapAmount: "600000000",
        returnAmount: "9825302858",
        paths: [
          {
            chainId: "Oraichain",
            tokenIn: "orai",
            tokenInAmount: "600000000",
            tokenOut: "uatom",
            tokenOutAmount: "781732133",
            tokenOutChainId: "cosmoshub-4",
            actions: [
              {
                type: "Swap",
                tokenIn: "orai",
                tokenInAmount: "600000000",
                tokenOut: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
                tokenOutAmount: "781732133",
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
                tokenInAmount: "781732133",
                tokenOut: "uatom",
                tokenOutAmount: "781732133",
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
            tokenInAmount: "781732133",
            tokenOut: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
            tokenOutAmount: "781732133",
            tokenOutChainId: "osmosis-1",
            actions: [
              {
                type: "Bridge",
                tokenIn: "uatom",
                tokenInAmount: "781732133",
                tokenOut: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
                tokenOutAmount: "781732133",
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
            tokenInAmount: "781732133",
            tokenOut: "uosmo",
            tokenOutAmount: "9825302858",
            tokenOutChainId: "osmosis-1",
            actions: [
              {
                type: "Swap",
                tokenIn: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
                tokenInAmount: "781732133",
                tokenOut: "uosmo",
                tokenOutAmount: "9825302858",
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
      },
      {
        swapAmount: "200000000",
        returnAmount: "3276268429",
        paths: [
          {
            chainId: "Oraichain",
            tokenIn: "orai",
            tokenInAmount: "200000000",
            tokenOut: "uusdc",
            tokenOutAmount: "1733503520",
            tokenOutChainId: "noble-1",
            actions: [
              {
                type: "Swap",
                tokenIn: "orai",
                tokenInAmount: "200000000",
                tokenOut: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
                tokenOutAmount: "1737861370",
                swapInfo: [
                  {
                    poolId: "orai19ttg0j7w5kr83js32tmwnwxxdq9rkmw4m3d7mn2j2hkpugwwa4tszwsnkg",
                    tokenOut: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd"
                  }
                ]
              },
              {
                type: "Bridge",
                tokenIn: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
                tokenInAmount: "1737861370",
                tokenOut: "uusdc",
                tokenOutAmount: "1733503520",
                tokenOutChainId: "noble-1",
                bridgeInfo: {
                  port: "transfer",
                  channel: "channel-147"
                }
              }
            ]
          },
          {
            chainId: "noble-1",
            tokenIn: "uusdc",
            tokenInAmount: "1733503520",
            tokenOut: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4",
            tokenOutAmount: "1731770016",
            tokenOutChainId: "osmosis-1",
            actions: [
              {
                type: "Bridge",
                tokenIn: "uusdc",
                tokenInAmount: "1733503520",
                tokenOut: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4",
                tokenOutAmount: "1731770016",
                tokenOutChainId: "osmosis-1",
                bridgeInfo: {
                  port: "transfer",
                  channel: "channel-1"
                }
              }
            ]
          },
          {
            chainId: "osmosis-1",
            tokenIn: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4",
            tokenInAmount: "1731770016",
            tokenOut: "uosmo",
            tokenOutAmount: "3276268429",
            tokenOutChainId: "osmosis-1",
            actions: [
              {
                type: "Swap",
                tokenIn: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4",
                tokenInAmount: "1731770016",
                tokenOut: "uosmo",
                tokenOutAmount: "3276268429",
                swapInfo: [
                  {
                    poolId: "1464",
                    tokenOut: "uosmo"
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        swapAmount: "100000000",
        returnAmount: "1637648287",
        paths: [
          {
            chainId: "Oraichain",
            tokenIn: "orai",
            tokenInAmount: "100000000",
            tokenOut: "uosmo",
            tokenOutAmount: "1637648287",
            tokenOutChainId: "osmosis-1",
            actions: [
              {
                type: "Swap",
                tokenIn: "orai",
                tokenInAmount: "100000000",
                tokenOut: "ibc/9C4DCD21B48231D0BC2AC3D1B74A864746B37E4292694C93C617324250D002FC",
                tokenOutAmount: "1637648287",
                swapInfo: [
                  {
                    poolId: "orai1d37artrk4tkhz2qyjmaulc2jzjkx7206tmpfug",
                    tokenOut: "ibc/9C4DCD21B48231D0BC2AC3D1B74A864746B37E4292694C93C617324250D002FC"
                  }
                ]
              },
              {
                type: "Bridge",
                tokenIn: "ibc/9C4DCD21B48231D0BC2AC3D1B74A864746B37E4292694C93C617324250D002FC",
                tokenInAmount: "1637648287",
                tokenOut: "uosmo",
                tokenOutAmount: "1637648287",
                tokenOutChainId: "osmosis-1",
                bridgeInfo: {
                  port: "transfer",
                  channel: "channel-13"
                }
              }
            ]
          }
        ]
      },
      {
        swapAmount: "100000000",
        returnAmount: "1636547996",
        paths: [
          {
            chainId: "Oraichain",
            tokenIn: "orai",
            tokenInAmount: "100000000",
            tokenOut: "uusdc",
            tokenOutAmount: "866506508",
            tokenOutChainId: "noble-1",
            actions: [
              {
                type: "Swap",
                tokenIn: "orai",
                tokenInAmount: "100000000",
                tokenOut: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
                tokenOutAmount: "869996493",
                swapInfo: [
                  {
                    poolId: "orai1m6q5k5nr2eh8q0rdrf57wr7phk7uvlpg7mwfv5",
                    tokenOut: "orai1lus0f0rhx8s03gdllx2n6vhkmf0536dv57wfge"
                  },
                  {
                    poolId: "orai1n4edv5h86rawzrvhy8lmrmnnmmherxnhuwqnk3yuvt0wgclh75usyn3md6",
                    tokenOut: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd"
                  }
                ]
              },
              {
                type: "Bridge",
                tokenIn: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
                tokenInAmount: "869996493",
                tokenOut: "uusdc",
                tokenOutAmount: "866506508",
                tokenOutChainId: "noble-1",
                bridgeInfo: {
                  port: "transfer",
                  channel: "channel-147"
                }
              }
            ]
          },
          {
            chainId: "noble-1",
            tokenIn: "uusdc",
            tokenInAmount: "866506508",
            tokenOut: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4",
            tokenOutAmount: "865640001",
            tokenOutChainId: "osmosis-1",
            actions: [
              {
                type: "Bridge",
                tokenIn: "uusdc",
                tokenInAmount: "866506508",
                tokenOut: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4",
                tokenOutAmount: "865640001",
                tokenOutChainId: "osmosis-1",
                bridgeInfo: {
                  port: "transfer",
                  channel: "channel-1"
                }
              }
            ]
          },
          {
            chainId: "osmosis-1",
            tokenIn: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4",
            tokenInAmount: "865640001",
            tokenOut: "uosmo",
            tokenOutAmount: "1636547996",
            tokenOutChainId: "osmosis-1",
            actions: [
              {
                type: "Swap",
                tokenIn: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4",
                tokenInAmount: "865640001",
                tokenOut: "uosmo",
                tokenOutAmount: "1636547996",
                swapInfo: [
                  {
                    poolId: "1263",
                    tokenOut: "uosmo"
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
];
