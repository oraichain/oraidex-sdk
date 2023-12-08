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
  WRAP_BNB_CONTRACT,
  WRAP_ETH_CONTRACT,
  WRAP_TRON_TRX_CONTRACT
} from "./constant";

const OraiIcon = "https://s2.coinmarketcap.com/static/img/coins/64x64/7533.png";
const OraiLightIcon = "https://s2.coinmarketcap.com/static/img/coins/64x64/7533.png";
const AtomIcon = "https://s2.coinmarketcap.com/static/img/coins/64x64/3794.png";
const AiriIcon = "https://i.ibb.co/m8mCyMr/airi.png";
const UsdtIcon = "https://s2.coinmarketcap.com/static/img/coins/64x64/825.png";
const KwtIcon = "https://s2.coinmarketcap.com/static/img/coins/64x64/12313.png";
const OsmoLightIcon = "https://assets.coingecko.com/coins/images/16724/large/osmo.png?1632763885";
const OsmoIcon = "https://assets.coingecko.com/coins/images/16724/large/osmo.png?1632763885";
const UsdcIcon = "https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png";
const ScOraiIcon = "https://s2.coinmarketcap.com/static/img/coins/64x64/7533.png";
const OraixIcon = "https://assets.coingecko.com/coins/images/28104/standard/oraix.png?1696527113";
const MilkyIcon = "https://s2.coinmarketcap.com/static/img/coins/64x64/14418.png";
const TronIcon = "https://s2.coinmarketcap.com/static/img/coins/64x64/1958.png";
const ScAtomIcon = "https://s2.coinmarketcap.com/static/img/coins/64x64/3794.png";
const EthIcon = "https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png";
const BnbIcon = "https://s2.coinmarketcap.com/static/img/coins/64x64/1839.png";
const InjIcon = "https://s2.coinmarketcap.com/static/img/coins/64x64/7226.png";
const OraixLightIcon = "https://assets.coingecko.com/coins/images/28104/standard/oraix.png?1696527113";
const NobleIcon = "https://raw.githubusercontent.com/cosmos/chain-registry/master/noble/images/stake.png";

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
  | "Noble";

export type CosmosChainId =
  | "Oraichain" // oraichain
  | "oraibridge-subnet-2" // oraibridge
  | "osmosis-1" // osmosis
  | "cosmoshub-4" // cosmos hub
  | "injective-1" // injective network
  | "kawaii_6886-1" // kawaii subnetwork
  | "noble-1";

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
  | "injective-protocol";

import { TokenItemType, tokens } from "./token";

type TokenIcon = Pick<TokenItemType, "coinGeckoId" | "Icon" | "IconLight">;
type ChainIcon = Pick<CustomChainInfo, "chainId" | "Icon" | "IconLight">;
export const tokensIcon: TokenIcon[] = [
  {
    coinGeckoId: "oraichain-token",
    Icon: OraiIcon,
    IconLight: OraiLightIcon
  },
  {
    coinGeckoId: "usd-coin",
    Icon: UsdcIcon,
    IconLight: UsdcIcon
  },
  {
    coinGeckoId: "airight",
    Icon: AiriIcon,
    IconLight: AiriIcon
  },
  {
    coinGeckoId: "tether",
    Icon: UsdtIcon,
    IconLight: UsdtIcon
  },
  {
    coinGeckoId: "tron",
    Icon: TronIcon,
    IconLight: TronIcon
  },
  {
    coinGeckoId: "kawaii-islands",
    Icon: KwtIcon,
    IconLight: KwtIcon
  },
  {
    coinGeckoId: "milky-token",
    Icon: MilkyIcon,
    IconLight: MilkyIcon
  },
  {
    coinGeckoId: "osmosis",
    Icon: OsmoIcon,
    IconLight: OsmoLightIcon
  },
  {
    coinGeckoId: "injective-protocol",
    Icon: InjIcon,
    IconLight: InjIcon
  },
  {
    coinGeckoId: "cosmos",
    Icon: AtomIcon,
    IconLight: AtomIcon
  },
  {
    coinGeckoId: "weth",
    Icon: EthIcon,
    IconLight: EthIcon
  },
  {
    coinGeckoId: "ethereum",
    Icon: EthIcon,
    IconLight: EthIcon
  },
  {
    coinGeckoId: "wbnb",
    Icon: BnbIcon,
    IconLight: BnbIcon
  },
  {
    coinGeckoId: "binancecoin",
    Icon: BnbIcon,
    IconLight: BnbIcon
  },
  {
    coinGeckoId: "oraidex",
    Icon: OraixIcon,
    IconLight: OraixLightIcon
  },
  {
    coinGeckoId: "scorai",
    Icon: ScOraiIcon,
    IconLight: ScOraiIcon
  },
  {
    coinGeckoId: "scatom",
    Icon: ScAtomIcon,
    IconLight: ScAtomIcon
  }
];

