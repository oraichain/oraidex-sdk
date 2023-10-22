import { EventHandler, OraiBridgeEvent } from "../src/event";
import { DuckDbNode } from "../src/db";

describe("test-mock-websocket", () => {
  let duckDb: DuckDbNode;
  let eventHandler: EventHandler;

  beforeEach(async () => {
    duckDb = await DuckDbNode.create();
    await duckDb.createTable();

    eventHandler = new EventHandler(duckDb);
  });
  it("test-oraibridge-ws", async () => {
    const oraiBridgeEvent = new OraiBridgeEvent(duckDb, eventHandler, "localhost:26657");
    const stream = await oraiBridgeEvent.connectCosmosSocket([
      { key: "message.action", value: "/gravity.v1.MsgExecuteIbcAutoForwards" }
    ]);
    // has to convert back to bytes because javascript object is not friendly with Uint8Array
    stream.shamefullySendNext({
      ...oraiBridgeAutoForwardTx,
      tx: new Uint8Array(Buffer.from(oraiBridgeAutoForwardTx.tx, "base64")),
      hash: new Uint8Array(Buffer.from(oraiBridgeAutoForwardTx.hash, "hex")),
      result: {
        ...oraiBridgeAutoForwardTx.result,
        data: new Uint8Array(Buffer.from(oraiBridgeAutoForwardTx.result.data, "base64"))
      }
    });
  });
});
