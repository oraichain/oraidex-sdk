# Oraichain <=> TON

# Overview

The Ton Bridge facilitates the transfer of tokens between the Ton blockchain and Oraichain, as well as other blockchains within the Cosmos ecosystem.

## Ton Contract

| Name           | Address                                          |
| -------------- | ------------------------------------------------ |
| Light Client   | EQDzy_POlimFDyzrHd3OQsb9sZCngyG3O7Za4GRFzM-rrO93 |
| Bridge Adapter | EQC-aFP0rJXwTgKZQJPbPfTSpBFc8wxOgKHWD9cPvOl_DnaY |

## Oraichain Contract

| Name           | Address                                                         |
| -------------- | --------------------------------------------------------------- |
| Light Client   | orai159l8l9c5ckhqpuwdfgs9p4v599nqt3cjlfahalmtrhfuncnec2ms5mz60e |
| Bridge Adapter | orai16crw7g2rcvuga7vlnyxgwtdxtan46k8qqjjwhjqdjvjgk96n95es35q8vm |

# Workflows:

## Send from Ton to Oraichain

<img src="./image/ton_to_orai.png" alt="Ton to Oraichain" width="1200">
<!-- ![Ton to Oraichain](./image/ton_to_orai.png) -->

## Send from Oraichain to Ton

![Oraichain to Ton](./image/orai_to_ton.png)

# Integration

## Ton to Oraichain

### Bridging Tokens from Ton to Oraichain

You can bridge two types of tokens from Ton to Oraichain:

1. **Ton (Native) Tokens**: This includes the native Ton token.
2. **Jetton Tokens**: This includes tokens like USDT, USDC, and other Jetton-based tokens.

#### For integration on Node.JS server:

```ts
const TON_NATIVE = "ton";
type JettonMasterAddress = string;
export type TonDenom = typeof TON_NATIVE | JettonMasterAddress;

interface ITonBridgeHandler {
  sendToCosmos(
    cosmosRecipient: string,
    amount: bigint,
    denom: TonDenom,
    opts: ValueOps,
    timeoutTimestamp: bigint = BigInt(calculateTimeoutTimestamp(3600)),
    memo: string = ""
  ): Promise<void>;
}
```

**Notice**:

- If you send native ton to Oraichain, the message will send directly to **Bridge Adapter** contract.
- If you send jetton token to Oraichain, the message will send to **Jetton Wallet** contract first then it will be forwarded to **Bridge Adapter** contract after some messages.

**Parameters**:

- `cosmosRecipient` : recipient address on cosmos destination chain.
- `amount`: amount of token that you want to send.
- `denom`: denom of the token, which will decide it is **bridge_ton** or **bridge_jetton_token**.
- `opts`: configuration of **total ton amount** that you want to send along with the messages and the **query id** of that message.
- `timeoutTimestamp`: timeout timestamp of packet.
- `memo`: [memo](./universal-swap-memo.md) is used for UniversalSwap which will be executed when the token reached to Oraichain.

**Example:**

```ts
import { COSMOS_CHAIN_IDS, OraiCommon, TON_NATIVE } from "@oraichain/common";
import { toNano } from "@ton/ton";
import { initCosmosWallet, initTonWallet } from "./demo-utils";
import { calculateTimeoutTimestampTon, createTonBridgeHandler } from "./utils";

export async function main() {
  const oraiMnemonic = <ORAICHAIN_MNEMONIC>;
  const tonMnemonic = <TON_MNEMONIC>;
  const cosmosWallet = initCosmosWallet(oraiMnemonic);
  const tonWallet = await initTonWallet(tonMnemonic, "V5R1");
  const cosmosRpc = (
    await OraiCommon.initializeFromGitRaw({
      chainIds: [COSMOS_CHAIN_IDS.ORAICHAIN]
    })
  ).chainInfos.cosmosChains[0].rpc;
  const handler = await createTonBridgeHandler(cosmosWallet, tonWallet, {
    rpc: cosmosRpc,
    chainId: COSMOS_CHAIN_IDS.ORAICHAIN
  });

  await handler.sendToCosmos(
    handler.wasmBridge.sender,
    toNano(3),
    TON_NATIVE,
    {
      queryId: 0,
      value: toNano(0) // dont care
    },
    calculateTimeoutTimestampTon(3600),
    ""
  );
}

main();
```

