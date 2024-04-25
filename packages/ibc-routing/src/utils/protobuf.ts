import { Root } from "protobufjs";

export const decodeIbcMemo = (base64String: string, isHookMemo: boolean = false): any => {
  const protobufRoot = Root.fromJSON({
    nested: {
      IbcBridgeWasmMemo: {
        fields: {
          destinationReceiver: {
            type: "string",
            id: 1
          },
          destinationChannel: {
            type: "string",
            id: 2
          },
          destinationDenom: {
            type: "string",
            id: 3
          }
        }
      },
      IbcHooksMemo: {
        fields: {
          receiver: {
            type: "bytes",
            id: 1
          },
          destinationReceiver: {
            type: "string",
            id: 2
          },
          destinationChannel: {
            type: "string",
            id: 3
          },
          destinationDenom: {
            type: "string",
            id: 4
          }
        }
      }
    }
  });

  const base64Buffer = Buffer.from(base64String, "base64");
  const decodedMessage = protobufRoot
    .lookupType(isHookMemo ? "IbcHooksMemo" : "IbcBridgeWasmMemo")
    .decode(base64Buffer);

  return decodedMessage.toJSON();
};
