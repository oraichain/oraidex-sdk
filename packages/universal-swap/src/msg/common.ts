import { ActionType, Path } from "../types";
import bech32 from "bech32";
import { generateError } from "@oraichain/oraidex-common";

/**
 * Validates that the path only contains one action bridge, and this action must be the last of the path.
 * @param path The path to be validated
 */
export const validatePath = (path: Path, hasSwap: boolean = true) => {
  if (path.actions.length == 0) {
    throw generateError("Require at least one action");
  }
  const numBridgeActions = path.actions.filter((action) => action.type === ActionType.Bridge).length;

  if (numBridgeActions > 1) {
    throw generateError("Only one Bridge action is allowed in the path");
  }

  if (numBridgeActions == 1 && path.actions[path.actions.length - 1].type !== ActionType.Bridge) {
    throw generateError("Bridge action must be the last in the path");
  }

  if (!hasSwap && path.actions.some((action) => action.type == ActionType.Convert || action.type == ActionType.Swap)) {
    throw generateError("Don't support swap action");
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
