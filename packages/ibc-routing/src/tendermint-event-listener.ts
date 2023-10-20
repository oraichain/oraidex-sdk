import { WebsocketClient } from "@cosmjs/tendermint-rpc";
import { Tendermint37Client } from "@cosmjs/tendermint-rpc/build/tendermint37";
import { buildQuery } from "@cosmjs/tendermint-rpc/build/tendermint37/requests";
import { createMachine, interpret } from "xstate";
import { DuckDB } from "./db";

let txList = [];

// export const connectCosmosSocket = async (baseUrl: string, db: DuckDB) => {
//   const client = await Tendermint37Client.create(new WebsocketClient(baseUrl));
//   const stream = client.subscribeTx(
//     buildQuery({
//       tags: []
//     })
//   );
//   stream.subscribe({
//     next: async (event) => {
//       const txHash = Buffer.from(event.hash).toString("hex").toUpperCase();
//       // console.log("new tx hash: ", txHash);
//       txMachine.send({ type: "STORE", txHash });
//       // const parsedEvents = parseRpcEvents(event.result.events);
//       console.log("tx list: ", txList);
//       // console.dir(parsedEvents, { depth: null });
//     }
//   });
// };
