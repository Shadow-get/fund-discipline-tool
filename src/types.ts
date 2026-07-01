export type Style =
  | "conservative"
  | "balanced"
  | "growth"
  | "dividend"
  | "usCore"
  | "mainline";

export type MarketState =
  | "cheap"
  | "fair"
  | "expensive"
  | "high"
  | "overheated"
  | "broken";

export type Frequency = "monthly" | "biweekly" | "weekly" | "daily";

export type AssetBucket = "chinaCore" | "globalCore" | "defensive" | "satellite" | "reserve";

export type AllocationTemplate = {
  chinaCore: number;
  globalCore: number;
  defensive: number;
  satellite: number;
  reserve: number;
};

export type AllocationLine = {
  key: AssetBucket;
  name: string;
  targetAmount: number;
  actualBuy: number;
  deferred: number;
  ratio: number;
  state?: MarketState;
  reason: string;
};

export type MonthlyPlan = {
  totalMonthlyAmount: number;
  executionFrequency: Frequency;
  totalBuy: number;
  reserve: number;
  lines: AllocationLine[];
  explanations: string[];
};

export type BucketOverride = {
  multiplier: number;
  reason: string;
};

export type MainlineStatus = "主线候选" | "可小仓观察" | "过热等待" | "暂不进入";

export type MainlineScanItem = {
  candidateId: string;
  name: string;
  category: string;
  representativeIndex: string;
  representativeEtfs: string[];
  returns20: number;
  returns60: number;
  returns120: number;
  volumeTrend: number;
  turnoverTrend: number;
  fundFlowProxy: number;
  valuationPercentile: number;
  heatScore: number;
  score: number;
  stage: string;
  status: MainlineStatus;
  suggestedSatelliteRatio: string;
  action: string;
  reason: string;
  evidence: {
    fund: string;
    strength: string;
    heat: string;
    policy: string;
  };
  source: string;
  updatedAt: string;
};

export type MainlineScanResponse = {
  mode: "live" | "cache" | "fallback" | "error";
  source: string;
  updatedAt: string;
  benchmark: string;
  message: string;
  results: MainlineScanItem[];
};
