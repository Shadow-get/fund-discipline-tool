import { localMainlineSnapshot } from "../data/mainlineSnapshot";
import type { MainlineScanItem, MainlineScanResponse } from "../types";

export function splitMainlineGroups(items: MainlineScanItem[]) {
  return {
    top: items.filter((item) => item.status === "主线候选"),
    watch: items.filter((item) => item.status === "可小仓观察"),
    overheated: items.filter((item) => item.status === "过热等待"),
    rejected: items.filter((item) => item.status === "暂不进入"),
  };
}

export function pickActionableMainline(items: MainlineScanItem[]) {
  return items.find((item) => item.status === "主线候选") ?? items.find((item) => item.status === "可小仓观察");
}

export async function fetchMainlineScan(forceFallback = false): Promise<MainlineScanResponse> {
  try {
    const response = await fetch(`/api/mainline-scan${forceFallback ? "?fallback=1" : ""}`);
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
