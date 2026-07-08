import type { KlinePeriod, MarketKlineResponse } from "../types";

export async function fetchMarketKline(code: string, period: KlinePeriod): Promise<MarketKlineResponse> {
  const params = new URLSearchParams({ code, period });
  const response = await fetch(`/api/market-kline?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = (await response.json()) as MarketKlineResponse;
  if (!Array.isArray(payload.points)) {
    throw new Error("K线数据格式异常");
  }
  return payload;
}
