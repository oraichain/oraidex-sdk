import { CAT_BSC_CONTRACT, PEPE_BSC_CONTRACT } from "src/constant";
import { BridgeAppCurrency } from "src/network";

export const PepeBscToken: BridgeAppCurrency = {
  coinDenom: "PEPE",
  coinMinimalDenom: "pepe",
  contractAddress: PEPE_BSC_CONTRACT,
  coinDecimals: 18,
  coinGeckoId: "pepe",
  bridgeTo: ["Oraichain"],
  coinImageUrl: "https://assets.coingecko.com/coins/images/29850/standard/pepe-token.jpeg?1696528776"
};

export const CatBscToken: BridgeAppCurrency = {
  coinDenom: "CAT",
  coinMinimalDenom: "cat",
  contractAddress: CAT_BSC_CONTRACT,
  coinDecimals: 18,
  coinGeckoId: "simon-s-cat",
  bridgeTo: ["Oraichain"],
  coinImageUrl: "https://assets.coingecko.com/coins/images/39765/standard/Simon's_Cat_Logo.png?1724017505"
};

export const CurrenciesBsc = [PepeBscToken, CatBscToken];
