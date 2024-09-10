import "dotenv/config";
import { CosmosWalletImpl } from "./offline-wallet";
import { UniversalSwapHandler } from "../handler";
import { flattenTokens, generateError, toAmount } from "@oraichain/oraidex-common";
import TonWallet from "@oraichain/tonbridge-sdk/build/wallet";
const router = {
  swapAmount: "1000000",
  returnAmount: "1000000",
  routes: []
};

const swapFromTonToOthers = async () => {
  const wallet = new CosmosWalletImpl(process.env.MNEMONIC);
  const sender = await wallet.getKeplrAddr("Oraichain");
  const tonWallet = await TonWallet.create("mainnet", {
    mnemonicData: { mnemonic: process.env.TON_MNEMONIC.split(" "), tonWalletVersion: "V5R1" }
  });
  const fromAmount = 3;
  console.log("sender: ", sender);
  console.log("tonWallet: ", tonWallet.sender.address.toString());
  const originalFromToken = flattenTokens.find((t) => t.coinGeckoId === "the-open-network" && t.chainId === "ton");
  const originalToToken = flattenTokens.find((t) => t.coinGeckoId === "the-open-network" && t.chainId === "osmosis-1");

  if (!originalToToken) throw generateError("Could not find original to token");
  if (!originalFromToken) throw generateError("Could not find original from token");

  const universalHandler = new UniversalSwapHandler(
    {
      originalFromToken,
      originalToToken,
      sender: {
        cosmos: sender,
        ton: tonWallet.sender.address.toString()
        // ton: "UQD3zsGYoDGgpambcp7SquM3wJqo6Yc-ksEtCGCDS8JwGQpp"
      },
      relayerFee: {
        relayerAmount: "100000",
        relayerDecimals: 6
      },
      fromAmount,
      userSlippage: 100,
      simulatePrice: "1000000",
      simulateAmount: toAmount(fromAmount, originalToToken.decimals).toString(),
      alphaSmartRoutes: router,
      affiliates: []
    },
    {
      cosmosWallet: wallet,
      tonWallet,
      swapOptions: { isAlphaSmartRouter: true, isIbcWasm: true }
    }
  );

  try {
    const result = await universalHandler.processUniversalSwap();
    console.log("result: ", result);
  } catch (error) {
    console.trace("error: ", error);
  }
};

(() => {
  swapFromTonToOthers();
})();
