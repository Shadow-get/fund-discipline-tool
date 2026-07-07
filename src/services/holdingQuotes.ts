import type { HoldingQuoteResponse } from "../types";

export async function fetchHoldingQuotes(codes: string[]): Promise<HoldingQuoteResponse> {
  const uniqueCodes = Array.from(new Set(codes.map((code) => code.trim()).filter(Boolean)));
  const query = encodeURIComponent(uniqueCodes.join(","));
  const response = await fetch(`/api/holding-quotes?codes=${query}`);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = (await response.json()) as HoldingQuoteResponse;
  if (!Array.isArray(payload.quotes)) {
    throw new Error("行情数据格式异常");
  }

  return payload;
}
