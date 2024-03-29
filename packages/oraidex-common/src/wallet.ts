import { OfflineSigner } from "@cosmjs/proto-signing";
import { CosmosChainId, EvmChainId, NetworkChainId, Networks } from "./network";
import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { SigningStargateClient, SigningStargateClientOptions } from "@cosmjs/stargate";
import { ethToTronAddress, tronToEthAddress } from "./helper";
import { TokenItemType } from "./token";
import { ethers } from "ethers";
import { IERC20Upgradeable__factory } from "./typechain-types";
import { JsonRpcSigner } from "@ethersproject/providers";
import { TronWeb } from "./tronweb";
import { EncodeObject } from "@cosmjs/proto-signing";
import { Tendermint37Client } from "@cosmjs/tendermint-rpc";
import { Stargate } from "@injectivelabs/sdk-ts";
import { BROADCAST_POLL_INTERVAL } from "./constant";

export interface EvmResponse {
  transactionHash: string;
}

export abstract class CosmosWallet {
  /**
   * This method should return the cosmos address in bech32 form given a cosmos chain id
   * Browsers should make use of the existing methods from the extension to implement this method
   * @param chainId - Cosmos chain id to parse and return the correct cosmos address
   */
  public abstract getKeplrAddr(chainId?: CosmosChainId): Promise<string>;

  /**
   * This method creates a new cosmos signer which is responsible for signing cosmos-based transactions.
   * Browsers should use signers from the extension to implement this method
   * @param chainId - Cosmos chain id
   */
  public abstract createCosmosSigner(chainId: CosmosChainId): Promise<OfflineSigner>;

  async getCosmWasmClient(
    config: { rpc: string; chainId: CosmosChainId },
    options: SigningStargateClientOptions
  ): Promise<{
    wallet: OfflineSigner;
    client: SigningCosmWasmClient;
    stargateClient: SigningStargateClient;
  }> {
    const { chainId, rpc } = config;
    const wallet = await this.createCosmosSigner(chainId);
    const tmClient = await Tendermint37Client.connect(rpc);
    let client;
    const optionsClient = {
      ...options,
      broadcastPollIntervalMs: BROADCAST_POLL_INTERVAL
    };
    if (chainId === "injective-1") {
      client = await Stargate.InjectiveSigningStargateClient.createWithSigner(
        tmClient as any,
        wallet,
        optionsClient as any
      );
    } else {
      client = await SigningCosmWasmClient.createWithSigner(tmClient, wallet, optionsClient);
    }
    const stargateClient = await SigningStargateClient.createWithSigner(tmClient, wallet, optionsClient);
    return { wallet, client, stargateClient };
  }

  async signAndBroadcast(
    fromChainId: CosmosChainId,
    fromRpc: string,
    options: SigningStargateClientOptions,
    sender: string,
    encodedObjects: EncodeObject[]
  ) {
    // handle sign and broadcast transactions
    const { client } = await this.getCosmWasmClient(
      {
        chainId: fromChainId as CosmosChainId,
        rpc: fromRpc
      },
      options
    );
    return client.signAndBroadcast(sender, encodedObjects, "auto");
  }
}

export abstract class EvmWallet {
  constructor(public tronWeb?: TronWeb) {}

  /**
   * Note: Browser only. Return if you dont use the browser.
   * This method allows switching between different evm networks.
   * @param chainId - evm chain id
   */
  public abstract switchNetwork(chainId: string | number | EvmChainId): Promise<void>;
  /**
   * This method should return the evm address of the current operating network
   */
  public abstract getEthAddress(): Promise<string>;

  /**
   * This method checks if the wallet is handling eth-like networks or not
   */
  public abstract checkEthereum(): boolean;
  /**
   * This method checks if the wallet is handling tron network or not
   */
  public abstract checkTron(): boolean;
  /**
   * This method returns an evm signer responsible for signing evm-based transactions.
   */
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
  ): Promise<EvmResponse> {
    if (!this.tronWeb) {
      throw new Error("You need to initialize tron web before calling submitTronSmartContract.");
    }
    try {
      const uint256Index = parameters.findIndex((param) => param.type === "uint256");

      // type uint256 is bigint, so we need to convert to string if its uint256 because the JSONUint8Array can not stringify bigint
      if (uint256Index && parameters.length > uint256Index) {
        parameters[uint256Index] = {
          ...parameters[uint256Index],
          value:
            typeof parameters[uint256Index].value === "bigint"
              ? parameters[uint256Index].value.toString()
              : parameters[uint256Index].value
        };
      }

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
      return { transactionHash: result.txid };
    } catch (error) {
      throw new Error(error);
    }
  }

  public async checkOrIncreaseAllowance(
    token: TokenItemType,
    owner: string,
    spender: string,
    amount: string
  ): Promise<EvmResponse> {
    // we store the tron address in base58 form, so we need to convert to hex if its tron because the contracts are using the hex form as parameters
    if (!token.contractAddress) return;
    const ownerHex = this.isTron(token.chainId) ? tronToEthAddress(owner) : owner;
    // using static rpc for querying both tron and evm
    const tokenContract = IERC20Upgradeable__factory.connect(
      token.contractAddress,
      new ethers.providers.JsonRpcProvider(token.rpc)
    );
    const currentAllowance = await tokenContract.allowance(ownerHex, spender);

    if (BigInt(currentAllowance.toString()) >= BigInt(amount)) return;

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

      // TODO: hardcode check currentAllowance USDT ERC20
      const isUsdtErc20 = token.chainId === "0x01" && token.coinGeckoId === "tether";
      if (isUsdtErc20 && !!currentAllowance.toString()) {
        const approveUsdtErc20 = await tokenContract.approve(spender, "0", { from: ownerHex });
        await approveUsdtErc20.wait();
      }

      const result = await tokenContract.approve(spender, amount, { from: ownerHex });
      await result.wait();
      return { transactionHash: result.hash };
    }
  }
}
