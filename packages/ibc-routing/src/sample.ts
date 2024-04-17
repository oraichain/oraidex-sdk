import { EvmChainPrefix } from "@oraichain/oraidex-common";
import { getSendToCosmosEvent } from "./utils/events";

const main = async () => {
  const data = await getSendToCosmosEvent(
    "0x518f5351515bdfc3bce2ad99156171beb66b864d15a8e3ee3eb2e65000d1149f",
    EvmChainPrefix.BSC_MAINNET
  );
  console.log(data);
};

main();
