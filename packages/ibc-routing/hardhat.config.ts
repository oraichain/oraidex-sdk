import "dotenv/config";
import "@nomiclabs/hardhat-ethers";
import "@typechain/hardhat";
import { ethers } from "ethers";
import { extendEnvironment } from "hardhat/config";
import { HardhatUserConfig } from "hardhat/types";

let accounts: string[] = [];

if (process.env.MNEMONIC) {
  accounts = [];
  for (let i = 0; i < 20; ++i) {
    accounts.push(ethers.Wallet.fromMnemonic(process.env.MNEMONIC, `m/44'/60'/0'/${i}`).privateKey);
  }
} else if (process.env.PRIVATE_KEY) {
  accounts = process.env.PRIVATE_KEY.split(/\s*,\s*/);
}

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",

  networks: {
    hardhat: {
      chainId: 5600,
      accounts: accounts?.map((privateKey) => ({
        privateKey,
        balance: "10000000000000000000000"
      })),
      forking: {
        url: "https://1rpc.io/bnb",
        blockNumber: 32755409
      }
    },
    bnb: {
      url: "https://1rpc.io/bnb",
      accounts
    }
  },
  paths: {
    sources: "contracts"
  },
  solidity: {
    compilers: [
      {
        version: "0.8.16",
        settings: {
          optimizer: {
            enabled: true, // Default: false
            runs: 1000 // Default: 200
          }
        }
      }
    ]
  },
  mocha: {
    timeout: process.env.TIMEOUT || 100000
  }
};

declare module "hardhat/types/runtime" {
  export interface HardhatRuntimeEnvironment {
    provider: ethers.providers.Web3Provider;
    getSigner: (addressOrIndex?: string | number) => ethers.providers.JsonRpcSigner;
    getSigners: (num?: number) => ethers.providers.JsonRpcSigner[];
  }
}

extendEnvironment((hre) => {
  // @ts-ignore
  hre.provider = new ethers.providers.Web3Provider(hre.network.provider);
  hre.getSigners = (num = 20) => [...new Array(num)].map((_, i) => hre.provider.getSigner(i));
  hre.getSigner = (addressOrIndex) => hre.provider.getSigner(addressOrIndex);
});

export default config;
