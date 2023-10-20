import { ethers } from "ethers";
import { Gravity__factory, Gravity } from "@oraichain/oraidex-common";

const listenToSendToCosmosEvent = () => {
  const gravity: Gravity = Gravity__factory.connect(
    ethers.utils.getAddress("0xb40C364e70bbD98E8aaab707A41a52A2eAF5733f"),
    new ethers.providers.JsonRpcProvider("https://1rpc.io/bnb")
  );
  gravity.on(gravity.filters.SendToCosmosEvent(), (a, b, c, d, e) => {
    console.log(a, b, c, d, e);
  });
};

listenToSendToCosmosEvent();