export const chainIcons: ChainIcon[] = [
  {
    chainId: "Oraichain",
    Icon: OraiIcon,
    IconLight: OraiLightIcon
  },
  {
    chainId: "kawaii_6886-1",
    Icon: KwtIcon,
    IconLight: KwtIcon
  },
  {
    chainId: "osmosis-1",
    Icon: OsmoIcon,
    IconLight: OsmoLightIcon
  },
  {
    chainId: "injective-1",
    Icon: InjIcon,
    IconLight: InjIcon
  },
  {
    chainId: "cosmoshub-4",
    Icon: AtomIcon,
    IconLight: AtomIcon
  },
  {
    chainId: "0x01",
    Icon: EthIcon,
    IconLight: EthIcon
  },
  {
    chainId: "0x2b6653dc",
    Icon: TronIcon,
    IconLight: TronIcon
  },
  {
    chainId: "0x38",
    Icon: BnbIcon,
    IconLight: BnbIcon
  },
  {
    chainId: "0x1ae6",
    Icon: KwtIcon,
    IconLight: KwtIcon
  },
  {
    chainId: "noble-1",
    Icon: NobleIcon,
    IconLight: NobleIcon
  }
];

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
  denom: string;
  prefix: string;
  rewarder: string;
  converter: string;
  oraidex_listing: string;
  multicall: string;
}

