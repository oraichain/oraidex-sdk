# Universal swap memo

## Overview

When tokens are bridged to Oraichain, a memo is utilized to invoke the [UniversalSwap](https://github.com/oraichain/osor-api-contracts/blob/14d852cedc0b6adf62a910d889791f2bbfffecb7/contracts/entry-point/src/contract.rs#L222) function in the [Osor-api-contracts](https://github.com/oraichain/osor-api-contracts). This contract plays a crucial role in facilitating any-to-any token swaps, seamlessly integrating into multi-chain workflows. The memo is encoded using the protobuf standard, ensuring compatibility and efficiency in the swap process.

```proto
syntax = "proto3";

message Memo {

  UserSwap user_swap = 1;
  // string because the minimum receive may be very high due to decimal points
  string minimum_receive = 2;
  uint64 timeout_timestamp = 3;
  PostAction post_swap_action = 4;
  string recovery_addr = 5;

  // we dont need swap amount since it will be sent via cw20 or native, and we
  // use that
  message SwapExactAssetIn { repeated SwapOperation operations = 1; }

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

  // if none is provided -> error, if more than one attributes are provided ->
  // error
  message UserSwap {
    // or adapter name so that the smart router can redirect to the right swap
    // router.
    string swap_venue_name = 1;
    optional SwapExactAssetIn swap_exact_asset_in = 2;
    optional SmartSwapExactAssetIn smart_swap_exact_asset_in = 3;
  }

  // Can possibly have both? -> if both then always contract_call first then ibc
  // transfer
  message PostAction {
    optional IbcTransfer ibc_transfer_msg = 1;
    optional IbcWasmTransfer ibc_wasm_transfer_msg = 2;
    optional ContractCall contract_call = 3;
    optional Transfer transfer_msg = 4;
  }

  message IbcTransfer {
    string source_channel = 1;
    string source_port = 2;
    string receiver = 3;
    string memo = 4;
    string recover_address = 5;
  }

  message IbcWasmTransfer {
    /// the local ibc endpoint you want to send tokens back on
    string local_channel_id = 1;
    string remote_address = 2; // can be 0x or bech32
    /// remote denom so that we know what denom to filter when we query based on
    /// the asset info. Most likely be: oraib0x... or eth0x...
    string remote_denom = 3;
    /// How long the packet lives in seconds. If not specified, use
    /// default_timeout
    optional uint64 timeout = 4;
    /// metadata of the transfer to suit the new fungible token transfer
    optional string memo = 5;
  }

  message ContractCall {
    string contract_address = 1;
    string msg = 2;
  }

  message Transfer {
    string to_address = 1;
  }
}
```

## Memo Message Structure

The `Memo` message is the primary structure for handling swap operations and associated actions.

### `Memo`

- **`user_swap` (1)**: Contains details about the swap operation.
- **`minimum_receive` (2)**: A string representing the minimum amount to be received from the swap (used for high precision due to decimal points).
- **`timeout_timestamp` (3)**: A `uint64` representing the deadline for the swap in Unix timestamp format.
- **`post_swap_action` (4)**: Specifies actions to take after the swap, such as transfers or contract calls.
- **`recovery_addr` (5)**: A string for an address used for recovery purposes.

### UserSwap Message

Details about the swap operation.

- **`swap_venue_name` (1)**: The name of the swap venue or adapter used to route the swap.
- **`swap_exact_asset_in` (2)**: Optional. Defines a swap where a specific amount of an asset is used.
- **`smart_swap_exact_asset_in` (3)**: Optional. Defines a smart swap involving routes to perform the swap.

### SwapExactAssetIn Message

Used for swaps where the exact amount of an asset is specified.

- **`operations` (1)**: A repeated field of `SwapOperation` messages, describing each operation in the swap.

### SmartSwapExactAssetIn Message

Used for smart swaps that involve routing.

- **`routes` (1)**: A repeated field of `Route` messages, describing each route for the swap.

### Route Message

Details a route in a smart swap.

- **`offer_amount` (1)**: The amount being offered in this route.
- **`operations` (2)**: A repeated field of `SwapOperation` messages for operations along this route.

[Build a Swap Route](./universal-swap/swap-route.md)

### SwapOperation Message

Describes a single swap operation.

- **`poolId` (1)**: Identifier for the pool involved in the swap.
- **`denomIn` (2)**: The denomination of the input asset.
- **`denomOut` (3)**: The denomination of the output asset.

### PostAction Message

Defines actions to take after the swap.

- **`ibc_transfer_msg` (1)**: Optional. Message for an IBC (Inter-Blockchain Communication) transfer to Cosmos networks.
- **`ibc_wasm_transfer_msg` (2)**: Optional. Message for an IBC transfer involving WASM, used for bridging from Oraichain to EVM, Noble, and Bitcoin.
- **`contract_call` (3)**: Optional. Details for calling a smart contract after the swap.
- **`transfer_msg` (4)**: Optional. General transfer message.

### IbcTransfer Message

Details for an IBC transfer to Cosmos networks.

- **`source_channel` (1)**: Source channel for the transfer.
- **`source_port` (2)**: Source port for the transfer.
- **`receiver` (3)**: Address of the receiver.
- **`memo` (4)**: Optional. Memo field for additional information.
- **`recover_address` (5)**: Optional. Address used for recovery.

### IbcWasmTransfer Message

Details for an IBC transfer involving WASM, used for bridging from Oraichain to EVM, Noble, and Bitcoin.

- **`local_channel_id` (1)**: The local IBC endpoint for the transfer.
- **`remote_address` (2)**: Remote address for the transfer, can be in different formats.
- **`remote_denom` (3)**: Denomination of the asset in the remote chain.
- **`timeout` (4)**: Optional. Timeout for the transfer packet.
- **`memo` (5)**: Optional. Memo for additional metadata.

### ContractCall Message

Details for a contract call.

- **`contract_address` (1)**: Address of the contract to call.
- **`msg` (2)**: Message or data to send to the contract.

### Transfer Message

Details for a simple transfer.

- **`to_address` (1)**: Address to send the transfer to.

## Example

This example illustrates a scenario where a user transfers Orai from the BNB Chain to Oraichain, swaps it for USDC, and then bridges the USDC to Ethereum.

```proto
Memo {
  user_swap: {
    swap_venue_name: "oraidex",
    swap_exact_asset_in: None,
    smart_swap_exact_asset_in: {
      routes: [
        {
          offer_amount: "3000000",
          operations: [
            {
              poolId: "orai19ttg0j7w5kr83js32tmwnwxxdq9rkmw4m3d7mn2j2hkpugwwa4tszwsnkg",
              denomIn: "orai",
              denomOut: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd"
            }
          ]
        }
      ]
    }
  },
  minimum_receive: "10658885",
  timeout_timestamp: 1723202477276000000,
  post_swap_action: {
    ibc_transfer_msg: None,
    ibc_wasm_transfer_msg: {
      local_channel_id: "channel-29",
      remote_address: "eth-mainnet0x8c7E0A841269a01c0Ab389Ce8Fb3Cf150A94E797",
      remote_denom: "eth-mainnet0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      timeout: Some(1723202477000000000),
      memo: Some("")
    },
    contract_call: None,
    transfer_msg: None
  },
  recovery_addr: "orai1hvr9d72r5um9lvt0rpkd4r75vrsqtw6yujhqs2"
}

```

The encoded value you provided represents a serialized Memo message using Protocol Buffers:
`CqMBCgdvcmFpZGV4GpcBCpQBCgczMDAwMDAwEogBCj9vcmFpMTl0dGcwajd3NWtyODNqczMydG13bnd4eGRxOXJrbXc0bTNkN21uMmoyaGtwdWd3d2E0dHN6d3Nua2cSBG9yYWkaP29yYWkxNXVuOG1zeDNuNXpmOWFobHhtZmVxZDJrd2E1d20wbnJweGVyMzA0bTluZDVxNnFxMGc2c2t1NXBkZBIIMTA2NTg4ODUYgN7v8N7wgvUXIokBEoYBCgpjaGFubmVsLTI5EjVldGgtbWFpbm5ldDB4OGM3RTBBODQxMjY5YTAxYzBBYjM4OUNlOEZiM0NmMTUwQTk0RTc5Nxo1ZXRoLW1haW5uZXQweEEwYjg2OTkxYzYyMThiMzZjMWQxOUQ0YTJlOUViMGNFMzYwNmVCNDgggISi7d3wgvUXKgAqK29yYWkxaHZyOWQ3MnI1dW05bHZ0MHJwa2Q0cjc1dnJzcXR3Nnl1amhxczI=`

[How to encode memo](./universal-swap/encode-memo.md)
