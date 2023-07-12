import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { stringToPath } from "@cosmjs/crypto";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { GasPrice } from "@cosmjs/stargate";
import "dotenv/config";
import { matchingOrders } from "./index";

const mnemonicMinLength = 12; // 12 words

(async () => {
  const prefix = "orai";
  const mnemonic = process.env["MNEMONIC"];
  const mnemonicWords = mnemonic.split(" ");
  const contractAddr = process.env.CONTRACT;
  if (
    !mnemonic ||
    (mnemonicWords.length != mnemonicMinLength &&
      mnemonicWords.length != mnemonicMinLength * 2)
  ) {
    throw new Error(
      `Must set MNEMONIC to a 12 or word phrase. Has: ${mnemonic.length}`
    );
  }
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
    hdPaths: [stringToPath(process.env.HD_PATH || "m/44'/118'/0'/0/0")],
    prefix,
  });
  const [firstAccount] = await wallet.getAccounts();
  const senderAddress = firstAccount.address;
  const client = await SigningCosmWasmClient.connectWithSigner(
    process.env.RPC_URL!,
    wallet,
    {
      gasPrice: GasPrice.fromString("0.002orai"),
      prefix,
    }
  );

  while (true) {
    try {
      await matchingOrders(client, senderAddress, contractAddr, 30, "orai");
    } catch (error) {
      console.error(error);
    }

    // await delay(1000);
  }
})();
