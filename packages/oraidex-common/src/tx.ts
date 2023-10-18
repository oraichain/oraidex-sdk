import { IndexedTx } from "@cosmjs/stargate";
export type Tx = IndexedTx & {
  timestamp?: string;
};
