import { DownloadState } from "@oraichain/cw-simulate";
import { SimulateCosmWasmClient } from "@oraichain/cw-simulate";
import { AIRI_CONTRACT, STAKING_CONTRACT } from '@oraichain/oraidex-common'
import { OraiswapStakingClient } from '@oraichain/oraidex-contracts-sdk'
import { deployContract } from '@oraichain/oraidex-contracts-build'
import path from "path";
import { InstantiateMsg } from "@oraichain/oraidex-contracts-sdk/build/OraiswapStaking.types";

// download state
(async () => {
  // public/wasm/<contract-addr>.state if does not exist => need to be created (<contract-addr>.state can be empty)
  const download = new DownloadState("https://lcd.orai.io", path.join(__dirname, "../", "public/wasm"));
  await download.saveState(STAKING_CONTRACT);
  const senderAddress = "orai1gkr56hlnx9vc7vncln2dkd896zfsqjn300kfq0";
  const client = new SimulateCosmWasmClient({ chainId: "Oraichain", bech32Prefix: "orai" });

  await download.loadState(client, senderAddress, STAKING_CONTRACT, "mainnet staking contract");
  const contract = new OraiswapStakingClient(client, senderAddress, STAKING_CONTRACT);
  const pools = await contract.poolInfo({ assetInfo: { token: { contract_addr: AIRI_CONTRACT } } })
  console.log("pool: ", pools)
  const contractInfo = await client.getContract(STAKING_CONTRACT);
  console.log("contract info: ", contractInfo)

  const deployContractResult = await deployContract(client, senderAddress, { factory_addr: senderAddress, oracle_addr: senderAddress, rewarder: senderAddress } as InstantiateMsg, "staking", "oraiswap_staking");

  const migrateResult = await client.migrate(senderAddress, STAKING_CONTRACT, deployContractResult.codeId, {}, 2000000000);
  console.log("migrate result: ", migrateResult)

  // new key after migrate should be lp token instead of airi

  // console.log(await contract.topHolders({ limit: 30 }));
})();