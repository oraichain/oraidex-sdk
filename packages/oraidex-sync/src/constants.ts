import {
  FACTORY_CONTRACT,
  FACTORY_V2_CONTRACT,
  MULTICALL_CONTRACT,
  ROUTER_V2_CONTRACT,
  STAKING_CONTRACT
} from "@oraichain/oraidex-common/build/constant";
import { AssetInfo } from "@oraichain/oraidex-contracts-sdk";

export const ORAI = "orai";
export const airiCw20Adress = "orai10ldgzued6zjp0mkqwsv2mux3ml50l97c74x8sg";
export const oraixCw20Address = "orai1lus0f0rhx8s03gdllx2n6vhkmf0536dv57wfge";
export const usdtCw20Address = "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh";
export const kwtCw20Address = "orai1nd4r053e3kgedgld2ymen8l9yrw8xpjyaal7j5";
export const milkyCw20Address = "orai1gzvndtzceqwfymu2kqhta2jn6gmzxvzqwdgvjw";
export const scAtomCw20Address = "orai19q4qak2g3cj2xc2y3060t0quzn3gfhzx08rjlrdd3vqxhjtat0cq668phq";
export const tronCw20Address = "orai1c7tpjenafvgjtgm9aqwm7afnke6c56hpdms8jc6md40xs3ugd0es5encn0";
export const scOraiCw20Address = "orai1065qe48g7aemju045aeyprflytemx7kecxkf5m7u5h5mphd0qlcs47pclp";
export const usdcCw20Address = "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd";
export const atomIbcDenom = "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78";
export const osmosisIbcDenom = "ibc/9C4DCD21B48231D0BC2AC3D1B74A864746B37E4292694C93C617324250D002FC";
export const injAddress = "orai19rtmkk6sn4tppvjmp5d5zj6gfsdykrl5rw2euu5gwur3luheuuusesqn49";
export const tenAmountInDecimalSix = 10000000;
export const truncDecimals = 6;
export const atomic = 10 ** truncDecimals;
export const oraiInfo: AssetInfo = { native_token: { denom: ORAI } };
export const usdtInfo: AssetInfo = { token: { contract_addr: usdtCw20Address } };
export const ORAIXOCH_INFO = {
  token: {
    contract_addr: "orai1lplapmgqnelqn253stz6kmvm3ulgdaytn89a8mz9y85xq8wd684s6xl3lt"
  }
};
export const OCH_PRICE = 0.4; // usdt

export const DAYS_PER_WEEK = 7;
export const DAYS_PER_YEAR = 365;
export const SEC_PER_YEAR = 60 * 60 * 24 * 365;
export const network = {
  factory: FACTORY_CONTRACT,
  factory_v2: FACTORY_V2_CONTRACT,
  router: ROUTER_V2_CONTRACT,
  staking: STAKING_CONTRACT,
  multicall: MULTICALL_CONTRACT
};

export const DEFAULT_WS_PORT = 2025;
