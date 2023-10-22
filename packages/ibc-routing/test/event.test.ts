/* eslint-disable */
import { buildQuery } from "@cosmjs/tendermint-rpc/build/tendermint34/requests";
import { parseRpcEvents } from "@oraichain/oraidex-common";
import { resolve } from "path";
import { DuckDbNode } from "../src/db";
import { EventHandler, IBCEventType, OraiBridgeAction, OraiBridgeEvent, OraiBridgeEventType, OraichainEvent } from "../src/event";
describe("Event parsing", () => {
  describe("OraiBridgeEvent", () => {
    it("sendPacketData and sendToCosmosExecuted", async () => {
      const db = await DuckDbNode.create(resolve(__dirname, "./data"));
      const handler = new EventHandler(db);
      const baseUrl = "https://bridge-v2.rpc.orai.io";
      const oraiBridgeEvent = new OraiBridgeEvent(db, handler, baseUrl);
      await oraiBridgeEvent.connectCosmosSocket();
      const query = buildQuery({ tags: [{ key: "message.action", value: OraiBridgeAction.AUTO_FORWARD_EVENT }] });
      const result = await oraiBridgeEvent.tendermintClient.txSearch({ query, per_page: 1, page: 500 });
      const parseEvent = parseRpcEvents(result.txs[0].result.events);
      const sendToCosmosExecuted = parseEvent.find((event) => event.type === OraiBridgeEventType.EVENT_SEND_TO_COSMOS_EXECUTED_IBC_AUTO_FORWARD);
      const sendPacketData = parseEvent.find((event) => event.type === IBCEventType.SEND_PACKET);
      const ibcTransfer = parseEvent.find((event) => event.type === IBCEventType.IBC_TRANSFER);
      await oraiBridgeEvent.tendermintClient.disconnect();

      if (sendPacketData) {
        const packet_sequence = sendPacketData.attributes.find((attr) => attr.key === "packet_sequence")?.value;
        console.log({ packet_sequence });

        const rpc = "https://rpc.orai.io";
        const oraichainEvent = new OraichainEvent(db, handler, rpc);
        await oraichainEvent.connectCosmosSocket();
        if (packet_sequence) {
          const queryRecvPacket = buildQuery({
            tags: [
              { key: "message.action", value: IBCEventType.RECEIVE_PACKET },
              { key: "recv_packet.packet_sequence", value: packet_sequence }
            ]
          });
          const recvPacketTx = await oraichainEvent.tendermintClient.txSearch({ query: queryRecvPacket });
          const parseRecvPacketEvents = parseRpcEvents(recvPacketTx.txs[0].result.events);
          console.log({ parseRecvPacketEvents });
          const writeAcknowledgement = parseRecvPacketEvents.find((event) => event.type === "write_acknowledgement");
          const packet_ack = writeAcknowledgement?.attributes.find((attr) => attr.key === "packet_ack")?.value;
          console.log({ packet_ack });

          const queryAcknowledgePacket = buildQuery({
            tags: [
              { key: "message.action", value: IBCEventType.ACKNOWLEDGE_PACKET },
              { key: "acknowledge_packet.packet_sequence", value: packet_sequence }
            ]
          });

          const ackPacketData = await oraichainEvent.tendermintClient.txSearch({ query: queryAcknowledgePacket });
          const ackPacketEvent = parseRpcEvents(ackPacketData.txs[0].result.events);
          console.log({ ackPacketEvent });
        }
      }
    });
  });
});
