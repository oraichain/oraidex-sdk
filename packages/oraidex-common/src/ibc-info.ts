// exclude evm chain

import {
  ATOM_ORAICHAIN_CHANNELS,
  IBC_TRANSFER_TIMEOUT,
  IBC_WASM_CONTRACT,
  IBC_WASM_CONTRACT_TEST,
  INJECTIVE_ORAICHAIN_CHANNELS,
  KWT_ORAICHAIN_CHANNELS,
  NOBLE_ORAICHAIN_CHANNELS,
  NOBLE_ORAICHAIN_CHANNELS_TEST,
  ORAIB_ORAICHAIN_CHANNELS,
  ORAIB_ORAICHAIN_CHANNELS_OLD,
  ORAIB_ORAICHAIN_CHANNELS_TEST,
  OSMOSIS_ORAICHAIN_CHANNELS,
  NEUTARO_ORAICHAIN_CHANNELS
} from "./constant";
import { CosmosChainId, NetworkChainId } from "./network";

export interface IBCInfo {
  source: string;
  channel: string;
  testInfo?: Omit<IBCInfo, "testInfo">;
  timeout: number;
}

export type IBCInfoMap = { [key in CosmosChainId]: { [key in NetworkChainId]?: IBCInfo } };

// ibc constants

export const [atom2oraichain, oraichain2atom] = ATOM_ORAICHAIN_CHANNELS.split(/\s+/);
export const [neutaro2oraichain, oraichain2neutaro] = NEUTARO_ORAICHAIN_CHANNELS.split(/\s+/);
export const [inj2oraichain, oraichain2inj] = INJECTIVE_ORAICHAIN_CHANNELS.split(/\s+/);
export const [osmosis2oraichain, oraichain2osmosis] = OSMOSIS_ORAICHAIN_CHANNELS.split(/\s+/);
export const [oraib2oraichain, oraichain2oraib] = ORAIB_ORAICHAIN_CHANNELS.split(/\s+/);
export const [noble2oraichain, oraichain2noble] = NOBLE_ORAICHAIN_CHANNELS.split(/\s+/);
export const [noble2oraichainTest, oraichain2nobleTest] = NOBLE_ORAICHAIN_CHANNELS_TEST.split(/\s+/);
export const [oraib2oraichainTest, oraichain2oraibTest] = ORAIB_ORAICHAIN_CHANNELS_TEST.split(/\s+/);
const [oraib2oraichain_old, oraichain2oraib_old] = ORAIB_ORAICHAIN_CHANNELS_OLD.split(/\s+/);
const [kwt2oraichain, oraichain2kwt] = KWT_ORAICHAIN_CHANNELS.split(/\s+/);

// exclude evm chain

