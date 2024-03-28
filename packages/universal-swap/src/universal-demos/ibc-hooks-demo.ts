import "dotenv/config";
import { CosmosWalletImpl } from "./offline-wallet";
import { UniversalSwapHandler } from "../handler";
import {
  CoinGeckoId,
  KWT_BSC_CONTRACT,
  USDC_CONTRACT,
  cosmosTokens,
  flattenTokens,
  generateError,
  getTokenOnOraichain,
  toAmount
} from "@oraichain/oraidex-common";

const cosmosToOraichain = async (
  chainId: "cosmoshub-4" | "osmosis-1" | "injective-1",
  toTokenCoingeckoId: CoinGeckoId
) => {
  const wallet = new CosmosWalletImpl(process.env.MNEMONIC);
  // ORAI oraichain -> ORAI injective
  // const originalFromToken = getTokenOnOraichain("oraichain-token");
  // const originalToToken = cosmosTokens.find((t) => t.chainId === chainId && t.denom === ORAIIBC_INJECTIVE_DENOM);

  // INJ oraichain -> ORAI injective
  // const originalFromToken = getTokenOnOraichain("injective-protocol");
  // const originalToToken = cosmosTokens.find((t) => t.chainId === chainId && t.denom === ORAIIBC_INJECTIVE_DENOM);

  // ORAI oraichain -> INJ injective
  // const originalFromToken = getTokenOnOraichain("oraichain-token");
  // const originalToToken = cosmosTokens.find((t) => t.chainId === chainId && t.denom === "inj");

  // INJ oraichain -> INJ injective
  // const originalFromToken = getTokenOnOraichain("injective-protocol");
  // const originalToToken = cosmosTokens.find((t) => t.chainId === chainId && t.denom === "inj");

  // KWT oraichain -> USDT oraichain
  // const originalFromToken = getTokenOnOraichain("kawaii-islands");
  // const originalToToken = getTokenOnOraichain("tether");

  // INJ oraichain -> USDT oraichain
  // const originalFromToken = getTokenOnOraichain("injective-protocol");
  // const originalToToken = getTokenOnOraichain("tether");

  // USDT oraichain -> INJ injective
  // const originalFromToken = getTokenOnOraichain("tether");
  // const originalToToken = cosmosTokens.find((t) => t.chainId === chainId && t.denom === "inj");

  // USDT BNB -> USDT oraichain
  // const originalToToken = getTokenOnOraichain("tether");
  // const originalFromToken = flattenTokens.find((t) => t.chainId === "0x38" && t.coinGeckoId === "tether");

  // KWT BNB -> KWT oraichain
  const originalFromToken = flattenTokens.find((t) => t.chainId === "0x38" && t.coinGeckoId === "kawaii-islands");
  const originalToToken = getTokenOnOraichain("kawaii-islands");

  // NTMPI TIMPI -> NTMPI oraichain
  // const originalFromToken = flattenTokens.find((t) => t.chainId === "Neutaro-1" && t.coinGeckoId === "neutaro");
  // const originalToToken = getTokenOnOraichain("neutaro");

  // OCH eth -> OCH oraichain
  // const originalFromToken = flattenTokens.find((t) => t.chainId === "0x01" && t.coinGeckoId === "och");
  // const originalToToken = getTokenOnOraichain("och");

  // USDC Noble -> USDC oraichain
  // const originalFromToken = flattenTokens.find((t) => t.chainId === "Neutaro-1" && t.coinGeckoId === "neutaro");
  // const originalToToken = getTokenOnOraichain("neutaro");

  // KWT oraichain -> KWT BNB Chain
  // const originalFromToken = getTokenOnOraichain("kawaii-islands");
  // const originalToToken = flattenTokens.find((t) => t.chainId === "0x38" && t.contractAddress === KWT_BSC_CONTRACT);

  // KWT oraichain -> KWT Kawaiiverse
  // const originalFromToken = getTokenOnOraichain("kawaii-islands");
  // const originalToToken = flattenTokens.find((t) => t.chainId === "kawaii_6886-1" && t.denom === "oraie");

  // USDT BNB -> USDT oraichain
  // const originalFromToken = getTokenOnOraichain("tether");
  // const originalToToken = flattenTokens.find((t) => t.chainId === "0x38" && t.coinGeckoId === "tether");

  // const [nativeAmount, cw20Amount] = await Promise.all([
  //   client.getBalance(this.swapData.sender.cosmos, toTokenInOrai.denom),
  //   client.queryContractSmart(originalFromToken.contractAddress, {
  //     balance: {
  //       address: this.swapData.sender.cosmos
  //     }
  //   })
  // ]);

  // amountsBalance = {
  //   [toTokenInOrai.denom]: nativeAmount?.amount,
  //   [originalFromToken.denom]: cw20Amount?.balance
  // };

  const amounts = {
    injective: "461973",
    "ibc/49D820DFDE9F885D7081725A58202ABA2F465CAEE4AFBC683DFB79A8E013E83E": "0",
    "ibc/4F7464EEE736CCFB6B444EB72DE60B3B43C0DD509FFA2B87E05D584467AAE8C8": "8909483553998500000000",
    kwt: "0"
  };

  const sender = await wallet.getKeplrAddr("Oraichain");

  if (!originalFromToken) throw generateError("Could not find original from token");
  if (!originalToToken) throw generateError("Could not find original to token");
  console.log({
    originalToToken,
    originalFromToken
  });

  const universalHandler = new UniversalSwapHandler(
    {
      originalFromToken,
      originalToToken,
      sender: { cosmos: sender, evm: "0x8c7E0A841269a01c0Ab389Ce8Fb3Cf150A94E797" },
      fromAmount: 1000,
      userSlippage: 1,
      amounts,
      simulateAmount: toAmount(1000, originalToToken.decimals).toString()
      // simulateAmount: "10000"
    },
    { cosmosWallet: wallet }
  );

  try {
    const result = await universalHandler.processUniversalSwap();
    console.log("result: ", result);
  } catch (error) {
    console.trace("error: ", error);
  }
};

(() => {
  cosmosToOraichain("injective-1", "tether");
})();
