import { CosmosChainId, EvmChainId, chainInfos, cosmosChains, evmChains } from "./network";

export const truncDecimals = 6;
export const atomic = 10 ** truncDecimals;

export const ORAI = "orai";
export const UAIRI = "uAIRI";
export const AIRI = "AIRI";
export const ATOM = "ATOM";
export const OSMO = "OSMO";
export const LP = "LP";
export const KWT = "oraie";
export const MILKY = "milky";
export const STABLE_DENOM = "usdt";
export const TRON_DENOM = "trx";

// estimate fee
export const GAS_ESTIMATION_SWAP_DEFAULT = 580000;
export const GAS_ESTIMATION_BRIDGE_DEFAULT = 200000;
export const MULTIPLIER = 1.6;
export const HIGH_GAS_PRICE = 0.007;
export const AVERAGE_COSMOS_GAS_PRICE = 0.025; // average based on Keplr

export const SEC_PER_YEAR = 60 * 60 * 24 * 365;

export const BROADCAST_POLL_INTERVAL = 600;

// commission_rate pool
export const COMMISSION_RATE = "0.003";

/* network:settings */
export const IBC_TRANSFER_TIMEOUT = 3600;
export const AXIOS_THROTTLE_THRESHOLD = 2000;
export const AXIOS_TIMEOUT = 10000;

// bsc and eth information
export const ETHEREUM_SCAN = "https://etherscan.io";
export const BSC_SCAN = "https://bscscan.com";
export const TRON_SCAN = "https://tronscan.org";
export const KWT_SCAN = "https://scan.kawaii.global";

export const ORAI_BRIDGE_UDENOM = "uoraib";
export const ORAI_BRIDGE_EVM_DENOM_PREFIX = "oraib";
export const ORAI_BRIDGE_EVM_ETH_DENOM_PREFIX = "eth-mainnet";
export const ORAI_BRIDGE_EVM_TRON_DENOM_PREFIX = "trontrx-mainnet";
export const ORAI_BRIDGE_EVM_FEE = "1";
export const ORAI_BRIDGE_CHAIN_FEE = "1";

// bsc contracts
export const ORAI_BSC_CONTRACT = "0xA325Ad6D9c92B55A3Fc5aD7e412B1518F96441C0";
export const AIRI_BSC_CONTRACT = "0x7e2A35C746F2f7C240B664F1Da4DD100141AE71F";
export const USDT_BSC_CONTRACT = "0x55d398326f99059fF775485246999027B3197955";
export const WRAP_BNB_CONTRACT = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
export const KWT_BSC_CONTRACT = "0x257a8d1E03D17B8535a182301f15290F11674b53";
export const MILKY_BSC_CONTRACT = "0x6fE3d0F096FC932A905accd1EB1783F6e4cEc717";
// tron contracts
export const USDT_TRON_CONTRACT = "0xa614f803B6FD780986A42c78Ec9c7f77e6DeD13C";
export const WRAP_TRON_TRX_CONTRACT = "0x891cdb91d149f23B1a45D9c5Ca78a88d0cB44C18";

// erc20 contracts
export const ORAI_ETH_CONTRACT = "0x4c11249814f11b9346808179Cf06e71ac328c1b5";
export const USDC_ETH_CONTRACT = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
export const MILKY_ERC_CONTRACT = "0xd567B3d7B8FE3C79a1AD8dA978812cfC4Fa05e75";
export const WRAP_ETH_CONTRACT = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
export const OCH_ETH_CONTRACT = "0x19373EcBB4B8cC2253D70F2a246fa299303227Ba";
export const KWT_DENOM = ORAI_BRIDGE_EVM_DENOM_PREFIX + KWT_BSC_CONTRACT;
export const MILKY_DENOM = ORAI_BRIDGE_EVM_DENOM_PREFIX + MILKY_BSC_CONTRACT;
export const USDT_ETH_CONTRACT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
export const ORAIX_ETH_CONTRACT = "0x2d869aE129e308F94Cc47E66eaefb448CEe0d03e";

// config for relayer
export const ATOM_ORAICHAIN_CHANNELS = "channel-301 channel-15";
// export const ATOM_ORAICHAIN_CHANNELS="channel-642 channel-124"
export const OSMOSIS_ORAICHAIN_CHANNELS = "channel-216 channel-13";
export const ORAIB_ORAICHAIN_CHANNELS = "channel-1 channel-29";
export const ORAIB_ORAICHAIN_CHANNELS_TEST = "channel-5 channel-64";
export const ORAIB_ORAICHAIN_CHANNELS_OLD = "channel-0 channel-20";
export const KWT_ORAICHAIN_CHANNELS = "channel-0 channel-21";
export const INJECTIVE_ORAICHAIN_CHANNELS = "channel-147 channel-146";
export const NOBLE_ORAICHAIN_CHANNELS = "channel-34 channel-147";
export const NOBLE_ORAICHAIN_CHANNELS_TEST = "channel-35 channel-148";
export const NEUTARO_ORAICHAIN_CHANNELS = "channel-1 channel-189";

