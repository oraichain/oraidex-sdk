import { DownloadState } from "@oraichain/cw-simulate";
import { SimulateCosmWasmClient } from "@oraichain/cw-simulate";
import { AIRI_CONTRACT, STAKING_CONTRACT } from "@oraichain/oraidex-common";
import path from "path";
import { readFileSync } from "fs";

// download state
const download = new DownloadState("https://lcd.orai.io", path.join(__dirname, "wasm"));
// await download.saveState(STAKING_CONTRACT);

const senderAddress = "orai1gkr56hlnx9vc7vncln2dkd896zfsqjn300kfq0";
const client = new SimulateCosmWasmClient({ chainId: "Oraichain", bech32Prefix: "orai" });
await download.loadState(client, senderAddress, STAKING_CONTRACT, "mainnet staking contract");
const pool = await client.queryContractSmart(STAKING_CONTRACT, {
  pool_info: { asset_info: { token: { contract_addr: AIRI_CONTRACT } } }
});
console.log("pool: ", pool);

const rewardsInfo = await client.queryContractSmart(STAKING_CONTRACT, {reward_infos: {asset_info: {token: {contract_addr: AIRI_CONTRACT}}}})
console.log("reward info: ", rewardsInfo)

// cwtools build ../oraiswap/contracts/* ../oraidex-listing-contract -o packages/contracts-build/data
const { codeId } = await client.upload(
  senderAddress,
  readFileSync(path.join(__dirname, "../..", "contracts-build/data/oraiswap_staking.wasm")),
  "auto"
);

const migrateResult = await client.migrate(senderAddress, STAKING_CONTRACT, codeId, {}, "auto");
console.log("migrate result: ", migrateResult);

const newRewardsInfo = await client.queryContractSmart(STAKING_CONTRACT, {reward_infos: {staking_token: pool.staking_token}})

console.log("new rewards info: ", newRewardsInfo);

const totalPoolKeys = await client.queryContractSmart(STAKING_CONTRACT, {total_pool_asset_keys: {}});
console.log("total: ", totalPoolKeys)
