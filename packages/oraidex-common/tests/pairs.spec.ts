import { MILKY_CONTRACT, USDC_CONTRACT, USDT_CONTRACT } from "../src/constant";
import { getPairSwapV2, isFactoryV1 } from "../src/pairs";

describe("test pairs functions should behave correctly", () => {
  it.each<[string, string[], string, boolean]>([
    [MILKY_CONTRACT, [USDT_CONTRACT], "usdt", false],
    [USDC_CONTRACT, ["orai"], "orai", true]
  ])("test-getPairSwapV2", (contractAddress, expectedArr, exprectArrDenom, expectedArrIncludesOrai) => {
    const { arr, arrLength, arrIncludesOrai, arrDenom } = getPairSwapV2(contractAddress);
    expect(arr).toEqual(expectedArr);
    expect(arrLength).toEqual(arr!.length);
    expect(arrDenom).toEqual(exprectArrDenom);
    expect(arrIncludesOrai).toEqual(expectedArrIncludesOrai);
  });

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
});
