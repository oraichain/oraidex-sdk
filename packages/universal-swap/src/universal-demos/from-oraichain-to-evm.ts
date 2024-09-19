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
  const fromAmount = 10000;
  let originalToToken = flattenTokens.find((t) => t.chainId === chainId && t.coinGeckoId === "pepe");

  let originalFromToken = flattenTokens.find((t) => t.chainId === "0x38" && t.coinGeckoId === "pepe");

  if (!originalFromToken) throw generateError("Could not find original from token");
  if (!originalToToken) throw generateError("Could not find original to token");

  console.log({
    originalToToken,
    originalFromToken
  });

  // const smartRoutes = await UniversalSwapHelper.simulateSwapUsingSmartRoute({
  //   fromInfo: originalFromToken,
  //   toInfo: originalToToken,
  //   amount: toAmount(fromAmount, originalToToken.decimals).toString()
  // });

  // console.log("expected amount: ", smartRoutes.returnAmount);
  const universalHandler = new UniversalSwapHandler(
    {
      originalFromToken,
      originalToToken,
      sender: { cosmos: sender, evm: "0x8c7E0A841269a01c0Ab389Ce8Fb3Cf150A94E797" },
      relayerFee: {
        relayerAmount: "100000",
        relayerDecimals: 6
      },
      simulatePrice: "10000000",
      fromAmount,
      simulateAmount: toAmount(fromAmount, originalToToken.decimals).toString(),
      userSlippage: 1
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
