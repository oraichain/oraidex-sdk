# Swap route

## Overview

A **Swap Route** is an essential component for executing token swaps on Oraidex. The Swap Route defines the path through which an asset (the **offer asset**) is exchanged for another asset (the **destination asset**) using potentially multiple intermediary steps, known as **multi-hop** swaps.

In each route, the `offer_amount` specifies the amount of the initial asset being swapped. The route consists of a series of `SwapOperations`, where each operation involves converting one token (tokenIn) into another (tokenOut). Importantly, within a single route, the output token of one operation must match the input token of the next operation, ensuring a seamless transition from the initial asset to the final destination asset.

The destination token received at the end of the swap route is then used for the subsequent actions in the broader transaction process, whether it be further swaps, transfers, or any other specified operation. This setup allows for complex, efficient trading strategies that can optimize for the best possible outcome across different pools and trading pairs on Oraidex.

```proto
message SmartSwapExactAssetIn { repeated Route routes = 1; }

message Route {
    string offer_amount = 1;
    repeated SwapOperation operations = 2;
  }

  message SwapOperation {
    string poolId = 1;
    string denomIn = 2;
    string denomOut = 3;
  }
```

## How to Build a Swap Route

To build a Swap Route on Oraidex, you can utilize the API provided by Oraidex's smart router. This API helps determine the most efficient route for your swap. Below is a step-by-step guide:

Start by calling the **Smart Route API** available at `https://osor.oraidex.io/smart-router/alpha-router`. This API returns the optimal swap route based on the assets and parameters you provide.

Suppose you've bridged Orai from BNB Chain to Oraichain and now want to swap it for USDT on Oraichain. You would call the Smart Route API with the following request body:

```json
POST https://osor.oraidex.io/smart-router/alpha-router
{
  "sourceAsset": "orai", // source asset
  "sourceChainId": "Oraichain", // source chain ID
  "destAsset": "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh", // destination asset
  "destChainId": "Oraichain", // destination chain id
  "offerAmount": "1000000000", // offer amount to swap
  "swapOptions": {
    "protocols": ["Oraidex", "OraidexV3"] // protocols used for swapping
  }
}
```

Sample response:

In the sample response provided by the Smart Route API, we are given a swap plan that divides 1000 Orai into two separate routes—one that swaps 700 Orai and another that swaps 300 Orai. Below is an example of how to interpret the response and use it to build your swap operations.

```json
{
  "swapAmount": "1000000000",
  "returnAmount": "5601376843",
  "routes": [
    {
      "swapAmount": "700000000",
      "returnAmount": "3921206817",
      "paths": [
        {
          "chainId": "Oraichain",
          "tokenIn": "orai",
          "tokenInAmount": "700000000",
          "tokenOut": "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh",
          "tokenOutAmount": "3921206817",
          "tokenOutChainId": "Oraichain",
          "actions": [
            {
              "type": "Swap",
              "protocol": "OraidexV3",
              "tokenIn": "orai",
              "tokenInAmount": "700000000",
              "tokenOut": "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh",
              "tokenOutAmount": "3921206817",
              "swapInfo": [
                {
                  "poolId": "orai-orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh-3000000000-100",
                  "tokenOut": "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "swapAmount": "300000000",
      "returnAmount": "1680170026",
      "paths": [
        {
          "chainId": "Oraichain",
          "tokenIn": "orai",
          "tokenInAmount": "300000000",
          "tokenOut": "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh",
          "tokenOutAmount": "1680170026",
          "tokenOutChainId": "Oraichain",
          "actions": [
            {
              "type": "Swap",
              "protocol": "OraidexV3",
              "tokenIn": "orai",
              "tokenInAmount": "300000000",
              "tokenOut": "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh",
              "tokenOutAmount": "1680170026",
              "swapInfo": [
                {
                  "poolId": "orai-orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd-3000000000-100",
                  "tokenOut": "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd"
                },
                {
                  "poolId": "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh-orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd-500000000-10",
                  "tokenOut": "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

From the response, you can see that 1000 Orai is split into two routes:

1. First route:

- Swap 700 Orai to USDT via a single pool.
- Use the swapInfo in this route to build the swap operations

```json
{
  "offer_amount": "700000000",
  "operations": [
    {
      "poolId": "orai-orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh-3000000000-100",
      "denomIn": "orai",
      "denomOut": "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh"
    }
  ]
}
```

2. Second Route:

- Swap 300 Orai to USDT, but this time through a multi-hop process.
- The first swap is from Orai to an intermediate token.
- The second swap converts the intermediate token to USDT

```json
{
  "offer_amount": "700000000",
  "operations": [
    {
      "poolId": "orai-orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd-3000000000-100",
      "denomIn": "orai",
      "denomOut": "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd"
    },
    {
      "poolId": "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh-orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd-500000000-10",
      "denomIn": "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
      "denomOut": "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh"
    }
  ]
}
```

To combine the two routes from the sample response into a single smart_swap_exact_asset_in structure, the resulting swap routes are as follows

```json
{
  "smart_swap_exact_asset_in": {
    "routes": [
      {
        "offer_amount": "700000000",
        "operations": [
          {
            "poolId": "orai-orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh-3000000000-100",
            "denomIn": "orai",
            "denomOut": "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh"
          }
        ]
      },
      {
        "offer_amount": "300000000",
        "operations": [
          {
            "poolId": "orai-orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd-3000000000-100",
            "denomIn": "orai",
            "denomOut": "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd"
          },
          {
            "poolId": "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh-orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd-500000000-10",
            "denomIn": "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
            "denomOut": "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh"
          }
        ]
      }
    ]
  }
}
```
