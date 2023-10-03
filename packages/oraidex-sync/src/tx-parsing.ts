import { Attribute, Event } from "@cosmjs/stargate";
import { Log } from "@cosmjs/stargate/build/logs";
import { Tx } from "@oraichain/cosmos-rpc-sync";
import { Tx as CosmosTx } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";
import { isEqual } from "lodash";
import { DuckDb } from "./db";
import {
  buildOhlcv,
  calculatePriceByPool,
  concatDataToUniqueKey,
  concatStakingpHistoryToUniqueKey,
  getPairLiquidity,
  getSwapDirection,
  groupByTime,
  isAssetInfoPairReverse,
  isoToTimestampNumber,
  removeOpsDuplication,
  toDecimal,
  toDisplay
} from "./helper";
import { pairWithStakingAsset, pairs } from "./pairs";
import { calculateLiquidityFee, isPoolHasFee } from "./pool-helper";
import {
  AccountTx,
  BasicTxData,
  LiquidityOpType,
  ModifiedMsgExecuteContract,
  MsgExecuteContractWithLogs,
  MsgType,
  OraiswapPairCw20HookMsg,
  OraiswapRouterCw20HookMsg,
  ProvideLiquidityOperationData,
  StakingOperationData,
  SwapOperationData,
  TxAnlysisResult,
  WithdrawLiquidityOperationData
} from "./types";
import { parseAssetInfoOnlyDenom } from "./parse";

function parseWasmEvents(events: readonly Event[]): (readonly Attribute[])[] {
  return events.filter((event) => event.type === "wasm").map((event) => event.attributes);
}

function parseTxLog(rawLog: string): Log[] {
  return JSON.parse(rawLog);
}

function parseTxToMsgExecuteContractMsgs(tx: Tx): MsgExecuteContractWithLogs[] {
  if (tx.code !== 0) return [];
  const logs: Log[] = parseTxLog(tx.rawLog);
  const cosmosTx = CosmosTx.decode(tx.tx);
  if (!cosmosTx.body) return [];
  const msgs: MsgExecuteContractWithLogs[] = [];
  for (let i = 0; i < cosmosTx.body.messages.length; i++) {
    const msg = cosmosTx.body.messages[i];
    if (msg.typeUrl === "/cosmwasm.wasm.v1.MsgExecuteContract") {
      const msgExecuteContract = MsgExecuteContract.decode(msg.value);
      // TODO: this is an assumption that the log order is the same as the message order.
      msgs.push({ ...msgExecuteContract, logs: logs[i] });
    }
  }
  return msgs;
}

function extractSwapOperations(txData: BasicTxData, wasmAttributes: (readonly Attribute[])[]): SwapOperationData[] {
  let swapData: SwapOperationData[] = [];
  let offerDenoms: string[] = [];
  let askDenoms: string[] = [];
  let commissionAmounts: string[] = [];
  let offerAmounts: string[] = [];
  let returnAmounts: string[] = [];
  let taxAmounts: string[] = [];
  let spreadAmounts: string[] = [];
  for (let attrs of wasmAttributes) {
    if (!attrs.find((attr) => attr.key === "action" && attr.value === "swap")) continue;
    for (let attr of attrs) {
      if (attr.key === "offer_asset") {
        offerDenoms.push(attr.value);
      } else if (attr.key === "ask_asset") {
        askDenoms.push(attr.value);
      } else if (attr.key === "offer_amount") {
        offerAmounts.push(attr.value);
      } else if (attr.key === "return_amount") {
        returnAmounts.push(attr.value);
      } else if (attr.key === "tax_amount") {
        taxAmounts.push(attr.value);
      } else if (attr.key === "commission_amount") {
        commissionAmounts.push(attr.value);
      } else if (attr.key === "spread_amount") {
        spreadAmounts.push(attr.value);
      }
    }
  }
  const swapAttrs = [offerAmounts, offerDenoms, askDenoms, returnAmounts, taxAmounts, commissionAmounts, spreadAmounts];
  // faulty swap attributes, wont collect
  if (!swapAttrs.every((array) => array.length === askDenoms.length)) return [];
  for (let i = 0; i < askDenoms.length; i++) {
    const offerAmount = parseInt(offerAmounts[i]);
    const returnAmount = parseInt(returnAmounts[i]);
    swapData.push({
      askDenom: askDenoms[i],
      commissionAmount: parseInt(commissionAmounts[i]),
      direction: getSwapDirection(offerDenoms[i], askDenoms[i]),
      offerAmount,
      offerDenom: offerDenoms[i],
      uniqueKey: concatDataToUniqueKey({
        txheight: txData.txheight,
        firstAmount: offerAmount,
        firstDenom: offerDenoms[i],
        secondAmount: returnAmount,
        secondDenom: askDenoms[i]
      }),

      returnAmount,
      spreadAmount: parseInt(spreadAmounts[i]),
      taxAmount: parseInt(taxAmounts[i]),
      timestamp: txData.timestamp,
      txhash: txData.txhash,
      txheight: txData.txheight
    });
  }
  return swapData;
}

