import { PEPE_ETH_CONTRACT } from "src/constant";
import { BridgeAppCurrency } from "src/network";

export const PepeEthToken: BridgeAppCurrency = {
  coinDenom: "PEPE",
  coinMinimalDenom: "pepe",
  contractAddress: PEPE_ETH_CONTRACT,
  coinDecimals: 18,
  coinGeckoId: "pepe",
  bridgeTo: ["Oraichain"],
  coinImageUrl: "https://assets.coingecko.com/coins/images/29850/standard/pepe-token.jpeg?1696528776"
};

export const CurrenciesEth = [PepeEthToken];
