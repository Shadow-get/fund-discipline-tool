import type { MarketState } from "../types";

export const marketStateLabels: Record<MarketState, string> = {
  cheap: "低估冷静",
  fair: "合理",
  expensive: "偏贵",
  high: "高估",
  overheated: "过热",
  broken: "逻辑破坏",
};

export const assetTypeBaseRatio = {
  chinaCore: 0.6,
  globalCore: 0.6,
  dividend: 0.7,
  nasdaq: 0.4,
  highVolatility: 0.3,
};
