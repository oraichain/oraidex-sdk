import { EvmChainPrefix } from "@oraichain/oraidex-common";
import { getSendToCosmosEvent } from "./utils/events";

const main = async () => {
  const data = await getSendToCosmosEvent(
    "0x8b3e1dd555e808bc597c8ff9a3740ae24aa31f8864d85a498fe4a2834d4c68cf",
    EvmChainPrefix.BSC_MAINNET
  );
  console.log(data);
};

main();
