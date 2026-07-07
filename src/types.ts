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

export type MainlineStatusKey = "top" | "watch" | "overheated" | "rejected";

export type MainlineStatus = string;

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
  statusKey?: MainlineStatusKey;
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

export type LowValuationStatusKey = "top" | "watch" | "trap" | "fair";

export type LowValuationScanItem = {
  candidateId: string;
  name: string;
  category: string;
  representativeIndex: string;
  representativeEtfs: string[];
  pe: number;
  pb: number;
  pePercentile: number;
  pbPercentile: number;
  dividendYield: number;
  earningsYield: number;
  earningsYieldSpread: number;
  roe: number;
  valueScore: number;
  qualityScore: number;
  cycleScore: number;
  logicRiskScore: number;
  marginOfSafety: number;
  score: number;
  stage: string;
  statusKey: LowValuationStatusKey;
  status: string;
  suggestedRatio: string;
  action: string;
  reason: string;
  evidence: {
    valuation: string;
    dividend: string;
    cycle: string;
    risk: string;
  };
  source: string;
  updatedAt: string;
};

export type LowValuationScanResponse = {
  mode: "model" | "fallback" | "error";
  source: string;
  updatedAt: string;
  riskFreeYield: number;
  message: string;
  methodology: string[];
  results: LowValuationScanItem[];
};

export type HoldingItem = {
  id: string;
  code: string;
  name: string;
  bucket: Exclude<AssetBucket, "reserve">;
  costAmount: number;
  marketValue: number;
  todayReturnPct: number;
  bucketShare: number;
};

export type StrategyTargetRecommendation = {
  id: string;
  code: string;
  name: string;
  bucket: Exclude<AssetBucket, "reserve">;
  allocationPct: number;
  role: string;
  tradeHint: string;
  riskNote: string;
};

export type ExecutionLog = {
  id: string;
  code: string;
  name: string;
  amount: number;
  executedAt: string;
  note: string;
};

export type DailyReturnItem = {
  date: string;
  profit: number;
  returnPct: number;
  marketValue: number;
  cashflow?: number;
};

export type HoldingQuote = {
  code: string;
  name: string;
  price: number;
  changePct: number;
  changeAmount: number;
  previousClose: number;
  source: string;
  updatedAt: string;
};

export type HoldingQuoteResponse = {
  mode: "live" | "fallback" | "error";
  source: string;
  updatedAt: string;
  message: string;
  quotes: HoldingQuote[];
};

export type NoticeKind = "success" | "warn" | "danger" | "neutral";

export type Notice = {
  id: string;
  kind: NoticeKind;
  title: string;
  message: string;
};

export type DashboardHoldingRow = HoldingItem & {
  recommendedAmount: number;
  executedAmount: number;
  completed: boolean;
  profit: number;
  profitPct: number;
  returnPct: number;
  todayReturnPct: number;
  quoteLabel: string;
  reason: string;
  badgeLabel: string;
};

export type CalendarDay = {
  day: number;
  date: string;
  item?: DailyReturnItem;
};

export type StrategyGoal =
  | "steadyDca"
  | "balancedCore"
  | "globalCoreFirst"
  | "aggressiveSatellite"
  | "retirement"
  | "custom";

export type StrategyRiskLevel = "low" | "medium" | "high";

export type StrategyProfile = {
  id: string;
  name: string;
  goal: StrategyGoal;
  style: Style;
  monthlyAmount: number;
  volatility: "low" | "medium" | "high";
  riskLevel: StrategyRiskLevel;
  horizonYears: number;
  maxDrawdownPct: number;
  allowSatellite: boolean;
  allowOverseas: boolean;
  allocation: AllocationTemplate;
  satelliteCapPct: number;
  heatControl: {
    normalHeatMax: number;
    reduceHeatMin: number;
    pauseHeatMin: number;
  };
  recommendationReason: string;
  riskRules: string[];
  createdAt: string;
};

export type AccountProfile = {
  id: string;
  name: string;
  strategyId: string;
  holdings: HoldingItem[];
  executionLogs: ExecutionLog[];
  dailyReturns: DailyReturnItem[];
  cashReserve: number;
  createdAt: string;
};

export type MarketHeatLevel = "cold" | "normal" | "warm" | "hot" | "overheated";

export type MarketHeatIndicator = {
  key: string;
  label: string;
  value: number;
  unit: string;
  level: MarketHeatLevel;
  detail: string;
};

export type MarketRecommendation = {
  title: string;
  action: string;
  reason: string;
  heatLevel: MarketHeatLevel;
  suggestedStyle: Style;
  suggestedMonthlyMultiplier: number;
  satelliteThrottle: number;
  indicators: MarketHeatIndicator[];
};
