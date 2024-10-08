import "dotenv/config";
import { flattenTokens, generateError } from "@oraichain/oraidex-common";
import { handleSimulateSwap } from "../helper";

const simulate = async () => {
  const fromAmount = 1;
  let originalFromToken = flattenTokens.find((t) => t.chainId === "0x38" && t.coinGeckoId === "oraichain-token");
  let originalToToken = flattenTokens.find((t) => t.chainId === "Oraichain" && t.coinGeckoId === "oraichain-token");

  if (!originalFromToken) throw generateError("Could not find original from token");
  if (!originalToToken) throw generateError("Could not find original to token");

  try {
    const res = await handleSimulateSwap({
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
  } catch (error) {
    console.log("error: ", error);
  }
};

(async () => {
  return await simulate();
})();
