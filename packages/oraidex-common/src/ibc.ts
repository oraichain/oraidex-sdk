// exclude evm chain

import { CosmosChainId, NetworkChainId } from "./network";

export interface IBCInfo {
  source: string;
  channel: string;
  timeout: number;
}

export type IBCInfoMap = { [key in CosmosChainId]: { [key in NetworkChainId]?: IBCInfo } };