async function calculateLpPrice({
  stakingAssetDenom,
  stakingAmount
}: {
  stakingAssetDenom: string;
  stakingAmount: number;
}): Promise<number> {
  try {
    const duckDb = DuckDb.instances;
    const pair = pairWithStakingAsset.find(
      (pair) => parseAssetInfoOnlyDenom(pair.stakingAssetInfo) === stakingAssetDenom
    );
    if (!pair)
      throw new Error(`extractStakingOperations:: cannot find pair with staking asset denom: ${stakingAssetDenom}`);

    const pairInfo = await duckDb.getPoolByAssetInfos(pair.asset_infos);
    if (!pairInfo) throw new Error(`extractStakingOperations: cannot find pair with asset_infos: ${pair.asset_infos}`);

    const latestLpPoolHistory = await duckDb.getLatestLpPoolAmount(pairInfo.pairAddr);
    if (!latestLpPoolHistory)
      throw new Error(`extractStakingOperations: cannot getLatestLpPoolAmount with pairAddr: ${pairInfo.pairAddr}`);

    const totalLiquidityInUsdt = await getPairLiquidity(pairInfo);
    console.log({
      totalShare: latestLpPoolHistory.totalShare,
      totalLiquidityInUsdt
    });
    const lpPrice =
      toDecimal(BigInt(stakingAmount), BigInt(latestLpPoolHistory.totalShare)) *
      toDisplay(Math.trunc(totalLiquidityInUsdt).toString());
    return lpPrice;
  } catch (error) {
    console.error("error in calculateLpPrice", error.message);
  }
}

async function extractStakingOperations(
  txData: BasicTxData,
  wasmAttributes: (readonly Attribute[])[]
): Promise<StakingOperationData[]> {
  let stakingData: StakingOperationData[] = [];
  let stakerAddresses: string[] = [];
  let stakingAssetDenoms: string[] = [];
  let stakeAmounts: number[] = [];
  for (let attrs of wasmAttributes) {
    const stakingAction = attrs.find(
      (attr) => attr.key === "action" && (attr.value === "bond" || attr.value === "unbond")
    );
    if (!stakingAction) continue;
    for (let attr of attrs) {
      if (attr.key === "staker_addr") {
        stakerAddresses.push(attr.value);
      } else if (attr.key === "asset_info") {
        stakingAssetDenoms.push(attr.value);
      } else if (attr.key === "amount") {
        const stakeAmount = stakingAction.value === "bond" ? parseInt(attr.value) : -parseInt(attr.value);
        stakeAmounts.push(stakeAmount);
      }
    }
  }

  for (let i = 0; i < stakerAddresses.length; i++) {
    const lpPrice = await calculateLpPrice({
      stakingAmount: stakeAmounts[i],
      stakingAssetDenom: stakingAssetDenoms[i]
    });
    if (!lpPrice) continue;
    stakingData.push({
      uniqueKey: concatStakingpHistoryToUniqueKey({
        txheight: txData.txheight,
        stakeAmount: stakeAmounts[i],
        stakerAddress: stakerAddresses[i],
        stakeAssetDenom: stakingAssetDenoms[i]
      }),
      stakerAddress: stakerAddresses[i],
      stakingAssetDenom: stakingAssetDenoms[i],
      stakeAmount: stakeAmounts[i],
      timestamp: txData.timestamp,
      txhash: txData.txhash,
      txheight: txData.txheight,
      stakeAmountInUsdt: lpPrice * stakeAmounts[i]
    });
  }
  return stakingData;
}

