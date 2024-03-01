/* eslint-disable security/detect-object-injection */
import { Attribute, Event } from "@cosmjs/stargate";
import { Log } from "@cosmjs/stargate/build/logs";
import { Tx } from "@oraichain/cosmos-rpc-sync";
import { AssetInfo } from "@oraichain/oraidex-contracts-sdk";
import { PoolResponse } from "@oraichain/oraidex-contracts-sdk/build/OraiswapPair.types";
import { Tx as CosmosTx } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";
import { isEqual } from "lodash";
import { OCH_PRICE, ORAIXOCH_INFO } from "./constants";
import { DuckDb } from "./db";
import {
  buildOhlcv,
  calculatePriceByPool,
  concatDataToUniqueKey,
  concatEarnedHistoryToUniqueKey,
  getSwapDirection,
  groupByTime,
  isAssetInfoPairReverse,
  isoToTimestampNumber,
  removeOpsDuplication
} from "./helper";
import { pairs } from "./pairs";
import { parseAssetInfoOnlyDenom, parseCw20DenomToAssetInfo } from "./parse";
import {
  accumulatePoolAmount,
  calculateLiquidityFee,
  getOraiPrice,
  getPoolInfos,
  getPriceAssetByUsdt,
  isPoolHasFee
} from "./pool-helper";
import {
  AccountTx,
  BasicTxData,
  EarningOperationData,
  LiquidityOpType,
  ModifiedMsgExecuteContract,
  MsgExecuteContractWithLogs,
  MsgType,
  OraiswapPairCw20HookMsg,
  OraiswapRouterCw20HookMsg,
  PoolInfo,
  ProvideLiquidityOperationData,
  SwapOperationData,
  TxAnlysisResult,
  WithdrawLiquidityOperationData
} from "./types";

function parseWasmEvents(events: readonly Event[]): (readonly Attribute[])[] {
  return events.filter((event) => event.type === "wasm").map((event) => event.attributes);
}

// use for extract claim reward
function parseTransferEvents(events: readonly Event[]): (readonly Attribute[])[] {
  return events.filter((event) => event.type === "transfer").map((event) => event.attributes);
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
  const swapData: SwapOperationData[] = [];
  const offerDenoms: string[] = [];
  const askDenoms: string[] = [];
  const commissionAmounts: string[] = [];
  const offerAmounts: string[] = [];
  const returnAmounts: string[] = [];
  const taxAmounts: string[] = [];
  const spreadAmounts: string[] = [];
  const senders: string[] = [];
  for (const attrs of wasmAttributes) {
    if (!attrs.find((attr) => attr.key === "action" && attr.value === "swap")) continue;
    for (const attr of attrs) {
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
        // for commission_amount & spread_amount: its unit is calculated according to return amount
        commissionAmounts.push(attr.value);
      } else if (attr.key === "spread_amount") {
        spreadAmounts.push(attr.value);
      } else if (attr.key === "to") {
        senders.push(attr.value);
      }
    }
  }
  const swapAttrs = [
    offerAmounts,
    offerDenoms,
    askDenoms,
    returnAmounts,
    taxAmounts,
    commissionAmounts,
    spreadAmounts,
    senders
  ];
  // faulty swap attributes, wont collect
  if (!swapAttrs.every((array) => array.length === askDenoms.length)) return [];
  for (let i = 0; i < askDenoms.length; i++) {
    const offerAmount = BigInt(offerAmounts[i]);
    const returnAmount = BigInt(returnAmounts[i]);
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
      txheight: txData.txheight,
      sender: senders[i]
    });
  }
  return swapData;
}

export const getBaseQuoteAmountFromSwapOps = (swapOp: SwapOperationData) => {
  // Sell: offer is ORAI, return is USDT
  // Buy: offer is USDT, return is ORAI
  let baseAmount = swapOp.direction === "Sell" ? swapOp.offerAmount : swapOp.returnAmount;
  let quoteAmount = -(swapOp.direction === "Sell" ? swapOp.returnAmount : swapOp.offerAmount);
  if (swapOp.direction === "Buy") {
    baseAmount = -baseAmount;
    quoteAmount = -quoteAmount;
  }
  return [BigInt(baseAmount), BigInt(quoteAmount)];
};

