import type { StockOpportunityItem, StockOpportunityResponse, StockOpportunityStatus } from "../types";

export async function fetchStockOpportunityScan(forceFallback = false, query = ""): Promise<StockOpportunityResponse> {
  const params = new URLSearchParams();
  if (forceFallback) params.set("fallback", "1");
  if (query.trim()) params.set("query", query.trim());
  const queryString = params.toString();
  const response = await fetch(`/api/stock-opportunities${queryString ? `?${queryString}` : ""}`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = (await response.json()) as StockOpportunityResponse;
  if (!Array.isArray(payload.results)) {
    throw new Error("个股观察数据格式异常");
  }
  return payload;
}

export function splitStockOpportunityGroups(items: StockOpportunityItem[]) {
  return {
    top: items.filter((item) => item.status === "重点观察"),
    watch: items.filter((item) => item.status === "跟踪观察"),
    overheated: items.filter((item) => item.status === "过热等待"),
    rejected: items.filter((item) => item.status === "暂不观察"),
  };
}

export function stockOpportunityKind(status: StockOpportunityStatus) {
  if (status === "重点观察") return "good";
  if (status === "过热等待") return "warn";
  if (status === "暂不观察") return "danger";
  return "neutral";
}
