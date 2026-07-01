export function getPortfolioHealth(input: {
  chinaCore: number;
  globalCore: number;
  defensive: number;
  satellite: number;
  reserve: number;
}) {
  const total = Object.values(input).reduce((sum, value) => sum + value, 0);
  const weights = {
    chinaCore: total ? input.chinaCore / total : 0,
    globalCore: total ? input.globalCore / total : 0,
    defensive: total ? input.defensive / total : 0,
    satellite: total ? input.satellite / total : 0,
    reserve: total ? input.reserve / total : 0,
  };

  const warnings: string[] = [];
  if (weights.satellite > 0.25) warnings.push("卫星仓超过25%，主题风险偏高，建议回到目标仓位。");
  if (weights.chinaCore + weights.globalCore < 0.4) warnings.push("核心仓不足，组合可能过度依赖主题或短期风格。");
  if (weights.reserve < 0.05) warnings.push("等待资金不足，市场回调时可用资金偏少。");
  if (weights.defensive < 0.15) warnings.push("防守仓较低，组合回撤承受压力会更大。");

  return {
    total,
    weights,
    status: warnings.length ? "需要调整" : "结构均衡",
    warnings,
  };
}
