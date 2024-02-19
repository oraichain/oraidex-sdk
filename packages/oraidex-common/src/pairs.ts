import { AssetInfo } from "@oraichain/oraidex-contracts-sdk";
import {
  AIRI_CONTRACT,
  ATOM_ORAICHAIN_DENOM,
  BTC_CONTRACT,
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
  USDT_CONTRACT,
  NEUTARO_ORAICHAIN_DENOM,
  WETH_CONTRACT,
} from "./constant";
import { parseAssetInfo } from "./helper";
import { TokenItemType, assetInfoMap } from "./token";
import uniq from "lodash/uniq";
import flatten from "lodash/flatten";

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
    symbols: ["ORAI", "wTRX"]
  },
  {
    asset_infos: [{ token: { contract_addr: SCATOM_CONTRACT } }, { native_token: { denom: ATOM_ORAICHAIN_DENOM } }],
    symbols: ["scATOM", "ATOM"]
  },
  {
    asset_infos: [{ token: { contract_addr: INJECTIVE_CONTRACT } }, { native_token: { denom: ORAI } }],
    symbols: ["INJ", "ORAI"]
  },
  {
    asset_infos: [{ token: { contract_addr: USDC_CONTRACT } }, { token: { contract_addr: ORAIX_CONTRACT } }],
    symbols: ["USDC", "ORAIX"]
  },
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: WETH_CONTRACT } }],
    symbols: ["ORAI", "WETH"]
  },,
  asset_infos: [{ native_token: { denom: NEUTARO_ORAICHAIN_DENOM } }, { token: { contract_addr: USDC_CONTRACT } }],
  {
    symbols: ["NTMPI", "USDC"]
  },
  {
    asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: BTC_CONTRACT } }],
    symbols: ["ORAI", "BTC"]
  }
];

// FIXME: makes this dynamic in the future so that permissionless listing is simpler
export enum pairLpTokens {
  AIRI_ORAI = "orai1hxm433hnwthrxneyjysvhny539s9kh6s2g2n8y",
  ORAIX_ORAI = "orai1qmy3uuxktflvreanaqph6yua7stjn6j65rur62",
  SCORAI_ORAI = "orai1ay689ltr57jt2snujarvakxrmtuq8fhuat5rnvq6rct89vjer9gqm2vde6",
  ATOM_ORAI = "orai1g2prqry343kx566cp7uws9w7v78n5tejylvaz6",
  USDT_ORAI = "orai1mav52eqhd07c3lwevcnqdykdzhh4733zf32jcn",
  KWT_ORAI = "orai17rcfcrwltujfvx7w4l2ggyku8qrncy0hdvrzvc",
  OSMO_ORAI = "orai19ltj97jmdqnz5mrd2amethetvcwsp0220kww3e",
  MILKY_USDT = "orai18ywllw03hvy720l06rme0apwyyq9plk64h9ccf",
  USDC_ORAI = "orai1e0x87w9ezwq2sdmvv5dq5ngzy98lt47tqfaf2m7zpkg49g5dj6fqred5d7",
  TRX_ORAI = "orai1wgywgvumt5dxhm7vjpwx5es9ecrtl85qaqdspjqwx2lugy7vmw5qlwrn88",
  SCATOM_ATOM = "orai1hcjne0hmdj6pjrc3xuksucr0yplsa9ny7v047c34y8k8hfflq6yqyjapnn",
  INJ_ORAI = "orai1slqw6gfvs6l2jgvh5ryjayf4g77d7sgfv6fumtyzcr06a6g9gnrq6c4rgg",
  USDC_ORAIX = "orai1nwpfd09mr4rf8d5c9mh43axzezkwyr7dq2lus23jsw4xw2jqkaxqxwmkd3",
  ORAI_WETH = "orai1rvr9wk6mdlfysvgp72ltthqvkkd5677mp892efq86yyr9alt0tms2a6lcs",
  ORAI_BTC = "orai1jd9lc2qt0ltjsatgnu38xsz8ngp89clp0dpeh8geyjj70yvkn4kqmrmh3m",
  NTMPI_USDC = "orai1rmvjmwd940ztafxue7630g75px8tqma4jskjuu57fkj0eqahqfgqqwjm00"
}

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

export const getPoolTokens = (): TokenItemType[] => {
  return uniq(flatten(PAIRS.map((pair) => pair.asset_infos)).map((info) => assetInfoMap[parseAssetInfo(info)]));
};

export const PAIRS_CHART = PAIRS.map((pair) => {
  const assets = pair.asset_infos.map((info) => {
    if ("native_token" in info) return info.native_token.denom;
    return info.token.contract_addr;
  });

  return {
    ...pair,
    symbol: `${pair.symbols[0]}/${pair.symbols[1]}`,
    info: `${assets[0]}-${assets[1]}`
  };
});
