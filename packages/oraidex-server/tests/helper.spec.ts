import { getDate24hBeforeNow } from "../src/helper";

describe("test-helper", () => {
  it("test-getDate24hBeforeNow", () => {
    // setup
    const now = new Date("2023-07-16T16:07:48.000Z");
    // act
    const result = getDate24hBeforeNow(now);
    // assert
    expect(result).toEqual(new Date("2023-07-15T16:07:48.000Z"));
  });
});
