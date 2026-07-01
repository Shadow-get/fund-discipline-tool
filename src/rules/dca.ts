import type { Frequency, MarketState } from "../types";

export function getDcaMultiplier(state: MarketState) {
  if (state === "cheap") return 1.5;
  if (state === "fair") return 1;
  if (state === "expensive") return 0.5;
  if (state === "high") return 0.3;
  if (state === "overheated") return 0.1;
  return 0;
}

export function getStateReason(state: MarketState) {
  const reasons: Record<MarketState, string> = {
    cheap: "估值有安全边际，可以提高买入速度，但仍保留分批原则。",
    fair: "价格接近合理区间，保持原计划执行。",
    expensive: "安全边际下降，降低新增资金，避免情绪追高。",
    high: "估值已经偏高，只保留参与权，等待回调恢复正常定投。",
    overheated: "热度和估值都偏高，新增资金以等待为主。",
    broken: "产业或盈利逻辑破坏，不因价格便宜而自动买入。",
  };

  return reasons[state];
}

export function getExecutionFrequency(monthlyAmount: number, volatility: "low" | "medium" | "high"): Frequency {
  if (monthlyAmount <= 1000) return "monthly";
  if (monthlyAmount <= 5000) return "weekly";
  if (volatility === "high") return "daily";
  return "weekly";
}

export function getFrequencyLabel(frequency: Frequency) {
  const labels: Record<Frequency, string> = {
    monthly: "每月1次",
    biweekly: "双周执行",
    weekly: "每周1次",
    daily: "每个交易日小额执行",
  };

  return labels[frequency];
}
