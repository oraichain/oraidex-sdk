import { IbcBridgeWasmMemo, IbcHooksMemo } from "./universal-swap_pb";
import { decode, encode, fromWords } from "bech32";
export const parseToIbcWasmMemo = (
  destinationReceiver: string,
  destinationChannel: string,
  destinationDenom: string
): string => {
  const wasmMemo = new IbcBridgeWasmMemo();
  wasmMemo.setDestinationReceiver(destinationReceiver);
  wasmMemo.setDestinationChannel(destinationChannel);
  wasmMemo.setDestinationDenom(destinationDenom);

  return Buffer.from(wasmMemo.serializeBinary()).toString("base64");
};

export const parseToIbcHookMemo = (
  receiver: string,
  destinationReceiver: string,
  destinationChannel: string,
  destinationDenom: string
): string => {
  const wasmMemo = new IbcHooksMemo();
  // we will encode receiver from Orai address to canonicalize address
  wasmMemo.setReceiver(Buffer.from(fromWords(decode(receiver).words)).toString("base64"));
  wasmMemo.setDestinationReceiver(destinationReceiver);
  wasmMemo.setDestinationChannel(destinationChannel);
  wasmMemo.setDestinationDenom(destinationDenom);
  return Buffer.from(wasmMemo.serializeBinary()).toString("base64");
};
