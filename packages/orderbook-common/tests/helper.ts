import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { compare } from "@oraichain/cosmwasm-vm-js";
import { SimulateCosmWasmClient } from "@oraichain/cw-simulate";
import { SortedMap } from "@oraichain/immutable";
import { toDisplay } from "@oraichain/oraidex-common";
import { OrderResponse } from "@oraichain/oraidex-contracts-sdk/build/OraiswapLimitOrder.types";
import * as bip39 from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import fs from "fs";
import path from "path";
import { OraichainOrderbookClientHelper } from "../src/helper";

export const ORAI_USDT_PAIR_CONTRACT_ADDR = "orai1c5s03c3l336dgesne7dylnmhszw8554tsyy9yt";
export const ORAI_USDT_LP_POOL_CONTRACT_ADDR = "orai1mav52eqhd07c3lwevcnqdykdzhh4733zf32jcn";

export interface MinimalOrder {
  price: number;
  amount: string;
  total: string;
}

export class BufferStream {
  private readonly fd: number;
  private sizeBuf: Buffer;

  constructor(private readonly filePath: string, append: boolean) {
    if (!append || !fs.existsSync(filePath)) {
      this.sizeBuf = Buffer.alloc(4);
      fs.writeFileSync(filePath, this.sizeBuf);
      this.fd = fs.openSync(filePath, "r+");
    } else {
      this.fd = fs.openSync(filePath, "r+");
      this.sizeBuf = Buffer.allocUnsafe(4);
      fs.readSync(this.fd, this.sizeBuf, 0, 4, 0);
    }
  }

  private increaseSize() {
    for (let i = this.sizeBuf.length - 1; i >= 0; --i) {
      if (this.sizeBuf[i] === 255) {
        this.sizeBuf[i] = 0;
      } else {
        this.sizeBuf[i]++;
        break;
      }
    }
  }

  get size() {
    return this.sizeBuf.readUInt32BE();
  }

  close() {
    fs.closeSync(this.fd);
  }

  write(entries: Array<[Uint8Array, Uint8Array]>) {
    let n = 0;
    for (const [k, v] of entries) {
      n += k.length + v.length + 3;
    }
    const outputBuffer = Buffer.allocUnsafe(n);
    let ind = 0;
    for (const [k, v] of entries) {
      outputBuffer[ind++] = k.length;
      outputBuffer.set(k, ind);
      ind += k.length;
      outputBuffer[ind++] = (v.length >> 8) & 0b11111111;
      outputBuffer[ind++] = v.length & 0b11111111;
      outputBuffer.set(v, ind);
      ind += v.length;
      this.increaseSize();
    }

    // update size
    fs.writeSync(this.fd, this.sizeBuf, 0, 4, 0);
    // append item
    fs.appendFileSync(this.filePath, outputBuffer);
  }
}

class BufferIter {
  private ind: number = 0;
  private bufInd: number = 0;
  constructor(private readonly buf: Buffer, public readonly size: number) {}

  reset() {
    this.ind = 0;
    this.bufInd = 0;
    return this;
  }

  next() {
    if (this.ind === this.size) {
      return {
        done: true
      };
    }

    const keyLength = this.buf[this.bufInd++];
    const k = this.buf.subarray(this.bufInd, (this.bufInd += keyLength));
    const valueLength = (this.buf[this.bufInd++] << 8) | this.buf[this.bufInd++];
    const v = this.buf.subarray(this.bufInd, (this.bufInd += valueLength));
    this.ind++;

    return {
      value: [k, v]
    };
  }
}

class BufferCollection {
  public readonly size: number;
  private readonly buf: Buffer;
  constructor(buf: Buffer) {
    this.size = buf.readUInt32BE();
    this.buf = buf.subarray(4);
  }

  entries() {
    return new BufferIter(this.buf, this.size);
  }
}

BufferCollection.prototype["@@__IMMUTABLE_KEYED__@@"] = true;