#### For integration on Web browser client:

Unfortunately, most client libraries for Ton do not support the same types of Ton clients as `@ton/core`. As a result, you’ll need to build the **Cell** and send the message manually.

For building cell, you will use `@oraichain/ton-bridge-contracts` library:

##### With bridging ton case:

```ts
interface BridgeTon {
  amount: bigint; // amount of ton you want to transfer
  timeout: bigint; // timeout of packet
  memo: Cell; // memo for execution when token reached Oraichain
  remoteReceiver: string; // cosmos address on destination chain
}

interface IBridgeAdapter {
  static buildBridgeTonBody(data: BridgeTon, remoteCosmosData: Uint8Array, ops: ValueOps);
}
```

**Parameters**:

- `data` : data for building bridge ton cell.
- `remoteCosmosData`: cosmos address in bech32.
- `ops`: configuration of **total ton amount** that you want to send along with the messages and the **query id** of that message.

##### With bridging jetton token case:

```ts
interface SendTransferInterface {
  toAddress: Address; // address that receive forwarding packet for handling (here is bridge adapter address)
  fwdAmount: bigint; // amount of ton for forwading packet
  jettonAmount: bigint; // amount of tokens for bridging
  jettonMaster: Address; // jetton master of bridging token
  remoteReceiver: string; // cosmos receipient address
  timeout: bigint; // timeout of packet
  memo: Cell; // memo for execution when token reached Oraichain
}

interface IJettonWallet {
  static buildSendTransferPacket(responseAddress: Address, data: SendTransferInterface, queryId: number = 0);
}
```

**Parameters**:

- `data` : data for building bridge jetton cell.
- `responseAddress`: address for receiving redundant fee ton.
- `queryId`: **query id** of that message.

**Examples for two cases:**

```tsx
import { useTonConnectUI } from "@tonconnect/ui-react";
...
const [tonConnectUI] = useTonConnectUI();
...
const memo = beginCell().storeStringRefTail(<memo_string>).endCell();
const getNativeBridgePayload = () =>
        BridgeAdapter.buildBridgeTonBody(
          {
            amount: BigInt(fmtAmount.toString()),
            memo,
            remoteReceiver: oraiAddress,
            timeout,
          },
          oraiAddressBech32,
          {
            queryId: 0,
            value: toNano(0), // don't care this
          }
        ).toBoc();

      const getOtherBridgeTokenPayload = () =>
        JettonWallet.buildSendTransferPacket(
          Address.parse(tonAddress),
          {
            fwdAmount: FWD_AMOUNT,
            jettonAmount: BigInt(fmtAmount.toString()),
            jettonMaster: Address.parse(token.contractAddress),
            remoteReceiver: oraiAddress,
            timeout,
            memo,
            toAddress: bridgeAdapterAddress,
          },
          0
        ).toBoc();

      const boc = isNativeTon
        ? getNativeBridgePayload()
        : getOtherBridgeTokenPayload();

      const tx = await tonConnectUI.sendTransaction({
        validUntil: TON_MESSAGE_VALID_UNTIL,
        messages: [
          {
            address: toAddress, // dia chi token
            amount: gasAmount, // gas
            payload: Base64.encode(boc),
          },
        ],
      });
```

## Oraichain to Ton

#### For integration on Node.JS server:

```ts
const TON_NATIVE = "ton";
type JettonMasterAddress = string;
export type TonDenom = typeof TON_NATIVE | JettonMasterAddress;

interface ITonBridgeHandler {
  sendToTon(
    tonRecipient: string,
    amount: bigint,
    tokenDenomOnTon: string,
    timeoutTimestamp: bigint = BigInt(calculateTimeoutTimestampTon(3600))
  ): Promise<void>;
}
```

**Parameters**:

