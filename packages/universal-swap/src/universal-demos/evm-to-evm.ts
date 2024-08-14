import "dotenv/config";
import { CosmosWalletImpl } from "./offline-wallet";
import { UniversalSwapHandler } from "../handler";
import {
  ORAI_ETH_CONTRACT,
  cosmosTokens,
  flattenTokens,
  generateError,
  toAmount,
  USDT_CONTRACT,
  ORAI_BSC_CONTRACT,
  EVM_CHAIN_ID_COMMON,
  USDT_BSC_CONTRACT,
  COSMOS_CHAIN_ID_COMMON
} from "@oraichain/oraidex-common";

const evmToEvm = async () => {
  const fromAmount = 1;
  const wallet = new CosmosWalletImpl(process.env.MNEMONIC);

  const sender = await wallet.getKeplrAddr("Oraichain");
  let originalFromToken = flattenTokens.find(
    (t) => t.chainId === EVM_CHAIN_ID_COMMON.BSC_CHAIN_ID && t.coinGeckoId === "oraichain-token"
  );

  let originalToToken = flattenTokens.find(
    (t) => t.chainId === COSMOS_CHAIN_ID_COMMON.ORAICHAIN_CHAIN_ID && t.coinGeckoId === "tether"
  );
  const evmAddress = "0xf2846a1E4dAFaeA38C1660a618277d67605bd2B5";
  if (!originalFromToken) throw generateError("Could not find original from token");
  if (!originalToToken) throw generateError("Could not find original to token");
  const universalHandler = new UniversalSwapHandler(
    {
      originalFromToken,
      originalToToken,
      sender: {
        evm: evmAddress,
        cosmos: sender
      },
      relayerFee: {
        relayerAmount: "100000",
        relayerDecimals: 6
      },
      simulatePrice: "100000",
      userSlippage: 1,
      fromAmount,
      simulateAmount: toAmount(fromAmount, originalToToken.decimals).toString()
    },
    {
      cosmosWallet: wallet,
      evmWallet: undefined,
      swapOptions: {
        isAlphaSmartRouter: true
      }
    }
  );

  try {
    const result = await universalHandler.processUniversalSwap();
    console.log("result: ", result);
  } catch (error) {
    console.log("error: ", error);
  }
};

(() => {
  return evmToEvm();
})();