// helper function
const downloadState = async (
  contractAddress: string,
  writeCallback: Function,
  endCallback: Function,
  startAfter?: string,
  limit = 5000
) => {
  let nextKey = startAfter;

  while (true) {
    const url = new URL(`https://lcd.orai.io/cosmwasm/wasm/v1/contract/${contractAddress}/state`);
    url.searchParams.append("pagination.limit", limit.toString());
    if (nextKey) {
      url.searchParams.append("pagination.key", nextKey);
      console.log("nextKey", nextKey);
    }
    try {
      const { models, pagination } = await fetch(url.toString(), {
        signal: AbortSignal.timeout(30000)
      }).then((res) => res.json());
      writeCallback(models);
      if (!(nextKey = pagination.next_key)) {
        return endCallback();
      }
    } catch (ex) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
};

// if there is nextKey then append, otherwise insert
export const saveState = async (contractAddress: string, nextKey?: string) => {
  const bufStream = new BufferStream(path.resolve(__dirname, "data", `${contractAddress}.state`), !!nextKey);
  await new Promise((resolve) => {
    downloadState(
      contractAddress,
      (chunks: any) => {
        const entries = chunks.map(({ key, value }) => [Buffer.from(key, "hex"), Buffer.from(value, "base64")]);
        bufStream.write(entries);
      },
      resolve,
      nextKey
    );
  });
  bufStream.close();

  // check contract code
  const contractFile = path.resolve(__dirname, "data", contractAddress);
  if (!fs.existsSync(contractFile)) {
    const {
      contract_info: { code_id }
    } = await fetch(`https://lcd.orai.io/cosmwasm/wasm/v1/contract/${contractAddress}`).then((res) => res.json());
    const { data } = await fetch(`https://lcd.orai.io/cosmwasm/wasm/v1/code/${code_id}`).then((res) => res.json());
    fs.writeFileSync(contractFile, Buffer.from(data, "base64"));
  }

  console.log("done");
};

export const loadStateData = (contractAddress: string): SortedMap<Uint8Array, Uint8Array> => {
  const buffer = fs.readFileSync(path.resolve(__dirname, "data", `${contractAddress}.state`));

  return SortedMap.rawPack<Uint8Array, Uint8Array>(
    // @ts-ignore
    new BufferCollection(buffer),
    compare
  );
};

export const loadState = async (
  client: SimulateCosmWasmClient,
  senderAddress: string,
  contractAddress: string,
  label: string,
  data: any,
  wasmCode?: Uint8Array
) => {
  const { codeId } = await client.upload(
    senderAddress,
    wasmCode ?? fs.readFileSync(path.resolve(__dirname, "data", contractAddress)),
    "auto"
  );

  await client.loadContract(
    contractAddress,
    {
      codeId,
      admin: senderAddress,
      label,
      creator: senderAddress,
      created: 1
    },
    data
  );
};

export const displayOrderDepth = (totalQuoteAmount: number): string => {
  const totalDepth = (totalQuoteAmount / 10).toFixed(0);
  let depthDisplay = "";
  for (let i = 0; i < Number(totalDepth); i++) {
    depthDisplay += ".";
  }
  return depthDisplay;
};

export const displayOrderbook = (orders: OrderResponse[], midPrice: string, baseDecimals = 6, quoteDecimals = 6) => {
  const buyOrders = orders
    .filter((order) => order.direction === "buy")
    .map((order) => ({
      price: OraichainOrderbookClientHelper.calculateOrderPrice(
        order.offer_asset.amount,
        order.ask_asset.amount,
        order.direction
      ),
      baseAmount: toDisplay(order.ask_asset.amount, baseDecimals, baseDecimals),
      totalQuoteAmount: toDisplay(order.offer_asset.amount, quoteDecimals, quoteDecimals),
      depth: displayOrderDepth(toDisplay(order.offer_asset.amount, quoteDecimals, quoteDecimals))
    }))
    .sort((a, b) => b.price - a.price);
  const sellOrders = orders
    .filter((order) => order.direction === "sell")
    .map((order) => ({
      price: OraichainOrderbookClientHelper.calculateOrderPrice(
        order.offer_asset.amount,
        order.ask_asset.amount,
        order.direction
      ),
      baseAmount: toDisplay(order.offer_asset.amount, baseDecimals, baseDecimals),
      totalQuoteAmount: toDisplay(order.ask_asset.amount, quoteDecimals, quoteDecimals),
      depth: displayOrderDepth(toDisplay(order.ask_asset.amount, quoteDecimals, quoteDecimals))
    }))
    .sort((a, b) => b.price - a.price);
  const sortedOrders = [
    {
      price: "sell ===================",
      baseAmount: "sell ===================",
      totalQuoteAmount: "sell ==================="
    },
    ...sellOrders,
    {
      price: midPrice,
      baseAmount: "mid ===================",
      totalQuoteAmount: "mid ==================="
    },
    ...buyOrders,
    {
      price: "buy ===================",
      baseAmount: "buy ===================",
      totalQuoteAmount: "buy ==================="
    }
  ];
  console.table(sortedOrders);
  return [buyOrders, sellOrders];
};

export const queryAndDisplayOrderbook = async (helper: OraichainOrderbookClientHelper) => {
  const allBuyTicks = (await helper.queryAllTicks("buy", 2)).slice(undefined, 10);
  const allSellTicks = (await helper.queryAllTicks("sell", 1)).slice(undefined, 10);
  const buyOrders = await helper.queryOrdersWithDirectionAndTicks(
    "buy",
    allBuyTicks.map((tick) => tick.price)
  );
  const sellOrders = await helper.queryOrdersWithDirectionAndTicks(
    "sell",
    allSellTicks.map((tick) => tick.price)
  );
  const orderbookPrice = await helper.getOrderbookPrice();
  displayOrderbook([...buyOrders, ...sellOrders], orderbookPrice.toString());
};

export const buildOfflineSigner = (_mnemonic?: string) => {
  const mnemonic = _mnemonic ? _mnemonic : bip39.generateMnemonic(wordlist);
  return DirectSecp256k1HdWallet.fromMnemonic(mnemonic);
};