export const getPoolFromSwapDenom = (swapOp: SwapOperationData, poolInfos: PoolResponse[]) => {
  const baseDenom = swapOp.direction === "Sell" ? swapOp.offerDenom : swapOp.askDenom;
  const quoteDenom = swapOp.direction === "Sell" ? swapOp.askDenom : swapOp.offerDenom;
  const pool = poolInfos.find(
    (info) =>
      info.assets.some((assetInfo) => parseAssetInfoOnlyDenom(assetInfo.info) === baseDenom) &&
      info.assets.some((assetInfo) => parseAssetInfoOnlyDenom(assetInfo.info) === quoteDenom)
  );
  return pool;
};

export const calculateSwapOpsWithPoolAmount = async (swapOps: SwapOperationData[]): Promise<SwapOperationData[]> => {
  try {
    if (swapOps.length === 0) return [];
    const duckDb = DuckDb.instances;
    const pairInfos = await duckDb.queryPairInfos();

    const minTxHeight = swapOps[0].txheight;
    const poolInfos = await getPoolInfos(
      pairInfos.map((pair) => pair.pairAddr),
      minTxHeight - 1 // assume data is sorted by height and timestamp
    );
    const accumulatePoolAmount: {
      [key: string]: PoolInfo;
    } = {};

    const updatedSwapOps = JSON.parse(JSON.stringify(swapOps)) as SwapOperationData[];
    for (const swapOp of updatedSwapOps) {
      const pool = getPoolFromSwapDenom(swapOp, poolInfos);

      // get pair addr to combine by address
      const assetInfos = pool.assets.map((asset) => asset.info) as [AssetInfo, AssetInfo];
      if (isAssetInfoPairReverse(assetInfos)) assetInfos.reverse();
      const pairInfo = await duckDb.getPoolByAssetInfos(assetInfos);
      if (!pairInfo) throw new Error("cannot find pair info when collectAccumulateLpAndSwapData");
      const { pairAddr } = pairInfo;

      const [baseAmount, quoteAmount] = getBaseQuoteAmountFromSwapOps(swapOp);
      // accumulate pool amount by pair addr
      if (!accumulatePoolAmount[pairAddr]) {
        const initialFirstTokenAmount = BigInt(
          pool.assets.find((asset) => parseAssetInfoOnlyDenom(asset.info) === parseAssetInfoOnlyDenom(assetInfos[0]))
            .amount
        );
        const initialSecondTokenAmount = BigInt(
          pool.assets.find((asset) => parseAssetInfoOnlyDenom(asset.info) === parseAssetInfoOnlyDenom(assetInfos[1]))
            .amount
        );
        accumulatePoolAmount[pairAddr] = {
          offerPoolAmount: initialFirstTokenAmount + baseAmount,
          askPoolAmount: initialSecondTokenAmount + quoteAmount
        };
      } else {
        accumulatePoolAmount[pairAddr].offerPoolAmount += baseAmount;
        accumulatePoolAmount[pairAddr].askPoolAmount += quoteAmount;
      }
      // update pool amount for swap ops
      swapOp.basePoolAmount = accumulatePoolAmount[pairAddr].offerPoolAmount;
      swapOp.quotePoolAmount = accumulatePoolAmount[pairAddr].askPoolAmount;
    }
    return updatedSwapOps;
  } catch (error) {
    console.log("error in calculateSwapOpsWithPoolAmount: ", error.message);
  }
};

export async function calculateRewardAssetPrice(rewardAssetDenom: string): Promise<number> {
  // hardcode price for reward OCH
  if (rewardAssetDenom === ORAIXOCH_INFO.token.contract_addr) {
    return OCH_PRICE;
  } else {
    const rewardAssetInfo = parseCw20DenomToAssetInfo(rewardAssetDenom);
    return await getPriceAssetByUsdt(rewardAssetInfo);
  }
}

export function calculateEarnAmountInUsdt(
  rewardAssetPrice: number,
  earnAmount: number,
  oraiEarnedAmount: number,
  oraiPrice: number
): number {
  return rewardAssetPrice * earnAmount + oraiPrice * oraiEarnedAmount;
}

