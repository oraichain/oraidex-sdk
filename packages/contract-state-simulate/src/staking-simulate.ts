import { DownloadState } from "@oraichain/cw-simulate";
import { SimulateCosmWasmClient } from "@oraichain/cw-simulate";
import { AIRI_CONTRACT, ATOM_ORAICHAIN_DENOM, INJECTIVE_CONTRACT, KWT_CONTRACT, MILKY_CONTRACT, ORAIX_CONTRACT, OSMOSIS_ORAICHAIN_DENOM, SCATOM_CONTRACT, SCORAI_CONTRACT, STAKING_CONTRACT, TRX_CONTRACT, USDC_CONTRACT } from "@oraichain/oraidex-common";
import path from "path";
import { readFileSync } from "fs";
import { OraiswapStakingClient } from "@oraichain/oraidex-contracts-sdk";

// download state
const download = new DownloadState("https://lcd.orai.io", path.join(__dirname, "wasm"));
// await download.saveState(STAKING_CONTRACT);

const oldAssetKeys = [
  {
      "native_token": {
          "denom": ATOM_ORAICHAIN_DENOM
      }
  },
  {
      "native_token": {
          "denom": OSMOSIS_ORAICHAIN_DENOM
      }
  },
  {
      "token": {
          "contract_addr": AIRI_CONTRACT
      }
  },
  {
      "token": {
          "contract_addr": USDC_CONTRACT
      }
  },
  {
      "token": {
          "contract_addr": ORAIX_CONTRACT
      }
  },
  {
      "token": {
          "contract_addr": KWT_CONTRACT
      }
  },
  {
      "token": {
          "contract_addr": MILKY_CONTRACT
      }
  },
  {
      "token": {
          "contract_addr": SCORAI_CONTRACT
      }
  },
  {
      "token": {
          "contract_addr": USDC_CONTRACT
      }
  },
  {
      "token": {
          "contract_addr": TRX_CONTRACT
      }
  },
  {
      "token": {
          "contract_addr": SCATOM_CONTRACT
      }
  },
  {
      "token": {
          "contract_addr": INJECTIVE_CONTRACT
      }
  }
]

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

const newStakingInstance = new OraiswapStakingClient(client, senderAddress, STAKING_CONTRACT);
for (let assetKey of oldAssetKeys) {
  console.log("asset key: ", assetKey)
  const result = await newStakingInstance.migrateStore({assetInfo: assetKey});
  let hasMigrateDone = result.events.find(ev => ev.type === 'wasm').attributes.find(attr => attr.key === 'remove_pool_info').value;
  console.log("result: ", result);
  while (hasMigrateDone !== "true") {
    const result = await newStakingInstance.migrateStore({assetInfo: assetKey});
    hasMigrateDone = result.events.find(ev => ev.type === 'wasm').attributes.find(attr => attr.key === 'remove_pool_info').value;
    console.log("new result: ", result)
  }
  console.log("finished processing asset key: ", assetKey) 
}