import { Attribute, Event, IndexedTx } from "@cosmjs/stargate";
import { Tx } from "@oraichain/cosmos-rpc-sync";
import { Asset, AssetInfo } from "@oraichain/oraidex-contracts-sdk";
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
  WithdrawLiquidityOperationData,
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
  return events
    .filter((event) => event.type === "wasm")
    .map((event) => event.attributes);
}

function parseOraidexAttributes(attributes: readonly Attribute[]) {
  return;
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

function parseExecuteContractToOraidexMsgs(
  msgs: MsgExecuteContractWithLogs[]
): ModifiedMsgExecuteContract[] {
  let objs: ModifiedMsgExecuteContract[] = [];
  for (let msg of msgs) {
    try {
      const obj: ModifiedMsgExecuteContract = {
        ...msg,
        msg: JSON.parse(Buffer.from(msg.msg).toString("utf-8")),
      };
      // Should be provide, remove liquidity or other oraidex related types
      if ("provide_liquidity" in obj.msg || "swap" in obj.msg) objs.push(obj);
      if ("send" in obj.msg) {
        try {
          const contractSendMsg: OraiswapPairCw20HookMsg = JSON.parse(
            Buffer.from(obj.msg.send.msg, "base64").toString("utf-8")
          );
          if (
            "swap" in contractSendMsg ||
            "withdraw_liquidity" in contractSendMsg
          )
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
  let pairAssets: Asset[][] = [];
  let transactions: Tx[] = [];
  let swapOpsData: SwapOperationData[] = [];
  let accountTxs: AccountTx[] = [];
  let provideLiquidityOpsData: ProvideLiquidityOperationData[] = [];
  let withdrawLiquidityOpsData: WithdrawLiquidityOperationData[] = [];
  for (let tx of txs) {
    transactions.push(tx);
    const msgExecuteContracts = parseTxToMsgExecuteContractMsgs(tx);
    const msgs = parseExecuteContractToOraidexMsgs(msgExecuteContracts);
    console.dir(msgs, { depth: null });
  }
  return undefined;
}

export {
  parseAssetInfo,
  delay,
  parseWasmEvents,
  parseOraidexAttributes,
  parseTxs,
};