export const ibcInfos: IBCInfoMap = {
  "cosmoshub-4": {
    Oraichain: {
      source: "transfer",
      channel: atom2oraichain,
      timeout: IBC_TRANSFER_TIMEOUT
    }
  },
  "Neutaro-1": {
    Oraichain: {
      source: "transfer",
      channel: neutaro2oraichain,
      timeout: IBC_TRANSFER_TIMEOUT
    }
  },
  "injective-1": {
    Oraichain: {
      source: "transfer",
      channel: inj2oraichain,
      timeout: IBC_TRANSFER_TIMEOUT
    }
  },
  "osmosis-1": {
    Oraichain: {
      source: "transfer",
      channel: osmosis2oraichain,
      timeout: IBC_TRANSFER_TIMEOUT
    }
  },
  "kawaii_6886-1": {
    Oraichain: {
      source: "transfer",
      channel: kwt2oraichain,
      timeout: IBC_TRANSFER_TIMEOUT
    }
  },
  "noble-1": {
    Oraichain: {
      source: "transfer",
      channel: noble2oraichain,
      testInfo: {
        source: "transfer",
        channel: noble2oraichainTest,
        timeout: IBC_TRANSFER_TIMEOUT
      },
      timeout: IBC_TRANSFER_TIMEOUT
    }
  },
  Oraichain: {
    "cosmoshub-4": {
      source: "transfer",
      channel: oraichain2atom,
      timeout: IBC_TRANSFER_TIMEOUT
    },
    "Neutaro-1": {
      source: "transfer",
      channel: oraichain2neutaro,
      timeout: IBC_TRANSFER_TIMEOUT
    },
    "injective-1": {
      source: "transfer",
      channel: oraichain2inj,
      timeout: IBC_TRANSFER_TIMEOUT
    },
    "osmosis-1": {
      source: "transfer",
      channel: oraichain2osmosis,
      timeout: IBC_TRANSFER_TIMEOUT
    },
    "oraibridge-subnet-2": {
      source: `wasm.${IBC_WASM_CONTRACT}`,
      channel: oraichain2oraib,
      testInfo: {
        source: `wasm.${IBC_WASM_CONTRACT_TEST}`,
        channel: oraichain2oraibTest,
        timeout: IBC_TRANSFER_TIMEOUT
      },
      timeout: IBC_TRANSFER_TIMEOUT
    },
    "0x01": {
      source: `wasm.${IBC_WASM_CONTRACT}`,
      channel: oraichain2oraib,
      timeout: IBC_TRANSFER_TIMEOUT,
      testInfo: {
        source: `wasm.${IBC_WASM_CONTRACT_TEST}`,
        channel: oraichain2oraibTest,
        timeout: IBC_TRANSFER_TIMEOUT
      }
    },
    "0x38": {
      source: `wasm.${IBC_WASM_CONTRACT}`,
      channel: oraichain2oraib,
      timeout: IBC_TRANSFER_TIMEOUT,
      testInfo: {
        source: `wasm.${IBC_WASM_CONTRACT_TEST}`,
        channel: oraichain2oraibTest,
        timeout: IBC_TRANSFER_TIMEOUT
      }
    },
    "0x2b6653dc": {
      source: `wasm.${IBC_WASM_CONTRACT}`,
      channel: oraichain2oraib,
      timeout: IBC_TRANSFER_TIMEOUT,
      testInfo: {
        source: `wasm.${IBC_WASM_CONTRACT_TEST}`,
        channel: oraichain2oraibTest,
        timeout: IBC_TRANSFER_TIMEOUT
      }
    },
    "kawaii_6886-1": {
      source: "transfer",
      channel: oraichain2kwt,
      timeout: IBC_TRANSFER_TIMEOUT
    },
    "noble-1": {
      source: `wasm.${IBC_WASM_CONTRACT}`,
      channel: oraichain2noble,
      testInfo: {
        source: `wasm.${IBC_WASM_CONTRACT_TEST}`,
        channel: oraichain2nobleTest,
        timeout: IBC_TRANSFER_TIMEOUT
      },
      timeout: IBC_TRANSFER_TIMEOUT
    }
  },
  "oraibridge-subnet-2": {
    Oraichain: {
      source: "transfer",
      channel: oraib2oraichain,
      testInfo: {
        source: "transfer",
        channel: oraib2oraichainTest,
        timeout: IBC_TRANSFER_TIMEOUT
      },
      timeout: IBC_TRANSFER_TIMEOUT
    }
  }
};

export const ibcInfosOld: Omit<IBCInfoMap, "osmosis-1" | "cosmoshub-4" | "injective-1" | "noble-1" | "Neutaro-1"> = {
  Oraichain: {
    "oraibridge-subnet-2": {
      source: "transfer",
      channel: oraichain2oraib_old,
      timeout: IBC_TRANSFER_TIMEOUT
    },
    "kawaii_6886-1": {
      source: "transfer",
      channel: oraichain2kwt,
      timeout: IBC_TRANSFER_TIMEOUT
    },
    "injective-1": {
      source: "transfer",
      channel: oraichain2inj,
      timeout: IBC_TRANSFER_TIMEOUT
    }
  },
  "oraibridge-subnet-2": {
    Oraichain: {
      source: "transfer",
      channel: oraib2oraichain_old,
      timeout: IBC_TRANSFER_TIMEOUT
    }
  },
  "kawaii_6886-1": {
    Oraichain: {
      source: "transfer",
      channel: kwt2oraichain,
      timeout: IBC_TRANSFER_TIMEOUT
    }
  }
};
