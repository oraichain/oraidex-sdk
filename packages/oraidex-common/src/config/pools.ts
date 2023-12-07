import { PAIRS, TokenItemType, parseAssetInfo } from '@oraichain/oraidex-common';
import uniq from 'lodash/uniq';
import flatten from 'lodash/flatten';
import { assetInfoMap } from './bridgeTokens';

export const getPoolTokens = (): TokenItemType[] => {
  return uniq(flatten(PAIRS.map((pair) => pair.asset_infos)).map((info) => assetInfoMap[parseAssetInfo(info)]));
}

export const PAIRS_CHART = PAIRS.map((pair) => {
  const assets = pair.asset_infos.map((info) => {
    if ('native_token' in info) return info.native_token.denom;
    return info.token.contract_addr;
  });

  return {
    ...pair,
    symbol: `${pair.symbols[0]}/${pair.symbols[1]}`,
    info: `${assets[0]}-${assets[1]}`
  };
});
