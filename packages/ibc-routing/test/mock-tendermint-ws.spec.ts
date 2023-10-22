import { Tendermint37Client, WebsocketClient } from "@cosmjs/tendermint-rpc";
import { TxData, TxEvent } from "@cosmjs/tendermint-rpc/build/tendermint37";
import { buildQuery } from "@cosmjs/tendermint-rpc/build/tendermint37/requests";
import { EventHandler, OraiBridgeEvent } from "../src/event";
import { DuckDbNode } from "../src/db";

export const oraiBridgeAutoForwardTx = {
  tx: "Cn0KYAolL2dyYXZpdHkudjEuTXNnRXhlY3V0ZUliY0F1dG9Gb3J3YXJkcxI3CDISLG9yYWliMTZtdzZ1NTYyNG03MGFwdWc2Zmg5YTlhdmV6ZjY3eTU2MnIwZHNuGgVvcmFpYhIUU2VudCB3aXRoIERlZXAgU3BhY2UY59yWBBJnClIKRgofL2Nvc21vcy5jcnlwdG8uc2VjcDI1NmsxLlB1YktleRIjCiECe0ZyCtvZLYgJolyLGFABMPV9Ycre2vSp9oUGhHaJ69oSBAoCCAEY0fkGEhEKCwoGdW9yYWliEgEwEPDJDxpAPj6SO09EYQcH9j/gGOzt2j/Wbk9jciWFWkkh7elj3KsWS8Igvtk48HOGiyEXgwgZD2xXcqKkrDsLgQsCcEXI2w==",
  hash: "5144ff1caf5b3d960978a3511490351670fbb8da604571e6652b78e7d11d9590",
  result: {
    code: 0,
    codespace: undefined,
    log: '[{"events":[{"type":"coin_received","attributes":[{"key":"receiver","value":"oraib1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejmgvu0t"},{"key":"amount","value":"1000000000000000oraib0x55d398326f99059fF775485246999027B3197955"},{"key":"receiver","value":"oraib1kq2rzz6fq2q7fsu75a9g7cpzjeanmk68vhhsty"},{"key":"amount","value":"1000000000000000oraib0x55d398326f99059fF775485246999027B3197955"}]},{"type":"coin_spent","attributes":[{"key":"spender","value":"oraib16n3lc7cywa68mg50qhp847034w88pntqzy3p9r"},{"key":"amount","value":"1000000000000000oraib0x55d398326f99059fF775485246999027B3197955"},{"key":"spender","value":"oraib1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejmgvu0t"},{"key":"amount","value":"1000000000000000oraib0x55d398326f99059fF775485246999027B3197955"}]},{"type":"gravity.v1.EventSendToCosmosExecutedIbcAutoForward","attributes":[{"key":"amount","value":"\\"1000000000000000\\""},{"key":"channel","value":"\\"channel-1\\""},{"key":"nonce","value":"\\"44326\\""},{"key":"receiver","value":"\\"channel-1/orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g:channel-29/eth-mainnet0xF540dEEee8d1C590c3ECfA5c52704D15fe6EA188:orai\\""},{"key":"timeout_height","value":"\\"0-0\\""},{"key":"timeout_time","value":"\\"1700542421011569802\\""},{"key":"token","value":"\\"oraib0x55d398326f99059fF775485246999027B3197955\\""}]},{"type":"ibc_transfer","attributes":[{"key":"sender","value":"oraib1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejmgvu0t"},{"key":"receiver","value":"orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g"}]},{"type":"message","attributes":[{"key":"action","value":"/gravity.v1.MsgExecuteIbcAutoForwards"},{"key":"sender","value":"oraib16n3lc7cywa68mg50qhp847034w88pntqzy3p9r"},{"key":"sender","value":"oraib1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejmgvu0t"},{"key":"module","value":"ibc_channel"},{"key":"module","value":"transfer"}]},{"type":"send_packet","attributes":[{"key":"packet_data","value":"{\\"amount\\":\\"1000000000000000\\",\\"denom\\":\\"oraib0x55d398326f99059fF775485246999027B3197955\\",\\"memo\\":\\"channel-29/eth-mainnet0xF540dEEee8d1C590c3ECfA5c52704D15fe6EA188:orai\\",\\"receiver\\":\\"orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g\\",\\"sender\\":\\"oraib1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejmgvu0t\\"}"},{"key":"packet_data_hex","value":"7b22616d6f756e74223a2231303030303030303030303030303030222c2264656e6f6d223a226f72616962307835356433393833323666393930353966463737353438353234363939393032374233313937393535222c226d656d6f223a226368616e6e656c2d32392f6574682d6d61696e6e65743078463534306445456565386431433539306333454366413563353237303444313566653645413138383a6f726169222c227265636569766572223a226f726169316734683634796a743066767a763576326a387479666e7065356b6d6e6574656a766667733767222c2273656e646572223a226f72616962316734683634796a743066767a763576326a387479666e7065356b6d6e6574656a6d6776753074227d"},{"key":"packet_timeout_height","value":"0-0"},{"key":"packet_timeout_timestamp","value":"1700542421011569802"},{"key":"packet_sequence","value":"6558"},{"key":"packet_src_port","value":"transfer"},{"key":"packet_src_channel","value":"channel-1"},{"key":"packet_dst_port","value":"wasm.orai195269awwnt5m6c843q6w7hp8rt0k7syfu9de4h0wz384slshuzps8y7ccm"},{"key":"packet_dst_channel","value":"channel-29"},{"key":"packet_channel_ordering","value":"ORDER_UNORDERED"},{"key":"packet_connection","value":"connection-1"}]},{"type":"transfer","attributes":[{"key":"recipient","value":"oraib1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejmgvu0t"},{"key":"sender","value":"oraib16n3lc7cywa68mg50qhp847034w88pntqzy3p9r"},{"key":"amount","value":"1000000000000000oraib0x55d398326f99059fF775485246999027B3197955"},{"key":"recipient","value":"oraib1kq2rzz6fq2q7fsu75a9g7cpzjeanmk68vhhsty"},{"key":"sender","value":"oraib1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejmgvu0t"},{"key":"amount","value":"1000000000000000oraib0x55d398326f99059fF775485246999027B3197955"}]}]}]',
    data: "CicKJS9ncmF2aXR5LnYxLk1zZ0V4ZWN1dGVJYmNBdXRvRm9yd2FyZHM=",
    events: [
      {
        type: "tx",
        attributes: [
          { key: "ZmVl", value: "MHVvcmFpYg==" },
          {
            key: "ZmVlX3BheWVy",
            value: "b3JhaWIxNm13NnU1NjI0bTcwYXB1ZzZmaDlhOWF2ZXpmNjd5NTYycjBkc24="
          }
        ]
      },
      {
        type: "tx",
        attributes: [
          {
            key: "YWNjX3NlcQ==",
            value: "b3JhaWIxNm13NnU1NjI0bTcwYXB1ZzZmaDlhOWF2ZXpmNjd5NTYycjBkc24vMTEzODcz"
          }
        ]
      },
      {
        type: "tx",
        attributes: [
          {
            key: "c2lnbmF0dXJl",
            value:
              "UGo2U08wOUVZUWNIOWovZ0dPenQyai9XYms5amNpV0ZXa2toN2VsajNLc1dTOElndnRrNDhIT0dpeUVYZ3dnWkQyeFhjcUtrckRzTGdRc0NjRVhJMnc9PQ=="
          }
        ]
      },
      {
        type: "message",
        attributes: [
          {
            key: "YWN0aW9u",
            value: "L2dyYXZpdHkudjEuTXNnRXhlY3V0ZUliY0F1dG9Gb3J3YXJkcw=="
          }
        ]
      },
      {
        type: "coin_spent",
        attributes: [
          {
            key: "c3BlbmRlcg==",
            value: "b3JhaWIxNm4zbGM3Y3l3YTY4bWc1MHFocDg0NzAzNHc4OHBudHF6eTNwOXI="
          },
          {
            key: "YW1vdW50",
            value: "MTAwMDAwMDAwMDAwMDAwMG9yYWliMHg1NWQzOTgzMjZmOTkwNTlmRjc3NTQ4NTI0Njk5OTAyN0IzMTk3OTU1"
          }
        ]
      },
      {
        type: "coin_received",
        attributes: [
          {
            key: "cmVjZWl2ZXI=",
            value: "b3JhaWIxZzRoNjR5anQwZnZ6djV2Mmo4dHlmbnBlNWttbmV0ZWptZ3Z1MHQ="
          },
          {
            key: "YW1vdW50",
            value: "MTAwMDAwMDAwMDAwMDAwMG9yYWliMHg1NWQzOTgzMjZmOTkwNTlmRjc3NTQ4NTI0Njk5OTAyN0IzMTk3OTU1"
          }
        ]
      },
      {
        type: "transfer",
        attributes: [
          {
            key: "cmVjaXBpZW50",
            value: "b3JhaWIxZzRoNjR5anQwZnZ6djV2Mmo4dHlmbnBlNWttbmV0ZWptZ3Z1MHQ="
          },
          {
            key: "c2VuZGVy",
            value: "b3JhaWIxNm4zbGM3Y3l3YTY4bWc1MHFocDg0NzAzNHc4OHBudHF6eTNwOXI="
          },
          {
            key: "YW1vdW50",
            value: "MTAwMDAwMDAwMDAwMDAwMG9yYWliMHg1NWQzOTgzMjZmOTkwNTlmRjc3NTQ4NTI0Njk5OTAyN0IzMTk3OTU1"
          }
        ]
      },
      {
        type: "message",
        attributes: [
          {
            key: "c2VuZGVy",
            value: "b3JhaWIxNm4zbGM3Y3l3YTY4bWc1MHFocDg0NzAzNHc4OHBudHF6eTNwOXI="
          }
        ]
      },
      {
        type: "coin_spent",
        attributes: [
          {
            key: "c3BlbmRlcg==",
            value: "b3JhaWIxZzRoNjR5anQwZnZ6djV2Mmo4dHlmbnBlNWttbmV0ZWptZ3Z1MHQ="
          },
          {
            key: "YW1vdW50",
            value: "MTAwMDAwMDAwMDAwMDAwMG9yYWliMHg1NWQzOTgzMjZmOTkwNTlmRjc3NTQ4NTI0Njk5OTAyN0IzMTk3OTU1"
          }
        ]
      },
      {
        type: "coin_received",
        attributes: [
          {
            key: "cmVjZWl2ZXI=",
            value: "b3JhaWIxa3Eycnp6NmZxMnE3ZnN1NzVhOWc3Y3B6amVhbm1rNjh2aGhzdHk="
          },
          {
            key: "YW1vdW50",
            value: "MTAwMDAwMDAwMDAwMDAwMG9yYWliMHg1NWQzOTgzMjZmOTkwNTlmRjc3NTQ4NTI0Njk5OTAyN0IzMTk3OTU1"
          }
        ]
      },
      {
        type: "transfer",
        attributes: [
          {
            key: "cmVjaXBpZW50",
            value: "b3JhaWIxa3Eycnp6NmZxMnE3ZnN1NzVhOWc3Y3B6amVhbm1rNjh2aGhzdHk="
          },
          {
            key: "c2VuZGVy",
            value: "b3JhaWIxZzRoNjR5anQwZnZ6djV2Mmo4dHlmbnBlNWttbmV0ZWptZ3Z1MHQ="
          },
          {
            key: "YW1vdW50",
            value: "MTAwMDAwMDAwMDAwMDAwMG9yYWliMHg1NWQzOTgzMjZmOTkwNTlmRjc3NTQ4NTI0Njk5OTAyN0IzMTk3OTU1"
          }
        ]
      },
      {
        type: "message",
        attributes: [
          {
            key: "c2VuZGVy",
            value: "b3JhaWIxZzRoNjR5anQwZnZ6djV2Mmo4dHlmbnBlNWttbmV0ZWptZ3Z1MHQ="
          }
        ]
      },
      {
        type: "send_packet",
        attributes: [
          {
            key: "cGFja2V0X2RhdGE=",
            value:
              "eyJhbW91bnQiOiIxMDAwMDAwMDAwMDAwMDAwIiwiZGVub20iOiJvcmFpYjB4NTVkMzk4MzI2Zjk5MDU5ZkY3NzU0ODUyNDY5OTkwMjdCMzE5Nzk1NSIsIm1lbW8iOiJjaGFubmVsLTI5L2V0aC1tYWlubmV0MHhGNTQwZEVFZWU4ZDFDNTkwYzNFQ2ZBNWM1MjcwNEQxNWZlNkVBMTg4Om9yYWkiLCJyZWNlaXZlciI6Im9yYWkxZzRoNjR5anQwZnZ6djV2Mmo4dHlmbnBlNWttbmV0ZWp2ZmdzN2ciLCJzZW5kZXIiOiJvcmFpYjFnNGg2NHlqdDBmdnp2NXYyajh0eWZucGU1a21uZXRlam1ndnUwdCJ9"
          },
          {
            key: "cGFja2V0X2RhdGFfaGV4",
            value:
              "N2IyMjYxNmQ2Zjc1NmU3NDIyM2EyMjMxMzAzMDMwMzAzMDMwMzAzMDMwMzAzMDMwMzAzMDMwMjIyYzIyNjQ2NTZlNmY2ZDIyM2EyMjZmNzI2MTY5NjIzMDc4MzUzNTY0MzMzOTM4MzMzMjM2NjYzOTM5MzAzNTM5NjY0NjM3MzczNTM0MzgzNTMyMzQzNjM5MzkzOTMwMzIzNzQyMzMzMTM5MzczOTM1MzUyMjJjMjI2ZDY1NmQ2ZjIyM2EyMjYzNjg2MTZlNmU2NTZjMmQzMjM5MmY2NTc0NjgyZDZkNjE2OTZlNmU2NTc0MzA3ODQ2MzUzNDMwNjQ0NTQ1NjU2NTM4NjQzMTQzMzUzOTMwNjMzMzQ1NDM2NjQxMzU2MzM1MzIzNzMwMzQ0NDMxMzU2NjY1MzY0NTQxMzEzODM4M2E2ZjcyNjE2OTIyMmMyMjcyNjU2MzY1Njk3NjY1NzIyMjNhMjI2ZjcyNjE2OTMxNjczNDY4MzYzNDc5NmE3NDMwNjY3NjdhNzYzNTc2MzI2YTM4NzQ3OTY2NmU3MDY1MzU2YjZkNmU2NTc0NjU2YTc2NjY2NzczMzc2NzIyMmMyMjczNjU2ZTY0NjU3MjIyM2EyMjZmNzI2MTY5NjIzMTY3MzQ2ODM2MzQ3OTZhNzQzMDY2NzY3YTc2MzU3NjMyNmEzODc0Nzk2NjZlNzA2NTM1NmI2ZDZlNjU3NDY1NmE2ZDY3NzY3NTMwNzQyMjdk"
          },
          { key: "cGFja2V0X3RpbWVvdXRfaGVpZ2h0", value: "MC0w" },
          {
            key: "cGFja2V0X3RpbWVvdXRfdGltZXN0YW1w",
            value: "MTcwMDU0MjQyMTAxMTU2OTgwMg=="
          },
          { key: "cGFja2V0X3NlcXVlbmNl", value: "NjU1OA==" },
          { key: "cGFja2V0X3NyY19wb3J0", value: "dHJhbnNmZXI=" },
          { key: "cGFja2V0X3NyY19jaGFubmVs", value: "Y2hhbm5lbC0x" },
          {
            key: "cGFja2V0X2RzdF9wb3J0",
            value: "d2FzbS5vcmFpMTk1MjY5YXd3bnQ1bTZjODQzcTZ3N2hwOHJ0MGs3c3lmdTlkZTRoMHd6Mzg0c2xzaHV6cHM4eTdjY20="
          },
          {
            key: "cGFja2V0X2RzdF9jaGFubmVs",
            value: "Y2hhbm5lbC0yOQ=="
          },
          {
            key: "cGFja2V0X2NoYW5uZWxfb3JkZXJpbmc=",
            value: "T1JERVJfVU5PUkRFUkVE"
          },
          {
            key: "cGFja2V0X2Nvbm5lY3Rpb24=",
            value: "Y29ubmVjdGlvbi0x"
          }
        ]
      },
      {
        type: "message",
        attributes: [{ key: "bW9kdWxl", value: "aWJjX2NoYW5uZWw=" }]
      },
      {
        type: "ibc_transfer",
        attributes: [
          {
            key: "c2VuZGVy",
            value: "b3JhaWIxZzRoNjR5anQwZnZ6djV2Mmo4dHlmbnBlNWttbmV0ZWptZ3Z1MHQ="
          },
          {
            key: "cmVjZWl2ZXI=",
            value: "b3JhaTFnNGg2NHlqdDBmdnp2NXYyajh0eWZucGU1a21uZXRlanZmZ3M3Zw=="
          }
        ]
      },
      {
        type: "message",
        attributes: [{ key: "bW9kdWxl", value: "dHJhbnNmZXI=" }]
      },
      {
        type: "gravity.v1.EventSendToCosmosExecutedIbcAutoForward",
        attributes: [
          { key: "YW1vdW50", value: "IjEwMDAwMDAwMDAwMDAwMDAi" },
          { key: "Y2hhbm5lbA==", value: "ImNoYW5uZWwtMSI=" },
          { key: "bm9uY2U=", value: "NDQyMzU=" },
          {
            key: "cmVjZWl2ZXI=",
            value:
              "ImNoYW5uZWwtMS9vcmFpMWc0aDY0eWp0MGZ2enY1djJqOHR5Zm5wZTVrbW5ldGVqdmZnczdnOmNoYW5uZWwtMjkvZXRoLW1haW5uZXQweEY1NDBkRUVlZThkMUM1OTBjM0VDZkE1YzUyNzA0RDE1ZmU2RUExODg6b3JhaSI="
          },
          { key: "dGltZW91dF9oZWlnaHQ=", value: "IjAtMCI=" },
          {
            key: "dGltZW91dF90aW1l",
            value: "IjE3MDA1NDI0MjEwMTE1Njk4MDIi"
          },
          {
            key: "dG9rZW4=",
            value: "Im9yYWliMHg1NWQzOTgzMjZmOTkwNTlmRjc3NTQ4NTI0Njk5OTAyN0IzMTk3OTU1Ig=="
          }
        ]
      }
    ],
    gasWanted: 255216,
    gasUsed: 127678
  },
  height: 8760836
};

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
