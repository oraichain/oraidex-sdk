import "dotenv/config";
import { CosmosWalletImpl } from "./offline-wallet";
import { UniversalSwapHandler } from "../handler";
import { USDC_CONTRACT, cosmosTokens, generateError } from "@oraichain/oraidex-common";

const basicCosmosIbcTransfer = async () => {
  const wallet = new CosmosWalletImpl(process.env.MNEMONIC);
  const sender = await wallet.getKeplrAddr("noble-1");
  const fromAmount = 0.000001;
  console.log("sender: ", sender);
  const originalFromToken = cosmosTokens.find((t) => t.chainId === "noble-1" && t.denom === "uusdc");
  const originalToToken = cosmosTokens.find(
    (t) => t.chainId === "Oraichain" && t.contractAddress && t.contractAddress === USDC_CONTRACT
  );
  if (!originalFromToken) throw generateError("Could not find original from token");
  if (!originalToToken) throw generateError("Could not find original to token");
  const universalHandler = new UniversalSwapHandler(
    { originalFromToken, originalToToken, sender: { cosmos: sender }, fromAmount },
    { cosmosWallet: wallet, ibcInfoTestMode: true }
  );

  try {
    const result = await universalHandler.processUniversalSwap();
    console.log("result: ", result);
  } catch (error) {
    console.log("error: ", error);
  }
};

basicCosmosIbcTransfer();
