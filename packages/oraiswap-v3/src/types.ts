export interface SnapshotValueData {
  tokenBNFromBeginning: string;
  usdValue24: number;
}

export interface PoolSnapshot {
  timestamp: number;
  volumeX: SnapshotValueData;
  volumeY: SnapshotValueData;
  liquidityX: SnapshotValueData;
  liquidityY: SnapshotValueData;
  feeX: SnapshotValueData;
  feeY: SnapshotValueData;
}

export interface PoolStatsData {
  snapshots: PoolSnapshot[];
  tokenX: {
    address: string;
    decimals: number;
  };
  tokenY: {
    address: string;
    decimals: number;
  };
}

export interface TokenData {
  address: string;
  symbol: string;
  coinGeckoId?: string;
  decimals: number;
}

export interface VirtualRange {
  lowerTick: number;
  upperTick: number;
}

export interface PositionLiquidInfo {
  liquidity: bigint;
  upper_tick_index: number;
  lower_tick_index: number;
}
