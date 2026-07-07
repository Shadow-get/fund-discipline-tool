import type { DailyReturnItem, HoldingItem } from "../types";

export const defaultHoldings: HoldingItem[] = [
  {
    id: "holding-hs300",
    code: "510300",
    name: "沪深300ETF",
    bucket: "chinaCore",
    costAmount: 30000,
    marketValue: 31800,
    todayReturnPct: 0.42,
    bucketShare: 1,
  },
  {
    id: "holding-csi500",
    code: "510500",
    name: "中证500ETF",
    bucket: "chinaCore",
    costAmount: 22000,
    marketValue: 21450,
    todayReturnPct: -0.28,
    bucketShare: 1,
  },
  {
    id: "holding-nasdaq",
    code: "513100",
    name: "纳指ETF",
    bucket: "globalCore",
    costAmount: 35000,
    marketValue: 42100,
    todayReturnPct: 0.65,
    bucketShare: 1,
  },
  {
    id: "holding-dividend",
    code: "515180",
    name: "红利ETF",
    bucket: "defensive",
    costAmount: 26000,
    marketValue: 27400,
    todayReturnPct: 0.12,
    bucketShare: 1,
  },
  {
    id: "holding-ai",
    code: "159819",
    name: "人工智能ETF",
    bucket: "satellite",
    costAmount: 12000,
    marketValue: 13750,
    todayReturnPct: 1.18,
    bucketShare: 1,
  },
];

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function currentMonthKey() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

export function createDefaultDailyReturns(): DailyReturnItem[] {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lastDay = Math.min(today.getDate(), daysInMonth);
  const pctPattern = [0.18, -0.27, 0.36, 0.08, -0.41, 0.52, 0.21, -0.16, 0.44, -0.08, 0.31, 0.12];
  const baseValue = 136500;

  return Array.from({ length: lastDay }, (_, index) => {
    const date = new Date(year, month, index + 1);
    const returnPct = pctPattern[index % pctPattern.length];
    const marketValue = baseValue + index * 850;
    const profit = Math.round((marketValue * returnPct) / 100);

    return {
      date: toDateKey(date),
      profit,
      returnPct,
      marketValue,
    };
  });
}
