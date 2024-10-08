import { CustomChainInfo, defaultBech32Config } from "./network";

export const celestiaNetwork: CustomChainInfo = {
  bech32Config: {
    bech32PrefixAccAddr: "celestia",
    bech32PrefixAccPub: "celestiapub",
    bech32PrefixConsAddr: "celestiavalcons",
    bech32PrefixConsPub: "celestiavalconspub",
    bech32PrefixValAddr: "celestiavaloper",
    bech32PrefixValPub: "celestiavaloperpub"
  },
  bip44: {
    coinType: 118
  },
  networkType: "cosmos",
  chainId: "celestia",
  chainName: "Celestia",
  chainSymbolImageUrl:
    "https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/celestia/chain.png",
  currencies: [
    {
      coinDecimals: 6,
      coinDenom: "TIA",
      coinGeckoId: "celestia",
      coinMinimalDenom: "utia",
      coinImageUrl: "https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/celestia/chain.png"
    }
  ],
  features: [],
  feeCurrencies: [
    {
      coinDecimals: 6,
      coinDenom: "TIA",
      coinGeckoId: "celestia",
      coinMinimalDenom: "utia",
      coinImageUrl: "https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/celestia/chain.png",
      gasPriceStep: {
        low: 0.01,
        average: 0.02,
        high: 0.1
      }
    }
  ],
  rpc: "https://celestia.rpc.orai.io",
  rest: "https://celestia.lcd.orai.io",
  stakeCurrency: {
    coinDecimals: 6,
    coinDenom: "TIA",
    coinGeckoId: "celestia",
    coinMinimalDenom: "utia",
    coinImageUrl: "https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/celestia/utia.png"
  },
  walletUrlForStaking: "https://wallet.keplr.app/chains/celestia"
};
