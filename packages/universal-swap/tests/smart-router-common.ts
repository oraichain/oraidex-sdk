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
  }
];
