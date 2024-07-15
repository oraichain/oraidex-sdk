import path from "path";
import { CustomChainInfo } from "./chain-infos/chain-info-type";
import { promises as fs } from "fs";
import {
  FACTORY_CONTRACT,
  FACTORY_V2_CONTRACT,
  ROUTER_V2_CONTRACT,
  ORACLE_CONTRACT,
  STAKING_CONTRACT,
  REWARDER_CONTRACT,
  CONVERTER_CONTRACT,
  ORAIDEX_LISTING_CONTRACT,
  MULTICALL_CONTRACT,
  ORAIDEX_BID_POOL_CONTRACT
} from "./constant";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ChainInfoReader {
  readChainInfos(): Promise<CustomChainInfo[]>;
}

export class ChainInfoReaderImpl {
  constructor(private readonly directory: string = path.join(__dirname, "chain-infos", "chains")) {}
  async readChainInfos(): Promise<CustomChainInfo[]> {
    const files = await fs.readdir(this.directory);
    const jsonFiles = files.filter((file) => path.extname(file) === ".json");

    const readFilesPromises = jsonFiles.map(async (file) => {
      const filePath = path.join(this.directory, file);
      const data = await fs.readFile(filePath, "utf-8");
      return JSON.parse(data);
    });

    return Promise.all(readFilesPromises);
  }
}

export class OraidexCommon {
  constructor(
    private _chainInfos: CustomChainInfo[] = [],
    private readonly chainInfoReader: ChainInfoReader = new ChainInfoReaderImpl()
  ) {}

  async initialize() {
    if (this._chainInfos.length === 0) this._chainInfos = await this.chainInfoReader.readChainInfos();
    return this;
  }

  get chainInfos() {
    return this._chainInfos;
  }

  get evmChains() {
    return this._chainInfos.filter((c) => c.networkType === "evm");
  }

  get cosmosChains() {
    return this._chainInfos.filter((c) => c.networkType === "cosmos");
  }

  get network() {
    const oraichainNetwork = this._chainInfos.find((chain) => chain.chainId === "Oraichain");
    if (!oraichainNetwork) {
      throw new Error("No Oraichain network");
    }
    return {
      ...oraichainNetwork,
      prefix: oraichainNetwork.bech32Config.bech32PrefixAccAddr,
      denom: "orai",
      coinType: oraichainNetwork.bip44.coinType,
      fee: { gasPrice: "0.00506", amount: "1518", gas: "2000000" }, // 0.000500 ORAI
      factory: FACTORY_CONTRACT,
      factory_v2: FACTORY_V2_CONTRACT,
      router: ROUTER_V2_CONTRACT,
      oracle: ORACLE_CONTRACT,
      staking: STAKING_CONTRACT,
      rewarder: REWARDER_CONTRACT,
      converter: CONVERTER_CONTRACT,
      oraidex_listing: ORAIDEX_LISTING_CONTRACT,
      multicall: MULTICALL_CONTRACT,
      bid_pool: ORAIDEX_BID_POOL_CONTRACT,
      explorer: "https://scan.orai.io"
    };
  }
}
