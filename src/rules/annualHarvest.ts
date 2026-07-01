export function getHarvestPlan(input: {
  startPrincipal: number;
  annualContribution: number;
  endValue: number;
  valuationPercentile: number;
  currentWeight: number;
  targetWeight: number;
  originalMonthlyDca: number;
}) {
  const profit = Math.max(0, input.endValue - input.startPrincipal - input.annualContribution);
  const isOverTarget = input.currentWeight > input.targetWeight * 1.2;

  let harvestRatio = 0;
  let reason = "年度收益或估值条件不足，不机械收割。";

  if (profit > 0 && input.valuationPercentile < 40) {
    harvestRatio = 0.1;
    reason = "有浮盈但估值仍低，只象征性收割，保留复利。";
  } else if (profit > input.annualContribution * 0.08 && input.valuationPercentile >= 55) {
    harvestRatio = 0.4;
    reason = "年度收益较好且估值合理偏高，可收割部分收益平滑下一年现金流。";
  }

  if (input.valuationPercentile >= 70) {
    harvestRatio = Math.max(harvestRatio, 0.6);
    reason = "估值分位较高，适合把部分浮盈转为下一年定投资金。";
  }

  if (input.valuationPercentile >= 85 && isOverTarget) {
    harvestRatio = 0.8;
    reason = "估值过热且仓位超标，收益收割可叠加再平衡。";
  }

  const harvestAmount = profit * harvestRatio;
  const monthlyBoost = harvestAmount / 12;

  return {
    profit,
    harvestRatio,
    harvestAmount,
    monthlyBoost,
    nextYearMonthlyDca: input.originalMonthlyDca + monthlyBoost,
    reason,
    risk: "如果市场进入单边牛市，过早收割可能降低复利，因此该策略只作为A股增强模块。",
  };
}
