import path from "path";
import { fileURLToPath } from "url";
import { toPercentage } from "../src";
import { ZapConsumer } from "../src/zap-consumer";
import { OraiswapV3Client, OraiswapV3Types } from "@oraichain/oraidex-contracts-sdk";
import fs from "fs";
import { client } from "./test-common";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const admin = "orai1swus8mwu8xjulawqxdwh8hvg4gknh2c64tuc0k";
const alice = "orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g";
const bob = "orai1602dkqjvh4s7ryajnz2uwhr8vetrwr8nekpxv5";

describe("ZapConsumer", () => {
  // init dex
  let protocolFee = 250000000000;
  let dex: OraiswapV3Client;
  let zapper: ZapConsumer;

  beforeEach(async () => {
    const { codeId: dexCodeId } = await client.upload(
      admin,
      fs.readFileSync(path.resolve(__dirname, "data", "oraiswap-v3.wasm")),
      "auto"
    );

    const { codeId: multicalCodeId } = await client.upload(
      admin,
      fs.readFileSync(path.resolve(__dirname, "data", "multicall.wasm")),
      "auto"
    );

    const { contractAddress: multicallAddress } = await client.instantiate(
      admin,
      multicalCodeId,
      {},
      "multicall",
      "auto"
    );

    dex = new OraiswapV3Client(
      client,
      admin,
      (
        await client.instantiate(
          admin,
          dexCodeId,
          { protocol_fee: protocolFee } as OraiswapV3Types.InstantiateMsg,
          "oraiswap_v3",
          "auto"
        )
      ).contractAddress
    );
  });
});