async function getFeeLiquidity(
  [baseDenom, quoteDenom]: [string, string],
  opType: LiquidityOpType,
  attrs: readonly Attribute[],
  txheight: number
): Promise<bigint> {
  // we only have one pair order. If the order is reversed then we also reverse the order
  let findedPair = pairs.find((pair) =>
    isEqual(
      pair.asset_infos.map((info) => parseAssetInfoOnlyDenom(info)),
      [quoteDenom, baseDenom]
    )
  );
  if (findedPair) {
    [baseDenom, quoteDenom] = [quoteDenom, baseDenom];
  } else {
    // otherwise find in reverse order
    findedPair = pairs.find((pair) =>
      isEqual(
        pair.asset_infos.map((info) => parseAssetInfoOnlyDenom(info)),
        [baseDenom, quoteDenom]
      )
    );
  }
  let fee = 0n;
  const isHasFee = isPoolHasFee(findedPair.asset_infos);
  if (isHasFee) {
    let lpShare =
      opType === "provide"
        ? attrs.find((attr) => attr.key === "share").value
        : attrs.find((attr) => attr.key === "withdrawn_share").value;
    const duckDb = DuckDb.instances;
    const pair = await duckDb.getPoolByAssetInfos(findedPair.asset_infos);
    fee = await calculateLiquidityFee(pair, txheight, +lpShare);
    console.log(`fee ${opType} liquidity: $${fee}`);
  }
  return fee;
}

async function extractMsgProvideLiquidity(
  txData: BasicTxData,
  msg: MsgType,
  txCreator: string,
  wasmAttributes: (readonly Attribute[])[]
): Promise<ProvideLiquidityOperationData | undefined> {
  if ("provide_liquidity" in msg) {
    for (let attrs of wasmAttributes) {
      const assetInfos = msg.provide_liquidity.assets.map((asset) => asset.info);

      let baseAsset = msg.provide_liquidity.assets[0];
      let quoteAsset = msg.provide_liquidity.assets[1];
      if (isAssetInfoPairReverse(assetInfos)) {
        baseAsset = msg.provide_liquidity.assets[1];
        quoteAsset = msg.provide_liquidity.assets[0];
      }
      const firstDenom = parseAssetInfoOnlyDenom(baseAsset.info);
      const secDenom = parseAssetInfoOnlyDenom(quoteAsset.info);
      const firstAmount = parseInt(baseAsset.amount);
      const secAmount = parseInt(quoteAsset.amount);

      const fee = await getFeeLiquidity(
        [parseAssetInfoOnlyDenom(baseAsset.info), parseAssetInfoOnlyDenom(quoteAsset.info)],
        "provide",
        attrs,
        txData.txheight
      );
      return {
        basePrice: calculatePriceByPool(BigInt(firstAmount), BigInt(secAmount)),
        baseTokenAmount: firstAmount,
        baseTokenDenom: firstDenom,
        baseTokenReserve: firstAmount,
        opType: "provide",
        uniqueKey: concatDataToUniqueKey({
          txheight: txData.txheight,
          firstAmount,
          firstDenom,
          secondAmount: secAmount,
          secondDenom: secDenom
        }),
        quoteTokenAmount: secAmount,
        quoteTokenDenom: secDenom,
        quoteTokenReserve: secAmount,
        timestamp: txData.timestamp,
        txCreator,
        txhash: txData.txhash,
        txheight: txData.txheight,
        taxRate: fee
      };
    }
  }

  return undefined;
}

function parseWithdrawLiquidityAssets(assets: string): string[] {
  // format: "2591orai, 773ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78"
  const regex = /^(\d+)([a-zA-Z\/0-9]+), (\d+)([a-zA-Z\/0-9]+)/;
  const matches = assets.match(regex);
  if (!matches || matches.length < 5) return []; // check < 5 because the string should be split into two numbers and two strings
  return matches.slice(1, 5);
}

