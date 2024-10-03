import { ActionType, Path } from "../types";
import { SwapOperation } from "@oraichain/osor-api-contracts-sdk/src/types";
import bech32 from "bech32";

/**
 * Validates that the path only contains one action bridge, and this action must be the last of the path.
 * @param path The path to be validated
 */
export const validatePath = (path: Path) => {
  if (path.actions.length == 0) {
    throw new Error("Require at least one action");
  }
  const numBridgeActions = path.actions.filter((action) => action.type === ActionType.Bridge).length;

  if (numBridgeActions > 1) {
    throw new Error("Only one Bridge action is allowed in the path");
  }

  if (numBridgeActions == 1 && path.actions[path.actions.length - 1].type !== ActionType.Bridge) {
    throw new Error("Bridge action must be the last in the path");
  }
};

// This function checks whether the given address is a CW20 token address
export const isCw20Token = (address: string): boolean => {
  try {
    // Attempt to decode the address using the bech32 library
    bech32.decode(address);
    // If decoding is successful, return true as it is a valid CW20 token address
    return true;
  } catch (err) {
    // If an error occurs during decoding, return false indicating that it is not a valid CW20 token address
    return false;
  }
};