// config for ibc denom
export const ATOM_ORAICHAIN_DENOM = "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78";
export const NEUTARO_ORAICHAIN_DENOM = "ibc/576B1D63E401B6A9A071C78A1D1316D016EC9333D2FEB14AD503FAC4B8731CD1";
export const OSMOSIS_ORAICHAIN_DENOM = "ibc/9C4DCD21B48231D0BC2AC3D1B74A864746B37E4292694C93C617324250D002FC";
export const AIRIBSC_ORAICHAIN_DENOM = "ibc/C458B4CC4F5581388B9ACB40774FDFBCEDC77A7F7CDFB112B469794AF86C4A69";
export const USDTBSC_ORAICHAIN_DENOM = "ibc/E8B5509BE79025DD7A572430204271D3061A535CC66A3A28FDEC4573E473F32F";
export const KWTBSC_ORAICHAIN_DENOM = "ibc/4F7464EEE736CCFB6B444EB72DE60B3B43C0DD509FFA2B87E05D584467AAE8C8";
export const MILKYBSC_ORAICHAIN_DENOM = "ibc/E12A2298AC40011C79F02F26C324BD54DF20F4B2904CB9028BFDEDCFAA89B906";
export const KWT_SUB_NETWORK_DENOM = "ibc/E8734BEF4ECF225B71825BC74DE30DCFF3644EAC9778FFD4EF9F94369B6C8377";
export const MILKY_SUB_NETWORK_DENOM = "ibc/81ACD1F7F5380CAA3F590C58C699FBD408B8792F694888D7256EEAF564488FAB";
export const INJECTIVE_ORAICHAIN_DENOM = "ibc/49D820DFDE9F885D7081725A58202ABA2F465CAEE4AFBC683DFB79A8E013E83E";
export const ORAIIBC_INJECTIVE_DENOM = "ibc/C20C0A822BD22B2CEF0D067400FCCFB6FAEEE9E91D360B4E0725BD522302D565";

// config for oraichain token
export const AIRI_CONTRACT = "orai10ldgzued6zjp0mkqwsv2mux3ml50l97c74x8sg";
export const ORAIX_CONTRACT = "orai1lus0f0rhx8s03gdllx2n6vhkmf0536dv57wfge";
export const USDT_CONTRACT = "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh";
export const USDC_CONTRACT = "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd";
export const KWT_CONTRACT = "orai1nd4r053e3kgedgld2ymen8l9yrw8xpjyaal7j5";
export const MILKY_CONTRACT = "orai1gzvndtzceqwfymu2kqhta2jn6gmzxvzqwdgvjw";
export const SCORAI_CONTRACT = "orai1065qe48g7aemju045aeyprflytemx7kecxkf5m7u5h5mphd0qlcs47pclp";
export const TRX_CONTRACT = "orai1c7tpjenafvgjtgm9aqwm7afnke6c56hpdms8jc6md40xs3ugd0es5encn0";
export const SCATOM_CONTRACT = "orai19q4qak2g3cj2xc2y3060t0quzn3gfhzx08rjlrdd3vqxhjtat0cq668phq";
export const XOCH_CONTRACT = "orai1lplapmgqnelqn253stz6kmvm3ulgdaytn89a8mz9y85xq8wd684s6xl3lt";
export const INJECTIVE_CONTRACT = "orai19rtmkk6sn4tppvjmp5d5zj6gfsdykrl5rw2euu5gwur3luheuuusesqn49";
export const WETH_CONTRACT = "orai1dqa52a7hxxuv8ghe7q5v0s36ra0cthea960q2cukznleqhk0wpnshfegez";
export const BTC_CONTRACT = "orai10g6frpysmdgw5tdqke47als6f97aqmr8s3cljsvjce4n5enjftcqtamzsd";
export const OCH_CONTRACT = "orai1hn8w33cqvysun2aujk5sv33tku4pgcxhhnsxmvnkfvdxagcx0p8qa4l98q";

// config for oraichain contract
export const FACTORY_CONTRACT = "orai1hemdkz4xx9kukgrunxu3yw0nvpyxf34v82d2c8";
export const FACTORY_V2_CONTRACT = "orai167r4ut7avvgpp3rlzksz6vw5spmykluzagvmj3ht845fjschwugqjsqhst";
export const ROUTER_V2_CONTRACT = "orai1j0r67r9k8t34pnhy00x3ftuxuwg0r6r4p8p6rrc8az0ednzr8y9s3sj2sf";
export const MIXED_ROUTER = "orai19ffxyc055r6l7nh44dae5fmln2q5quyf2r505w3d36k78hkx4z6qke76q9";
export const ORACLE_CONTRACT = "orai18rgtdvlrev60plvucw2rz8nmj8pau9gst4q07m";
export const STAKING_CONTRACT = "orai19p43y0tqnr5qlhfwnxft2u5unph5yn60y7tuvu";
export const REWARDER_CONTRACT = "orai15hua2q83fp666nwhnyrn9g8gt9ueenl32qnugh";
export const CONVERTER_CONTRACT = "orai14wy8xndhnvjmx6zl2866xqvs7fqwv2arhhrqq9";
export const ORAIDEX_LISTING_CONTRACT = "orai1mkr02jzz0jfh34ps6z966uyueu4tlmnyg57nn72pxfq9t9a706tsha5znh";
export const ORAIDEX_BID_POOL_CONTRACT = "orai1r4v3f8p2xethczvw5l5ed8cr05a9dqp6auy2zmz5dyvcq5h5g5kqg6m7vu";
export const ORAIDEX_SMART_ROUTER_CONTRACT = "orai107rze07vst8gzw82vzds6tvpnf2yru6pgutcfsscvxjww8z88ktsgyqgcm";

