import { OfflineSigner } from "@cosmjs/proto-signing";
import { ConfigKey, defaultConfig, Config } from "./config";
import { Sender } from "@ton/ton";
import { TonBridgeHandler } from "./BridgeHandler";
import { GasPrice } from "@cosmjs/stargate";

export async function createOraichainTonBridgeHandler(
  tonSender: Sender,
  cosmosSigner: OfflineSigner,
  env: ConfigKey,
  overrideConfig?: Config,
  tonCenterApiKey?: string
) {
  if (!tonSender.address) {
    throw new Error("Ton sender must have an address");
  }
  const configEnv = { ...defaultConfig[env], ...overrideConfig };
  return TonBridgeHandler.create({
    wasmBridge: configEnv.wasmBridgeAddress,
    tonBridge: configEnv.tonBridgeAddress,
    tonSender: tonSender,
    offlineSigner: cosmosSigner,
    cosmosRpc: configEnv.rpcUrl,
    tonClientParameters: {
      endpoint: configEnv.tonCenterUrl,
      apiKey: tonCenterApiKey
    },
    signingCosmwasmClientOpts: {
      gasPrice: GasPrice.fromString("0.002orai"),
      broadcastPollIntervalMs: 700
    }
  });
}