export type CoinIcon = any;
export type BridgeAppCurrency = FeeCurrency & {
  readonly bridgeTo?: NetworkChainId[];
  readonly coinGeckoId?: CoinGeckoId;
  readonly Icon?: CoinIcon;
  readonly IconLight?: CoinIcon;
  readonly bridgeNetworkIdentifier?: EvmChainId;
  readonly coinDecimals: 6 | 18;
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
  bip44: {
    coinType: 118
  },
  bech32Config: defaultBech32Config("orai"),
  feeCurrencies: [OraiToken],

  Icon: OraiIcon,
  IconLight: OraiLightIcon,
  features: ["ibc-transfer", "cosmwasm", "wasmd_0.24+"],
  currencies: [
    OraiToken,
    {
      coinDenom: "ATOM",
      coinGeckoId: "cosmos",
      coinMinimalDenom: ATOM_ORAICHAIN_DENOM,
      bridgeTo: ["cosmoshub-4"],
      coinDecimals: 6,
      Icon: AtomIcon,
      IconLight: AtomIcon
    },

    {
      coinDenom: "AIRI",
      coinGeckoId: "airight",
      coinMinimalDenom: "airi",
      type: "cw20",
      contractAddress: AIRI_CONTRACT,
      bridgeTo: ["0x38"],
      coinDecimals: 6,
      Icon: AiriIcon
    },
    {
      coinDenom: "USDT",
      coinGeckoId: "tether",
      coinMinimalDenom: "usdt",
      type: "cw20",
      contractAddress: USDT_CONTRACT,
      bridgeTo: ["0x38", "0x2b6653dc"],
      coinDecimals: 6,
      Icon: UsdtIcon
    },
    {
      coinDenom: "USDC",
      coinGeckoId: "usd-coin",
      coinMinimalDenom: "usdc",
      type: "cw20",
      contractAddress: USDC_CONTRACT,
      bridgeTo: ["0x01", "noble-1"],
      coinDecimals: 6,
      Icon: UsdcIcon
    },
    {
      coinDenom: "OSMO",
      coinMinimalDenom: OSMOSIS_ORAICHAIN_DENOM,
      coinDecimals: 6,
      coinGeckoId: "osmosis",
      bridgeTo: ["osmosis-1"],
      Icon: OsmoIcon,
      IconLight: OsmoLightIcon
    },
    {
      coinDenom: "BEP20 KWT",
      coinGeckoId: "kawaii-islands",
      coinMinimalDenom: KWTBSC_ORAICHAIN_DENOM,
      coinDecimals: 18,
      Icon: KwtIcon
    },
    {
      coinDenom: "KWT",
      coinGeckoId: "kawaii-islands",
      coinMinimalDenom: "kwt",
      type: "cw20",
      contractAddress: KWT_CONTRACT,
      bridgeTo: ["kawaii_6886-1", "0x38"],
      coinDecimals: 6,
      Icon: KwtIcon
    },
    {
      coinDenom: "BEP20 MILKY",
      coinGeckoId: "milky-token",
      coinMinimalDenom: MILKYBSC_ORAICHAIN_DENOM,
      coinDecimals: 18,
      Icon: MilkyIcon
    },
    {
      coinDenom: "MILKY",
      coinGeckoId: "milky-token",
      coinMinimalDenom: "milky",
      type: "cw20",
      contractAddress: MILKY_CONTRACT,
      bridgeTo: ["kawaii_6886-1", "0x38"],
      coinDecimals: 6,
      Icon: MilkyIcon
    },
    {
      coinDenom: "ORAIX",
      coinMinimalDenom: "oraix",
      type: "cw20",
      contractAddress: ORAIX_CONTRACT,
      coinGeckoId: "oraidex",
      coinDecimals: 6,
      Icon: OraixIcon,
      IconLight: OraixLightIcon
    },
    {
      coinDenom: "scORAI",
      coinMinimalDenom: "scorai",
      type: "cw20",
      contractAddress: SCORAI_CONTRACT,
      coinGeckoId: "scorai",
      coinDecimals: 6,
      Icon: ScOraiIcon
    },
    {
      coinDenom: "wTRX",
      coinGeckoId: "tron",
      coinMinimalDenom: "trx",
      type: "cw20",
      contractAddress: TRX_CONTRACT,
      bridgeTo: ["0x2b6653dc"],
      coinDecimals: 6,
      Icon: TronIcon
    },
    {
      coinDenom: "scATOM",
      coinMinimalDenom: "scatom",
      type: "cw20",
      contractAddress: SCATOM_CONTRACT,
      coinGeckoId: "scatom",
      coinDecimals: 6,
      Icon: ScAtomIcon
    },
    {
      coinDenom: "IBC INJ",
      coinGeckoId: "injective-protocol",
      coinMinimalDenom: INJECTIVE_ORAICHAIN_DENOM,
      coinDecimals: 18,
      Icon: InjIcon,
      IconLight: InjIcon
    },
    {
      coinDenom: "INJ",
      coinGeckoId: "injective-protocol",
      coinMinimalDenom: "injective",
      contractAddress: INJECTIVE_CONTRACT,
      bridgeTo: ["injective-1"],
      type: "cw20",
      coinDecimals: 6,
      Icon: InjIcon,
      IconLight: InjIcon
    }
    // {
    //   coinDenom: 'ATOM-CW20',
    //   coinGeckoId: 'cosmos',
    //   coinMinimalDenom: 'uatom',
    //   type: 'cw20',
    //   contractAddress: 'orai17l2zk3arrx0a0fyuneyx8raln68622a2lrsz8ph75u7gw9tgz3esayqryf',
    //   bridgeTo: ['cosmoshub-4'],
    //   coinDecimals: 6,
    //   Icon: AtomIcon
    // }
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

    features: ["ibc-transfer"],
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
        IconLight: OraiLightIcon,
        Icon: OraiIcon
      },
      {
        coinDenom: "ORAI",
        coinMinimalDenom: ORAI_BRIDGE_EVM_ETH_DENOM_PREFIX + ORAI_ETH_CONTRACT,
        bridgeNetworkIdentifier: "0x01",
        coinDecimals: 18,
        coinGeckoId: "oraichain-token",
        IconLight: OraiLightIcon,
        prefixToken: ORAI_BRIDGE_EVM_ETH_DENOM_PREFIX,
        Icon: OraiIcon
      },
      {
        coinDenom: "USDC",
        coinMinimalDenom: ORAI_BRIDGE_EVM_ETH_DENOM_PREFIX + USDC_ETH_CONTRACT,
        bridgeNetworkIdentifier: "0x01",
        coinDecimals: 6,
        coinGeckoId: "usd-coin",
        prefixToken: ORAI_BRIDGE_EVM_ETH_DENOM_PREFIX,
        Icon: UsdcIcon
      },
      {
        coinDenom: "AIRI",
        coinMinimalDenom: ORAI_BRIDGE_EVM_DENOM_PREFIX + AIRI_BSC_CONTRACT,
        bridgeNetworkIdentifier: "0x38",
        coinDecimals: 18,
        coinGeckoId: "airight",
        Icon: AiriIcon
      },
      {
        coinDenom: "USDT",
        coinMinimalDenom: ORAI_BRIDGE_EVM_DENOM_PREFIX + USDT_BSC_CONTRACT,
        bridgeNetworkIdentifier: "0x38",
        coinDecimals: 18,
        coinGeckoId: "tether",
        Icon: UsdtIcon
      },
      {
        coinDenom: "USDT",
        coinMinimalDenom: ORAI_BRIDGE_EVM_TRON_DENOM_PREFIX + USDT_TRON_CONTRACT,
        bridgeNetworkIdentifier: "0x2b6653dc",
        prefixToken: ORAI_BRIDGE_EVM_TRON_DENOM_PREFIX,
        coinDecimals: 6,
        coinGeckoId: "tether",
        Icon: UsdtIcon
      },
      {
        coinDenom: "wTRX",
        coinMinimalDenom: ORAI_BRIDGE_EVM_TRON_DENOM_PREFIX + WRAP_TRON_TRX_CONTRACT,
        bridgeNetworkIdentifier: "0x2b6653dc",
        coinDecimals: 6,
        coinGeckoId: "tron",
        prefixToken: ORAI_BRIDGE_EVM_TRON_DENOM_PREFIX,
        Icon: TronIcon
      },
      {
        coinDenom: "KWT",
        bridgeNetworkIdentifier: "0x38",
        coinMinimalDenom: KWT_DENOM,
        coinDecimals: 18,
        coinGeckoId: "kawaii-islands",
        Icon: KwtIcon
      },
      {
        coinDenom: "MILKY",
        bridgeNetworkIdentifier: "0x38",
        coinMinimalDenom: MILKY_DENOM,
        coinDecimals: 18,
        coinGeckoId: "milky-token",
        Icon: MilkyIcon
      }
    ]
  },
  {
    rpc: "https://tendermint1.kawaii.global",
    rest: "https://cosmos1.kawaii.global",
    chainId: "kawaii_6886-1",
    chainName: "Kawaiiverse",
    networkType: "cosmos",
    stakeCurrency: KawaiiToken,
    bip44: {
      coinType: 60
    },
    bech32Config: defaultBech32Config("oraie"),
    feeCurrencies: [KawaiiToken],

    Icon: KwtIcon,
    // features: ['ibc-transfer'],
    features: ["ibc-transfer", "ibc-go", "stargate", "eth-address-gen", "eth-key-sign"],
    currencies: [
      KawaiiToken,
      {
        coinDenom: "MILKY",
        coinGeckoId: "milky-token",
        coinMinimalDenom: MILKY_SUB_NETWORK_DENOM,
        coinDecimals: 18,
        bridgeTo: ["Oraichain", "kawaii_6886-1"],
        Icon: MilkyIcon
      },
      {
        coinDenom: "ERC20 MILKY",
        coinMinimalDenom: "erc20_milky",
        bridgeTo: ["Oraichain", "kawaii_6886-1"],
        contractAddress: MILKY_ERC_CONTRACT,
        coinDecimals: 18,
        coinGeckoId: "milky-token",
        Icon: MilkyIcon
      },
      {
        coinDenom: "KWT",
        coinMinimalDenom: KWT_SUB_NETWORK_DENOM,
        coinDecimals: 18,
        bridgeTo: ["Oraichain", "kawaii_6886-1"],
        coinGeckoId: "kawaii-islands",
        Icon: KwtIcon
      },
      {
        coinDenom: "ERC20 KWT",
        bridgeTo: ["Oraichain", "kawaii_6886-1"],
        coinMinimalDenom: "erc20_kwt",
        contractAddress: "0x80b5a32E4F032B2a058b4F29EC95EEfEEB87aDcd",
        coinDecimals: 18,
        coinGeckoId: "kawaii-islands",
        Icon: KwtIcon
      }
    ]
  },

  /// popular networks already included
  {
    rpc: "https://osmosis-rpc.polkachu.com",
    rest: "https://osmosis-api.polkachu.com",
    chainId: "osmosis-1",
    chainName: "Osmosis",
    networkType: "cosmos",
    bip44: {
      coinType: 118
    },
    Icon: OsmoIcon,
    IconLight: OsmoLightIcon,
    bech32Config: defaultBech32Config("osmo"),
    feeCurrencies: [OsmoToken],
    currencies: [
      {
        coinDenom: "OSMO",
        coinMinimalDenom: "uosmo",
        coinDecimals: 6,
        coinGeckoId: "osmosis",
        bridgeTo: ["Oraichain"],
        Icon: OsmoIcon,
        IconLight: OsmoLightIcon
      }
    ]
  },
  /// popular networks already included
  {
    rpc: "https://injective-rpc.polkachu.com",
    rest: "https://injective-lcd.quickapi.com",
    chainId: "injective-1",
    chainName: "Injective",
    networkType: "cosmos",
    bip44: {
      coinType: 60
    },
    Icon: InjIcon,
    IconLight: InjIcon,
    bech32Config: defaultBech32Config("inj"),
    feeCurrencies: [InjectiveToken],
    currencies: [
      {
        coinDenom: "INJ",
        coinMinimalDenom: "inj",
        coinDecimals: 18,
        coinGeckoId: "injective-protocol",
        bridgeTo: ["Oraichain"],
        Icon: InjIcon,
        IconLight: InjIcon
      },
      {
        coinDenom: "ORAI",
        coinMinimalDenom: ORAIIBC_INJECTIVE_DENOM,
        coinDecimals: 6,
        coinGeckoId: "oraichain-token",
        bridgeTo: ["Oraichain"],
        Icon: OraiIcon,
        IconLight: OraiLightIcon
      }
    ]
  },
  {
    rpc: "https://rpc.mainnet.noble.strange.love/",
    rest: "https://noble-api.polkachu.com",
    chainId: "noble-1",
    chainName: "Noble",
    networkType: "cosmos",
    bip44: {
      coinType: 118
    },
    bech32Config: defaultBech32Config("noble"),
    features: ["stargate", "ibc-transfer", "no-legacy-stdTx", "ibc-go"],
    Icon: NobleIcon,
    IconLight: NobleIcon,
    currencies: [
      {
        coinDenom: "USDC",
        coinMinimalDenom: "uusdc",
        coinDecimals: 6,
        coinGeckoId: "usd-coin",
        coinImageUrl: "https://raw.githubusercontent.com/cosmos/chain-registry/master/noble/images/USDCoin.png",
        gasPriceStep: {
          low: 0,
          average: 0.025,
          high: 0.03
        },
        bridgeTo: ["Oraichain"],
        Icon: UsdcIcon,
        IconLight: UsdcIcon
      }
    ],
    feeCurrencies: [
      {
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
      }
    ],
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
  {
    rpc: "https://rpc-cosmos.oraidex.io",
    rest: "https://lcd-cosmos.oraidex.io",
    chainId: "cosmoshub-4",
    chainName: "Cosmos Hub",
    networkType: "cosmos",
    bip44: {
      coinType: 118
    },
    Icon: AtomIcon,
    IconLight: AtomIcon,
    bech32Config: defaultBech32Config("cosmos"),
    feeCurrencies: [AtomToken],
    currencies: [
      {
        coinDenom: "ATOM",
        coinGeckoId: "cosmos",
        coinMinimalDenom: "uatom",
        coinDecimals: 6,
        bridgeTo: ["Oraichain"],
        Icon: AtomIcon,
        IconLight: AtomIcon
      }
    ]
  },

  /// evm chain info
  {
    rpc: "https://rpc.ankr.com/eth",
    chainId: "0x01",
    chainName: "Ethereum",
    bip44: {
      coinType: 60
    },
    Icon: EthIcon,
    networkType: "evm",
    currencies: [
      {
        coinDenom: "ORAI",
        coinMinimalDenom: "erc20_orai",
        contractAddress: ORAI_ETH_CONTRACT,
        coinDecimals: 18,
        bridgeTo: ["Oraichain"],
        coinGeckoId: "oraichain-token",
        IconLight: OraiLightIcon,
        prefixToken: ORAI_BRIDGE_EVM_ETH_DENOM_PREFIX,
        Icon: OraiIcon
      },
      {
        coinDenom: "USDC",
        coinMinimalDenom: "erc20_usdc",
        contractAddress: USDC_ETH_CONTRACT,
        coinDecimals: 6,
        bridgeTo: ["Oraichain"],
        coinGeckoId: "usd-coin",
        prefixToken: ORAI_BRIDGE_EVM_ETH_DENOM_PREFIX,
        Icon: UsdcIcon
      },
      {
        coinDenom: "WETH",
        coinMinimalDenom: "erc20_eth",
        contractAddress: WRAP_ETH_CONTRACT,
        coinDecimals: 18,
        bridgeTo: ["Oraichain"],
        coinGeckoId: "weth",
        Icon: EthIcon
      },
      {
        coinDenom: "ETH",
        coinMinimalDenom: "eth",
        contractAddress: "",
        coinDecimals: 18,
        bridgeTo: ["Oraichain"],
        coinGeckoId: "ethereum",
        Icon: EthIcon
      }
    ]
  },
  {
    rpc: "https://api.trongrid.io/jsonrpc",
    rest: "https://api.trongrid.io",
    chainId: "0x2b6653dc",
    networkType: "evm",
    chainName: "Tron Network",
    Icon: TronIcon,
    currencies: [
      {
        coinDenom: "USDT",
        coinMinimalDenom: "trx20_usdt",
        contractAddress: USDT_TRON_CONTRACT,
        bridgeTo: ["Oraichain"],
        coinDecimals: 6,
        coinGeckoId: "tether",
        prefixToken: ORAI_BRIDGE_EVM_TRON_DENOM_PREFIX,
        Icon: UsdtIcon
      },
      {
        coinDenom: "wTRX",
        coinMinimalDenom: "trx20_trx",
        contractAddress: WRAP_TRON_TRX_CONTRACT,
        bridgeTo: ["Oraichain"],
        coinDecimals: 6,
        coinGeckoId: "tron",
        prefixToken: ORAI_BRIDGE_EVM_TRON_DENOM_PREFIX,
        Icon: TronIcon
      }
    ],
    bip44: {
      coinType: 195
    }
  },
  {
    rpc: "https://bsc-dataseed1.binance.org",
    networkType: "evm",
    Icon: BnbIcon,
    chainId: "0x38",
    chainName: "BNB Chain",
    bip44: {
      coinType: 60
    },
    currencies: [
      {
        coinDenom: "ORAI",
        coinMinimalDenom: "bep20_orai",
        contractAddress: ORAI_BSC_CONTRACT,
        bridgeTo: ["Oraichain"],
        coinDecimals: 18,
        coinGeckoId: "oraichain-token",
        prefixToken: ORAI_BRIDGE_EVM_DENOM_PREFIX,
        Icon: OraiIcon,
        IconLight: OraiLightIcon
      },
      {
        coinDenom: "AIRI",
        coinMinimalDenom: "bep20_airi",
        contractAddress: AIRI_BSC_CONTRACT,
        bridgeTo: ["Oraichain"],
        coinDecimals: 18,
        coinGeckoId: "airight",
        prefixToken: ORAI_BRIDGE_EVM_DENOM_PREFIX,
        Icon: AiriIcon
      },
      {
        coinDenom: "USDT",
        coinMinimalDenom: "bep20_usdt",
        contractAddress: USDT_BSC_CONTRACT,
        bridgeTo: ["Oraichain"],
        coinDecimals: 18,
        coinGeckoId: "tether",
        prefixToken: ORAI_BRIDGE_EVM_DENOM_PREFIX,
        Icon: UsdtIcon
      },
      {
        coinDenom: "KWT",
        coinMinimalDenom: "bep20_kwt",
        contractAddress: KWT_BSC_CONTRACT,
        bridgeTo: ["Oraichain"],
        coinDecimals: 18,
        coinGeckoId: "kawaii-islands",
        Icon: KwtIcon
      },
      {
        coinDenom: "MILKY",
        coinMinimalDenom: "bep20_milky",
        contractAddress: MILKY_BSC_CONTRACT,
        coinDecimals: 18,
        coinGeckoId: "milky-token",
        bridgeTo: ["Oraichain"],
        Icon: MilkyIcon
      },
      {
        coinDenom: "WBNB",
        coinMinimalDenom: "bep20_wbnb",
        contractAddress: WRAP_BNB_CONTRACT,
        coinDecimals: 18,
        coinGeckoId: "wbnb",
        bridgeTo: ["Oraichain"],
        Icon: BnbIcon
      },
      {
        coinDenom: "BNB",
        coinMinimalDenom: "bnb",
        contractAddress: "",
        coinDecimals: 18,
        coinGeckoId: "binancecoin",
        bridgeTo: ["Oraichain"],
        Icon: BnbIcon
      }
    ]
  },
  {
    rpc: "https://endpoint1.kawaii.global",
    chainId: "0x1ae6",
    networkType: "evm",
    chainName: "Kawaiiverse EVM",
    Icon: KwtIcon,
    bip44: {
      coinType: 60
    },
    currencies: [
      {
        coinDenom: "ERC20 MILKY",
        coinMinimalDenom: "erc20_milky",
        bridgeTo: ["Oraichain", "kawaii_6886-1"],
        contractAddress: MILKY_ERC_CONTRACT,
        coinDecimals: 18,
        coinGeckoId: "milky-token",
        Icon: MilkyIcon
      },
      {
        coinDenom: "ERC20 KWT",
        bridgeTo: ["Oraichain", "kawaii_6886-1"],
        coinMinimalDenom: "erc20_kwt",
        contractAddress: "0x80b5a32E4F032B2a058b4F29EC95EEfEEB87aDcd",
        coinDecimals: 18,
        coinGeckoId: "kawaii-islands",
        Icon: KwtIcon
      }
    ]
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
  oracle: ORACLE_CONTRACT,
  staking: STAKING_CONTRACT,
  rewarder: REWARDER_CONTRACT,
  converter: CONVERTER_CONTRACT,
  oraidex_listing: ORAIDEX_LISTING_CONTRACT,
  multicall: MULTICALL_CONTRACT,
  explorer: "https://scan.orai.io"
};

// exclude kawaiverse subnet and other special evm that has different cointype
export const evmChains = chainInfos.filter(
  (c) => c.networkType === "evm" && c.bip44.coinType === 60 && c.chainId !== "0x1ae6"
);
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