async function extractMsgWithdrawLiquidity(
  txData: BasicTxData,
  wasmAttributes: (readonly Attribute[])[],
  txCreator: string
): Promise<WithdrawLiquidityOperationData[]> {
  const withdrawData: WithdrawLiquidityOperationData[] = [];

  for (let attrs of wasmAttributes) {
    if (!attrs.find((attr) => attr.key === "action" && attr.value === "withdraw_liquidity")) continue;
    const assetAttr = attrs.find((attr) => attr.key === "refund_assets");
    if (!assetAttr) continue;
    const assets = parseWithdrawLiquidityAssets(assetAttr.value);
    // sanity check. only push data if can parse asset successfully
    let baseAssetAmount = parseInt(assets[0]);
    let baseAsset = assets[1];
    let quoteAsset = assets[3];
    let quoteAssetAmount = parseInt(assets[2]);
    // we only have one pair order. If the order is reversed then we also reverse the order
    let findedPair = pairs.find((pair) =>
      isEqual(
        pair.asset_infos.map((info) => parseAssetInfoOnlyDenom(info)),
        [quoteAsset, baseAsset]
      )
    );
    if (findedPair) {
      [baseAsset, quoteAsset] = [quoteAsset, baseAsset];
      [baseAssetAmount, quoteAssetAmount] = [quoteAssetAmount, baseAssetAmount];
    }
    if (assets.length !== 4) continue;

    const fee = await getFeeLiquidity([baseAsset, quoteAsset], "withdraw", attrs, txData.txheight);

    withdrawData.push({
      basePrice: calculatePriceByPool(BigInt(baseAssetAmount), BigInt(quoteAssetAmount)),
      baseTokenAmount: baseAssetAmount,
      baseTokenDenom: baseAsset,
      baseTokenReserve: baseAssetAmount,
      opType: "withdraw",
      uniqueKey: concatDataToUniqueKey({
        txheight: txData.txheight,
        firstDenom: baseAsset,
        firstAmount: baseAssetAmount,
        secondDenom: quoteAsset,
        secondAmount: quoteAssetAmount
      }),
      quoteTokenAmount: quoteAssetAmount,
      quoteTokenDenom: quoteAsset,
      quoteTokenReserve: quoteAssetAmount,
      timestamp: txData.timestamp,
      txCreator,
      txhash: txData.txhash,
      txheight: txData.txheight,
      taxRate: fee
    });
  }
  return withdrawData;
}

function parseExecuteContractToOraidexMsgs(msgs: MsgExecuteContractWithLogs[]): ModifiedMsgExecuteContract[] {
  let objs: ModifiedMsgExecuteContract[] = [];
  for (let msg of msgs) {
    try {
      const obj: ModifiedMsgExecuteContract = {
        ...msg,
        msg: JSON.parse(Buffer.from(msg.msg).toString("utf-8"))
      };
      // Should be provide, remove liquidity, swap, or other oraidex related types
      if (
        "provide_liquidity" in obj.msg ||
        "execute_swap_operations" in obj.msg ||
        "execute_swap_operation" in obj.msg ||
        "bond" in obj.msg ||
        "unbond" in obj.msg ||
        "mint" in obj.msg ||
        "burn" in obj.msg ||
        ("execute" in obj.msg && typeof obj.msg.execute === "object" && "proposal_id" in obj.msg.execute)
      )
        objs.push(obj);
      if ("send" in obj.msg) {
        try {
          const contractSendMsg: OraiswapPairCw20HookMsg | OraiswapRouterCw20HookMsg = JSON.parse(
            Buffer.from(obj.msg.send.msg, "base64").toString("utf-8")
          );
          if (
            "execute_swap_operations" in contractSendMsg ||
            "withdraw_liquidity" in contractSendMsg ||
            "bond" in contractSendMsg ||
            "unbond" in contractSendMsg ||
            "mint" in contractSendMsg ||
            "burn" in contractSendMsg
          ) {
            objs.push({ ...msg, msg: contractSendMsg });
          }
        } catch (error) {
          console.log("parsing msg send error: ", error);
          // do nothing because we dont care about other types of msgs
        }
      }
    } catch (error) {
      // do nothing because we dont care about other types of msgs
    }
  }
  return objs;
}

