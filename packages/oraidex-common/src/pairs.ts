import { AssetInfo } from "@oraichain/oraidex-contracts-sdk";
import {
  AIRI_CONTRACT,
  ATOM_ORAICHAIN_DENOM,
  INJECTIVE_CONTRACT,
  KWT_CONTRACT,
  MILKY_CONTRACT,
  ORAI,
  ORAIX_CONTRACT,
  OSMOSIS_ORAICHAIN_DENOM,
  SCATOM_CONTRACT,
  SCORAI_CONTRACT,
  TRX_CONTRACT,
  USDC_CONTRACT,
  USDT_CONTRACT
} from "./constant";

export type PairMapping = {
  asset_infos: [AssetInfo, AssetInfo];
  factoryV1?: boolean;
};

export const PAIRS: PairMapping[] = [
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: AIRI_CONTRACT } }],
    factoryV1: true
  },
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: ORAIX_CONTRACT } }],
    factoryV1: true
  },
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: SCORAI_CONTRACT } }]
  },
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { native_token: { denom: ATOM_ORAICHAIN_DENOM } }],
    factoryV1: true
  },
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: USDT_CONTRACT } }],
    factoryV1: true
  },
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: KWT_CONTRACT } }],
    factoryV1: true
  },
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { native_token: { denom: OSMOSIS_ORAICHAIN_DENOM } }],
    factoryV1: true
  },
  {
    asset_infos: [{ token: { contract_addr: MILKY_CONTRACT } }, { token: { contract_addr: USDT_CONTRACT } }],
    factoryV1: true
  },
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: USDC_CONTRACT } }]
  },
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: TRX_CONTRACT } }]
  },
  {
    asset_infos: [{ native_token: { denom: ATOM_ORAICHAIN_DENOM } }, { token: { contract_addr: SCATOM_CONTRACT } }]
  },
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: INJECTIVE_CONTRACT } }]
  }
  // {
  //   asset_infos: [
  //     { native_token: { denom: ORAI } }, // or your ibc native / cw20 token pair
  //     { token: { contract_addr: 'orai17l2zk3arrx0a0fyuneyx8raln68622a2lrsz8ph75u7gw9tgz3esayqryf' } }
  //   ]
  // }
];