- `tonRecipient` : ton recipient address.
- `amount`: amount of token that you want to send.
- `tokenDenomOnTon`: token denom address on ton. With ton native token it will be **ton zero address** and with jetton token, it will be **jetton master address**.
- `timeoutTimestamp`: timeout timestamp of packet.

**Examples:**

```ts
import { COSMOS_CHAIN_IDS, OraiCommon } from "@oraichain/common";
import { toNano } from "@ton/ton";
import { TON_ZERO_ADDRESS } from "./constants";
import { initCosmosWallet, initTonWallet } from "./demo-utils";
import { createTonBridgeHandler } from "./utils";

export async function main() {
  const oraiMnemonic = <ORAICHAIN_MNEMONIC>;
  const tonMnemonic = <TON_MNEMONIC>;
  const cosmosWallet = initCosmosWallet(oraiMnemonic);
  const tonWallet = await initTonWallet(tonMnemonic, "V4R2");
  const cosmosRpc = (
    await OraiCommon.initializeFromGitRaw({
      chainIds: [COSMOS_CHAIN_IDS.ORAICHAIN],
    })
  ).chainInfos.cosmosChains[0].rpc;
  const handler = await createTonBridgeHandler(
    cosmosWallet,
    tonWallet,
    { rpc: cosmosRpc, chainId: COSMOS_CHAIN_IDS.ORAICHAIN }
  );
  const tonReceiveAddress = handler.tonSender.address.toString({
    urlSafe: true,
    bounceable: false,
  });
  console.log(tonReceiveAddress);
  const result = await handler.sendToTon(
    tonReceiveAddress,
    toNano(3),
    TON_ZERO_ADDRESS
  );
  console.log(result);
}

main();
```

#### For integration on Web browser client:

At the time i write this docs, `@oraichain/tonbridge-sdk` does not support for client since it is using ton wallet which can not be used for client. Temporarily, I will show a doc on how to use `@oraichain/tonbridge-contracts-sdk` on client.

##### With bridging native token (which is created by token factory module):

```ts
interface TonbridgeBridgeInterface {
  bridgeToTon: (
    {
      denom,
      timeout,
      to
    }: {
      denom: string;
      timeout?: number;
      to: string;
    },
    _fee?: number | StdFee | "auto",
    _memo?: string,
    _funds?: Coin[]
  ) => Promise<ExecuteResult>;
}
```

**Parameters**:

- `denom` : ton denom address on Ton Network (**ZERO ADDRESS** if it is TON & **Jetton Master Address** if it is jetton token).
- `timeout`: timeout timestamp of packet.
- `to`: ton recipient address.

##### With jetton token:

```ts
## with this case, you just need to send cw20 token to the ton bridge contract with the message as follow:

interface Message {
  denom: string;
  timeout?: number;
  to: string;
}
```

**Parameters**:

- `denom` : ton denom address on Ton Network (**ZERO ADDRESS** if it is TON & **Jetton Master Address** if it is jetton token).
- `timeout`: timeout timestamp of packet.
- `to`: ton recipient address.

**Examples for two cases:**

```ts
const tonBridgeClient = new TonbridgeBridgeClient(window.client, oraiAddress, network.CW_TON_BRIDGE);

let tx;

const timeout = Math.floor(new Date().getTime() / 1000) + 3600;
const msg = {
  // crcSrc: ARG_BRIDGE_TO_TON.CRC_SRC,
  denom: TonTokenList(tonNetwork).find((tk) => tk.coingeckoId === token.coingeckoId).contractAddress,
  timeout,
  to: tonAddress
};

const funds = handleSentFunds({
  denom: token.denom,
  amount: toAmount(amount, token.decimal).toString()
});

// native token
if (!token.contractAddress) {
  tx = await tonBridgeClient.bridgeToTon(msg, "auto", null, funds);
}
// cw20 token
else {
  tx = await window.client.execute(
    oraiAddress,
    token.contractAddress,
    {
      send: {
        contract: network.CW_TON_BRIDGE,
        amount: toAmount(amount, token.decimal).toString(),
        msg: toBinary({
          denom: msg.denom,
          timeout,
          to: msg.to
        })
      }
    },
    "auto"
  );
}
```
