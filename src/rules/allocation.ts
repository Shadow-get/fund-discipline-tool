import type { AssetBucket, BucketOverride, MarketState, MonthlyPlan, Style } from "../types";
import { bucketLabels, strategyTemplates } from "../data/strategyTemplates";
import { getDcaMultiplier, getExecutionFrequency, getStateReason } from "./dca";

const orderedBuckets: Exclude<AssetBucket, "reserve">[] = ["chinaCore", "globalCore", "defensive", "satellite"];

export function generateMonthlyPlan(input: {
  monthlyAmount: number;
  style: Style;
  states: Record<Exclude<AssetBucket, "reserve">, MarketState>;
  volatility: "low" | "medium" | "high";
  template?: Record<AssetBucket, number>;
  overrides?: Partial<Record<Exclude<AssetBucket, "reserve">, BucketOverride>>;
}): MonthlyPlan {
  const template = input.template ?? strategyTemplates[input.style] ?? strategyTemplates.balanced;
  const lines = orderedBuckets.map((key) => {
    const ratio = template[key];
    const state = input.states[key];
    const override = input.overrides?.[key];
    const targetAmount = input.monthlyAmount * ratio;
    const multiplier = override?.multiplier ?? (key === "defensive" && state === "cheap" ? 1 : getDcaMultiplier(state));
    const actualBuy = Math.max(0, targetAmount * multiplier);
    const deferred = Math.max(0, targetAmount - actualBuy);

    return {
      key,
      name: bucketLabels[key],
      ratio,
      state,
      targetAmount,
      actualBuy,
      deferred,
      reason: override?.reason ?? getStateReason(state),
    };
  });

  const deferredTotal = lines.reduce((sum, item) => sum + item.deferred, 0);
  const baseReserve = input.monthlyAmount * template.reserve;
  const reserve = baseReserve + deferredTotal;
  const totalBuy = lines.reduce((sum, item) => sum + item.actualBuy, 0);
  const executionFrequency = getExecutionFrequency(input.monthlyAmount, input.volatility);

  return {
    totalMonthlyAmount: input.monthlyAmount,
    executionFrequency,
    totalBuy,
    reserve,
    lines,
    explanations: [
      "月度只决定一次策略，执行可以按周或按日拆分，避免每天被情绪带着改计划。",
      "未买入的资金进入等待资金，不强行投入同一板块。",
      "宽基负责长期定投，产业增强可低速定投，热点主线只做触发式建仓。",
    ],
  };
}
