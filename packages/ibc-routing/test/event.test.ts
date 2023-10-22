/* eslint-disable */
import { resolve } from "path";
import { DuckDbNode } from "../src/db";
import { ContextHandler, OraiBridgeEvent } from "../src/event";
describe("Event parsing", () => {
  describe("OraiBridgeEvent", () => {
    it("listenToOraiBridgeEvent", async () => {
      const db = await DuckDbNode.create(resolve(__dirname, "./data"));
      const handler = new ContextHandler(db);
      const baseUrl = "https://bridge-v2.rpc.orai.io";
      const oraiBridgeEvent = new OraiBridgeEvent(db, handler, baseUrl);
      await oraiBridgeEvent.listenToOraiBridgeEvent();
    });
  });
});
