import { SimulateCosmWasmClient } from "@oraichain/cw-simulate";
import { IncentivesFundManagerClient, IncentivesFundManagerTypes, OraiswapFactoryClient, OraiswapFactoryTypes, OraiswapMixedRouterClient, OraiswapMixedRouterTypes, OraiswapOracleClient, OraiswapOracleTypes, OraiswapTokenClient, OraiswapTokenTypes, OraiswapV3Client, OraiswapV3Types, ZapperClient, ZapperTypes } from "@oraichain/oraidex-contracts-sdk";
import * as oraidexArtifacts from "@oraichain/oraidex-contracts-build";
import path from "path";
import fs from "fs";
import { MulticallQueryClient } from "@oraichain/common-contracts-sdk";

export const senderAddress = "orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g";
export const bobAddress = "orai1602dkqjvh4s7ryajnz2uwhr8vetrwr8nekpxv5";

export const deployer = "orai1swus8mwu8xjulawqxdwh8hvg4gknh2c64tuc0k";

export const client = new SimulateCosmWasmClient({
  chainId: "Oraichain",
  bech32Prefix: "orai"
});

export const createTokens = async (amount: string, receiver: string, ...symbols: string[]) => {
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
          initial_balances: [{ address: receiver, amount }]
        } as OraiswapTokenTypes.InstantiateMsg,
        "token",
        "oraiswap-token"
      );
      return new OraiswapTokenClient(client, senderAddress, res.contractAddress);
    })
  );

  return tokens.sort((a, b) => a.contractAddress.localeCompare(b.contractAddress));
};

export const deployContract = async (name: string, initMsg: any) => {
  const { codeId } = await client.upload(
    deployer,
    fs.readFileSync(path.resolve(__dirname, "data", `${name}.wasm`)),
    "auto"
  );

  const { contractAddress } = await client.instantiate(
    deployer,
    codeId,
    initMsg,
    name,
    "auto"
  );

  return contractAddress;
};

export const createTokenWithDecimal = async (symbol: string, decimals: number) => {
  const res = await oraidexArtifacts.deployContract(
    client,
    deployer,
    {
      mint: {
        minter: deployer
      },
      decimals,
      symbol,
      name: symbol,
      initial_balances: []
    } as OraiswapTokenTypes.InstantiateMsg,
    "token",
    "oraiswap-token"
  );

  return new OraiswapTokenClient(client, deployer, res.contractAddress);
}

export const deployMultiCall = async () => {
  const res = await deployContract("multicall", {});
  return new MulticallQueryClient(client, res);
}

export const deployIncentivesFundManager = async (msg: IncentivesFundManagerTypes.InstantiateMsg) => {
  const res = await deployContract("incentives-fund-manager", msg);
  return new IncentivesFundManagerClient(client, deployer, res);
};

export const deployDexV3 = async (msg: OraiswapV3Types.InstantiateMsg) => {
  const res = await deployContract("oraiswap-v3", msg);
  return new OraiswapV3Client(client, deployer, res);
}

export const deployOracle = async (msg: OraiswapOracleTypes.InstantiateMsg) => {
  const res = await deployContract("oraiswap-oracle", msg);
  return new OraiswapOracleClient(client, deployer, res);
}

export const deployFactory = async (msg: OraiswapFactoryTypes.InstantiateMsg) => {
  const res = await deployContract("oraiswap-factory", msg);
  return new OraiswapFactoryClient(client, deployer, res);
}

export const deployMixedRouter = async (msg: OraiswapMixedRouterTypes.InstantiateMsg) => {
  const res = await deployContract("oraiswap-mixed-router", msg);
  return new OraiswapMixedRouterClient(client, deployer, res);
}

export const deployZapper = async (msg: ZapperTypes.InstantiateMsg) => {
  const res = await deployContract("zapper", msg);
  return new ZapperClient(client, deployer, res);
}

