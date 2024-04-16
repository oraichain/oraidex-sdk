import { Event } from "@cosmjs/tendermint-rpc/build/tendermint37";

export function isBase64(str: string) {
  try {
    return btoa(atob(str)) === str;
  } catch (err) {
    return false;
  }
}

export const parseRpcEvents = (events: readonly Event[]): Event[] => {
  return events.map((ev: any) => ({
    ...ev,
    attributes: ev.attributes.map((attr) => {
      let obj;
      try {
        obj = {
          key: isBase64(attr.key) ? Buffer.from(attr.key, "base64").toString("utf-8") : attr.key,
          value: isBase64(attr.value) ? Buffer.from(attr.value, "base64").toString("utf-8") : attr.value
        };
      } catch (err) {
        obj = {
          key: isBase64(attr.key) ? Buffer.from(attr.key, "base64").toString("utf-8") : attr.key,
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
