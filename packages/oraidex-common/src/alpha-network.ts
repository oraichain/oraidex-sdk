import { BridgeAppCurrency } from "./network";

export const AtomOsmosisToken: BridgeAppCurrency = {
  coinDenom: "ATOM",
  coinMinimalDenom: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
  coinDecimals: 6,
  coinGeckoId: "cosmos",
  coinImageUrl: "https://dhj8dql1kzq2v.cloudfront.net/white/atom.png",
  gasPriceStep: {
    low: 0,
    average: 0.025,
    high: 0.04
  }
};

export const UsdcOsmosisToken: BridgeAppCurrency = {
  coinDenom: "USDC",
  coinMinimalDenom: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4",
  coinDecimals: 6,
  coinGeckoId: "usd-coin",
  coinImageUrl: "https://raw.githubusercontent.com/cosmos/chain-registry/master/noble/images/USDCoin.png",
  gasPriceStep: {
    low: 0,
    average: 0.025,
    high: 0.04
  }
};

export const OraiOsmosisToken: BridgeAppCurrency = {
  coinDenom: "ORAI",
  coinMinimalDenom: "ibc/161D7D62BAB3B9C39003334F1671208F43C06B643CC9EDBBE82B64793C857F1D",
  coinDecimals: 6,
  coinGeckoId: "oraichain-token",
  coinImageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/7533.png",
  gasPriceStep: {
    low: 0,
    average: 0.025,
    high: 0.04
  }
};

export const TiaOsmosisToken: BridgeAppCurrency = {
  coinDenom: "TIA",
  coinMinimalDenom: "ibc/D79E7D83AB399BFFF93433E54FAA480C191248FC556924A2A8351AE2638B3877",
  coinDecimals: 6,
  coinGeckoId: "celestia",
  coinImageUrl: "https://raw.githubusercontent.com/cosmos/chain-registry/master/celestia/images/celestia.png",
  gasPriceStep: {
    low: 0,
    average: 0.025,
    high: 0.04
  }
};

export const InjOsmosisToken: BridgeAppCurrency = {
  coinDenom: "INJ",
  coinMinimalDenom: "ibc/64BA6E31FE887D66C6F8F31C7B1A80C7CA179239677B4088BB55F5EA07DBE273",
  coinDecimals: 18,
  coinGeckoId: "injective-protocol",
  coinImageUrl: "https://raw.githubusercontent.com/cosmos/chain-registry/master/injective/images/inj.png",
  gasPriceStep: {
    low: 0,
    average: 0.025,
    high: 0.04
  }
};

export const TonOsmosisToken: BridgeAppCurrency = {
  coinDenom: "TON",
  coinMinimalDenom: "ibc/905889A7F0B94F1CE1506D9BADF13AE9141E4CBDBCD565E1DFC7AE418B3E3E98",
  coinDecimals: 9,
  coinGeckoId: "the-open-network",
  coinImageUrl: "https://raw.githubusercontent.com/cosmos/chain-registry/master/_non-cosmos/ton/images/ton.png",
  gasPriceStep: {
    low: 0,
    average: 0.025,
    high: 0.04
  }
};

export const listOsmosisToken = [AtomOsmosisToken, OraiOsmosisToken, TiaOsmosisToken, TonOsmosisToken];
