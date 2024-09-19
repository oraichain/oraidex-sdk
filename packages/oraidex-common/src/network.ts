import { Bech32Config, ChainInfo, Currency, FeeCurrency } from "@keplr-wallet/types";
import {
  AIRI_BSC_CONTRACT,
  AIRI_CONTRACT,
  ATOM_ORAICHAIN_DENOM,
  CONVERTER_CONTRACT,
  FACTORY_CONTRACT,
  FACTORY_V2_CONTRACT,
  INJECTIVE_CONTRACT,
  INJECTIVE_ORAICHAIN_DENOM,
  KWTBSC_ORAICHAIN_DENOM,
  KWT_BSC_CONTRACT,
  KWT_CONTRACT,
  KWT_DENOM,
  KWT_SUB_NETWORK_DENOM,
  MILKYBSC_ORAICHAIN_DENOM,
  MILKY_BSC_CONTRACT,
  MILKY_CONTRACT,
  MILKY_DENOM,
  MILKY_ERC_CONTRACT,
  MILKY_SUB_NETWORK_DENOM,
  MULTICALL_CONTRACT,
  ORACLE_CONTRACT,
  ORAIDEX_LISTING_CONTRACT,
  ORAIIBC_INJECTIVE_DENOM,
  ORAIX_CONTRACT,
  ORAI_BRIDGE_EVM_DENOM_PREFIX,
  ORAI_BRIDGE_EVM_ETH_DENOM_PREFIX,
  ORAI_BRIDGE_EVM_TRON_DENOM_PREFIX,
  ORAI_BSC_CONTRACT,
  ORAI_ETH_CONTRACT,
  OSMOSIS_ORAICHAIN_DENOM,
  REWARDER_CONTRACT,
  ROUTER_V2_CONTRACT,
  SCATOM_CONTRACT,
  SCORAI_CONTRACT,
  STAKING_CONTRACT,
  TRX_CONTRACT,
  USDC_CONTRACT,
  USDC_ETH_CONTRACT,
  USDT_BSC_CONTRACT,
  USDT_CONTRACT,
  USDT_TRON_CONTRACT,
  WETH_CONTRACT,
  WRAP_BNB_CONTRACT,
  WRAP_ETH_CONTRACT,
  WRAP_TRON_TRX_CONTRACT,
  USDT_ETH_CONTRACT,
  BTC_CONTRACT,
  NEUTARO_ORAICHAIN_DENOM,
  OCH_ETH_CONTRACT,
  OCH_CONTRACT,
  TON_ORAICHAIN_DENOM,
  ORAIDEX_BID_POOL_CONTRACT,
  ORAIX_ETH_CONTRACT,
  MIXED_ROUTER,
  AMM_V3_CONTRACT,
  PEPE_ORAICHAIN_DENOM,
  CAT_ORAICHAIN_DENOM,
  PEPE_ETH_CONTRACT,
  PEPE_BSC_CONTRACT,
  CAT_BSC_CONTRACT
} from "./constant";
import { listOsmosisToken } from "./alpha-network";

export type NetworkName =
  | "Oraichain"
  | "Cosmos Hub"
  | "Osmosis"
  | "OraiBridge"
  | "BNB Chain"
  | "Ethereum"
  | "Kawaiiverse"
  | "Kawaiiverse EVM"
  | "Tron Network"
  | "Injective"
  | "Noble"
  | "Neutaro";

export type CosmosChainId =
  | "Oraichain" // oraichain
  | "oraibridge-subnet-2" // oraibridge
  | "osmosis-1" // osmosis
  | "cosmoshub-4" // cosmos hub
  | "injective-1" // injective network
  | "kawaii_6886-1" // kawaii subnetwork
  | "noble-1" // noble network
  | "Neutaro-1"; //neutaro network;

export type EvmChainId =
  | "0x38" // bsc
  | "0x01" // ethereum
  | "0x1ae6" // kawaii
  | "0x2b6653dc"; // tron

export type NetworkChainId = CosmosChainId | EvmChainId;

export type CoinGeckoId =
  | "oraichain-token"
  | "osmosis"
  | "cosmos"
  | "ethereum"
  | "binancecoin"
  | "airight"
  | "oraidex"
  | "tether"
  | "kawaii-islands"
  | "milky-token"
  | "scorai"
  | "oraidex"
  | "usd-coin"
  | "tron"
  | "weth"
  | "wbnb"
  | "scatom"
  | "injective-protocol"
  | "bitcoin"
  | "neutaro"
  | "och"
  | "celestia"
  | "the-open-network"
  | "pepe"
  | "simon-s-cat";

export type NetworkType = "cosmos" | "evm";
export interface NetworkConfig {
  coinType?: number;
  explorer: string;
  /** Fixed fee */
  fee: { gasPrice: string; amount: string; gas: string };
  factory: string;
  factory_v2: string;
  oracle: string;
  staking: string;
  router: string;
  mixer_router: string;
  denom: string;
  prefix: string;
  rewarder: string;
  converter: string;
  oraidex_listing: string;
  bid_pool: string;
  multicall: string;
  pool_v3: string;
}

export type CoinIcon = any;
export type BridgeAppCurrency = FeeCurrency & {
  readonly bridgeTo?: NetworkChainId[];
  readonly coinGeckoId?: CoinGeckoId;
  readonly Icon?: CoinIcon;
  readonly IconLight?: CoinIcon;
  readonly bridgeNetworkIdentifier?: EvmChainId;
  readonly coinDecimals: 6 | 9 | 18;
  readonly contractAddress?: string;
  readonly prefixToken?: string;
};

export type CoinType = 118 | 60 | 195;

/**
 * A list of Cosmos chain infos. If we need to add / remove any chains, just directly update this variable.
 * some chain is already in wallet so we override some attributes as optional
 */
