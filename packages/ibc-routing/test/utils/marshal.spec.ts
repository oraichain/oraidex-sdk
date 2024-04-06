import { unmarshalOraiBridgeRoute } from "../../src/utils/marshal";

describe("Marshal encode/decoder", () => {
  it("Test decode marshal", () => {
    const destination =
      "channel-1/orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd:CjVldGgtbWFpbm5ldDB4MGRlQjUyNDk5QzJlOUYzOTIxYzYzMWNiNkFkMzUyMkM1NzZkNTQ4NBIKY2hhbm5lbC0yORo1ZXRoLW1haW5uZXQweGRBQzE3Rjk1OEQyZWU1MjNhMjIwNjIwNjk5NDU5N0MxM0Q4MzFlYzc=";
    expect(JSON.stringify(unmarshalOraiBridgeRoute(destination))).toBe(
      JSON.stringify({
        oraiBridgeChannel: "channel-1",
        oraiReceiver: "orai1ehmhqcn8erf3dgavrca69zgp4rtxj5kqgtcnyd",
        finalDestinationChannel: "channel-29",
        finalReceiver: "eth-mainnet0x0deB52499C2e9F3921c631cb6Ad3522C576d5484",
        tokenIdentifier: "eth-mainnet0xdAC17F958D2ee523a2206206994597C13D831ec7"
      })
    );
  });
});
