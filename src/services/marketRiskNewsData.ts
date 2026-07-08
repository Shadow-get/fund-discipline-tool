import type { MarketRiskNewsResponse } from "../types";

export async function fetchMarketRiskNews(forceFallback = false): Promise<MarketRiskNewsResponse> {
  const params = new URLSearchParams();
  if (forceFallback) params.set("fallback", "1");
  const query = params.toString();
  const response = await fetch(`/api/market-risk-news${query ? `?${query}` : ""}`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = (await response.json()) as MarketRiskNewsResponse;
  if (!Array.isArray(payload.items)) {
    throw new Error("新闻风险数据格式异常");
  }
  return payload;
}
