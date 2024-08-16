export type Config = {
  wasmBridgeAddress?: string;
  tonBridgeAddress?: string;
  tonCenterUrl?: string;
  rpcUrl?: string;
};

export const defaultConfig: Record<string, Config> = {
  mainnet: {
    wasmBridgeAddress: "orai159l8l9c5ckhqpuwdfgs9p4v599nqt3cjlfahalmtrhfuncnec2ms5mz60e",
    tonBridgeAddress: "EQC-aFP0rJXwTgKZQJPbPfTSpBFc8wxOgKHWD9cPvOl_DnaY",
    tonCenterUrl: "https://toncenter.orai.io/jsonRPC",
    rpcUrl: "https://rpc.orai.io"
  }
};

export type ConfigKey = keyof typeof defaultConfig;
