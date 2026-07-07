import { localMainlineSnapshot } from "../data/mainlineSnapshot";
import type { MainlineScanItem, MainlineScanResponse, MainlineStatusKey } from "../types";

export function getMainlineStatusKind(item: MainlineScanItem): MainlineStatusKey {
  if (item.statusKey) return item.statusKey;

  const status = item.status ?? "";
  if (status.includes("过热") || status.includes("杩囩儹")) return "overheated";
  if (status.includes("暂不") || status.includes("鏆備笉")) return "rejected";
  if (status.includes("观察") || status.includes("瑙傚療")) return "watch";
  if (status.includes("主线") || status.includes("涓荤嚎")) return "top";
  return "rejected";
}

export function isMainlineStatusKind(item: MainlineScanItem, kind: MainlineStatusKey) {
  return getMainlineStatusKind(item) === kind;
}

export function splitMainlineGroups(items: MainlineScanItem[]) {
  return {
    top: items.filter((item) => isMainlineStatusKind(item, "top")),
    watch: items.filter((item) => isMainlineStatusKind(item, "watch")),
    overheated: items.filter((item) => isMainlineStatusKind(item, "overheated")),
    rejected: items.filter((item) => isMainlineStatusKind(item, "rejected")),
  };
}

export function pickActionableMainline(items: MainlineScanItem[]) {
  return items.find((item) => isMainlineStatusKind(item, "top")) ?? items.find((item) => isMainlineStatusKind(item, "watch"));
}

export async function fetchMainlineScan(forceFallback = false, forceRefresh = false): Promise<MainlineScanResponse> {
  try {
    const params = new URLSearchParams();
    if (forceFallback) params.set("fallback", "1");
    if (forceRefresh) params.set("refresh", "1");
    const query = params.toString();
    const response = await fetch(`/api/mainline-scan${query ? `?${query}` : ""}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = (await response.json()) as MainlineScanResponse;
    if (!Array.isArray(payload.results)) {
      throw new Error("主线数据格式异常");
    }

    return payload;
  } catch (error) {
    return {
      ...localMainlineSnapshot,
      mode: "fallback",
      message: `本地API不可用，使用前端内置快照。原因：${error instanceof Error ? error.message : "未知错误"}`,
    };
  }
}
