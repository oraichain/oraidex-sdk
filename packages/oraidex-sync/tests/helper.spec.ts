import { Asset, AssetInfo } from "@oraichain/oraidex-contracts-sdk";
import {
  calculatePrefixSum,
  findAssetInfoPathToUsdt,
  findMappedTargetedAssetInfo,
  extractUniqueAndFlatten,
  findPairAddress,
  calculatePriceByPool
} from "../src/helper";
import { pairs } from "../src/pairs";
import {
  ORAI,
  airiCw20Adress,
  milkyCw20Address,
  scAtomCw20Address,
  usdcCw20Address,
  usdtCw20Address
} from "../src/constants";
import { PairInfoData } from "../src/types";

describe("test-helper", () => {
  it.each<[AssetInfo, number]>([
    [{ token: { contract_addr: usdtCw20Address } }, 2],
    [{ token: { contract_addr: usdcCw20Address } }, 1],
    [{ native_token: { denom: "orai" } }, 9],
    [{ token: { contract_addr: airiCw20Adress } }, 1]
  ])("test-findMappedTargetedAssetInfo", (info, expectedListLength) => {
    // setup

    // act
    const result = findMappedTargetedAssetInfo(info);

    // assert
    expect(result.length).toEqual(expectedListLength);
  });

  it.each<[AssetInfo, number]>([
    [{ token: { contract_addr: usdtCw20Address } }, 1],
    [{ native_token: { denom: "orai" } }, 2],
    [{ token: { contract_addr: airiCw20Adress } }, 3],
    [{ token: { contract_addr: milkyCw20Address } }, 2],
    [{ token: { contract_addr: scAtomCw20Address } }, 4]
  ])("test-findAssetInfoPathToUsdt", (info, expectedListLength) => {
    // setup

    // act
    const result = findAssetInfoPathToUsdt(info);

    // assert
    expect(result.length).toEqual(expectedListLength);
  });

  it("test-calculatePrefixSum", () => {
    const data = [
      {
        denom: "foo",
        amount: 100
      },
      { denom: "foo", amount: 10 },
      { denom: "bar", amount: 5 },
      { denom: "bar", amount: -1 },
      { denom: "hello", amount: 5 }
    ];
    const result = calculatePrefixSum(1, data);
    expect(result).toEqual([
      { denom: "foo", amount: 101 },
      { denom: "foo", amount: 111 },
      { denom: "bar", amount: 6 },
      { denom: "bar", amount: 5 },
      { denom: "hello", amount: 6 }
    ]);
  });

  it("test-extractUniqueAndFlatten-extracting-unique-items-in-pair-mapping", () => {
    // act
    const result = extractUniqueAndFlatten(pairs);
    // assert
    expect(result).toEqual([
      { native_token: { denom: "orai" } },
      { token: { contract_addr: "orai10ldgzued6zjp0mkqwsv2mux3ml50l97c74x8sg" } },
      { token: { contract_addr: "orai1lus0f0rhx8s03gdllx2n6vhkmf0536dv57wfge" } },
      {
        token: { contract_addr: "orai1065qe48g7aemju045aeyprflytemx7kecxkf5m7u5h5mphd0qlcs47pclp" }
      },
      {
        native_token: { denom: "ibc/A2E2EEC9057A4A1C2C0A6A4C78B0239118DF5F278830F50B4A6BDD7A66506B78" }
      },
      { token: { contract_addr: "orai12hzjxfh77wl572gdzct2fxv2arxcwh6gykc7qh" } },
      { token: { contract_addr: "orai1nd4r053e3kgedgld2ymen8l9yrw8xpjyaal7j5" } },
      {
        native_token: { denom: "ibc/9C4DCD21B48231D0BC2AC3D1B74A864746B37E4292694C93C617324250D002FC" }
      },
      { token: { contract_addr: "orai1gzvndtzceqwfymu2kqhta2jn6gmzxvzqwdgvjw" } },
      {
        token: { contract_addr: "orai15un8msx3n5zf9ahlxmfeqd2kwa5wm0nrpxer304m9nd5q6qq0g6sku5pdd" }
      },
      {
        token: { contract_addr: "orai1c7tpjenafvgjtgm9aqwm7afnke6c56hpdms8jc6md40xs3ugd0es5encn0" }
      },
      {
        token: { contract_addr: "orai19q4qak2g3cj2xc2y3060t0quzn3gfhzx08rjlrdd3vqxhjtat0cq668phq" }
      }
    ]);
  });
  it.each<[AssetInfo, string | undefined]>([
    [{ token: { contract_addr: usdtCw20Address } }, "orai1c5s03c3l336dgesne7dylnmhszw8554tsyy9yt"],
    [{ token: { contract_addr: "foo" } }, undefined]
  ])("test-findPairAddress", (assetInfo, expectedPairAddr) => {
    // setup
    let pairInfoData: PairInfoData[] = [
      {
        firstAssetInfo: JSON.stringify({ native_token: { denom: ORAI } } as AssetInfo),
        secondAssetInfo: JSON.stringify({ token: { contract_addr: usdtCw20Address } } as AssetInfo),
        commissionRate: "",
        pairAddr: "orai1c5s03c3l336dgesne7dylnmhszw8554tsyy9yt",
        liquidityAddr: "",
        oracleAddr: ""
      }
    ];
    let assetInfos: [AssetInfo, AssetInfo] = [{ native_token: { denom: ORAI } }, assetInfo];

    // act
    const result = findPairAddress(pairInfoData, assetInfos);

    // assert
    expect(result).toEqual(expectedPairAddr);
  });

  it("test-calculatePriceByPool", () => {
    const result = calculatePriceByPool(BigInt(10305560305234), BigInt(10205020305234), 0);
    console.log("result: ", result.toString());
  });
});
