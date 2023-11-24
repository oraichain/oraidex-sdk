import { DownloadState, SimulateCosmWasmClient } from "@oraichain/cw-simulate";
import {
  AssetInfo,
  OraiswapFactoryQueryClient,
  OraiswapRewarderClient,
  OraiswapStakingClient
} from "@oraichain/oraidex-contracts-sdk";
import { REWARDER_CONTRACT, STAKING_CONTRACT } from "@oraichain/oraidex-common";
import path from "path";
import { existsSync, readFileSync } from "fs";
import { network } from "../constants";
import { queryAllPairInfos } from "../";
import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
const client = new SimulateCosmWasmClient({ chainId: "Oraichain", bech32Prefix: "orai" });

const downloadPath = path.join(__dirname, "./wasm");
// download state
const download = new DownloadState("https://lcd.orai.io", downloadPath);

export async function getMigrateStakingV3Client() {
  // await download.saveState(STAKING_CONTRACT);
  const toAssetInfo = (info: string): AssetInfo => {
    if (info[0] === "i") return { native_token: { denom: info } };
    return { token: { contract_addr: info } };
  };

  const oldAssetKeys = [
    "orai19q4qak2g3cj2xc2y3060t0quzn3gfhzx08rjlrdd3vqxhjtat0cq668phq",
    "orai19rtmkk6sn4tppvjmp5d5zj6gfsdykrl5rw2euu5gwur3luheuuusesqn49",
    "orai1gzvndtzceqwfymu2kqhta2jn6gmzxvzqwdgvjw",
    "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh",
    "ibc/4F7464EEE736CCFB6B444EB72DE60B3B43C0DD509FFA2B87E05D584467AAE8C8",
    "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
    "ibc/9C4DCD21B48231D0BC2AC3D1B74A864746B37E4292694C93C617324250D002FC",
    "ibc/9E4F68298EE0A201969E583100E5F9FAD145BAA900C04ED3B6B302D834D8E3C4",
    "ibc/BA44E90EAFEA8F39D87A94A4A61C9FFED5887C2730DFBA668C197BA331372859",
    "orai1065qe48g7aemju045aeyprflytemx7kecxkf5m7u5h5mphd0qlcs47pclp",
    "orai10ldgzued6zjp0mkqwsv2mux3ml50l97c74x8sg",
    "orai1nd4r053e3kgedgld2ymen8l9yrw8xpjyaal7j5",
    "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd",
    "orai1c7tpjenafvgjtgm9aqwm7afnke6c56hpdms8jc6md40xs3ugd0es5encn0",
    "orai1l22k254e8rvgt5agjm3nn9sy0cmvhjmhd6ew6shacfmexkgzymhsyc2sr2",
    "orai1lus0f0rhx8s03gdllx2n6vhkmf0536dv57wfge",
    "orai1llsm2ly9lchj006cw2mmlu8wmhr0sa988sp3m5"
  ];

  const oldAssetInfos = oldAssetKeys.map(toAssetInfo);

  const senderAddress = "orai1gkr56hlnx9vc7vncln2dkd896zfsqjn300kfq0";
  const owner = "orai1fs25usz65tsryf0f8d5cpfmqgr0xwup4kjqpa0";

  await download.loadState(client, senderAddress, STAKING_CONTRACT, "mainnet staking contract");

  const oldPools = [];
  for (const oldInfo of oldAssetInfos) {
    const pool = await client.queryContractSmart(STAKING_CONTRACT, {
      pool_info: { asset_info: oldInfo }
    });
    oldPools.push(pool);
  }

  // cwtools build ../oraiswap/contracts/* ../oraidex-listing-contract -o packages/contracts-build/data
  const { codeId } = await client.upload(
    senderAddress,
    readFileSync(path.join(__dirname, "./migrate/oraiswap_staking.wasm")),
    "auto"
  );

  const migrateResult = await client.migrate(senderAddress, STAKING_CONTRACT, codeId, {}, "auto");
  console.log("migrate result: ", migrateResult);

  // load state & migrate for rewarder contract
  await download.loadState(client, senderAddress, REWARDER_CONTRACT, "mainnet rewarder contract");
  const { codeId: rewarderNewCodeId } = await client.upload(
    senderAddress,
    readFileSync(path.join(__dirname, "./migrate/oraiswap_rewarder.wasm")),
    "auto"
  );
  const rewarderMigrateResult = await client.migrate(senderAddress, REWARDER_CONTRACT, rewarderNewCodeId, {}, "auto");
  console.log("rewarder migrate result: ", rewarderMigrateResult);
  const newStakingInstance = new OraiswapStakingClient(client, owner, STAKING_CONTRACT);
  for (const assetKey of oldAssetInfos) {
    await newStakingInstance.migrateStore({ assetInfo: assetKey });
  }

  const config = await newStakingInstance.config();
  console.log("config: ", config);
  const unlockContractResult = await newStakingInstance.updateConfig({ migrateStoreStatus: true });
  console.log("unlock contract status: ", unlockContractResult);

  const rewarderContract = new OraiswapRewarderClient(client, owner, REWARDER_CONTRACT);
  const distributeResult = await rewarderContract.distribute({ stakingTokens: [oldPools[5].staking_token] });
  console.log("Distribute result at tx:", distributeResult.transactionHash);

  // load used contract
  // await download.saveState(network.factory);
  // await download.saveState(network.factory_v2);
  // await download.saveState(network.multicall);
  // await download.saveState(network.router);
  await download.loadState(client, senderAddress, network.factory, "factory contract");
  await download.loadState(client, senderAddress, network.factory_v2, "factory_v2 contract");
  await download.loadState(client, senderAddress, network.multicall, "multicall contract");
  await download.loadState(client, senderAddress, network.router, "router contract");

  const firstFactoryClient = new OraiswapFactoryQueryClient(client, network.factory);
  const secondFactoryClient = new OraiswapFactoryQueryClient(client, network.factory_v2);

  const allPairsInfo = await queryAllPairInfos(firstFactoryClient, secondFactoryClient);
  for (const pairInfo of allPairsInfo) {
    console.log("pair info: ", pairInfo.contract_addr);
    await Promise.all(
      pairInfo.asset_infos.map(async (info) => {
        if ("token" in info) {
          console.log("token pair addr: ", info.token.contract_addr);
          if (!existsSync(path.join(__dirname, `./wasm/${info.token.contract_addr}`))) {
            console.log("download token info contract: ", info.token.contract_addr);
            await download.saveState(info.token.contract_addr);
          }
          await download.loadState(client, senderAddress, info.token.contract_addr, "token contract");
        } else {
          const cosmosClient = await CosmWasmClient.connect("https://rpc.orai.io");
          const balance = await cosmosClient.getBalance(pairInfo.contract_addr, info.native_token.denom);
          client.app.bank.setBalance(pairInfo.contract_addr, [balance]);
        }
      })
    );
    if (!existsSync(path.join(__dirname, `./wasm/${pairInfo.contract_addr}`))) {
      console.log("download pair info: ", pairInfo.contract_addr);
      await download.saveState(pairInfo.contract_addr);
    }
    if (!existsSync(path.join(__dirname, `./wasm/${pairInfo.liquidity_token}`))) {
      console.log("download liquidity token: ", pairInfo.liquidity_token);
      await download.saveState(pairInfo.liquidity_token);
    }
    await download.loadState(client, senderAddress, pairInfo.liquidity_token, "liquidity token contract");
    await download.loadState(client, senderAddress, pairInfo.contract_addr, "pairt contract");
  }
}

// getMigrateStakingV3Client();
export default client;
