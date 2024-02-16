import { OfflineSigner } from "@cosmjs/proto-signing";

export interface UserWallet {
  address: string;
  signer: OfflineSigner;
}
