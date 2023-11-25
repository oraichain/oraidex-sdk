import { Bar as BarType } from "../charting_library";

export type Bar = BarType & {
  ticker?: string;
};

export type AssetInfo = {
  token: {
    contract_addr: string;
  };
} | {
  native_token: {
    denom: string;
  };
};

export type PairMapping = {
  asset_infos: [AssetInfo, AssetInfo];
  symbols: [string, string];
  denoms?: [string, string];
};
