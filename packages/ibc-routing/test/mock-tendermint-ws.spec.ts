import { Tendermint37Client, WebsocketClient } from "@cosmjs/tendermint-rpc";
import { TxData, TxEvent } from "@cosmjs/tendermint-rpc/build/tendermint37";
import { buildQuery } from "@cosmjs/tendermint-rpc/build/tendermint37/requests";

const connectCosmosSocket = async () => {
  const websocketClient = new WebsocketClient("localhost:1234", (err) => {
    console.log("error connecting to the ws: ", err);
  });

  const client = await Tendermint37Client.create(websocketClient);
  const stream = client.subscribeTx(
    buildQuery({
      tags: []
    })
  );
  stream.subscribe({
    next: async (event) => {
      console.log("event: ", event);
      expect(event.height).toEqual(1);
    }
  });
  return stream;
};

describe("test-mock-websocket", () => {
  it("test-ws", async () => {
    // const stream = await connectCosmosSocket();
    // stream.shamefullySendNext({
    //   tx: Uint8Array.from([]),
    //   hash: Uint8Array.from([]),
    //   height: 1,
    //   result: { code: 1, events: [], gasUsed: 1, gasWanted: 1 } as TxData
    // } as TxEvent);
  });
});
