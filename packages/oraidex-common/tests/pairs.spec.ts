import { MILKY_CONTRACT, OSMOSIS_ORAICHAIN_DENOM, USDC_CONTRACT, USDT_CONTRACT } from "../src/constant";
import { isFactoryV1, isInPairList } from "../src/pairs";

describe("test pairs functions should behave correctly", () => {
  it("test-isFactoryV1", () => {
    const oraiToken = { native_token: { denom: "orai" } };
    expect(
      isFactoryV1([oraiToken, { token: { contract_addr: "orai10ldgzued6zjp0mkqwsv2mux3ml50l97c74x8sg" } }])
    ).toEqual(true);

    expect(
      isFactoryV1([
        oraiToken,
        { token: { contract_addr: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd" } }
      ])
    ).toEqual(false);
  });

  it.each<[string, boolean]>([
    [USDT_CONTRACT, true],
    [OSMOSIS_ORAICHAIN_DENOM, true],
    ["foobar", false]
  ])("test-isInPairList", (identifier, expectedResult) => {
    expect(isInPairList(identifier)).toEqual(expectedResult);
  });
});
