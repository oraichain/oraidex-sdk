import "dotenv/config";
import { generateError, OraidexCommon } from "@oraichain/oraidex-common";
import { handleSimulateSwap } from "../helper";

const simulate = async () => {
  const fromAmount = 1;

  const oraidexCommon = await OraidexCommon.load();
  const flattenTokens = oraidexCommon.flattenTokens;

  let originalFromToken = flattenTokens.find((t) => t.chainId === "Oraichain" && t.coinGeckoId === "tether");
  let originalToToken = flattenTokens.find((t) => t.chainId === "Oraichain" && t.coinGeckoId === "oraichain-token");

  if (!originalFromToken) throw generateError("Could not find original from token");
  if (!originalToToken) throw generateError("Could not find original to token");

  try {
    const res = await handleSimulateSwap({
      flattenTokens,
      oraichainTokens: oraidexCommon.oraichainTokens,
      originalFromInfo: originalFromToken,
      originalToInfo: originalToToken,
      originalAmount: fromAmount,
      routerClient: "" as any,
      routerOption: {
        useIbcWasm: true
      },
      routerConfig: {
        url: "https://osor.oraidex.io",
        path: "/smart-router/alpha-router",
        protocols: ["Oraidex", "OraidexV3", "Osmosis"]
      }
    });
    console.log({ res });

  } catch (error) {
    console.log("error: ", error);
  }
};

(async () => {
  return await simulate();
})();
