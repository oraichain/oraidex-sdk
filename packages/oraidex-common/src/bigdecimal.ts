type DecimalLike = string | number | bigint | BigDecimal;

export class BigDecimal {
  private bigInt: bigint;

  constructor(value: DecimalLike, protected decimals: number = 6) {
    if (typeof value === "string") {
      const [ints, decis] = value.split(".");
      const padding = decis ? decis.padEnd(decimals, "0").substring(0, decimals) : "0".repeat(decimals);
      this.bigInt = BigInt(ints + padding);
    } else if (typeof value === "number") {
      return new BigDecimal(value.toString(), decimals);
    } else if (typeof value === "bigint") {
      this.bigInt = value * 10n ** BigInt(decimals);
    } else {
      this.bigInt = value.bigInt;
      this.decimals = value.decimals;
    }
  }

  private processDecimal = (value: DecimalLike): BigDecimal => {
    if (value instanceof BigDecimal) {
      if (value.decimals > this.decimals) {
        this.bigInt *= 10n ** BigInt(value.decimals - this.decimals);
        this.decimals = value.decimals;
      } else if (this.decimals > value.decimals) {
        value.bigInt *= 10n ** BigInt(this.decimals - value.decimals);
        value.decimals = this.decimals;
      }
      // same decimal
      return value;
    }
    return new BigDecimal(value, this.decimals);
  };

  toString() {
    let str = this.bigInt.toString();
    let ret = "";
    // minus
    if (str[0] === "-") {
      ret += "-";
      str = str.substring(1);
    }

    const padStartLen = this.decimals - str.length;

    if (padStartLen >= 0) {
      // need padding some
      if (padStartLen > 0) str = "0".repeat(padStartLen) + str;
      // the nominator is 0
      ret += "0";
    } else {
      // get the nominator part
      ret += str.slice(0, -this.decimals);
    }

    let denominator = str.slice(-this.decimals).replace(/0+$/, "");
    if (denominator) {
      ret += "." + denominator;
    }

    return ret;
  }

  toNumber() {
    return Number(this.toString());
  }

  clone(): BigDecimal {
    return new BigDecimal(this);
  }

  private iadd(other: DecimalLike) {
    const otherDecimal = this.processDecimal(other);
    this.bigInt += otherDecimal.bigInt;
    return this;
  }

  private isub(other: DecimalLike) {
    const otherDecimal = this.processDecimal(other);
    this.bigInt -= otherDecimal.bigInt;
    return this;
  }

  private idiv(other: DecimalLike) {
    const otherDecimal = this.processDecimal(other);
    this.bigInt = (this.bigInt * 10n ** BigInt(this.decimals)) / otherDecimal.bigInt;
    return this;
  }

  private imul(other: DecimalLike) {
    const otherDecimal = this.processDecimal(other);
    this.bigInt *= otherDecimal.bigInt;
    this.bigInt /= 10n ** BigInt(this.decimals);
    return this;
  }

  add(other: DecimalLike) {
    return this.clone().iadd(other);
  }

  sub(other: DecimalLike) {
    return this.clone().isub(other);
  }

  div(other: DecimalLike) {
    return this.clone().idiv(other);
  }

  mul(other: DecimalLike) {
    return this.clone().imul(other);
  }

  valueOf() {
    return this.toNumber();
  }
}
