import { Attribute, Event } from "@cosmjs/stargate";
import { Tx } from "@oraichain/cosmos-rpc-sync";
import { AssetInfo } from "@oraichain/oraidex-contracts-sdk";
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";
import { Tx as CosmosTx } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import {
  AccountTx,
  ModifiedMsgExecuteContract,
  MsgExecuteContractWithLogs,
  MsgType,
  OraiswapPairCw20HookMsg,
  ProvideLiquidityOperationData,
  SwapOperationData,
  TxAnlysisResult,
  WithdrawLiquidityOperationData
} from "./types";
import { Log } from "@cosmjs/stargate/build/logs";

function parseAssetInfo(info: AssetInfo): string {
  if ("native_token" in info) return info.native_token.denom;
  return info.token.contract_addr;
}

async function delay(timeout: number) {
  return new Promise((resolve) => setTimeout(resolve, timeout));
}

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

function extractSwapOperations(txhash: string, events: readonly Event[]): SwapOperationData[] {
  const wasmAttributes = parseWasmEvents(events);
  let swapData: SwapOperationData[] = [];
  let offerDenoms: string[] = [];
  let askDenoms: string[] = [];
  let commissionAmounts: string[] = [];
  let offerAmounts: string[] = [];
  let returnAmounts: string[] = [];
  let taxAmounts: string[] = [];
  let spreadAmounts: string[] = [];
  for (let attrs of wasmAttributes) {
    if (!attrs.find((attr) => attr.key === "swap")) continue;
    for (let attr of attrs) {
      if (attr.key === "offer_asset") {
        offerDenoms.push(attr.value);
      }
      if (attr.key === "ask_asset") {
        askDenoms.push(attr.value);
      }
      if (attr.key === "offer_amount") {
        offerAmounts.push(attr.value);
      }
      if (attr.key === "return_amount") {
        returnAmounts.push(attr.value);
      }
      if (attr.key === "tax_amount") {
        taxAmounts.push(attr.value);
      }
      if (attr.key === "commission_amount") {
        commissionAmounts.push(attr.value);
      }
      if (attr.key === "spread_amount") {
        spreadAmounts.push(attr.value);
      }
    }
  }
  // TODO: check length of above data should be equal because otherwise we would miss information
  for (let i = 0; i < askDenoms.length; i++) {
    swapData.push({
      txhash,
      offerDenom: offerDenoms[i],
      offerAmount: offerAmounts[i],
      returnAmount: returnAmounts[i],
      commissionAmount: parseInt(commissionAmounts[i]),
      spreadAmount: parseInt(spreadAmounts[i]),
      taxAmount: parseInt(taxAmounts[i]),
      askDenom: askDenoms[i]
    });
  }
  return swapData;
}

function extractMsgProvideLiquidity(
  txhash: string,
  msg: MsgType,
  txCreator: string
): ProvideLiquidityOperationData | undefined {
  if ("provide_liquidity" in msg) {
    const firstAsset = msg.provide_liquidity.assets[0];
    const secAsset = msg.provide_liquidity.assets[1];
    return {
      txhash,
      firstTokenAmount: parseInt(firstAsset.amount),
      firstTokenDenom: parseAssetInfo(firstAsset.info),
      secondTokenAmount: parseInt(secAsset.amount),
      secondTokenDenom: parseAssetInfo(secAsset.info),
      txCreator,
      opType: "provide"
    };
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

function extractMsgWithdrawLiquidity(
  txhash: string,
  events: readonly Event[],
  txCreator: string
): WithdrawLiquidityOperationData[] {
  const withdrawData: WithdrawLiquidityOperationData[] = [];
  const wasmAttributes = parseWasmEvents(events);

  for (let attrs of wasmAttributes) {
    if (!attrs.find((attr) => attr.key === "withdraw_liquidity")) continue;
    const assetAttr = attrs.find((attr) => attr.key === "refund_assets");
    if (!assetAttr) continue;
    const assets = parseWithdrawLiquidityAssets(assetAttr.value);
    // sanity check. only push data if can parse asset successfully
    if (assets.length !== 4) continue;
    withdrawData.push({
      txhash,
      firstTokenAmount: parseInt(assets[0]),
      firstTokenDenom: assets[1],
      secondTokenAmount: parseInt(assets[2]),
      secondTokenDenom: assets[3],
      txCreator,
      opType: "withdraw"
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
      if ("provide_liquidity" in obj.msg || "execute_swap_operations" in obj.msg || "execute_swap_operation" in obj.msg)
        objs.push(obj);
      if ("send" in obj.msg) {
        try {
          const contractSendMsg: OraiswapPairCw20HookMsg = JSON.parse(
            Buffer.from(obj.msg.send.msg, "base64").toString("utf-8")
          );
          if ("swap" in contractSendMsg || "withdraw_liquidity" in contractSendMsg)
            objs.push({ ...msg, msg: contractSendMsg });
        } catch (error) {
          // do nothing because we dont care about other types of msgs
        }
      }
    } catch (error) {
      // do nothing because we dont care about other types of msgs
    }
  }
  return objs;
}

function parseTxs(txs: Tx[]): TxAnlysisResult {
  let transactions: Tx[] = [];
  let swapOpsData: SwapOperationData[] = [];
  let accountTxs: AccountTx[] = [];
  let provideLiquidityOpsData: ProvideLiquidityOperationData[] = [];
  let withdrawLiquidityOpsData: WithdrawLiquidityOperationData[] = [];
  for (let tx of txs) {
    transactions.push(tx);
    const msgExecuteContracts = parseTxToMsgExecuteContractMsgs(tx);
    const msgs = parseExecuteContractToOraidexMsgs(msgExecuteContracts);
    const txhash = tx.hash;
    for (let msg of msgs) {
      const sender = msg.sender;
      swapOpsData.push(...extractSwapOperations(txhash, msg.logs.events));
      const provideLiquidityData = extractMsgProvideLiquidity(txhash, msg.msg, sender);
      if (provideLiquidityData) provideLiquidityOpsData.push(provideLiquidityData);
      withdrawLiquidityOpsData.push(...extractMsgWithdrawLiquidity(txhash, msg.logs.events, sender));
      accountTxs.push({ txhash, accountAddress: sender });
    }
  }
  return {
    // transactions: txs,
    swapOpsData,
    accountTxs,
    provideLiquidityOpsData,
    withdrawLiquidityOpsData
  };
}

export { parseAssetInfo, delay, parseWasmEvents, parseTxs, parseWithdrawLiquidityAssets };
