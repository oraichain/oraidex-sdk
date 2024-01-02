import { UserWallet, decrypt, delay, setupWallet } from "@oraichain/oraitrading-common";
import { WebhookClient, time, userMention } from "discord.js";

import "dotenv/config";
import { matchingOrders } from "./index";

async function getSender(rpcUrl: string): Promise<UserWallet | string> {
  try {
    const sender = await setupWallet(
      process.env.MNEMONIC ?? decrypt(process.env.MNEMONIC_PASS, process.env.MNEMONIC_ENCRYPTED),
      {
        hdPath: process.env.HD_PATH ?? "m/44'/118'/0'/0/0",
        rpcUrl,
        prefix: "orai",
        gasPrices: "0.001"
      }
    );
    return sender;
  } catch (error: any) {
    console.log({ error: error.message });
    return "Error: " + error.message;
  }
}

(async () => {
  const contractAddr = process.env.CONTRACT;
  const webhookUrl = process.env.DISCORD_WEBHOOK ?? "";
  const discordUserIds: string[] = process.env.DISCORD_USERS_IDS?.split(",") || [];

  const rpcUrl = process.env.RPC_URL ?? "https://rpc.orai.io";

  if (webhookUrl === "") {
    throw new Error("Discord webhook is not set!");
  }

  let mentionUserIds: string = "";
  for (const userId of discordUserIds) {
    mentionUserIds = " " + mentionUserIds + userMention(userId.replace(/[']/g, "")) + " ";
  }

  const webhookClient = new WebhookClient({
    url: webhookUrl
  });

  const sender = await getSender(rpcUrl);
  if (typeof sender === "string") {
    throw new Error("Cannot get sender - err: " + sender);
  }
  while (true) {
    const date: Date = new Date();
    try {
      const res = await matchingOrders(sender, contractAddr, 100, "orai");
      if (res !== undefined) {
        await webhookClient.send(
          `:receipt: BOT: ${sender.address} - matched - txHash: ${res.transactionHash}` + ` at ${time(date)}`
        );
      }
    } catch (error) {
      console.error(error);
      await webhookClient.send(
        `:red_circle: BOT: ${sender.address} - err ` + error.message + ` at ${time(date)}` + mentionUserIds
      );
      await delay(5000);
    }
  }
})();
