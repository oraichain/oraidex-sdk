import { generateError } from "@oraichain/oraidex-common";
import { OraiBridgeRouteData, splitOnce } from "@oraichain/oraidex-universal-swap";
import { decodeIbcMemo } from "./protobuf";

export const unmarshalOraiBridgeRoute = (destination: string): OraiBridgeRouteData => {
  const routeData: OraiBridgeRouteData = {
    oraiBridgeChannel: "",
    oraiReceiver: "",
    finalDestinationChannel: "",
    finalReceiver: "",
    tokenIdentifier: ""
  };
  const splittedDestination = splitOnce(destination, ":");
  const firstDestination = splittedDestination[0].split("/");

  if (firstDestination.length === 2) {
    routeData.oraiBridgeChannel = firstDestination[0];
    routeData.oraiReceiver = firstDestination[1];
  } else if (firstDestination.length === 1) {
    routeData.oraiReceiver = firstDestination[0];
  } else throw generateError(`First destination ${JSON.stringify(firstDestination)} of ${destination} is malformed`);

  if (splittedDestination.length === 1) return routeData;
  try {
    const decodedSecondDestination = decodeIbcMemo(splittedDestination[1], false);
    routeData.finalDestinationChannel = decodedSecondDestination.destinationChannel;
    routeData.tokenIdentifier = decodedSecondDestination.destinationDenom;
    routeData.finalReceiver = decodedSecondDestination.destinationReceiver;
    return routeData;
  } catch (err) {
    throw generateError(`Wrong formatter in base64`);
  }
};
