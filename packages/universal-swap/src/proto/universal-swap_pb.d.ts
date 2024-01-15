// package: universalswap
// file: src/utils/universal-swap.proto

import * as jspb from "google-protobuf";

export class IbcHooksMemo extends jspb.Message {
  getReceiver(): Uint8Array | string;
  getReceiver_asU8(): Uint8Array;
  getReceiver_asB64(): string;
  setReceiver(value: Uint8Array | string): void;

  getDestinationReceiver(): string;
  setDestinationReceiver(value: string): void;

  getDestinationChannel(): string;
  setDestinationChannel(value: string): void;

  getDestinationDenom(): string;
  setDestinationDenom(value: string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): IbcHooksMemo.AsObject;
  static toObject(includeInstance: boolean, msg: IbcHooksMemo): IbcHooksMemo.AsObject;
  static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
  static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
  static serializeBinaryToWriter(message: IbcHooksMemo, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): IbcHooksMemo;
  static deserializeBinaryFromReader(message: IbcHooksMemo, reader: jspb.BinaryReader): IbcHooksMemo;
}

export namespace IbcHooksMemo {
  export type AsObject = {
    receiver: Uint8Array | string;
    destinationReceiver: string;
    destinationChannel: string;
    destinationDenom: string;
  };
}

export class IbcBridgeWasmMemo extends jspb.Message {
  getDestinationReceiver(): string;
  setDestinationReceiver(value: string): void;

  getDestinationChannel(): string;
  setDestinationChannel(value: string): void;

  getDestinationDenom(): string;
  setDestinationDenom(value: string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): IbcBridgeWasmMemo.AsObject;
  static toObject(includeInstance: boolean, msg: IbcBridgeWasmMemo): IbcBridgeWasmMemo.AsObject;
  static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
  static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
  static serializeBinaryToWriter(message: IbcBridgeWasmMemo, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): IbcBridgeWasmMemo;
  static deserializeBinaryFromReader(message: IbcBridgeWasmMemo, reader: jspb.BinaryReader): IbcBridgeWasmMemo;
}

export namespace IbcBridgeWasmMemo {
  export type AsObject = {
    destinationReceiver: string;
    destinationChannel: string;
    destinationDenom: string;
  };
}
