import { network } from "@oraichain/oraidex-common";
import dotenv from "dotenv";
dotenv.config();

export const config = {
  ORAIBRIDGE_RPC_URL: process.env.ORAIBRIDGE_RPC_URL ?? "https://bridge-v2.rpc.orai.io",
  ORAICHAIN_RPC_URL: process.env.ORAICHAIN_RPC_URL ?? network.rpc
};
