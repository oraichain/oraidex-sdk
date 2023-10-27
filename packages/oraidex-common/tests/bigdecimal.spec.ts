import { BigDecimal } from "../src/bigdecimal";

describe("add", function () {
  it("should be defined", function () {
    expect(BigDecimal.prototype.add).toBeDefined();
  });

  it("should: 12+13 = 25", function () {
    expect(new BigDecimal("12").add("13").toString()).toBe("25");
  });

  it("should: 12-13 = -1", function () {
    expect(new BigDecimal("12").add("-13").toString()).toBe("-1");
  });

  it("should: 12.12+13.94 = 26.06", function () {
    expect(new BigDecimal("12.12").add("13.94").toString()).toBe("26.06");
  });

  it("should: 12-135 = -123", function () {
    expect(new BigDecimal("12").add("-135").toString()).toBe("-123");
  });

  it("should: 12.67+13 = 25.67", function () {
    expect(new BigDecimal("12.67").add("13").toString()).toBe("25.67");
  });

  it("should: -12.67+13 = 0.33", function () {
    expect(new BigDecimal("-12.67").add("13").toString()).toBe("0.33");
  });

  it("should: 12.67-13 = -0.33", function () {
    expect(new BigDecimal("12.67").add("-13").toString()).toBe("-0.33");
  });

  it("should: 0.012-0.013 = -0.001", function () {
    expect(new BigDecimal("0.012").add("-0.013").toString()).toBe("-0.001");
  });

  it("should: -12.67-13 = -0.33", function () {
    expect(new BigDecimal("-12.67").add("-13").toString()).toBe("-25.67");
  });

  it("should: 12.67+.13 = 12.8", function () {
    expect(new BigDecimal("12.67").add(".13").toString()).toBe("12.8");
  });

  it("should: 100-12 = 88", function () {
    expect(new BigDecimal("100").add("-12").toString()).toBe("88");
  });

  it("should: 126.7-13 = 113.7", function () {
    expect(new BigDecimal("126.7").add("-13").toString()).toBe("113.7");
  });
  it("should: 12.67-130.7 = -118.03", function () {
    expect(new BigDecimal("12.67").add("-130.7").toString()).toBe("-118.03");
  });
  it("should: 10+(-0) = 10", function () {
    expect(new BigDecimal("10").add("-0").toString()).toBe("10");
  });
});
