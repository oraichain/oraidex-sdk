import { QueryTag, WebsocketClient } from "@cosmjs/tendermint-rpc";
import { Tendermint37Client } from "@cosmjs/tendermint-rpc/build/tendermint37";
import { buildQuery } from "@cosmjs/tendermint-rpc/build/tendermint37/requests";
import { AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";
import { parseRpcEvents } from "@oraichain/oraidex-common";
import { CosmosPhase, Phase } from "./phase";

const testEvent = [
  {
    type: "coin_spent",
    attributes: [
      {
        key: "spender",
        value: "orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g"
      },
      { key: "amount", value: "2855orai" }
    ]
  },
  {
    type: "coin_received",
    attributes: [
      {
        key: "receiver",
        value: "orai17xpfvakm2amg962yls6f84z3kell8c5lr24r2w"
      },
      { key: "amount", value: "2855orai" }
    ]
  },
  {
    type: "transfer",
    attributes: [
      {
        key: "recipient",
        value: "orai17xpfvakm2amg962yls6f84z3kell8c5lr24r2w"
      },
      {
        key: "sender",
        value: "orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g"
      },
      { key: "amount", value: "2855orai" }
    ]
  },
  {
    type: "message",
    attributes: [
      {
        key: "sender",
        value: "orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g"
      }
    ]
  },
  {
    type: "tx",
    attributes: [
      { key: "fee", value: "2855orai" },
      {
        key: "fee_payer",
        value: "orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g"
      }
    ]
  },
  {
    type: "tx",
    attributes: [
      {
        key: "acc_seq",
        value: "orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g/1516"
      }
    ]
  },
  {
    type: "tx",
    attributes: [
      {
        key: "signature",
        value: "35GSrUsvywZAVifR/fPIZ1KN1k1bGzJdVz3TwnJUebAYYYnUx1sZuUbEdobrPNxU8pAGwneZHzc6xSiccb4PIQ=="
      }
    ]
  },
  {
    type: "message",
    attributes: [{ key: "action", value: "/cosmwasm.wasm.v1.MsgExecuteContract" }]
  },
  {
    type: "message",
    attributes: [
      { key: "module", value: "wasm" },
      {
        key: "sender",
        value: "orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g"
      }
    ]
  },
  {
    type: "coin_spent",
    attributes: [
      {
        key: "spender",
        value: "orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g"
      },
      { key: "amount", value: "10orai" }
    ]
  },
  {
    type: "coin_received",
    attributes: [
      {
        key: "receiver",
        value: "orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm"
      },
      { key: "amount", value: "10orai" }
    ]
  },
  {
    type: "transfer",
    attributes: [
      {
        key: "recipient",
        value: "orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm"
      },
      {
        key: "sender",
        value: "orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g"
      },
      { key: "amount", value: "10orai" }
    ]
  },
  {
    type: "execute",
    attributes: [
      {
        key: "_contract_address",
        value: "orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm"
      }
    ]
  },
  {
    type: "wasm",
    attributes: [
      {
        key: "_contract_address",
        value: "orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm"
      },
      { key: "action", value: "transfer" },
      { key: "type", value: "transfer_back_to_remote_chain" },
      {
        key: "sender",
        value: "orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g"
      },
      {
        key: "receiver",
        value: "oraib1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejmgvu0t"
      },
      {
        key: "denom",
        value:
          "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm/channel-29/oraib0xA325Ad6D9c92B55A3Fc5aD7e412B1518F96441C0"
      },
      { key: "amount", value: "10000000000000" },
      { key: "token_fee", value: "0" },
      { key: "relayer_fee", value: "0" }
    ]
  },
  {
    type: "send_packet",
    attributes: [
      {
        key: "packet_data",
        value:
          '{"amount":"10000000000000","denom":"wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm/channel-29/oraib0xA325Ad6D9c92B55A3Fc5aD7e412B1518F96441C0","receiver":"oraib1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejmgvu0t","sender":"orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g","memo":"oraib0x7ae6c941fC3623253cF8Abd6A895D085353e193C"}'
      },
      {
        key: "packet_data_hex",
        value:
          "7b22616d6f756e74223a223130303030303030303030303030222c2264656e6f6d223a227761736d2e6f7261693139353236396177776e74356d3663383433713677376870387274306b3773796675396465346830777a333834736c7368757a707338793763636d2f6368616e6e656c2d32392f6f72616962307841333235416436443963393242353541334663356144376534313242313531384639363434314330222c227265636569766572223a226f72616962316734683634796a743066767a763576326a387479666e7065356b6d6e6574656a6d6776753074222c2273656e646572223a226f726169316734683634796a743066767a763576326a387479666e7065356b6d6e6574656a766667733767222c226d656d6f223a226f72616962307837616536633934316643333632333235336346384162643641383935443038353335336531393343227d"
      },
      { key: "packet_timeout_height", value: "0-0" },
      { key: "packet_timeout_timestamp", value: "1697330509202011360" },
      { key: "packet_sequence", value: "8090" },
      {
        key: "packet_src_port",
        value: "wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm"
      },
      { key: "packet_src_channel", value: "channel-29" },
      { key: "packet_dst_port", value: "transfer" },
      { key: "packet_dst_channel", value: "channel-1" },
      { key: "packet_channel_ordering", value: "ORDER_UNORDERED" },
      { key: "packet_connection", value: "connection-38" }
    ]
  }
];

const testTxHash = "EE5964D52E76511ECE1533B209E6C0B1121808934D1141F1BE50FB44AD5982B5";

export class BridgeContext {
  public readonly queryTags: QueryTag[] = [{ key: "wasm.type", value: "transfer_back_to_remote_chain" }];
  public phase: Phase;
  constructor(public readonly conn: AsyncDuckDBConnection, private readonly baseUrl: string) {
    this.phase = new CosmosPhase(this); // TODO: need to if-else based on event to switch phase
  }

  connectCosmosSocket = async () => {
    const client = await Tendermint37Client.create(new WebsocketClient(this.baseUrl));
    const stream = client.subscribeTx(
      buildQuery({
        tags: this.queryTags
      })
    );
    stream.subscribe({
      next: async (event) => {
        const parsedEvents = parseRpcEvents(event.result.events);
        console.dir(parsedEvents, { depth: null });
        await this.phase.processPhase(event);
        //   console.log("logs: ", event.result.log);
        //   console.log("send packet: ", event.result.events.find((ev) => ev.type === "send_packet").attributes);
      }
    });

    const id = testTxHash;
    await conn.send();
  };
}
