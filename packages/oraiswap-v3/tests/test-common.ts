import { SimulateCosmWasmClient } from "@oraichain/cw-simulate";
import { OraiswapTokenClient, OraiswapTokenTypes } from "@oraichain/oraidex-contracts-sdk";
import * as oraidexArtifacts from "@oraichain/oraidex-contracts-build";

export const senderAddress = "orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g";
export const bobAddress = "orai1602dkqjvh4s7ryajnz2uwhr8vetrwr8nekpxv5";

export const client = new SimulateCosmWasmClient({
  chainId: "Oraichain",
  bech32Prefix: "orai"
});

export const createTokens = async (amount: string, ...symbols: string[]) => {
  // init airi token
  const tokens = await Promise.all(
    symbols.map(async (symbol) => {
      const res = await oraidexArtifacts.deployContract(
        client,
        senderAddress,
        {
          mint: {
            minter: senderAddress
          },
          decimals: 6,
          symbol,
          name: symbol,
          initial_balances: [{ address: senderAddress, amount }]
        } as OraiswapTokenTypes.InstantiateMsg,
        "token",
        "oraiswap-token"
      );
      return new OraiswapTokenClient(client, senderAddress, res.contractAddress);
    })
  );

  return tokens.sort((a, b) => a.contractAddress.localeCompare(b.contractAddress));
};
