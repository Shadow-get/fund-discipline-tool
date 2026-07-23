import { localLowValuationSnapshot } from "../data/lowValuationSnapshot";
import type { LowValuationScanItem, LowValuationScanResponse, LowValuationStatusKey } from "../types";
import { isChinaTradingTime } from "../utils/marketTime";

export function isLowValuationStatusKind(item: LowValuationScanItem, kind: LowValuationStatusKey) {
  return item.statusKey === kind;
}

export function splitLowValuationGroups(items: LowValuationScanItem[]) {
  return {
    top: items.filter((item) => isLowValuationStatusKind(item, "top")),
    watch: items.filter((item) => isLowValuationStatusKind(item, "watch")),
    trap: items.filter((item) => isLowValuationStatusKind(item, "trap")),
    fair: items.filter((item) => isLowValuationStatusKind(item, "fair")),
  };
}

export function pickActionableLowValuation(items: LowValuationScanItem[]) {
  return items.find((item) => isLowValuationStatusKind(item, "top")) ?? items.find((item) => isLowValuationStatusKind(item, "watch"));
}

function dynamicErrorResponse(message: string): LowValuationScanResponse {
  return {
    mode: "error",
    source: "动态公开行情",
    updatedAt: new Date().toISOString(),
    riskFreeYield: 0,
    message,
    methodology: [],
    results: [],
  };
}

export async function fetchLowValuationScan({ dynamicOnly = isChinaTradingTime() } = {}): Promise<LowValuationScanResponse> {
  try {
    const params = new URLSearchParams();
    if (dynamicOnly) params.set("dynamic", "1");
    const query = params.toString();
    const response = await fetch(`/api/low-valuation-scan${query ? `?${query}` : ""}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = (await response.json()) as LowValuationScanResponse;
    if (!Array.isArray(payload.results)) {
      throw new Error("低估值数据格式异常");
    }

    return payload;
  } catch (error) {
    if (dynamicOnly) {
      return dynamicErrorResponse(`动态低估值扫描失败。原因：${error instanceof Error ? error.message : "未知错误"}`);
    }

    return {
      ...localLowValuationSnapshot,
      mode: "fallback",
      message: `本地低估值 API 不可用，使用前端内置快照。原因：${error instanceof Error ? error.message : "未知错误"}`,
    };
  }
}
