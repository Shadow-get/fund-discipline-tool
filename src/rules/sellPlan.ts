export type SellInput = {
  totalAssets: number;
  currentAmount: number;
  targetWeight: number;
  baseRatio: number;
  heatScore: number;
  fundPrice: number;
};

export function getSellPlan(input: SellInput) {
  const targetAmount = input.totalAssets * input.targetWeight;
  const baseAmount = targetAmount * input.baseRatio;
  const overweight = input.currentAmount - targetAmount;
  const sellable = input.currentAmount - baseAmount;
  const suggestedSell = Math.max(0, Math.min(overweight, sellable));

  if (suggestedSell <= 0) {
    return {
      needSell: false,
      targetAmount,
      baseAmount,
      suggestedSell: 0,
      message: "当前没有明显超配，不建议为了猜顶部而卖出。",
    };
  }

  const days = input.heatScore >= 85 ? 20 : input.heatScore >= 70 ? 40 : 60;
  const dailySellAmount = suggestedSell / days;
  const dailyShares = input.fundPrice > 0 ? dailySellAmount / input.fundPrice : 0;
  const weeklySellAmount = dailySellAmount * 5;

  return {
    needSell: true,
    targetAmount,
    baseAmount,
    suggestedSell,
    days,
    dailySellAmount,
    dailyShares,
    weeklySellAmount,
    monthlySellAmount: suggestedSell,
    stopAtAmount: Math.max(targetAmount, baseAmount),
    message: input.heatScore >= 85 ? "严重超配且热度较高，可采用日度分批卖出。" : "仓位超目标，优先用周度或月度再平衡。",
  };
}