// Cw20-staking contract
export const CW20_STAKING_CONTRACT = "orai1xu9yw2xwd55d09pjce28yjklvk2kwwrqw4ql9gvyrs607z26kv0sl99040";
export const CW20_REWARDER_CONTRACT = "orai1qcktymq49m0ylagwt7jzd7u4phajhgk0ruxr0g3ssxyrkte4u9zqy896gf";
export const CW20_SNAPSHOT_CONTRACT = "orai1hmlnhwu3p2kkzac64un5zkz3za8hscklkyaqu4gagdc756zjyemsyp96kd"; // DAODAO support querrier

// config for evm
export const GRAVITY_EVM_CONTRACT = "0x9a0A02B296240D2620E339cCDE386Ff612f07Be5";
// export const GRAVITY_TRON_CONTRACT in tron format TLXrPtQor6xxF2HeQtmKJUUkVNjJZVsgTM
export const GRAVITY_TRON_CONTRACT = "0x73Ddc880916021EFC4754Cb42B53db6EAB1f9D64";

// IBC Wasm contract
export const IBC_WASM_CONTRACT = "orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm";
export const IBC_WASM_CONTRACT_TEST = "orai1jtt8c2lz8emh8s708y0aeduh32xef2rxyg8y78lyvxn806cu7q0sjtxsnv";

// Utiliti contract
export const MULTICALL_CONTRACT = "orai1q7x644gmf7h8u8y6y8t9z9nnwl8djkmspypr6mxavsk9ual7dj0sxpmgwd";

export const BASE_API_URL = "https://api.oraidex.io";

// alpha smart router
export const OSMOSIS_ROUTER_CONTRACT = "osmo1h3jkejkcpthl45xrrm5geed3eq75p5rgfce9taufkwfr89k63muqweu2y7";

// websocket consts
export const WEBSOCKET_RECONNECT_ATTEMPTS = 5;
export const WEBSOCKET_RECONNECT_INTERVAL = 20000;

export const UNISWAP_ROUTER_DEADLINE = 15000; // swap deadline in ms
export const EVM_BALANCE_RETRY_COUNT = 5;

// evm chainID
export enum EVM_CHAIN_ID_COMMON {
  ETH_CHAIN_ID = "0x01",
  BSC_CHAIN_ID = "0x38",
  KAWAII_EVM_CHAIN_ID = "0x1ae6",
  TRON_CHAIN_ID = "0x2b6653dc"
}
// cosmos chainId
export enum COSMOS_CHAIN_ID_COMMON {
  ORAICHAIN_CHAIN_ID = "Oraichain",
  ORAIBRIDGE_CHAIN_ID = "oraibridge-subnet-2",
  OSMOSIS_CHAIN_ID = "osmosis-1",
  COSMOSHUB_CHAIN_ID = "cosmoshub-4",
  INJECTVE_CHAIN_ID = "injective-1",
  KAWAII_COSMOS_CHAIN_ID = "kawaii_6886-1",
  NOBLE_CHAIN_ID = "noble-1"
}

// asset info token
export const ORAI_INFO = {
  native_token: {
    denom: ORAI
  }
};

export const ORAIX_INFO = {
  token: {
    contract_addr: ORAIX_CONTRACT
  }
};

export const ORAIXOCH_INFO = {
  token: {
    contract_addr: XOCH_CONTRACT
  }
};

export const USDC_INFO = {
  token: {
    contract_addr: USDC_CONTRACT
  }
};

export const NEUTARO_INFO = {
  native_token: {
    denom: NEUTARO_ORAICHAIN_DENOM
  }
};

// slippage swap
export const OPTIONS_SLIPPAGE = [1, 3, 5];
export const DEFAULT_SLIPPAGE = OPTIONS_SLIPPAGE[0];
export const DEFAULT_MANUAL_SLIPPAGE = 2.5;

// create cw20 token
export const CODE_ID_CW20 = 761;
export const CW20_DECIMALS = 6;

// type switch wallet between keplr and owallet
export type WalletType = "keplr" | "owallet" | "leapSnap";

export const gravityContracts: Omit<Record<EvmChainId, string>, "0x1ae6"> = {
  "0x38": GRAVITY_EVM_CONTRACT,
  "0x01": GRAVITY_EVM_CONTRACT,
  "0x2b6653dc": GRAVITY_TRON_CONTRACT
};
