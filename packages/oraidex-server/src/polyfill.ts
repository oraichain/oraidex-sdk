import { Tendermint34Client } from "@cosmjs/tendermint-rpc";

//@ts-ignore
BigInt.prototype.toJSON = function () {
  return this.toString();
};

// polyfill

// @ts-ignore
Tendermint34Client.detectVersion = () => {};
//@ts-ignore
// Tendermint34Client.prototype.status = async function () {
//   return {
//     nodeInfo: {
//       network: "Oraichain",
//       version: ""
//     }
//   };
// };
