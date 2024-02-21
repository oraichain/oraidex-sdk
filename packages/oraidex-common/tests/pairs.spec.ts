import {
  AIRI_CONTRACT,
  ATOM_ORAICHAIN_DENOM,
  BTC_CONTRACT,
  INJECTIVE_CONTRACT,
  KWT_CONTRACT,
  MILKY_CONTRACT,
  NEUTARO_ORAICHAIN_DENOM,
  ORAI,
  ORAIX_CONTRACT,
  OSMOSIS_ORAICHAIN_DENOM,
  SCATOM_CONTRACT,
  SCORAI_CONTRACT,
  TRX_CONTRACT,
  USDC_CONTRACT,
  USDT_CONTRACT,
  WETH_CONTRACT
} from "../src/constant";
import { PAIRS, isFactoryV1, isInPairList, pairLpTokens } from "../src/pairs";

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

  it("test-PAIRS-should-persist-correct-order-and-has-correct-data", () => {
    // this test should be updated once there's a new pair coming
    expect(PAIRS).toEqual([
      {
        asset_infos: [{ token: { contract_addr: AIRI_CONTRACT } }, { native_token: { denom: ORAI } }],
        symbols: ["AIRI", "ORAI"],
        factoryV1: true,
        lp_token: pairLpTokens.AIRI_ORAI
      },
      {
        asset_infos: [{ token: { contract_addr: ORAIX_CONTRACT } }, { native_token: { denom: ORAI } }],
        symbols: ["ORAIX", "ORAI"],
        factoryV1: true,
        lp_token: pairLpTokens.ORAIX_ORAI
      },
      {
        asset_infos: [{ token: { contract_addr: SCORAI_CONTRACT } }, { native_token: { denom: ORAI } }],
        symbols: ["scORAI", "ORAI"],
        lp_token: pairLpTokens.SCORAI_ORAI
      },
      {
        asset_infos: [{ native_token: { denom: ORAI } }, { native_token: { denom: ATOM_ORAICHAIN_DENOM } }],
        symbols: ["ORAI", "ATOM"],
        factoryV1: true,
        lp_token: pairLpTokens.ATOM_ORAI
      },
      {
        asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: USDT_CONTRACT } }],
        symbols: ["ORAI", "USDT"],
        factoryV1: true,
        lp_token: pairLpTokens.USDT_ORAI
      },
      {
        asset_infos: [{ token: { contract_addr: KWT_CONTRACT } }, { native_token: { denom: ORAI } }],
        symbols: ["KWT", "ORAI"],
        factoryV1: true,
        lp_token: pairLpTokens.KWT_ORAI
      },
      {
        asset_infos: [{ native_token: { denom: ORAI } }, { native_token: { denom: OSMOSIS_ORAICHAIN_DENOM } }],
        symbols: ["ORAI", "OSMO"],
        factoryV1: true,
        lp_token: pairLpTokens.OSMO_ORAI
      },
      {
        asset_infos: [{ token: { contract_addr: MILKY_CONTRACT } }, { token: { contract_addr: USDT_CONTRACT } }],
        symbols: ["MILKY", "USDT"],
        factoryV1: true,
        lp_token: pairLpTokens.MILKY_USDT
      },
      {
        asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: USDC_CONTRACT } }],
        symbols: ["ORAI", "USDC"],
        lp_token: pairLpTokens.USDC_ORAI
      },
      {
        asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: TRX_CONTRACT } }],
        symbols: ["ORAI", "wTRX"],
        lp_token: pairLpTokens.TRX_ORAI
      },
      {
        asset_infos: [{ token: { contract_addr: SCATOM_CONTRACT } }, { native_token: { denom: ATOM_ORAICHAIN_DENOM } }],
        symbols: ["scATOM", "ATOM"],
        lp_token: pairLpTokens.SCATOM_ATOM
      },
      {
        asset_infos: [{ token: { contract_addr: INJECTIVE_CONTRACT } }, { native_token: { denom: ORAI } }],
        symbols: ["INJ", "ORAI"],
        lp_token: pairLpTokens.INJ_ORAI
      },
      {
        asset_infos: [{ token: { contract_addr: USDC_CONTRACT } }, { token: { contract_addr: ORAIX_CONTRACT } }],
        symbols: ["USDC", "ORAIX"],
        lp_token: pairLpTokens.USDC_ORAIX
      },
      {
        asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: WETH_CONTRACT } }],
        symbols: ["ORAI", "WETH"],
        lp_token: pairLpTokens.ORAI_WETH
      },
      {
        asset_infos: [{ native_token: { denom: ORAI } }, { token: { contract_addr: BTC_CONTRACT } }],
        symbols: ["ORAI", "BTC"],
        lp_token: pairLpTokens.ORAI_BTC
      },
      {
        asset_infos: [
          { native_token: { denom: NEUTARO_ORAICHAIN_DENOM } },
          { token: { contract_addr: USDC_CONTRACT } }
        ],
        symbols: ["NTMPI", "USDC"],
        lp_token: pairLpTokens.NTMPI_USDC
      }
    ]);
  });
});
