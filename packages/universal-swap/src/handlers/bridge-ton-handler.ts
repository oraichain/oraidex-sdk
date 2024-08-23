import { createOraichainTonBridgeHandler } from "@oraichain/tonbridge-sdk";

export class BridgeTonHandler {
  async handleBridge() {
    // TODO: impl handle TON bridge universal swap logic here
    const handler = await createOraichainTonBridgeHandler();
  }
}
