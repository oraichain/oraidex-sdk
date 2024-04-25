import { TxEvent } from "@cosmjs/tendermint-rpc";
import { Event } from "@cosmjs/tendermint-rpc/build/tendermint37";
import { chainInfos, EvmChainPrefix, Gravity__factory } from "@oraichain/oraidex-common";
import axios from "axios";
import { ethers } from "ethers";
import { EvmRpcs, GravityAddress } from "../constants";
import { convertStringToUint8Array } from "../helpers";

export function isBase64(str: string) {
  try {
    return btoa(atob(str)) === str;
  } catch (err) {
    return false;
  }
}

export const parseRpcEvents = (events: readonly Event[]): Event[] => {
  return events.map((ev: any) => ({
    ...ev,
    attributes: ev.attributes.map((attr) => {
      let obj;
      try {
        obj = {
          key: isBase64(attr.key) ? Buffer.from(attr.key, "base64").toString("utf-8") : attr.key,
          value: isBase64(attr.value) ? Buffer.from(attr.value, "base64").toString("utf-8") : attr.value
        };
      } catch (err) {
        obj = {
          key: isBase64(attr.key) ? Buffer.from(attr.key, "base64").toString("utf-8") : attr.key,
          value: attr.value
        };
      }
      return obj;
    })
  }));
};

export const encodeRpcEvents = (events: readonly Event[]): Event[] => {
  return events.map((ev: any) => ({
    ...ev,
    attributes: ev.attributes.map((attr: any) => {
      return {
        key: Buffer.from(attr.key).toString("base64"),
        value: Buffer.from(attr.value).toString("base64")
      };
    })
  }));
};

export const getSendToCosmosEvent = async (txHash: string, evmChainPrefix: EvmChainPrefix): Promise<any[]> => {
  const provider = new ethers.providers.JsonRpcProvider(EvmRpcs[evmChainPrefix]);
  const transaction = await provider.getTransaction(txHash);

  if (!transaction.blockNumber) {
    throw new Error("Transaction is not mined!");
  }

  const gravityAddress = GravityAddress[evmChainPrefix];
  const blockNumber = transaction.blockNumber;
  const gravity = Gravity__factory.connect(ethers.utils.getAddress(gravityAddress), provider);
  const data = await gravity.queryFilter(
    {
      address: gravityAddress,
      topics: [ethers.utils.id("SendToCosmosEvent(address,address,string,uint256,uint256)")]
    },
    blockNumber,
    blockNumber
  );

  return data.map((item) => [...item.args, item]);
};

export const getCosmosTxEvent = async (txHash: any, chainId: string): Promise<TxEvent> => {
  const chainMetadata = chainInfos.find((item) => item.chainId === chainId);

  if (!chainMetadata) {
    throw new Error("chain id does not exist!");
  }
  const result = await axios.get(`${chainMetadata.rpc}/tx?hash=${`0x${txHash}`}&prove=true`);
  const txData = result.data;

  const hash =
    typeof txData.result.hash == "string" ? convertStringToUint8Array(txData.result.hash) : txData.result.hash;

  return { ...txData.result, result: txData.result.tx_result, hash };
};
