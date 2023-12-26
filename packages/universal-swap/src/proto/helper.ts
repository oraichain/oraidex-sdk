import { IbcBridgeWasmMemo, IbcHooksMemo } from "./universal-swap_pb";

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
  wasmMemo.setReceiver(receiver);
  wasmMemo.setDestinationReceiver(destinationReceiver);
  wasmMemo.setDestinationChannel(destinationChannel);
  wasmMemo.setDestinationDenom(destinationDenom);
  return Buffer.from(wasmMemo.serializeBinary()).toString("base64");
};
