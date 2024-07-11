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
const BtcIcon = "https://s2.coinmarketcap.com/static/img/coins/64x64/1.png";
const TIAIcon = "https://assets.coingecko.com/coins/images/31967/standard/tia.jpg?1696530772";
const OasisIcon = "https://assets.coingecko.com/coins/images/13162/standard/rose.png?1696512946";
const OCHIcon =
  "https://assets.coingecko.com/coins/images/34236/standard/orchai_logo_white_copy_4x-8_%281%29.png?1704307670";

import { flatten } from "lodash";
import { chainInfos as customChainInfos, CustomChainInfo } from "../network";
import { TokenItemType, tokens } from "../token";

const [otherChainTokens, oraichainTokens] = tokens;
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
    coinGeckoId: "bitcoin",
    Icon: BtcIcon,
    IconLight: BtcIcon
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
  },
  {
    coinGeckoId: "och",
    Icon: OCHIcon,
    IconLight: OCHIcon
  },
  {
    coinGeckoId: "celestia",
    Icon: TIAIcon,
    IconLight: TIAIcon
  },
  {
    coinGeckoId: "oasis-network",
    Icon: OasisIcon,
    IconLight: OasisIcon
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
  },
  {
    chainId: "0x5afe",
    Icon: OasisIcon,
    IconLight: OasisIcon
  }
];
export const mapListWithIcon = (list: any[], listIcon: ChainIcon[] | TokenIcon[], key: "chainId" | "coinGeckoId") => {
  return list.map((item) => {
    let Icon = OraiIcon;
    let IconLight = OraiLightIcon;

    //@ts-ignore
    const findedItem = listIcon.find((icon) => icon[key] === item[key]);
    if (findedItem) {
      Icon = findedItem.Icon;
      IconLight = findedItem.IconLight;
    }

    return {
      ...item,
      Icon,
      IconLight
    };
  });
};

// mapped chain info with icon
export const chainInfosWithIcon = mapListWithIcon(customChainInfos, chainIcons, "chainId");

// mapped token with icon
export const oraichainTokensWithIcon = mapListWithIcon(oraichainTokens, tokensIcon, "coinGeckoId");
export const otherTokensWithIcon = mapListWithIcon(otherChainTokens, tokensIcon, "coinGeckoId");

export const tokensWithIcon = [otherTokensWithIcon, oraichainTokensWithIcon];
export const flattenTokensWithIcon = flatten(tokensWithIcon);