export interface CustomChainInfo
  extends Omit<ChainInfo, "feeCurrencies" | "stakeCurrency" | "currencies" | "rest" | "bech32Config"> {
  readonly chainId: NetworkChainId;
  readonly chainName: NetworkName;
  readonly Icon?: CoinIcon;
  readonly IconLight?: CoinIcon;
  readonly networkType: NetworkType;
  readonly bip44: {
    coinType: CoinType;
  };
  readonly bech32Config?: Bech32Config;
  readonly rest?: string; // optional, rest api tron and lcd for cosmos
  readonly stakeCurrency?: Currency;
  readonly feeCurrencies?: FeeCurrency[];
  readonly currencies: BridgeAppCurrency[];
  readonly hideInUI?: boolean;
  readonly txExplorer?: {
    readonly name: string;
    readonly txUrl: string;
    readonly accountUrl?: string;
  };
}

export const defaultBech32Config = (
  mainPrefix: string,
  validatorPrefix = "val",
  consensusPrefix = "cons",
  publicPrefix = "pub",
  operatorPrefix = "oper"
) => {
  return {
    bech32PrefixAccAddr: mainPrefix,
    bech32PrefixAccPub: mainPrefix + publicPrefix,
    bech32PrefixValAddr: mainPrefix + validatorPrefix + operatorPrefix,
    bech32PrefixValPub: mainPrefix + validatorPrefix + operatorPrefix + publicPrefix,
    bech32PrefixConsAddr: mainPrefix + validatorPrefix + consensusPrefix,
    bech32PrefixConsPub: mainPrefix + validatorPrefix + consensusPrefix + publicPrefix
  };
};

