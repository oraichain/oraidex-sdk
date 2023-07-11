import * as helper from "../src/helper";

describe("test-helper", () => {
  it("test-parseWithdrawLiquidityAssets", () => {
    const result = helper.parseWithdrawLiquidityAssets(
      "2591orai, 773ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78"
    );
  });
});
