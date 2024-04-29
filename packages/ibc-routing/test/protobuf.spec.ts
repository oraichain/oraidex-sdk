import { expect } from "chai";
import { decodeIbcMemo } from "../src/utils/protobuf";

describe("Protobuf decode", () => {
  it("Test decode hook memo", () => {
    const memo =
      "ChTN93BiZ8jTFqOsHjuiiQGo1mlSwBIvb3JhaWIweDBkZUI1MjQ5OUMyZTlGMzkyMWM2MzFjYjZBZDM1MjJDNTc2ZDU0ODQaCmNoYW5uZWwtMjkiL29yYWliMHg1NWQzOTgzMjZmOTkwNTlmRjc3NTQ4NTI0Njk5OTAyN0IzMTk3OTU1";
    const decodedData = decodeIbcMemo(memo, true);
    expect(decodedData).eql({
      receiver: "zfdwYmfI0xajrB47ookBqNZpUsA=",
      destinationReceiver: "oraib0x0deB52499C2e9F3921c631cb6Ad3522C576d5484",
      destinationChannel: "channel-29",
      destinationDenom: "oraib0x55d398326f99059fF775485246999027B3197955"
    });
  });
  it("Test decode hook memo", () => {
    const memo =
      "ChTN93BiZ8jTFqOsHjuiiQGo1mlSwBIvb3JhaWIweDBkZUI1MjQ5OUMyZTlGMzkyMWM2MzFjYjZBZDM1MjJDNTc2ZDU0ODQaCmNoYW5uZWwtMjkiL29yYWliMHg1NWQzOTgzMjZmOTkwNTlmRjc3NTQ4NTI0Njk5OTAyN0IzMTk3OTU1";
    const decodedData = decodeIbcMemo(memo, true);
    expect(decodedData).eql({
      receiver: "zfdwYmfI0xajrB47ookBqNZpUsA=",
      destinationReceiver: "oraib0x0deB52499C2e9F3921c631cb6Ad3522C576d5484",
      destinationChannel: "channel-29",
      destinationDenom: "oraib0x55d398326f99059fF775485246999027B3197955"
    });
  });
});
