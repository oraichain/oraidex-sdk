import { DownloadState } from "@oraichain/cw-simulate";
import { SimulateCosmWasmClient } from "@oraichain/cw-simulate";
import {
  AIRI_CONTRACT,
  ATOM_ORAICHAIN_DENOM,
  INJECTIVE_CONTRACT,
  KWT_CONTRACT,
  MILKY_CONTRACT,
  ORAIX_CONTRACT,
  OSMOSIS_ORAICHAIN_DENOM,
  REWARDER_CONTRACT,
  SCATOM_CONTRACT,
  SCORAI_CONTRACT,
  STAKING_CONTRACT,
  TRX_CONTRACT,
  USDC_CONTRACT,
  parseAssetInfo
} from "@oraichain/oraidex-common";
import { AssetInfo, OraiswapRewarderClient, OraiswapStakingClient } from "@oraichain/oraidex-contracts-sdk";
import assert from "assert";
import { readFileSync } from "fs";
import path from "path";
import { exit } from "process";

// download state
const download = new DownloadState("https://lcd.orai.io", path.join(__dirname, "wasm"));
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

const oldProductionAssetInfos = [
  {
    native_token: {
      denom: ATOM_ORAICHAIN_DENOM
    }
  },
  {
    native_token: {
      denom: OSMOSIS_ORAICHAIN_DENOM
    }
  },
  {
    token: {
      contract_addr: AIRI_CONTRACT
    }
  },
  {
    token: {
      contract_addr: USDC_CONTRACT
    }
  },
  {
    token: {
      contract_addr: ORAIX_CONTRACT
    }
  },
  {
    token: {
      contract_addr: KWT_CONTRACT
    }
  },
  {
    token: {
      contract_addr: MILKY_CONTRACT
    }
  },
  {
    token: {
      contract_addr: SCORAI_CONTRACT
    }
  },
  {
    token: {
      contract_addr: USDC_CONTRACT
    }
  },
  {
    token: {
      contract_addr: TRX_CONTRACT
    }
  },
  {
    token: {
      contract_addr: SCATOM_CONTRACT
    }
  },
  {
    token: {
      contract_addr: INJECTIVE_CONTRACT
    }
  }
];

const senderAddress = "orai1gkr56hlnx9vc7vncln2dkd896zfsqjn300kfq0";
const owner = "orai1fs25usz65tsryf0f8d5cpfmqgr0xwup4kjqpa0";
const client = new SimulateCosmWasmClient({ chainId: "Oraichain", bech32Prefix: "orai" });

await download.loadState(client, senderAddress, STAKING_CONTRACT, "mainnet staking contract");

let oldPools = [];
let stakingTokens = [];
for (let oldInfo of oldProductionAssetInfos) {
  const pool = await client.queryContractSmart(STAKING_CONTRACT, {
    pool_info: { asset_info: oldInfo }
  });
  oldPools.push(pool);
  stakingTokens.push(pool.staking_token);
}
console.log(stakingTokens);

const rewardsInfo = await client.queryContractSmart(STAKING_CONTRACT, {
  reward_infos: { asset_info: { token: { contract_addr: AIRI_CONTRACT } } }
});
console.log("reward info: ", rewardsInfo);

// cwtools build ../oraiswap/contracts/* ../oraidex-listing-contract -o packages/contracts-build/data
const { codeId } = await client.upload(
  senderAddress,
  readFileSync(path.join(__dirname, "../..", "contracts-build/data/oraiswap_staking.wasm")),
  "auto"
);

const migrateResult = await client.migrate(senderAddress, STAKING_CONTRACT, codeId, {}, "auto");
console.log("migrate result: ", migrateResult);

// load state & migrate for rewarder contract
// await download.saveState(REWARDER_CONTRACT);
await download.loadState(client, senderAddress, REWARDER_CONTRACT, "mainnet rewarder contract");
const { codeId: rewarderNewCodeId } = await client.upload(
  senderAddress,
  readFileSync(path.join(__dirname, "../..", "contracts-build/data/oraiswap_rewarder.wasm")),
  "auto"
);
const rewarderMigrateResult = await client.migrate(senderAddress, REWARDER_CONTRACT, rewarderNewCodeId, {}, "auto");
console.log("rewarder migrate result: ", rewarderMigrateResult);
const newStakingInstance = new OraiswapStakingClient(client, owner, STAKING_CONTRACT);
for (let assetKey of oldAssetInfos) {
  const result = await newStakingInstance.migrateStore({ assetInfo: assetKey });
  const migratedAssetInfo = result.events
    .find((ev) => ev.type === "wasm")
    .attributes.find((attr) => attr.key === "asset_info").value;
  assert(parseAssetInfo(assetKey) === migratedAssetInfo);
}

const config = await newStakingInstance.config();
console.log("config: ", config);
const unlockContractResult = await newStakingInstance.updateConfig({ migrateStoreStatus: true });
console.log("unlock contract status: ", unlockContractResult);

// assert if old pool stores = new pool stores
const newPoolResults = await newStakingInstance.getPoolsInformation();
assert(oldPools.length === newPoolResults.length);
console.log("old pool result: ", oldPools);

// assert stakers & their rewards
for (let oldPool of oldPools) {
  const oldStakersGivenKey = await newStakingInstance.queryOldStore({
    storeType: { stakers: { asset_info: oldPool.asset_info } }
  });
  for (let oldStaker of oldStakersGivenKey) {
    const oldRewardsOfStaker = await newStakingInstance.queryOldStore({
      storeType: { rewards: { staker: oldStaker[0] } }
    });
    const newRewardsStaker = (
      await Promise.all(
        oldPools.map((oldPool) =>
          newStakingInstance.rewardInfo({
            stakingToken: oldPool.staking_token,
            stakerAddr: oldStaker[0]
          })
        )
      )
    ).filter((reward) => reward.reward_infos.length > 0);

    assert(newRewardsStaker.length === oldRewardsOfStaker.length);
  }
}

const rewarderContract = new OraiswapRewarderClient(client, owner, REWARDER_CONTRACT);
const distributeResult = await rewarderContract.distribute({ stakingTokens: [oldPools[5].staking_token] });

// confirm that the distribute transaction has been executed successfully
assert(
  distributeResult.events.find(
    (ev) => ev.type === "wasm" && ev.attributes.find((attr) => attr.key === "action" && attr.value === "deposit_reward")
  ) !== undefined
);
