import {
  CAT_BSC_CONTRACT,
  ORAI_BRIDGE_EVM_DENOM_PREFIX,
  ORAI_BRIDGE_EVM_ETH_DENOM_PREFIX,
  PEPE_BSC_CONTRACT,
  PEPE_ETH_CONTRACT
} from "src/constant";
import { BridgeAppCurrency } from "src/network";

export const PepeBscOraiBridgeToken: BridgeAppCurrency = {
  coinDenom: "PEPE",
  coinMinimalDenom: ORAI_BRIDGE_EVM_DENOM_PREFIX + PEPE_BSC_CONTRACT,
  bridgeNetworkIdentifier: "0x38",
  coinDecimals: 18,
  coinGeckoId: "pepe",
  prefixToken: ORAI_BRIDGE_EVM_DENOM_PREFIX,
  coinImageUrl: "https://assets.coingecko.com/coins/images/29850/standard/pepe-token.jpeg?1696528776"
};

export const PepeEthOraiBridgeToken: BridgeAppCurrency = {
  coinDenom: "PEPE",
  coinMinimalDenom: ORAI_BRIDGE_EVM_ETH_DENOM_PREFIX + PEPE_ETH_CONTRACT,
  bridgeNetworkIdentifier: "0x01",
  coinDecimals: 18,
  coinGeckoId: "pepe",
  prefixToken: ORAI_BRIDGE_EVM_ETH_DENOM_PREFIX,
  coinImageUrl: "https://assets.coingecko.com/coins/images/29850/standard/pepe-token.jpeg?1696528776"
};

export const CatBscOraiBridgeToken: BridgeAppCurrency = {
  coinDenom: "CAT",
  coinMinimalDenom: ORAI_BRIDGE_EVM_DENOM_PREFIX + CAT_BSC_CONTRACT,
  bridgeNetworkIdentifier: "0x38",
  coinDecimals: 18,
  prefixToken: ORAI_BRIDGE_EVM_DENOM_PREFIX,
  coinGeckoId: "simon-s-cat",
  coinImageUrl: "https://assets.coingecko.com/coins/images/39765/standard/Simon's_Cat_Logo.png?1724017505"
};

export const CurrenciesOraiBridge = [PepeBscOraiBridgeToken, PepeEthOraiBridgeToken, CatBscOraiBridgeToken];
