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
const pools = await client.queryContractSmart(STAKING_CONTRACT, {
  pool_info: { asset_info: { token: { contract_addr: AIRI_CONTRACT } } }
});
console.log("pool: ", pools);

// cwtools build ../oraiswap/contracts/oraiswap_staking -o packages/contract-state-simulate/src/wasm
const { codeId } = await client.upload(
  senderAddress,
  readFileSync(path.join(__dirname, "wasm", "oraiswap_staking.wasm")),
  "auto"
);

const migrateResult = await client.migrate(senderAddress, STAKING_CONTRACT, codeId, {}, "auto");
console.log("migrate result: ", migrateResult);

// const newStakingContract = new OraiswapStakingClient(client, senderAddress, STAKING_CONTRACT);
// const pool = await newStakingContract.poolInfo({ stakingToken: pools.staking_token });
// console.log("pool: ", pool)

// new key after migrate should be lp token instead of airi

// console.log(await contract.topHolders({ limit: 30 }));
// })();
