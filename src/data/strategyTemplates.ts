import type { AllocationTemplate, Style } from "../types";

export const styleLabels: Record<Style, string> = {
  conservative: "稳健",
  balanced: "均衡",
  growth: "成长",
  dividend: "红利",
  usCore: "美股宽基",
  mainline: "主线/产业增强",
};

export const strategyTemplates: Record<Style, AllocationTemplate> = {
  conservative: { chinaCore: 0.2, globalCore: 0.2, defensive: 0.45, satellite: 0.05, reserve: 0.1 },
  balanced: { chinaCore: 0.25, globalCore: 0.25, defensive: 0.25, satellite: 0.15, reserve: 0.1 },
  growth: { chinaCore: 0.25, globalCore: 0.3, defensive: 0.15, satellite: 0.2, reserve: 0.1 },
  dividend: { chinaCore: 0.2, globalCore: 0.2, defensive: 0.45, satellite: 0.05, reserve: 0.1 },
  usCore: { chinaCore: 0.2, globalCore: 0.35, defensive: 0.2, satellite: 0.15, reserve: 0.1 },
  mainline: { chinaCore: 0.25, globalCore: 0.25, defensive: 0.25, satellite: 0.15, reserve: 0.1 },
};

export const bucketLabels = {
  chinaCore: "A股核心宽基",
  globalCore: "美股/全球核心宽基",
  defensive: "防守仓",
  satellite: "产业增强/主线机会",
  reserve: "等待资金",
};
