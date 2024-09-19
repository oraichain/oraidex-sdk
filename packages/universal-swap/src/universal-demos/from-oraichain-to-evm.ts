import "dotenv/config";
import { CosmosWalletImpl } from "./offline-wallet";
import { UniversalSwapHandler } from "../handler";
import { flattenTokens, generateError, toAmount } from "@oraichain/oraidex-common";
import { UniversalSwapHelper } from "../helper";

const oraichainToEvm = async () => {
  console.log({ abc: "11111" });

  const chainId = "Oraichain";
  const wallet = new CosmosWalletImpl(process.env.MNEMONIC);

  const sender = await wallet.getKeplrAddr(chainId);
  const fromAmount = 100;
  let originalFromToken = flattenTokens.find((t) => t.chainId === chainId && t.coinGeckoId === "pepe");

  let originalToToken = flattenTokens.find((t) => t.chainId === "0x38" && t.coinGeckoId === "pepe");

  if (!originalFromToken) throw generateError("Could not find original from token");
  if (!originalToToken) throw generateError("Could not find original to token");

  const smartRoutes = await UniversalSwapHelper.simulateSwapUsingSmartRoute({
    fromInfo: originalFromToken,
    toInfo: originalToToken,
    amount: toAmount(fromAmount, originalToToken.decimals).toString()
  });

  console.log("expected amount: ", smartRoutes.returnAmount);
  const universalHandler = new UniversalSwapHandler(
    {
      originalFromToken,
      originalToToken,
      sender: { cosmos: sender },
      relayerFee: {
        relayerAmount: "0",
        relayerDecimals: 6
      },
      simulatePrice: "1",
      fromAmount,
      simulateAmount: toAmount(fromAmount, originalToToken.decimals).toString(),
      userSlippage: 0.01
    },
    { cosmosWallet: wallet, swapOptions: {} }
  );

  try {
    const result = await universalHandler.processUniversalSwap();
    console.log("result: ", result);
  } catch (error) {
    console.log("error: ", error);
  }
};

(() => {
  return oraichainToEvm();
})();
