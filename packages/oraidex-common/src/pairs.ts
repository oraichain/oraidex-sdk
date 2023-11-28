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
import { parseAssetInfo } from "./helper";
import { oraichainTokens } from "./token";

export type PairMapping = {
  asset_infos: [AssetInfo, AssetInfo];
  symbols: [string, string];
  factoryV1?: boolean;
};

export const PAIRS: PairMapping[] = [
  {
    asset_infos: [{ token: { contract_addr: AIRI_CONTRACT } }, { native_token: { denom: ORAI } }],
    symbols: ["AIRI", "ORAI"],
    factoryV1: true
  },
  {
    asset_infos: [{ token: { contract_addr: ORAIX_CONTRACT } }, { native_token: { denom: ORAI } }],
    symbols: ["ORAIX", "ORAI"],
    factoryV1: true
  },
  {
    asset_infos: [{ token: { contract_addr: SCORAI_CONTRACT } }, { native_token: { denom: ORAI } }],
    symbols: ["scORAI", "ORAI"]
  },
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { native_token: { denom: ATOM_ORAICHAIN_DENOM } }],
    symbols: ["ORAI", "ATOM"],
    factoryV1: true
  },
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: USDT_CONTRACT } }],
    symbols: ["ORAI", "USDT"],
    factoryV1: true
  },
  {
    asset_infos: [{ token: { contract_addr: KWT_CONTRACT } }, { native_token: { denom: ORAI } }],
    symbols: ["KWT", "ORAI"],
    factoryV1: true
  },
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { native_token: { denom: OSMOSIS_ORAICHAIN_DENOM } }],
    symbols: ["ORAI", "OSMO"],
    factoryV1: true
  },
  {
    asset_infos: [{ token: { contract_addr: MILKY_CONTRACT } }, { token: { contract_addr: USDT_CONTRACT } }],
    symbols: ["MILKY", "USDT"],
    factoryV1: true
  },
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: USDC_CONTRACT } }],
    symbols: ["ORAI", "USDC"]
  },
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: TRX_CONTRACT } }],
    symbols: ["ORAI", "WTRX"]
  },
  {
    asset_infos: [{ token: { contract_addr: SCATOM_CONTRACT } }, { native_token: { denom: ATOM_ORAICHAIN_DENOM } }],
    symbols: ["scATOM", "ATOM"]
  },
  {
    asset_infos: [{ token: { contract_addr: INJECTIVE_CONTRACT } }, { native_token: { denom: ORAI } }],
    symbols: ["INJ", "ORAI"]
  }
];

// token identifier can be denom or contract addr
export const isInPairList = (tokenIdentifier: string) => {
  return PAIRS.some((pair) =>
    pair.asset_infos.some((info) => {
      if ("native_token" in info) {
        return info.native_token.denom === tokenIdentifier;
      }
      return info.token.contract_addr === tokenIdentifier;
    })
  );
};

/**
 * Get list contract_addr | denom that make a pair when combined with input
 * @param contractAddress
 * @returns
 */
export const getPairSwapV2 = (contractAddress: string) => {
  let arr = [];
  let arrDenom = ORAI;
  if (!contractAddress) return { arrLength: 0 };

  const pairMapping = PAIRS.filter((p) =>
    p.asset_infos.find(
      (asset: {
        token: {
          contract_addr: string;
        };
      }) => asset?.token?.contract_addr === contractAddress
    )
  );

  if (pairMapping.length) {
    for (const info of pairMapping) {
      const assets0 = parseAssetInfo(info?.asset_infos?.[0]);
      const assets1 = parseAssetInfo(info?.asset_infos?.[1]);
      if (assets0 !== contractAddress) arr.push(assets0);
      if (assets1 !== contractAddress) arr.push(assets1);
    }
  }

  if (arr.length) {
    arrDenom = oraichainTokens.find((e) => e.contractAddress === arr[0])?.denom ?? arr[0];
  }

  return {
    arr,
    arrLength: arr.length,
    arrDenom,
    arrIncludesOrai: arr.includes(ORAI)
  };
};

export const isFactoryV1 = (assetInfos: [AssetInfo, AssetInfo]): boolean => {
  const pair = PAIRS.find(
    (pair) =>
      pair.asset_infos.find((info) => parseAssetInfo(info) === parseAssetInfo(assetInfos[0])) &&
      pair.asset_infos.find((info) => parseAssetInfo(info) === parseAssetInfo(assetInfos[1]))
  );
  if (!pair) {
    return true;
  }
  return pair.factoryV1 ?? false;
};
