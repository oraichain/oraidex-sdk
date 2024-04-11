import { Event } from "@cosmjs/tendermint-rpc/build/tendermint37";

export const parseRpcEvents = (events: readonly Event[]): Event[] => {
  return events.map((ev: any) => ({
    ...ev,
    attributes: ev.attributes.map((attr) => {
      let obj;
      try {
        obj = {
          key: Buffer.from(attr.key, "base64").toString("utf-8"),
          value: Buffer.from(attr.value, "base64").toString("utf-8")
        };
      } catch (err) {
        obj = {
          key: Buffer.from(attr.key, "base64").toString("utf-8"),
          value: attr.value
        };
      }
      return obj;
    })
  }));
};

export const encodeRpcEvents = (events: readonly Event[]): Event[] => {
  return events.map((ev: any) => ({
    ...ev,
    attributes: ev.attributes.map((attr: any) => {
      return {
        key: Buffer.from(attr.key).toString("base64"),
        value: Buffer.from(attr.value).toString("base64")
      };
    })
  }));
};
