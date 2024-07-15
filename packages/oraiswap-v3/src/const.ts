export const ORAISWAP_V3_CONTRACT = "orai10s0c75gw5y5eftms5ncfknw6lzmx0dyhedn75uz793m8zwz4g8zq4d9x9a";

export const DENOMINATOR = 10n ** 12n;
export const LIQUIDITY_DENOMINATOR = 10n ** 6n;
export const PRICE_DENOMINATOR = 10n ** 24n;
export const MAX_TICKMAP_QUERY_SIZE = (16 * 1024 * 8) / (16 + 64);
export const CHUNK_SIZE = 64;
export const LIQUIDITY_TICKS_LIMIT = (16 * 1024 * 8) / (32 + 128 + 8);

export const MAINNET_TOKENS = [
  {
    address: "orai",
    symbol: "ORAI",
    coingeckoId: "oraichain-token",
    decimals: 6
  },
  {
    address: "orai1lus0f0rhx8s03gdllx2n6vhkmf0536dv57wfge",
    symbol: "ORAIX",
    coingeckoId: "oraidex",
    decimals: 6
  },
  {
    address: "orai1hn8w33cqvysun2aujk5sv33tku4pgcxhhnsxmvnkfvdxagcx0p8qa4l98q",
    symbol: "OCH",
    coingeckoId: "och",
    decimals: 6
  },
  {
    address: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
    symbol: "USDC",
    coingeckoId: "usd-coin",
    decimals: 6
  },
  {
    address: "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh",
    symbol: "USDT",
    coingeckoId: "tether",
    decimals: 6
  }
];
