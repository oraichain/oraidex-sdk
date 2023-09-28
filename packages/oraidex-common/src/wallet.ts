import { OfflineSigner } from "@cosmjs/proto-signing";
import { CosmosChainId, NetworkChainId, network } from "./network";
import { SigningCosmWasmClient, SigningCosmWasmClientOptions } from "@cosmjs/cosmwasm-stargate";
import { GasPrice } from "@cosmjs/stargate";

export abstract class UniversalWallet {
  public abstract getCosmosAddr(chainId?: NetworkChainId): Promise<string>;
  public abstract getEthAddr(): Promise<string>;
  public abstract collectCosmosWallet(chainId: string): Promise<OfflineSigner>;

  getCosmWasmClient = async (
    config: { signer?: OfflineSigner; rpc?: string; chainId: CosmosChainId },
    options?: SigningCosmWasmClientOptions
  ) => {
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
  };
}
