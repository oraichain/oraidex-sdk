import { SimulateCosmWasmClient } from "@oraichain/cw-simulate";
import { OraiswapTokenClient } from "@oraichain/oraidex-contracts-sdk";
import { CwIcs20LatestClient, Cw20Coin } from "@oraichain/common-contracts-sdk";
import * as oraidexArtifacts from "@oraichain/oraidex-contracts-build";
import * as commonArtifacts from "@oraichain/common-contracts-build";

export const testSenderAddress = "orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g";
export const mockAccountInfo = {
  jsonrpc: "2.0",
  id: 955129638521,
  result: {
    response: {
      code: 0,
      log: "",
      info: "",
      index: "0",
      key: null,
      value:
        "Cp8BCiAvY29zbW9zLmF1dGgudjFiZXRhMS5CYXNlQWNjb3VudBJ7CitvcmFpMWc0aDY0eWp0MGZ2enY1djJqOHR5Zm5wZTVrbW5ldGVqdmZnczdnEkYKHy9jb3Ntb3MuY3J5cHRvLnNlY3AyNTZrMS5QdWJLZXkSIwohA/7NDxzUr4iFC8PmBZllh5P6RdDtLgnvL32OVolC+2tGGKwQIN0R",
      proofOps: null,
      height: "17608705",
      codespace: ""
    }
  }
};

export const mockSimulate = {
  jsonrpc: "2.0",
  id: 245744838225,
  result: {
    response: {
      code: 0,
      log: "",
      info: "",
      index: "0",
      key: null,
      value:
        "CgQQp6kDEroJCiAKHgocL2Nvc21vcy5iYW5rLnYxYmV0YTEuTXNnU2VuZBLEBVt7ImV2ZW50cyI6W3sidHlwZSI6ImNvaW5fcmVjZWl2ZWQiLCJhdHRyaWJ1dGVzIjpbeyJrZXkiOiJyZWNlaXZlciIsInZhbHVlIjoib3JhaTFnNGg2NHlqdDBmdnp2NXYyajh0eWZucGU1a21uZXRlanZmZ3M3ZyJ9LHsia2V5IjoiYW1vdW50IiwidmFsdWUiOiIxb3JhaSJ9XX0seyJ0eXBlIjoiY29pbl9zcGVudCIsImF0dHJpYnV0ZXMiOlt7ImtleSI6InNwZW5kZXIiLCJ2YWx1ZSI6Im9yYWkxZzRoNjR5anQwZnZ6djV2Mmo4dHlmbnBlNWttbmV0ZWp2ZmdzN2cifSx7ImtleSI6ImFtb3VudCIsInZhbHVlIjoiMW9yYWkifV19LHsidHlwZSI6Im1lc3NhZ2UiLCJhdHRyaWJ1dGVzIjpbeyJrZXkiOiJhY3Rpb24iLCJ2YWx1ZSI6Ii9jb3Ntb3MuYmFuay52MWJldGExLk1zZ1NlbmQifSx7ImtleSI6InNlbmRlciIsInZhbHVlIjoib3JhaTFnNGg2NHlqdDBmdnp2NXYyajh0eWZucGU1a21uZXRlanZmZ3M3ZyJ9LHsia2V5IjoibW9kdWxlIiwidmFsdWUiOiJiYW5rIn1dfSx7InR5cGUiOiJ0cmFuc2ZlciIsImF0dHJpYnV0ZXMiOlt7ImtleSI6InJlY2lwaWVudCIsInZhbHVlIjoib3JhaTFnNGg2NHlqdDBmdnp2NXYyajh0eWZucGU1a21uZXRlanZmZ3M3ZyJ9LHsia2V5Ijoic2VuZGVyIiwidmFsdWUiOiJvcmFpMWc0aDY0eWp0MGZ2enY1djJqOHR5Zm5wZTVrbW5ldGVqdmZnczdnIn0seyJrZXkiOiJhbW91bnQiLCJ2YWx1ZSI6IjFvcmFpIn1dfV19XRoxCgdtZXNzYWdlEiYKBmFjdGlvbhIcL2Nvc21vcy5iYW5rLnYxYmV0YTEuTXNnU2VuZBpVCgpjb2luX3NwZW50EjYKB3NwZW5kZXISK29yYWkxZzRoNjR5anQwZnZ6djV2Mmo4dHlmbnBlNWttbmV0ZWp2ZmdzN2cSDwoGYW1vdW50EgUxb3JhaRpZCg1jb2luX3JlY2VpdmVkEjcKCHJlY2VpdmVyEitvcmFpMWc0aDY0eWp0MGZ2enY1djJqOHR5Zm5wZTVrbW5ldGVqdmZnczdnEg8KBmFtb3VudBIFMW9yYWkajAEKCHRyYW5zZmVyEjgKCXJlY2lwaWVudBIrb3JhaTFnNGg2NHlqdDBmdnp2NXYyajh0eWZucGU1a21uZXRlanZmZ3M3ZxI1CgZzZW5kZXISK29yYWkxZzRoNjR5anQwZnZ6djV2Mmo4dHlmbnBlNWttbmV0ZWp2ZmdzN2cSDwoGYW1vdW50EgUxb3JhaRpACgdtZXNzYWdlEjUKBnNlbmRlchIrb3JhaTFnNGg2NHlqdDBmdnp2NXYyajh0eWZucGU1a21uZXRlanZmZ3M3ZxoZCgdtZXNzYWdlEg4KBm1vZHVsZRIEYmFuaw==",
      proofOps: null,
      height: "17608707",
      codespace: ""
    }
  }
};

