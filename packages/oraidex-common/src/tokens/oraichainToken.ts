import { ATOM_ORAICHAIN_DENOM, TON_ORAICHAIN_DENOM } from "@oraichain/oraidex-common";
import { CAT_ORAICHAIN_DENOM, PEPE_ORAICHAIN_DENOM } from "src/constant";
import { BridgeAppCurrency } from "src/network";

export const OraiOraichainToken: BridgeAppCurrency = {
  coinDenom: "ORAI",
  coinMinimalDenom: "orai",
  coinDecimals: 6,
  coinGeckoId: "oraichain-token",
  bridgeTo: ["0x38", "0x01", "injective-1"],
  coinImageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/7533.png",
  gasPriceStep: {
    low: 0.003,
    average: 0.005,
    high: 0.007
  }
};

export const AtomOraichainToken: BridgeAppCurrency = {
  coinDenom: "ATOM",
  coinGeckoId: "cosmos",
  coinMinimalDenom: ATOM_ORAICHAIN_DENOM,
  bridgeTo: ["cosmoshub-4"],
  coinDecimals: 6,
  coinImageUrl: "https://dhj8dql1kzq2v.cloudfront.net/white/atom.png"
};

export const TonOraichainToken: BridgeAppCurrency = {
  coinDenom: "TON",
  coinMinimalDenom: TON_ORAICHAIN_DENOM,
  coinDecimals: 9,
  coinGeckoId: "the-open-network",
  coinImageUrl: "https://assets.coingecko.com/coins/images/17980/standard/ton_symbol.png?1696517498"
};

export const PepeOraichainToken: BridgeAppCurrency = {
  coinDenom: "PEPE",
  coinGeckoId: "pepe",
  coinMinimalDenom: PEPE_ORAICHAIN_DENOM,
  bridgeTo: ["0x38", "0x01"],
  coinDecimals: 6,
  coinImageUrl: "https://assets.coingecko.com/coins/images/29850/standard/pepe-token.jpeg?1696528776"
};

export const CatOraichainToken: BridgeAppCurrency = {
  coinDenom: "CAT",
  coinMinimalDenom: CAT_ORAICHAIN_DENOM,
  coinDecimals: 9,
  bridgeTo: ["0x38"],
  coinGeckoId: "simon-s-cat",
  coinImageUrl: "https://assets.coingecko.com/coins/images/39765/standard/Simon's_Cat_Logo.png?1724017505"
};

export const CurrenciesOraichain = [
  OraiOraichainToken,
  AtomOraichainToken,
  PepeOraichainToken,
  CatOraichainToken,
  TonOraichainToken
];
