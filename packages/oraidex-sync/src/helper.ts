import { Attribute, Event } from "@cosmjs/stargate";
import { AssetInfo } from "@oraichain/oraidex-contracts-sdk";

function parseAssetInfo(info: AssetInfo): string {
  if ("native_token" in info) return info.native_token.denom;
  return info.token.contract_addr;
}

async function delay(timeout: number) {
  return new Promise((resolve) => setTimeout(resolve, timeout));
}

function parseWasmEvents(events: readonly Event[]): (readonly Attribute[])[] {
  return events
    .filter((event) => event.type === "wasm")
    .map((event) => event.attributes);
}

function parseOraidexAttributes(attributes: readonly Attribute[]) {
  return;
}

export { parseAssetInfo, delay, parseWasmEvents, parseOraidexAttributes };
