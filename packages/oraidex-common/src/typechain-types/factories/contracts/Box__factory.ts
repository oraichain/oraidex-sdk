/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import { Signer, utils, Contract, ContractFactory, Overrides } from "ethers";
import type { Provider, TransactionRequest } from "@ethersproject/providers";
import type { PromiseOrValue } from "../../common";
import type { Box, BoxInterface } from "../../contracts/Box";

const _abi = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint8",
        name: "version",
        type: "uint8",
      },
    ],
    name: "Initialized",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "previousOwner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "OwnershipTransferred",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "value",
        type: "uint256",
      },
    ],
    name: "ValueChanged",
    type: "event",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "renounceOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "retrieve",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "value",
        type: "uint256",
      },
    ],
    name: "store",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "transferOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "withdrawFeesCollected",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const _bytecode =
  "0x608060405234801561001057600080fd5b50610343806100206000396000f3fe608060405234801561001057600080fd5b50600436106100625760003560e01c806325422519146100675780632e64cec1146100715780636057361d14610087578063715018a61461009a5780638da5cb5b146100a2578063f2fde38b146100c2575b600080fd5b61006f6100d5565b005b6065546040519081526020015b60405180910390f35b61006f6100953660046102a4565b61012c565b61006f610155565b6100aa610169565b6040516001600160a01b03909116815260200161007e565b61006f6100d03660046102bd565b610178565b600060658190556040519081526000805160206102ee8339815191529060200160405180910390a160405133904780156108fc02916000818181858888f19350505050158015610129573d6000803e3d6000fd5b50565b60658190556040518181526000805160206102ee8339815191529060200160405180910390a150565b61015d6101f3565b6101676000610252565b565b6033546001600160a01b031690565b6101806101f3565b6001600160a01b0381166101ea5760405162461bcd60e51b815260206004820152602660248201527f4f776e61626c653a206e6577206f776e657220697320746865207a65726f206160448201526564647265737360d01b60648201526084015b60405180910390fd5b61012981610252565b336101fc610169565b6001600160a01b0316146101675760405162461bcd60e51b815260206004820181905260248201527f4f776e61626c653a2063616c6c6572206973206e6f7420746865206f776e657260448201526064016101e1565b603380546001600160a01b038381166001600160a01b0319831681179093556040519116919082907f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e090600090a35050565b6000602082840312156102b657600080fd5b5035919050565b6000602082840312156102cf57600080fd5b81356001600160a01b03811681146102e657600080fd5b939250505056fe93fe6d397c74fdf1402a8b72e47b68512f0510d7b98a4bc4cbdf6ac7108b3c59a2646970667358221220fb28a88c2b1648426cf244c23639164b0d4c96babbe4fd40417bb505cc0398a064736f6c634300080a0033";

type BoxConstructorParams =
  | [signer?: Signer]
  | ConstructorParameters<typeof ContractFactory>;

const isSuperArgs = (
  xs: BoxConstructorParams
): xs is ConstructorParameters<typeof ContractFactory> => xs.length > 1;

export class Box__factory extends ContractFactory {
  constructor(...args: BoxConstructorParams) {
    if (isSuperArgs(args)) {
      super(...args);
    } else {
      super(_abi, _bytecode, args[0]);
    }
  }

  override deploy(
    overrides?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<Box> {
    return super.deploy(overrides || {}) as Promise<Box>;
  }
  override getDeployTransaction(
    overrides?: Overrides & { from?: PromiseOrValue<string> }
  ): TransactionRequest {
    return super.getDeployTransaction(overrides || {});
  }
  override attach(address: string): Box {
    return super.attach(address) as Box;
  }
  override connect(signer: Signer): Box__factory {
    return super.connect(signer) as Box__factory;
  }

  static readonly bytecode = _bytecode;
  static readonly abi = _abi;
  static createInterface(): BoxInterface {
    return new utils.Interface(_abi) as BoxInterface;
  }
  static connect(address: string, signerOrProvider: Signer | Provider): Box {
    return new Contract(address, _abi, signerOrProvider) as Box;
  }
}