export const OraiToken: BridgeAppCurrency = {
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

export const OraiBToken: BridgeAppCurrency = {
  coinDenom: "ORAIB",
  coinMinimalDenom: "uoraib",
  coinDecimals: 6,
  gasPriceStep: {
    low: 0,
    average: 0,
    high: 0
  }
};

export const KawaiiToken: BridgeAppCurrency = {
  coinDenom: "ORAIE",
  coinMinimalDenom: "oraie",
  coinDecimals: 18,
  coinGeckoId: "kawaii-islands",
  gasPriceStep: {
    low: 0,
    average: 0.000025,
    high: 0.00004
  }
};

export const InjectiveToken: BridgeAppCurrency = {
  coinDenom: "INJ",
  coinMinimalDenom: "inj",
  coinDecimals: 18,
  coinGeckoId: "injective-protocol",
  gasPriceStep: {
    low: 5000000000,
    average: 25000000000,
    high: 50000000000
  }
};

export const AtomToken: BridgeAppCurrency = {
  coinDenom: "ATOM",
  coinMinimalDenom: "uatom",
  coinDecimals: 6,
  coinGeckoId: "cosmos",
  coinImageUrl: "https://dhj8dql1kzq2v.cloudfront.net/white/atom.png",
  gasPriceStep: {
    low: 0,
    average: 0.025,
    high: 0.04
  }
};

export const NeutaroToken: BridgeAppCurrency = {
  coinDenom: "NTMPI",
  coinMinimalDenom: "uneutaro",
  coinDecimals: 6,
  coinGeckoId: "neutaro",
  coinImageUrl: "https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/Neutaro/chain.png",
  gasPriceStep: {
    low: 0.01,
    average: 0.025,
    high: 0.03
  }
};

export const NativeUsdcNobleToken: BridgeAppCurrency = {
  coinDenom: "USDC",
  coinMinimalDenom: "uusdc",
  coinDecimals: 6,
  coinGeckoId: "usd-coin",
  coinImageUrl: "https://raw.githubusercontent.com/cosmos/chain-registry/master/noble/images/USDCoin.png",
  gasPriceStep: {
    low: 0,
    average: 0.025,
    high: 0.03
  }
};

export const OsmoToken: BridgeAppCurrency = {
  coinDenom: "OSMO",
  coinMinimalDenom: "uosmo",
  coinDecimals: 6,
  coinGeckoId: "osmosis",
  coinImageUrl: "https://dhj8dql1kzq2v.cloudfront.net/white/osmo.png",
  gasPriceStep: {
    low: 0,
    average: 0.025,
    high: 0.04
  }
};

export const oraichainNetwork: CustomChainInfo = {
  rpc: "https://rpc.orai.io",
  rest: "https://lcd.orai.io",
  chainId: "Oraichain",
  chainName: "Oraichain",
  networkType: "cosmos",
  stakeCurrency: OraiToken,
  feeCurrencies: [OraiToken],
  bip44: {
    coinType: 118
  },
  bech32Config: defaultBech32Config("orai"),

  features: ["stargate", "ibc-transfer", "cosmwasm", "wasmd_0.24+", "no-legacy-stdTx"],
  txExplorer: {
    name: "Oraiscan",
    txUrl: "https://scan.orai.io/txs/{txHash}",
    accountUrl: "https://scan.orai.io/account/{address}"
  },
  currencies: [
    OraiToken,
    {
      coinDenom: "ATOM",
      coinGeckoId: "cosmos",
      coinMinimalDenom: ATOM_ORAICHAIN_DENOM,
      bridgeTo: ["cosmoshub-4"],
      coinDecimals: 6,
      coinImageUrl: "https://dhj8dql1kzq2v.cloudfront.net/white/atom.png"
    },
    {
      coinDenom: "NTMPI",
      coinGeckoId: "neutaro",
      coinMinimalDenom: NEUTARO_ORAICHAIN_DENOM,
      bridgeTo: ["Neutaro-1"],
      coinDecimals: 6,
      coinImageUrl: "https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/Neutaro/chain.png"
    },
    // {
    //   coinDenom: 'BEP20 AIRI',
    //   coinGeckoId: 'airight',
    //   coinMinimalDenom: AIRIBSC_ORAICHAIN_DENOM,
    //   coinDecimals: 18,
    //   Icon: AiriIcon
    // },
    {
      coinDenom: "AIRI",
      coinGeckoId: "airight",
      coinMinimalDenom: "airi",
      type: "cw20",
      contractAddress: AIRI_CONTRACT,
      bridgeTo: ["0x38"],
      coinDecimals: 6,
      coinImageUrl: "https://i.ibb.co/m8mCyMr/airi.png"
    },
    {
      coinDenom: "USDT",
      coinGeckoId: "tether",
      coinMinimalDenom: "usdt",
      type: "cw20",
      contractAddress: USDT_CONTRACT,
      bridgeTo: ["0x38", "0x2b6653dc", "0x01"],
      coinDecimals: 6,
      coinImageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/825.png"
    },
    {
      coinDenom: "USDC",
      coinGeckoId: "usd-coin",
      coinMinimalDenom: "usdc",
      type: "cw20",
      contractAddress: USDC_CONTRACT,
      bridgeTo: ["0x01", "noble-1"],
      coinDecimals: 6,
      coinImageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png"
    },
    {
      coinDenom: "OSMO",
      coinMinimalDenom: OSMOSIS_ORAICHAIN_DENOM,
      coinDecimals: 6,
      coinGeckoId: "osmosis",
      bridgeTo: ["osmosis-1"],
      coinImageUrl: "https://dhj8dql1kzq2v.cloudfront.net/white/osmo.png"
    },
    {
      coinDenom: "BEP20 KWT",
      coinGeckoId: "kawaii-islands",
      coinMinimalDenom: KWTBSC_ORAICHAIN_DENOM,
      coinDecimals: 18,
      coinImageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/12313.png"
    },
    {
      coinDenom: "KWT",
      coinGeckoId: "kawaii-islands",
      coinMinimalDenom: "kwt",
      type: "cw20",
      contractAddress: KWT_CONTRACT,
      bridgeTo: ["kawaii_6886-1", "0x38"],
      coinDecimals: 6,
      coinImageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/12313.png"
    },
    {
      coinDenom: "BEP20 MILKY",
      coinGeckoId: "milky-token",
      coinMinimalDenom: MILKYBSC_ORAICHAIN_DENOM,
      coinDecimals: 18,
      coinImageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/14418.png"
    },
    {
      coinDenom: "MILKY",
      coinGeckoId: "milky-token",
      coinMinimalDenom: "milky",
      type: "cw20",
      contractAddress: MILKY_CONTRACT,
      bridgeTo: ["kawaii_6886-1", "0x38"],
      coinDecimals: 6,
      coinImageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/14418.png"
    },
    {
      coinDenom: "ORAIX",
      coinMinimalDenom: "oraix",
      type: "cw20",
      contractAddress: ORAIX_CONTRACT,
      bridgeTo: ["0x01"],
      coinGeckoId: "oraidex",
      coinDecimals: 6,
      coinImageUrl: "https://i.ibb.co/VmMJtf7/oraix.png"
    },
    {
      coinDenom: "scORAI",
      coinMinimalDenom: "scorai",
      type: "cw20",
      contractAddress: SCORAI_CONTRACT,
      coinGeckoId: "scorai",
      coinDecimals: 6
    },
    {
      coinDenom: "wTRX",
      coinGeckoId: "tron",
      coinMinimalDenom: "trx",
      type: "cw20",
      contractAddress: TRX_CONTRACT,
      bridgeTo: ["0x2b6653dc"],
      coinDecimals: 6,
      coinImageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/1958.png"
    },
    {
      coinDenom: "scATOM",
      coinMinimalDenom: "scatom",
      type: "cw20",
      contractAddress: SCATOM_CONTRACT,
      coinGeckoId: "scatom",
      coinDecimals: 6
    },
    {
      coinDenom: "IBC INJ",
      coinGeckoId: "injective-protocol",
      coinMinimalDenom: INJECTIVE_ORAICHAIN_DENOM,
      coinDecimals: 18,
      coinImageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/7226.png"
    },
    {
      coinDenom: "INJ",
      coinGeckoId: "injective-protocol",
      coinMinimalDenom: "injective",
      contractAddress: INJECTIVE_CONTRACT,
      bridgeTo: ["injective-1"],
      type: "cw20",
      coinDecimals: 6,
      coinImageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/7226.png"
    },
    {
      coinDenom: "WETH",
      coinGeckoId: "weth",
      coinMinimalDenom: "weth",
      type: "cw20",
      contractAddress: WETH_CONTRACT,
      bridgeTo: ["0x01"],
      coinDecimals: 6,
      coinImageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png"
    },
    {
      coinDenom: "BTC",
      coinGeckoId: "bitcoin",
      coinMinimalDenom: "usat",
      type: "cw20",
      contractAddress: BTC_CONTRACT,
      // bridgeTo: ["bitcoinTestnet"],
      coinDecimals: 6,
      coinImageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/1.png"
    },
    {
      coinDenom: "OCH",
      coinGeckoId: "och",
      coinMinimalDenom: "och",
      type: "cw20",
      contractAddress: OCH_CONTRACT,
      bridgeTo: ["0x01"],
      coinDecimals: 6,
      coinImageUrl:
        "https://assets.coingecko.com/coins/images/34236/standard/orchai_logo_white_copy_4x-8_%281%29.png?1704307670"
    },
    {
      coinDenom: "TON",
      coinMinimalDenom: TON_ORAICHAIN_DENOM,
      coinDecimals: 9,
      coinGeckoId: "the-open-network",
      coinImageUrl: "https://assets.coingecko.com/coins/images/17980/standard/ton_symbol.png?1696517498"
    },
    {
      coinDenom: "PEPE",
      coinMinimalDenom: PEPE_ORAICHAIN_DENOM,
      coinDecimals: 18,
      coinGeckoId: "pepe",
      bridgeTo: ["0x01", "0x38"],
      coinImageUrl: "https://assets.coingecko.com/coins/images/29850/standard/pepe-token.jpeg?1696528776"
    },
    {
      coinDenom: "CAT",
      coinMinimalDenom: CAT_ORAICHAIN_DENOM,
      coinDecimals: 18,
      bridgeTo: ["0x38"],
      coinGeckoId: "simon-s-cat",
      coinImageUrl: "https://assets.coingecko.com/coins/images/39765/standard/Simon's_Cat_Logo.png?1724017505"
    }
  ]
};

export const chainInfos: CustomChainInfo[] = [
  // networks to add on keplr
  oraichainNetwork,
  {
    rpc: "https://bridge-v2.rpc.orai.io",
    rest: "https://bridge-v2.lcd.orai.io",
    chainId: "oraibridge-subnet-2",
    chainName: "OraiBridge",
    networkType: "cosmos",
    bip44: {
      coinType: 118
    },
    bech32Config: defaultBech32Config("oraib"),
    features: ["stargate", "ibc-transfer", "no-legacy-stdTx"],
    stakeCurrency: OraiBToken,
    feeCurrencies: [OraiBToken],
    // not use oraib as currency
    currencies: [
      OraiBToken,
      {
        coinDenom: "ORAI",
        coinMinimalDenom: ORAI_BRIDGE_EVM_DENOM_PREFIX + ORAI_BSC_CONTRACT,
        bridgeNetworkIdentifier: "0x38",
        coinDecimals: 18,
        coinGeckoId: "oraichain-token",
        coinImageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/7533.png"
      },
      {
        coinDenom: "ORAI",
        coinMinimalDenom: ORAI_BRIDGE_EVM_ETH_DENOM_PREFIX + ORAI_ETH_CONTRACT,
        bridgeNetworkIdentifier: "0x01",
        coinDecimals: 18,
        coinGeckoId: "oraichain-token",
        prefixToken: ORAI_BRIDGE_EVM_ETH_DENOM_PREFIX,
        coinImageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/7533.png"
      },
      {
        coinDenom: "USDC",
        coinMinimalDenom: ORAI_BRIDGE_EVM_ETH_DENOM_PREFIX + USDC_ETH_CONTRACT,
        bridgeNetworkIdentifier: "0x01",
        coinDecimals: 6,
        coinGeckoId: "usd-coin",
        prefixToken: ORAI_BRIDGE_EVM_ETH_DENOM_PREFIX,
        coinImageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png"
      },
      {
        coinDenom: "AIRI",
        coinMinimalDenom: ORAI_BRIDGE_EVM_DENOM_PREFIX + AIRI_BSC_CONTRACT,
        bridgeNetworkIdentifier: "0x38",
        coinDecimals: 18,
        coinGeckoId: "airight",
        coinImageUrl: "https://i.ibb.co/m8mCyMr/airi.png"
      },
      {
        coinDenom: "USDT",
        coinMinimalDenom: ORAI_BRIDGE_EVM_DENOM_PREFIX + USDT_BSC_CONTRACT,
        bridgeNetworkIdentifier: "0x38",
        coinDecimals: 18,
        coinGeckoId: "tether",
        coinImageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/825.png"
      },
      {
        coinDenom: "USDT",
        coinMinimalDenom: ORAI_BRIDGE_EVM_TRON_DENOM_PREFIX + USDT_TRON_CONTRACT,
        bridgeNetworkIdentifier: "0x2b6653dc",
        prefixToken: ORAI_BRIDGE_EVM_TRON_DENOM_PREFIX,
        coinDecimals: 6,
        coinGeckoId: "tether",
        coinImageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/825.png"
      },
      {
        coinDenom: "wTRX",
        coinMinimalDenom: ORAI_BRIDGE_EVM_TRON_DENOM_PREFIX + WRAP_TRON_TRX_CONTRACT,
        bridgeNetworkIdentifier: "0x2b6653dc",
        coinDecimals: 6,
        coinGeckoId: "tron",
        prefixToken: ORAI_BRIDGE_EVM_TRON_DENOM_PREFIX,
        coinImageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/1958.png"
      },
      {
        coinDenom: "KWT",
        bridgeNetworkIdentifier: "0x38",
        coinMinimalDenom: KWT_DENOM,
        coinDecimals: 18,
        coinGeckoId: "kawaii-islands",
        coinImageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/12313.png"
      },
      {
        coinDenom: "MILKY",
        bridgeNetworkIdentifier: "0x38",
        coinMinimalDenom: MILKY_DENOM,
        coinDecimals: 18,
        coinGeckoId: "milky-token",
        coinImageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/14418.png"
      },
      {
        coinDenom: "WETH",
        coinMinimalDenom: ORAI_BRIDGE_EVM_ETH_DENOM_PREFIX + WRAP_ETH_CONTRACT,
        bridgeNetworkIdentifier: "0x01",
        coinDecimals: 18,
        coinGeckoId: "weth",
        prefixToken: ORAI_BRIDGE_EVM_ETH_DENOM_PREFIX,
        coinImageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png"
      },
      {
        coinDenom: "USDT",
        coinMinimalDenom: ORAI_BRIDGE_EVM_ETH_DENOM_PREFIX + USDT_ETH_CONTRACT,
        bridgeNetworkIdentifier: "0x01",
        coinDecimals: 6,
        coinGeckoId: "tether",
        prefixToken: ORAI_BRIDGE_EVM_ETH_DENOM_PREFIX,
        coinImageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/825.png"
      },
      {
        coinDenom: "OCH",
        coinMinimalDenom: ORAI_BRIDGE_EVM_ETH_DENOM_PREFIX + OCH_ETH_CONTRACT,
        bridgeNetworkIdentifier: "0x01",
        coinDecimals: 18,
        coinGeckoId: "och",
        prefixToken: ORAI_BRIDGE_EVM_ETH_DENOM_PREFIX,
        coinImageUrl:
          "https://assets.coingecko.com/coins/images/34236/standard/orchai_logo_white_copy_4x-8_%281%29.png?1704307670"
      },
      {
        coinDenom: "ORAIX",
        coinMinimalDenom: ORAI_BRIDGE_EVM_ETH_DENOM_PREFIX + ORAIX_ETH_CONTRACT,
        bridgeNetworkIdentifier: "0x01",
        coinDecimals: 18,
        coinGeckoId: "oraidex",
        prefixToken: ORAI_BRIDGE_EVM_ETH_DENOM_PREFIX,
        coinImageUrl: "https://i.ibb.co/VmMJtf7/oraix.png"
      },
      {
        coinDenom: "PEPE",
        coinMinimalDenom: ORAI_BRIDGE_EVM_ETH_DENOM_PREFIX + PEPE_ETH_CONTRACT,
        bridgeNetworkIdentifier: "0x01",
        coinDecimals: 18,
        coinGeckoId: "pepe",
        prefixToken: ORAI_BRIDGE_EVM_ETH_DENOM_PREFIX,
        coinImageUrl: "https://assets.coingecko.com/coins/images/29850/standard/pepe-token.jpeg?1696528776"
      },
      {
        coinDenom: "PEPE",
        coinMinimalDenom: ORAI_BRIDGE_EVM_DENOM_PREFIX + PEPE_BSC_CONTRACT,
        bridgeNetworkIdentifier: "0x38",
        coinDecimals: 18,
        coinGeckoId: "pepe",
        prefixToken: ORAI_BRIDGE_EVM_DENOM_PREFIX,
        coinImageUrl: "https://assets.coingecko.com/coins/images/29850/standard/pepe-token.jpeg?1696528776"
      },
      {
        coinDenom: "CAT",
        coinMinimalDenom: ORAI_BRIDGE_EVM_DENOM_PREFIX + CAT_BSC_CONTRACT,
        bridgeNetworkIdentifier: "0x38",
        coinDecimals: 18,
        coinGeckoId: "simon-s-cat",
        prefixToken: ORAI_BRIDGE_EVM_DENOM_PREFIX,
        coinImageUrl: "https://assets.coingecko.com/coins/images/39765/standard/Simon's_Cat_Logo.png?1724017505"
      }
    ],
    txExplorer: {
      name: "OraiBridge Scan",
      txUrl: "https://scan.bridge.orai.io/tx/${txHash}",
      accountUrl: "https://scan.bridge.orai.io/account/{address}"
    }
  },
  {
    rpc: "https://tendermint1.kawaii.global",
    rest: "https://cosmos1.kawaii.global",
    chainId: "kawaii_6886-1",
    chainName: "Kawaiiverse",
    networkType: "cosmos",
    stakeCurrency: KawaiiToken,
    feeCurrencies: [KawaiiToken],
    bip44: {
      coinType: 60
    },
    bech32Config: defaultBech32Config("oraie"),

    // features: ['ibc-transfer'],
    features: ["ibc-transfer", "ibc-go", "stargate", "eth-address-gen", "eth-key-sign", "isEvm", "no-legacy-stdTx"],
    currencies: [
      KawaiiToken,
      {
        coinDenom: "MILKY",
        coinGeckoId: "milky-token",
        coinMinimalDenom: MILKY_SUB_NETWORK_DENOM,
        coinDecimals: 18,
        bridgeTo: ["Oraichain", "kawaii_6886-1"],
        coinImageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/14418.png"
      },
      {
        coinDenom: "ERC20 MILKY",
        coinMinimalDenom: "erc20_milky",
        bridgeTo: ["Oraichain", "kawaii_6886-1"],
        contractAddress: MILKY_ERC_CONTRACT,
        coinDecimals: 18,
        coinGeckoId: "milky-token",
        coinImageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/14418.png"
      },
      {
        coinDenom: "KWT",
        coinMinimalDenom: KWT_SUB_NETWORK_DENOM,
        coinDecimals: 18,
        bridgeTo: ["Oraichain", "kawaii_6886-1"],
        coinGeckoId: "kawaii-islands",
        coinImageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/12313.png"
      },
      {
        coinDenom: "ERC20 KWT",
        bridgeTo: ["Oraichain", "kawaii_6886-1"],
        coinMinimalDenom: "erc20_kwt",
        contractAddress: "0x80b5a32E4F032B2a058b4F29EC95EEfEEB87aDcd",
        coinDecimals: 18,
        coinGeckoId: "kawaii-islands",
        coinImageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/12313.png"
      }
    ],
    txExplorer: {
      name: "Kawaiiverse Scan",
      txUrl: "https://scan.kawaii.global/tx/${txHash}",
      accountUrl: "https://scan.kawaii.global/account/{address}"
    }
  },

  /// popular networks already included
  {
    rpc: "https://osmosis.rpc.orai.io/",
    rest: "https://osmosis.lcd.orai.io/",
    chainId: "osmosis-1",
    chainName: "Osmosis",
    networkType: "cosmos",
    bip44: {
      coinType: 118
    },
    bech32Config: defaultBech32Config("osmo"),
    features: ["stargate", "ibc-transfer", "no-legacy-stdTx", "ibc-go", "cosmwasm"],
    stakeCurrency: OsmoToken,
    feeCurrencies: [OsmoToken],
    currencies: [
      {
        ...OsmoToken,
        bridgeTo: ["Oraichain"]
      },
      ...listOsmosisToken
    ]
  },
  /// popular networks already included
  {
    rpc: "https://injective.rpc.orai.io/",
    rest: "https://injective.lcd.orai.io/",
    chainId: "injective-1",
    chainName: "Injective",
    networkType: "cosmos",
    bip44: {
      coinType: 60
    },
    bech32Config: defaultBech32Config("inj"),
    features: ["stargate", "no-legacy-stdTx", "ibc-transfer", "ibc-go"],
    stakeCurrency: InjectiveToken,
    feeCurrencies: [InjectiveToken],
    currencies: [
      {
        ...InjectiveToken,
        bridgeTo: ["Oraichain"]
      },
      {
        coinDenom: "ORAI",
        coinMinimalDenom: ORAIIBC_INJECTIVE_DENOM,
        coinDecimals: 6,
        coinGeckoId: "oraichain-token",
        coinImageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/7533.png",
        bridgeTo: ["Oraichain"]
      }
    ],
    txExplorer: {
      name: "Injective Scan",
      txUrl: "https://explorer.injective.network/transaction/{txHash}"
    },
    beta: true
  },
  {
    rpc: "https://cosmos-rpc.publicnode.com:443",
    rest: "https://cosmos-rest.publicnode.com",
    chainId: "cosmoshub-4",
    chainName: "Cosmos Hub",
    networkType: "cosmos",
    bip44: {
      coinType: 118
    },
    bech32Config: defaultBech32Config("cosmos"),
    features: ["stargate", "ibc-transfer", "no-legacy-stdTx", "ibc-go"],
    currencies: [
      {
        ...AtomToken,
        bridgeTo: ["Oraichain"]
      }
    ],
    feeCurrencies: [AtomToken],
    stakeCurrency: AtomToken,
    chainSymbolImageUrl: "https://dhj8dql1kzq2v.cloudfront.net/white/atom.png",
    txExplorer: {
      name: "Mintscan",
      txUrl: "https://www.mintscan.io/cosmos/txs/{txHash}"
    }
  },
  {
    // rpc: 'http://rpc.neutaro.tech:26657/',
    rpc: "https://neutaro.rpc.orai.io",
    rest: "https://neutaro.lcd.orai.io",
    // rest: "http://api.neutaro.tech:1317/",
    chainId: "Neutaro-1",
    chainName: "Neutaro",
    networkType: "cosmos",
    bip44: {
      coinType: 118
    },
    bech32Config: defaultBech32Config("neutaro"),
    stakeCurrency: {
      coinDenom: "ntmpi",
      coinMinimalDenom: "uneutaro",
      coinDecimals: 6,
      coinImageUrl: "https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/Neutaro/chain.png"
    },
    feeCurrencies: [
      {
        coinDenom: "ntmpi",
        coinMinimalDenom: "uneutaro",
        coinDecimals: 6,
        coinImageUrl: "https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/Neutaro/chain.png",
        gasPriceStep: {
          low: 0.01,
          average: 0.025,
          high: 0.03
        }
      }
    ],
    currencies: [
      {
        ...NeutaroToken,
        bridgeTo: ["Oraichain"]
      }
    ]
  },
  {
    rpc: "https://rpc.cosmos.directory/noble",
    rest: "https://rest.cosmos.directory/noble",
    chainId: "noble-1",
    chainName: "Noble",
    networkType: "cosmos",
    bip44: {
      coinType: 118
    },
    bech32Config: defaultBech32Config("noble"),
    features: ["stargate", "ibc-transfer", "no-legacy-stdTx", "ibc-go"],
    currencies: [
      {
        ...NativeUsdcNobleToken,
        bridgeTo: ["Oraichain"]
      }
    ],
    feeCurrencies: [NativeUsdcNobleToken],
    stakeCurrency: {
      coinDecimals: 6,
      coinDenom: "STAKE",
      coinMinimalDenom: "ustake",
      coinImageUrl: "https://raw.githubusercontent.com/cosmos/chain-registry/master/noble/images/stake.png"
    },
    chainSymbolImageUrl: "https://raw.githubusercontent.com/cosmos/chain-registry/master/noble/images/stake.png",
    txExplorer: {
      name: "Mintscan",
      txUrl: "https://www.mintscan.io/noble/txs/{txHash}"
    }
  },

  /// evm chain info
  {
    rpc: "https://rpc.ankr.com/eth",
    chainId: "0x01",
    chainName: "Ethereum",
    bip44: {
      coinType: 60
    },
    networkType: "evm",
    features: ["isEvm"],
    currencies: [
      {
        coinDenom: "ORAI",
        coinMinimalDenom: "erc20_orai",
        contractAddress: ORAI_ETH_CONTRACT,
        coinDecimals: 18,
        bridgeTo: ["Oraichain"],
        coinGeckoId: "oraichain-token",
        prefixToken: ORAI_BRIDGE_EVM_ETH_DENOM_PREFIX,
        coinImageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/7533.png"
      },
      {
        coinDenom: "USDC",
        coinMinimalDenom: "erc20_usdc",
        contractAddress: USDC_ETH_CONTRACT,
        coinDecimals: 6,
        bridgeTo: ["Oraichain"],
        coinGeckoId: "usd-coin",
        prefixToken: ORAI_BRIDGE_EVM_ETH_DENOM_PREFIX,
        coinImageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png"
      },
      {
        coinDenom: "WETH",
        coinMinimalDenom: "erc20_eth",
        contractAddress: WRAP_ETH_CONTRACT,
        coinDecimals: 18,
        bridgeTo: ["Oraichain"],
        coinGeckoId: "weth",
        prefixToken: ORAI_BRIDGE_EVM_ETH_DENOM_PREFIX,
        coinImageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png"
      },
      {
        coinDenom: "ETH",
        coinMinimalDenom: "eth",
        contractAddress: "",
        coinDecimals: 18,
        bridgeTo: ["Oraichain"],
        coinGeckoId: "ethereum",
        coinImageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png"
      },
      {
        coinDenom: "USDT",
        coinMinimalDenom: "erc20_usdt",
        contractAddress: USDT_ETH_CONTRACT,
        coinDecimals: 6,
        bridgeTo: ["Oraichain"],
        coinGeckoId: "tether",
        prefixToken: ORAI_BRIDGE_EVM_ETH_DENOM_PREFIX,
        coinImageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/825.png"
      },
      {
        coinDenom: "OCH",
        coinMinimalDenom: "erc20_och",
        contractAddress: OCH_ETH_CONTRACT,
        coinDecimals: 18,
        bridgeTo: ["Oraichain"],
        coinGeckoId: "och",
        prefixToken: ORAI_BRIDGE_EVM_ETH_DENOM_PREFIX,
        coinImageUrl:
          "https://assets.coingecko.com/coins/images/34236/standard/orchai_logo_white_copy_4x-8_%281%29.png?1704307670"
      },
      {
        coinDenom: "ORAIX",
        coinMinimalDenom: "erc20_oraix",
        contractAddress: ORAIX_ETH_CONTRACT,
        coinDecimals: 18,
        bridgeTo: ["Oraichain"],
        coinGeckoId: "oraidex",
        prefixToken: ORAI_BRIDGE_EVM_ETH_DENOM_PREFIX,
        coinImageUrl: "https://i.ibb.co/VmMJtf7/oraix.png"
      },
      {
        coinDenom: "PEPE",
        coinMinimalDenom: "erc20_pepe",
        contractAddress: PEPE_ETH_CONTRACT,
        coinDecimals: 18,
        bridgeTo: ["Oraichain"],
        coinGeckoId: "pepe",
        prefixToken: ORAI_BRIDGE_EVM_ETH_DENOM_PREFIX,
        coinImageUrl: "https://assets.coingecko.com/coins/images/29850/standard/pepe-token.jpeg?1696528776"
      }
    ],
    txExplorer: {
      name: "Etherscan",
      txUrl: "https://etherscan.io/tx/{txHash}",
      accountUrl: "https://etherscan.io/address/{address}"
    }
  },
  {
    rpc: "https://api.trongrid.io/jsonrpc",
    rest: "https://api.trongrid.io",
    chainId: "0x2b6653dc",
    networkType: "evm",
    chainName: "Tron Network",
    features: ["isEvm"],
    currencies: [
      {
        coinDenom: "USDT",
        coinMinimalDenom: "trx20_usdt",
        contractAddress: USDT_TRON_CONTRACT,
        bridgeTo: ["Oraichain"],
        coinDecimals: 6,
        coinGeckoId: "tether",
        prefixToken: ORAI_BRIDGE_EVM_TRON_DENOM_PREFIX,
        coinImageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/825.png"
      },
      {
        coinDenom: "wTRX",
        coinMinimalDenom: "trx20_trx",
        contractAddress: WRAP_TRON_TRX_CONTRACT,
        bridgeTo: ["Oraichain"],
        coinDecimals: 6,
        coinGeckoId: "tron",
        prefixToken: ORAI_BRIDGE_EVM_TRON_DENOM_PREFIX,
        coinImageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/1958.png"
      }
    ],
    bip44: {
      coinType: 195
    },
    txExplorer: {
      name: "Tronscan",
      txUrl: "https://tronscan.org/#/transaction/{txHash}",
      accountUrl: "https://tronscan.org/#/address/{address}"
    }
  },
  {
    rpc: "https://bsc-dataseed1.binance.org",
    networkType: "evm",
    chainId: "0x38",
    chainName: "BNB Chain",
    bip44: {
      coinType: 60
    },
    features: ["isEvm"],
    currencies: [
      {
        coinDenom: "ORAI",
        coinMinimalDenom: "bep20_orai",
        contractAddress: ORAI_BSC_CONTRACT,
        bridgeTo: ["Oraichain"],
        coinDecimals: 18,
        coinGeckoId: "oraichain-token",
        prefixToken: ORAI_BRIDGE_EVM_DENOM_PREFIX,
        coinImageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/7533.png"
      },
      {
        coinDenom: "AIRI",
        coinMinimalDenom: "bep20_airi",
        contractAddress: AIRI_BSC_CONTRACT,
        bridgeTo: ["Oraichain"],
        coinDecimals: 18,
        coinGeckoId: "airight",
        prefixToken: ORAI_BRIDGE_EVM_DENOM_PREFIX,
        coinImageUrl: "https://i.ibb.co/m8mCyMr/airi.png"
      },
      {
        coinDenom: "USDT",
        coinMinimalDenom: "bep20_usdt",
        contractAddress: USDT_BSC_CONTRACT,
        bridgeTo: ["Oraichain"],
        coinDecimals: 18,
        coinGeckoId: "tether",
        prefixToken: ORAI_BRIDGE_EVM_DENOM_PREFIX,
        coinImageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/825.png"
      },
      {
        coinDenom: "KWT",
        coinMinimalDenom: "bep20_kwt",
        contractAddress: KWT_BSC_CONTRACT,
        bridgeTo: ["Oraichain"],
        coinDecimals: 18,
        coinGeckoId: "kawaii-islands",
        coinImageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/12313.png"
      },
      {
        coinDenom: "MILKY",
        coinMinimalDenom: "bep20_milky",
        contractAddress: MILKY_BSC_CONTRACT,
        coinDecimals: 18,
        coinGeckoId: "milky-token",
        bridgeTo: ["Oraichain"],
        coinImageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/14418.png"
      },
      {
        coinDenom: "WBNB",
        coinMinimalDenom: "bep20_wbnb",
        contractAddress: WRAP_BNB_CONTRACT,
        coinDecimals: 18,
        coinGeckoId: "wbnb",
        bridgeTo: ["Oraichain"],
        coinImageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/1839.png"
      },
      {
        coinDenom: "BNB",
        coinMinimalDenom: "bnb",
        contractAddress: "",
        coinDecimals: 18,
        coinGeckoId: "binancecoin",
        bridgeTo: ["Oraichain"],
        coinImageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/1839.png"
      },
      {
        coinDenom: "PEPE",
        coinMinimalDenom: "bep20_pepe",
        contractAddress: PEPE_BSC_CONTRACT,
        coinDecimals: 18,
        coinGeckoId: "pepe",
        bridgeTo: ["Oraichain"],
        coinImageUrl: "https://assets.coingecko.com/coins/images/29850/standard/pepe-token.jpeg?1696528776"
      },
      {
        coinDenom: "CAT",
        coinMinimalDenom: "bep20_cat",
        contractAddress: CAT_BSC_CONTRACT,
        coinDecimals: 18,
        coinGeckoId: "simon-s-cat",
        bridgeTo: ["Oraichain"],
        coinImageUrl: "https://assets.coingecko.com/coins/images/39765/standard/Simon's_Cat_Logo.png?1724017505"
      }
    ],
    txExplorer: {
      name: "Bsc Scan",
      txUrl: "https://bscscan.com/tx/${txHash}",
      accountUrl: "https://bscscan.com/address/{address}"
    }
  },
  {
    rpc: "https://endpoint1.kawaii.global",
    chainId: "0x1ae6",
    networkType: "evm",
    chainName: "Kawaiiverse EVM",
    bip44: {
      coinType: 60
    },
    features: ["isEvm"],
    currencies: [
      {
        coinDenom: "ERC20 MILKY",
        coinMinimalDenom: "erc20_milky",
        bridgeTo: ["Oraichain", "kawaii_6886-1"],
        contractAddress: MILKY_ERC_CONTRACT,
        coinDecimals: 18,
        coinGeckoId: "milky-token",
        coinImageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/14418.png"
      },
      {
        coinDenom: "ERC20 KWT",
        bridgeTo: ["Oraichain", "kawaii_6886-1"],
        coinMinimalDenom: "erc20_kwt",
        contractAddress: "0x80b5a32E4F032B2a058b4F29EC95EEfEEB87aDcd",
        coinDecimals: 18,
        coinGeckoId: "kawaii-islands",
        coinImageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/12313.png"
      }
    ],
    txExplorer: {
      name: "Kawaiiverse Scan",
      txUrl: "https://scan.kawaii.global/tx/${txHash}",
      accountUrl: "https://scan.kawaii.global/account/{address}"
    }
  }
];

export const network: CustomChainInfo & NetworkConfig = {
  ...oraichainNetwork,
  prefix: oraichainNetwork.bech32Config.bech32PrefixAccAddr,
  denom: "orai",
  coinType: oraichainNetwork.bip44.coinType,
  fee: { gasPrice: "0.00506", amount: "1518", gas: "2000000" }, // 0.000500 ORAI
  factory: FACTORY_CONTRACT,
  factory_v2: FACTORY_V2_CONTRACT,
  router: ROUTER_V2_CONTRACT,
  mixer_router: MIXED_ROUTER,
  oracle: ORACLE_CONTRACT,
  staking: STAKING_CONTRACT,
  rewarder: REWARDER_CONTRACT,
  converter: CONVERTER_CONTRACT,
  oraidex_listing: ORAIDEX_LISTING_CONTRACT,
  multicall: MULTICALL_CONTRACT,
  bid_pool: ORAIDEX_BID_POOL_CONTRACT,
  explorer: "https://scan.orai.io",
  pool_v3: AMM_V3_CONTRACT
};

// exclude kawaiverse subnet and other special evm that has different cointype
export const evmChains = chainInfos.filter((c) => c.networkType === "evm");
export const cosmosChains = chainInfos.filter((c) => c.networkType === "cosmos");

// evm network
export enum Networks {
  mainnet = 1,
  ropsten = 3,
  rinkeby = 4,
  goerli = 5,
  optimism = 10,
  kovan = 42,
  matic = 137,
  kovanOptimism = 69,
  xdai = 100,
  goerliOptimism = 420,
  arbitrum = 42161,
  rinkebyArbitrum = 421611,
  goerliArbitrum = 421613,
  mumbai = 80001,
  sepolia = 11155111,
  avalancheMainnet = 43114,
  avalancheFuji = 43113,
  fantomTestnet = 4002,
  fantom = 250,
  bsc = 56,
  bsc_testnet = 97,
  moonbeam = 1284,
  moonriver = 1285,
  moonbaseAlphaTestnet = 1287,
  harmony = 1666600000,
  cronos = 25,
  fuse = 122,
  songbirdCanaryNetwork = 19,
  costonTestnet = 16,
  boba = 288,
  aurora = 1313161554,
  astar = 592,
  okc = 66,
  heco = 128,
  metis = 1088,
  rsk = 30,
  rskTestnet = 31,
  evmos = 9001,
  evmosTestnet = 9000,
  thundercore = 108,
  thundercoreTestnet = 18,
  oasis = 26863,
  celo = 42220,
  godwoken = 71402,
  godwokentestnet = 71401,
  klatyn = 8217,
  milkomeda = 2001,
  kcc = 321,
  kawaiiverse = 6886,
  etherlite = 111,
  tron = 728126428
}
