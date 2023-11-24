import { AssetInfo } from "@oraichain/common-contracts-sdk/build/CwIcs20Latest.types";
import { Bar as BarType } from "../charting_library";

export type Bar = BarType & {
  ticker?: string;
};

export type PairMapping = {
  asset_infos: [AssetInfo, AssetInfo];
  symbols: [string, string];
  denoms?: [string, string];
};
