import { OfflineSigner } from "@cosmjs/proto-signing";
import { CosmosChainId, NetworkChainId, Networks, network } from "./network";
import { SigningCosmWasmClient, SigningCosmWasmClientOptions } from "@cosmjs/cosmwasm-stargate";
import { GasPrice } from "@cosmjs/stargate";
import { ethToTronAddress, tronToEthAddress } from "./helper";
import { TokenItemType } from "./token";
import { ethers } from "ethers";
import { IERC20Upgradeable__factory } from "./typechain-types";
import { JsonRpcSigner } from "@ethersproject/providers";
import { TronWeb } from "./tronweb";
import { AccountData } from "@cosmjs/amino";

export abstract class CosmosWallet {
  public abstract getKeplrAddr(chainId?: NetworkChainId): Promise<string>;
  public abstract collectCosmosWallet(chainId: string): Promise<OfflineSigner>;

  async getCosmWasmClient(
    config: { signer?: OfflineSigner; rpc?: string; chainId: CosmosChainId },
    options?: SigningCosmWasmClientOptions
  ): Promise<{ wallet: OfflineSigner; client: SigningCosmWasmClient; defaultAddress: AccountData }> {
    const { chainId, rpc, signer } = config;
    const wallet = signer ?? (await this.collectCosmosWallet(chainId));
    const defaultAddress = (await wallet.getAccounts())[0];
    const client = await SigningCosmWasmClient.connectWithSigner(
      rpc ?? network.rpc,
      wallet,
      options ?? {
        gasPrice: GasPrice.fromString(network.fee.gasPrice + network.denom)
      }
    );
    return { wallet, client, defaultAddress };
  }
}

export abstract class EvmWallet {
  public tronWeb: TronWeb;

  public abstract switchNetwork(chainId: string | number): Promise<void>;
  public abstract getEthAddress(): Promise<string>;
  public abstract checkEthereum(): boolean;
  public abstract checkTron(): boolean;
  public abstract getSigner(): JsonRpcSigner;

  public isTron(chainId: string | number) {
    return Number(chainId) == Networks.tron;
  }
  public getFinalEvmAddress(
    chainId: NetworkChainId,
    address: { metamaskAddress?: string; tronAddress?: string }
  ): string | undefined {
    if (this.isTron(chainId)) return address.tronAddress;
    return address.metamaskAddress;
  }

  public async submitTronSmartContract(
    address: string,
    functionSelector: string,
    options: { feeLimit?: number } = { feeLimit: 40 * 1e6 }, // submitToCosmos costs about 40 TRX
    parameters = [],
    issuerAddress: string
  ): Promise<string> {
    if (!this.tronWeb) {
      throw new Error("You need to initialize tron web before calling submitTronSmartContract.");
    }
    try {
      console.log("before building tx: ", issuerAddress);
      const transaction = await this.tronWeb.transactionBuilder.triggerSmartContract(
        address,
        functionSelector,
        options,
        parameters,
        ethToTronAddress(issuerAddress)
      );
      console.log("transaction builder: ", transaction);

      if (!transaction.result || !transaction.result.result) {
        throw new Error("Unknown trigger error: " + JSON.stringify(transaction.transaction));
      }
      console.log("before signing");

      // sign from inject tronWeb
      const singedTransaction = await this.tronWeb.trx.sign(transaction.transaction);
      console.log("signed tx: ", singedTransaction);
      const result = await this.tronWeb.trx.sendRawTransaction(singedTransaction);
      return result.txid;
    } catch (error) {
      throw new Error(error);
    }
  }

  public async checkOrIncreaseAllowance(
    token: TokenItemType,
    owner: string,
    spender: string,
    amount: string
  ): Promise<string> {
    // we store the tron address in base58 form, so we need to convert to hex if its tron because the contracts are using the hex form as parameters
    if (!token.contractAddress) return;
    const ownerHex = this.isTron(token.chainId) ? tronToEthAddress(owner) : owner;
    // using static rpc for querying both tron and evm
    const tokenContract = IERC20Upgradeable__factory.connect(
      token.contractAddress,
      new ethers.providers.JsonRpcProvider(token.rpc)
    );
    const currentAllowance = await tokenContract.allowance(ownerHex, spender);

    if (currentAllowance.toString() >= amount) return;

    if (this.isTron(token.chainId)) {
      if (this.checkTron())
        return this.submitTronSmartContract(
          ethToTronAddress(token.contractAddress),
          "approve(address,uint256)",
          {},
          [
            { type: "address", value: spender },
            { type: "uint256", value: amount }
          ],
          ownerHex
        );
    } else if (this.checkEthereum()) {
      // using window.ethereum for signing
      // if you call this function on evm, you have to switch network before calling. Otherwise, unexpected errors may happen
      const tokenContract = IERC20Upgradeable__factory.connect(token.contractAddress, this.getSigner());
      const result = await tokenContract.approve(spender, amount, { from: ownerHex });
      await result.wait();
      return result.hash;
    }
  }
}
