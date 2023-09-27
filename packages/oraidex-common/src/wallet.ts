import { NetworkChainId } from "./network";

export abstract class UniversalWallet {
  public abstract getCosmosAddr(chainId?: NetworkChainId): string;
  public abstract getEthAddr(): string;
}