async function extractClaimOperations(
  txData: BasicTxData,
  wasmAttributes: (readonly Attribute[])[],
  msg: MsgType,
  transferAttributes: (readonly Attribute[])[]
): Promise<EarningOperationData[]> {
  const claimData: EarningOperationData[] = [];
  const stakerAddresses: string[] = [];
  const rewardAssetDenoms: string[] = [];
  const earnAmounts: number[] = [];
  let stakingToken: string;

  // transfer attribute for claim native ORAI
  let oraiEarnedAmount = 0;
  for (const attrs of transferAttributes) {
    for (const attr of attrs) {
      if (attr.key === "amount") {
        const asset = parseClaimNativeAsset(attr.value);
        oraiEarnedAmount = parseInt(asset[0]);
        break;
      }
    }
  }
  let oraiPrice = 0;
  if (oraiEarnedAmount) oraiPrice = await getOraiPrice();

  for (const attrs of wasmAttributes) {
    const stakingAction = attrs.find((attr) => attr.key === "action" && attr.value === "withdraw_reward");
    if (!stakingAction) continue;
    stakingToken = "withdraw" in msg ? msg.withdraw.staking_token : undefined;
    if (!stakingToken) continue;

    attrs.forEach((attr, index) => {
      if (attr.key === "to") stakerAddresses.push(attr.value);
      if (attr.key === "amount") {
        earnAmounts.push(parseInt(attr.value));

        /**
         * Attrs returned with in the following order so we use attrs[index - 2] to access contract address of reward asset.
         * { key:_contract_address, value:orai1lus0f0rhx8s03gdllx2n6vhkmf0536dv57wfge }
           { key:action, value:transfer }
           { key:amount, value:892039 }
        */
        const rewardAsset = attrs[index - 2];
        rewardAssetDenoms.push(rewardAsset.value);
      }
    });
  }

  for (let i = 0; i < stakerAddresses.length; i++) {
    const rewardAssetPrice = await calculateRewardAssetPrice(rewardAssetDenoms[i]);
    const earnAmountInUsdt = calculateEarnAmountInUsdt(rewardAssetPrice, earnAmounts[i], oraiEarnedAmount, oraiPrice);
    claimData.push({
      uniqueKey: concatEarnedHistoryToUniqueKey({
        txheight: txData.txheight,
        earnAmount: earnAmounts[i],
        stakerAddress: stakerAddresses[i],
        rewardAssetDenom: rewardAssetDenoms[i]
      }),
      txheight: txData.txheight,
      txhash: txData.txhash,
      timestamp: txData.timestamp,
      stakerAddress: stakerAddresses[i],
      stakingAssetDenom: stakingToken,
      stakingAssetPrice: rewardAssetPrice,
      earnAmount: BigInt(earnAmounts[i]),
      earnAmountInUsdt,
      rewardAssetDenom: rewardAssetDenoms[i]
    });
  }
  return claimData;
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
  if (!findedPair) return 0n;
  let fee = 0n;
  const isHasFee = isPoolHasFee(findedPair.asset_infos);
  if (isHasFee) {
    const lpShare =
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
    for (const attrs of wasmAttributes) {
      const assetInfos = msg.provide_liquidity.assets.map((asset) => asset.info);

      let baseAsset = msg.provide_liquidity.assets[0];
      let quoteAsset = msg.provide_liquidity.assets[1];
      if (isAssetInfoPairReverse(assetInfos)) {
        baseAsset = msg.provide_liquidity.assets[1];
        quoteAsset = msg.provide_liquidity.assets[0];
      }
      const firstDenom = parseAssetInfoOnlyDenom(baseAsset.info);
      const secDenom = parseAssetInfoOnlyDenom(quoteAsset.info);
      const firstAmount = BigInt(baseAsset.amount);
      const secAmount = BigInt(quoteAsset.amount);
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

function parseClaimNativeAsset(assets: string): string[] {
  // format: "2591orai"
  const regex = /^(\d+)([a-zA-Z\/0-9]+)$/;
  const matches = assets.match(regex);
  if (!matches || matches.length < 2) return [];
  return matches.slice(1, 5);
}

async function extractMsgWithdrawLiquidity(
  txData: BasicTxData,
  wasmAttributes: (readonly Attribute[])[],
  txCreator: string
): Promise<WithdrawLiquidityOperationData[]> {
  const withdrawData: WithdrawLiquidityOperationData[] = [];

  for (const attrs of wasmAttributes) {
    if (!attrs.find((attr) => attr.key === "action" && attr.value === "withdraw_liquidity")) continue;
    const assetAttr = attrs.find((attr) => attr.key === "refund_assets");
    if (!assetAttr) continue;
    const assets = parseWithdrawLiquidityAssets(assetAttr.value);
    // sanity check. only push data if can parse asset successfully
    let baseAssetAmount = BigInt(assets[0]);
    let baseAsset = assets[1];
    let quoteAsset = assets[3];
    let quoteAssetAmount = BigInt(assets[2]);
    // we only have one pair order. If the order is reversed then we also reverse the order
    const findedPair = pairs.find((pair) =>
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
  const objs: ModifiedMsgExecuteContract[] = [];
  for (const msg of msgs) {
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
        "withdraw" in obj.msg ||
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
  const transactions: Tx[] = [];
  let swapOpsData: SwapOperationData[] = [];
  let claimOpsData: EarningOperationData[] = [];
  const accountTxs: AccountTx[] = [];
  let provideLiquidityOpsData: ProvideLiquidityOperationData[] = [];
  let withdrawLiquidityOpsData: WithdrawLiquidityOperationData[] = [];
  for (const tx of txs) {
    transactions.push(tx);
    const msgExecuteContracts = parseTxToMsgExecuteContractMsgs(tx);
    const msgs = parseExecuteContractToOraidexMsgs(msgExecuteContracts);
    const basicTxData: BasicTxData = {
      timestamp: isoToTimestampNumber(tx.timestamp),
      txhash: tx.hash,
      txheight: tx.height
    };

    for (const msg of msgs) {
      const sender = msg.sender;
      const wasmAttributes = parseWasmEvents(msg.logs.events);
      const transferAttributes = parseTransferEvents(msg.logs.events);
      swapOpsData.push(...extractSwapOperations(basicTxData, wasmAttributes));
      claimOpsData.push(...(await extractClaimOperations(basicTxData, wasmAttributes, msg.msg, transferAttributes)));
      const provideLiquidityData = await extractMsgProvideLiquidity(basicTxData, msg.msg, sender, wasmAttributes);
      if (provideLiquidityData) provideLiquidityOpsData.push(provideLiquidityData);
      withdrawLiquidityOpsData.push(...(await extractMsgWithdrawLiquidity(basicTxData, wasmAttributes, sender)));
      accountTxs.push({ txhash: basicTxData.txhash, accountAddress: sender });
    }
  }
  swapOpsData = swapOpsData.filter((i) => i.direction);
  swapOpsData = removeOpsDuplication(swapOpsData) as SwapOperationData[];

  provideLiquidityOpsData = groupByTime(
    removeOpsDuplication(provideLiquidityOpsData)
  ) as ProvideLiquidityOperationData[];
  withdrawLiquidityOpsData = groupByTime(
    removeOpsDuplication(withdrawLiquidityOpsData)
  ) as WithdrawLiquidityOperationData[];

  claimOpsData = groupByTime(removeOpsDuplication(claimOpsData)) as EarningOperationData[];

  const lpOpsData = [...provideLiquidityOpsData, ...withdrawLiquidityOpsData];
  // accumulate liquidity pool amount via provide/withdraw liquidity and swap ops
  const poolAmountHistories = await accumulatePoolAmount(lpOpsData, [...swapOpsData]);

  const swapOpsWithPoolAmount = await calculateSwapOpsWithPoolAmount(swapOpsData);
  return {
    swapOpsData: groupByTime(swapOpsData) as SwapOperationData[],
    ohlcv: buildOhlcv(swapOpsWithPoolAmount),
    accountTxs,
    provideLiquidityOpsData,
    withdrawLiquidityOpsData,
    claimOpsData: groupByTime(removeOpsDuplication(claimOpsData)) as EarningOperationData[],
    poolAmountHistories
  };
}

export const processEventApr = (txs: Tx[]) => {
  const assets = {
    infoTokenAssetPools: new Set<string>(),
    isTriggerRewardPerSec: false
  };
  for (const tx of txs) {
    // guard code. Should refetch all token info if match event update_rewards_per_sec or length of staking asset equal to pairs length.
    if (assets.isTriggerRewardPerSec || assets.infoTokenAssetPools.size === pairs.length) break;

    const msgExecuteContracts = parseTxToMsgExecuteContractMsgs(tx);
    const msgs = parseExecuteContractToOraidexMsgs(msgExecuteContracts);
    for (const msg of msgs) {
      const wasmAttributes = parseWasmEvents(msg.logs.events);
      for (const attrs of wasmAttributes) {
        if (attrs.find((attr) => attr.key === "action" && (attr.value === "bond" || attr.value === "unbond"))) {
          const stakingAssetDenom = attrs.find((attr) => attr.key === "staking_token")?.value;
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

export {
  parseClaimNativeAsset,
  parseTransferEvents,
  parseTxToMsgExecuteContractMsgs,
  parseTxs,
  parseWasmEvents,
  parseWithdrawLiquidityAssets
};