export const mockStatus = {
  jsonrpc: "2.0",
  id: 765138518489,
  result: {
    node_info: {
      protocol_version: { p2p: "8", block: "11", app: "0" },
      id: "6ffa64f7e7d78421d43eafa800fb11df3ce9c176",
      listen_addr: "tcp://0.0.0.0:26656",
      network: "Oraichain",
      version: "0.34.29",
      channels: "40202122233038606100",
      moniker: "mainnet-sentry6",
      other: { tx_index: "on", rpc_address: "tcp://0.0.0.0:26657" }
    },
    sync_info: {
      latest_block_hash: "FB98CF714E844680D2F933B630364FFCB665A1525E75AF4E2AE56BC3E10780E2",
      latest_app_hash: "5BED49716F7A9CC54BCDF6F02BBD055546260DEE45F90C4E22665945FF46A1ED",
      latest_block_height: "17608708",
      latest_block_time: "2024-04-03T19:24:02.1973058Z",
      earliest_block_hash: "9C3C6F0A72142BCCE9D52883522D86D7ACDD4B5DB12059C2070AD0847268CE63",
      earliest_app_hash: "E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855",
      earliest_block_height: "1",
      earliest_block_time: "2021-02-23T17:06:00.124468946Z",
      catching_up: false
    },
    validator_info: {
      address: "DB71D3EE07AB06B394915C186C48939887FBDF03",
      pub_key: { type: "tendermint/PubKeyEd25519", value: "QJxO4ljISgXoTU5e48pip/bff80xwLw+RxaDdjM05G0=" },
      voting_power: "0"
    }
  }
};

export const mockResponse = {
  jsonrpc: "2.0",
  id: 961599376562,
  result: {
    code: 0,
    data: "",
    log: "[]",
    codespace: "",
    hash: "2F59A5318ED6350976244EAD25CB78ACFEBC1B9C9A96809269A793EDFB529065"
  }
};

export const mockTxSearch = {
  jsonrpc: "2.0",
  id: 295798615435,
  result: {
    txs: [
      {
        hash: "2F59A5318ED6350976244EAD25CB78ACFEBC1B9C9A96809269A793EDFB529065",
        height: "17608709",
        index: 0,
        tx_result: {
          code: 0,
          data: "",
          log: "",
          info: "",
          gas_wanted: "76215",
          gas_used: "68664",
          events: [],
          codespace: ""
        },
        timestamp: "2024-04-03T19:24:03Z",
        tx: "CogBCoUBChwvY29zbW9zLmJhbmsudjFiZXRhMS5Nc2dTZW5kEmUKK29yYWkxZzRoNjR5anQwZnZ6djV2Mmo4dHlmbnBlNWttbmV0ZWp2ZmdzN2cSK29yYWkxZzRoNjR5anQwZnZ6djV2Mmo4dHlmbnBlNWttbmV0ZWp2ZmdzN2caCQoEb3JhaRIBMRJlClEKRgofL2Nvc21vcy5jcnlwdG8uc2VjcDI1NmsxLlB1YktleRIjCiED/s0PHNSviIULw+YFmWWHk/pF0O0uCe8vfY5WiUL7a0YSBAoCCAEY3RESEAoKCgRvcmFpEgI3NxC30wQaQBfHtIpbY6nu7qqMlhqtIgRK4ID/uoJ2vzPPBapPZNUuRUeTjoisSNSi4eUh26+edx5aiY3dbV+vlVdeaptOxkA="
      }
    ],
    total_count: "1"
  }
};

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
