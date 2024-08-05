import { AIRI_CONTRACT, ATOM_ORAICHAIN_DENOM, BTC_CONTRACT, INJECTIVE_CONTRACT, INJECTIVE_ORAICHAIN_DENOM, KWT_CONTRACT, KWTBSC_ORAICHAIN_DENOM, MILKY_CONTRACT, MILKYBSC_ORAICHAIN_DENOM, NEUTARO_ORAICHAIN_DENOM, OCH_CONTRACT, ORAIX_CONTRACT, OSMOSIS_ORAICHAIN_DENOM, SCATOM_CONTRACT, SCORAI_CONTRACT, TRX_CONTRACT, USDC_CONTRACT, USDT_CONTRACT, WETH_CONTRACT } from "@oraichain/oraidex-common";
import { getLiquidityTicksLimit, getMaxSqrtPrice } from "@oraichain/oraiswap-v3-wasm";

export const ORAISWAP_V3_CONTRACT = "orai10s0c75gw5y5eftms5ncfknw6lzmx0dyhedn75uz793m8zwz4g8zq4d9x9a";

export const DENOMINATOR = 10n ** 12n;
export const LIQUIDITY_DENOMINATOR = 10n ** 6n;
export const PRICE_DENOMINATOR = 10n ** 24n;
export const MAX_TICKMAP_QUERY_SIZE = (16 * 1024 * 8) / (16 + 64);
export const CHUNK_SIZE = 64;
export const LIQUIDITY_TICKS_LIMIT = getLiquidityTicksLimit();

export const CHUNK_QUERY = 100;
export const POSITION_TICKS_LIMIT = 372;

export const MAINNET_TOKENS = [
  {
    symbol: 'ATOM',
    coinGeckoId: 'cosmos',
    address: ATOM_ORAICHAIN_DENOM,
    bridgeTo: ['cosmoshub-4'],
    decimals: 6,
  },
  {
    symbol: 'NTMPI',
    coinGeckoId: 'neutaro',
    address: NEUTARO_ORAICHAIN_DENOM,
    bridgeTo: ['Neutaro-1'],
    decimals: 6,
  },
  {
    symbol: 'AIRI',
    coinGeckoId: 'airight',
    type: 'cw20',
    address: AIRI_CONTRACT,
    bridgeTo: ['0x38'],
    decimals: 6,
  },
  {
    symbol: 'USDT',
    coinGeckoId: 'tether',
    type: 'cw20',
    address: USDT_CONTRACT,
    bridgeTo: ['0x38', '0x2b6653dc', '0x01'],
    decimals: 6,
  },
  {
    symbol: 'USDC',
    coinGeckoId: 'usd-coin',
    type: 'cw20',
    address: USDC_CONTRACT,
    bridgeTo: ['0x01', 'noble-1'],
    decimals: 6,
  },
  {
    symbol: 'OSMO',
    address: OSMOSIS_ORAICHAIN_DENOM,
    decimals: 6,
    coinGeckoId: 'osmosis',
    bridgeTo: ['osmosis-1'],
  },
  {
    symbol: 'BEP20 KWT',
    coinGeckoId: 'kawaii-islands',
    address: KWTBSC_ORAICHAIN_DENOM,
    decimals: 18,
  },
  {
    symbol: 'KWT',
    coinGeckoId: 'kawaii-islands',
    type: 'cw20',
    address: KWT_CONTRACT,
    bridgeTo: ['kawaii_6886-1', '0x38'],
    decimals: 6,
  },
  {
    symbol: 'BEP20 MILKY',
    coinGeckoId: 'milky-token',
    address: MILKYBSC_ORAICHAIN_DENOM,
    decimals: 18,
  },
  {
    symbol: 'MILKY',
    coinGeckoId: 'milky-token',
    type: 'cw20',
    address: MILKY_CONTRACT,
    bridgeTo: ['kawaii_6886-1', '0x38'],
    decimals: 6,
  },
  {
    symbol: 'ORAIX',
    type: 'cw20',
    address: ORAIX_CONTRACT,
    coinGeckoId: 'oraidex',
    decimals: 6,
    bridgeTo: ['0x01'],
  },
  {
    symbol: 'scORAI',
    type: 'cw20',
    address: SCORAI_CONTRACT,
    coinGeckoId: 'scorai',
    decimals: 6,
  },
  {
    symbol: 'wTRX',
    coinGeckoId: 'tron',
    type: 'cw20',
    address: TRX_CONTRACT,
    bridgeTo: ['0x2b6653dc'],
    decimals: 6,
  },
  {
    symbol: 'scATOM',
    type: 'cw20',
    address: SCATOM_CONTRACT,
    coinGeckoId: 'scatom',
    decimals: 6,
  },
  {
    symbol: 'IBC INJ',
    coinGeckoId: 'injective-protocol',
    address: INJECTIVE_ORAICHAIN_DENOM,
    decimals: 18,
  },
  {
    symbol: 'INJ',
    coinGeckoId: 'injective-protocol',
    address: INJECTIVE_CONTRACT,
    bridgeTo: ['injective-1'],
    type: 'cw20',
    decimals: 6,
  },
  {
    symbol: 'WETH',
    coinGeckoId: 'weth',
    type: 'cw20',
    address: WETH_CONTRACT,
    bridgeTo: ['0x01'],
    decimals: 6,
    coinImageUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png',
  },
  {
    symbol: 'OCH',
    coinGeckoId: 'och',
    type: 'cw20',
    address: OCH_CONTRACT,
    bridgeTo: ['0x01'],
    decimals: 6,
    coinImageUrl:
      'https://assets.coingecko.com/coins/images/34236/standard/orchai_logo_white_copy_4x-8_%281%29.png?1704307670',
  },
  {
    symbol: 'BTC',
    coinGeckoId: 'bitcoin',
    type: 'cw20',
    address: BTC_CONTRACT,
    decimals: 6,
    coinImageUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png'
  }
]
