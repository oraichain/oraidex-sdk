import * as helper from "../src/tx-parsing";

describe("test-tx-parsing", () => {
  it.each<[string, string[]]>([
    [
      "2591orai, 773ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
      [
        "2591",
        "orai",
        "773",
        "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78",
      ],
    ],
    ["foo", []],
  ])("test-parseWithdrawLiquidityAssets", (assets, expectedParsing) => {
    // act
    const result = helper.parseWithdrawLiquidityAssets(assets);
    // assert
    expect(result).toEqual(expectedParsing);
  });
});
