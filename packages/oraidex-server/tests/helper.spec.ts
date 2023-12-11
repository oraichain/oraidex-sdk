import { getDate24hBeforeNow, validateContractAddress } from "../src/helper";

describe("test-helper", () => {
  it("test-getDate24hBeforeNow", () => {
    // setup
    const now = new Date("2023-07-16T16:07:48.000Z");
    // act
    const result = getDate24hBeforeNow(now);
    // assert
    expect(result).toEqual(new Date("2023-07-15T16:07:48.000Z"));
  });

  it.each([
    ["orai", false],
    ["orai1234", false],
    ["abc", false],
    ["orai1lus0f0rhx8s03gdllx2n6vhkmf0536dv57wfge", true], // ORAIX
    ["orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh", true] // USDT
  ])("test-validateContractAddress", (contractAddress, expected) => {
    const checkContractAddress = validateContractAddress(contractAddress);
    // assert
    expect(checkContractAddress).toEqual(expected);
  });
});
