import * as commonArtifacts from "@oraichain/common-contracts-build";
import { Cw20Coin, CwIcs20LatestClient } from "@oraichain/common-contracts-sdk";
import { SimulateCosmWasmClient } from "@oraichain/cw-simulate";
import * as oraidexArtifacts from "@oraichain/oraidex-contracts-build";
import { OraiswapTokenClient } from "@oraichain/oraidex-contracts-sdk";

export const testSenderAddress = "orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g";

export const client = new SimulateCosmWasmClient({
  chainId: "Oraichain",
  bech32Prefix: "orai"
});

export const deployToken = async (
  client: SimulateCosmWasmClient,
  {
    symbol,
    name,
    decimals = 6,
    initial_balances = [{ address: testSenderAddress, amount: "1000000000" }]
  }: { symbol: string; name: string; decimals?: number; initial_balances?: Cw20Coin[] }
): Promise<OraiswapTokenClient> => {
  return new OraiswapTokenClient(
    client,
    testSenderAddress,
    (
      await oraidexArtifacts.deployContract(
        client,
        testSenderAddress,

        {
          decimals,
          symbol,
          name,
          mint: { minter: testSenderAddress },
          initial_balances
        },
        "token",
        "oraiswap-token"
      )
    ).contractAddress
  );
};

export const deployIcs20Token = async (
  client: SimulateCosmWasmClient,
  { swap_router_contract, gov_contract = testSenderAddress }: { gov_contract?: string; swap_router_contract: string }
): Promise<CwIcs20LatestClient> => {
  const { contractAddress } = await commonArtifacts.deployContract(
    client,
    testSenderAddress,
    {
      allowlist: [],
      default_timeout: 3600,
      gov_contract,
      swap_router_contract
    },
    "cw-ics20-latest",
    "cw-ics20-latest"
  );
  return new CwIcs20LatestClient(client, testSenderAddress, contractAddress);
};
