import { DownloadState } from "@oraichain/cw-simulate";
import { SimulateCosmWasmClient } from "@oraichain/cw-simulate";
import { AIRI_CONTRACT, STAKING_CONTRACT } from '@oraichain/oraidex-common'
import { OraiswapStakingClient } from '@oraichain/oraidex-contracts-sdk'
import path from "path";
import { readFileSync } from "fs";

// download state
(async () => {
  // public/wasm/<contract-addr>.state if does not exist => need to be created (<contract-addr>.state can be empty)
  const download = new DownloadState("https://lcd.orai.io", path.join(__dirname, "../", "public/wasm"));
  await download.saveState(STAKING_CONTRACT, "AAlyZXdhcmRfdjIAFN4pl1aTsDjbPoftifQgypuRL4PCaWJjL0EyRTJFRUM5MDU3QTRBMUMyQzBBNkE0Qzc4QjAyMzkxMThERjVGMjc4ODMwRjUwQjRBNkJERDdBNjY1MDZCNzg=");
  const senderAddress = "orai1gkr56hlnx9vc7vncln2dkd896zfsqjn300kfq0";
  const client = new SimulateCosmWasmClient({ chainId: "Oraichain", bech32Prefix: "orai" });

  await download.loadState(client, senderAddress, STAKING_CONTRACT, "mainnet staking contract");
  const pools = await client.queryContractSmart(STAKING_CONTRACT, { pool_info: { asset_info: { token: { contract_addr: AIRI_CONTRACT } } } })
  console.log("pool: ", pools)

  const deployContractResult = await client.upload(senderAddress, readFileSync(path.join(__dirname, '../..', 'contracts-build/data/oraiswap_staking.wasm')), 20000000);

  const migrateResult = await client.migrate(senderAddress, STAKING_CONTRACT, deployContractResult.codeId, {}, 2000000000);
  console.log("migrate result: ", migrateResult)

  const newStakingContract = new OraiswapStakingClient(client, senderAddress, STAKING_CONTRACT);
  const pool = await newStakingContract.poolInfo({ stakingToken: pools.staking_token });
  console.log("pool: ", pool)

  // new key after migrate should be lp token instead of airi

  // console.log(await contract.topHolders({ limit: 30 }));
})();