async function parseTxs(txs: Tx[]): Promise<TxAnlysisResult> {
  let transactions: Tx[] = [];
  let swapOpsData: SwapOperationData[] = [];
  let stakingOpsData: StakingOperationData[] = [];
  let accountTxs: AccountTx[] = [];
  let provideLiquidityOpsData: ProvideLiquidityOperationData[] = [];
  let withdrawLiquidityOpsData: WithdrawLiquidityOperationData[] = [];
  for (let tx of txs) {
    transactions.push(tx);
    const msgExecuteContracts = parseTxToMsgExecuteContractMsgs(tx);
    const msgs = parseExecuteContractToOraidexMsgs(msgExecuteContracts);
    const basicTxData: BasicTxData = {
      timestamp: isoToTimestampNumber(tx.timestamp),
      txhash: tx.hash,
      txheight: tx.height
    };

    for (let msg of msgs) {
      const sender = msg.sender;
      const wasmAttributes = parseWasmEvents(msg.logs.events);

      swapOpsData.push(...extractSwapOperations(basicTxData, wasmAttributes));
      stakingOpsData.push(...(await extractStakingOperations(basicTxData, wasmAttributes)));
      const provideLiquidityData = await extractMsgProvideLiquidity(basicTxData, msg.msg, sender, wasmAttributes);
      if (provideLiquidityData) provideLiquidityOpsData.push(provideLiquidityData);
      withdrawLiquidityOpsData.push(...(await extractMsgWithdrawLiquidity(basicTxData, wasmAttributes, sender)));
      accountTxs.push({ txhash: basicTxData.txhash, accountAddress: sender });
    }
  }
  swapOpsData = swapOpsData.filter((i) => i.direction);
  swapOpsData = removeOpsDuplication(swapOpsData) as SwapOperationData[];
  return {
    swapOpsData: groupByTime(swapOpsData) as SwapOperationData[],
    ohlcv: buildOhlcv(swapOpsData),
    accountTxs,
    provideLiquidityOpsData: groupByTime(
      removeOpsDuplication(provideLiquidityOpsData)
    ) as ProvideLiquidityOperationData[],
    withdrawLiquidityOpsData: groupByTime(
      removeOpsDuplication(withdrawLiquidityOpsData)
    ) as WithdrawLiquidityOperationData[],
    stakingOpsData: groupByTime(removeOpsDuplication(stakingOpsData)) as StakingOperationData[]
  };
}

export const processEventApr = (txs: Tx[]) => {
  const assets = {
    infoTokenAssetPools: new Set<string>(),
    isTriggerRewardPerSec: false
  };
  for (let tx of txs) {
    // guard code. Should refetch all token info if match event update_rewards_per_sec or length ofstaking asset equal to pairs length.
    if (assets.isTriggerRewardPerSec || assets.infoTokenAssetPools.size === pairs.length) break;

    const msgExecuteContracts = parseTxToMsgExecuteContractMsgs(tx);
    const msgs = parseExecuteContractToOraidexMsgs(msgExecuteContracts);
    for (let msg of msgs) {
      const wasmAttributes = parseWasmEvents(msg.logs.events);
      for (let attrs of wasmAttributes) {
        if (attrs.find((attr) => attr.key === "action" && (attr.value === "bond" || attr.value === "unbond"))) {
          const stakingAssetDenom = attrs.find((attr) => attr.key === "asset_info")?.value;
          assets.infoTokenAssetPools.add(stakingAssetDenom);
        }

        if (attrs.find((attr) => attr.key === "action" && attr.value === "update_rewards_per_sec")) {
          assets.isTriggerRewardPerSec = true;
          break;
        }
      }
    }
  }
  return assets;
};

export { parseTxToMsgExecuteContractMsgs, parseTxs, parseWasmEvents, parseWithdrawLiquidityAssets };
