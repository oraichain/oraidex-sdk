import { ethers } from "ethers";
import { Gravity__factory, Gravity } from "@oraichain/oraidex-common";
import { DuckDB } from "./db";

export class EthEvent {
  constructor(public readonly db: DuckDB) {}

  listenToEthEvent = async (rpcUrl: string, gravityContract: string) => {
    const gravity: Gravity = Gravity__factory.connect(
      ethers.utils.getAddress(gravityContract),
      new ethers.providers.JsonRpcProvider(rpcUrl)
    );
    return gravity.on(
      gravity.filters.SendToCosmosEvent(),
      (fromTokenAddr, sender, destination, fromAmount, eventNonce) => {
        console.log(fromTokenAddr, sender, destination, fromAmount, eventNonce);
        // this.db.insertData({})
        // create new evm machine,
      }
    );
  };
}
