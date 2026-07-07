import { createDefaultDailyReturns, defaultHoldings } from "./dashboardWorkspace";
import { strategyTemplates } from "./strategyTemplates";
import type {
  AccountProfile,
  AllocationTemplate,
  AssetBucket,
  HoldingItem,
  LowValuationScanResponse,
  MainlineScanResponse,
  MarketHeatIndicator,
  MarketHeatLevel,
  MarketRecommendation,
  StrategyGoal,
  StrategyProfile,
  StrategyTargetRecommendation,
  Style,
} from "../types";

type HoldingBucket = Exclude<AssetBucket, "reserve">;

type TargetTemplate = Omit<StrategyTargetRecommendation, "id" | "allocationPct"> & {
  bucket: HoldingBucket;
  weight: number;
};

const builtinStrategySpecs: Array<{ id: string; goal: StrategyGoal; index: number }> = [
  { id: "strategy-balanced-core", goal: "balancedCore", index: 1 },
  { id: "strategy-global-core-first", goal: "globalCoreFirst", index: 2 },
  { id: "strategy-steady-dca", goal: "steadyDca", index: 3 },
  { id: "strategy-aggressive-satellite", goal: "aggressiveSatellite", index: 4 },
  { id: "strategy-retirement", goal: "retirement", index: 5 },
  { id: "strategy-custom", goal: "custom", index: 6 },
];

export const strategyGoalLabels: Record<StrategyGoal, string> = {
  steadyDca: "稳健定投",
  balancedCore: "宽基均衡",
  globalCoreFirst: "全球核心优先",
  aggressiveSatellite: "进攻增强",
  retirement: "养老防守",
  custom: "自定义",
};

export const strategyGoalDescriptions: Record<StrategyGoal, string> = {
  steadyDca: "适合刚开始定投，优先控制回撤和执行难度。",
  balancedCore: "适合普通上班族，核心宽基为主，少量卫星增强。",
  globalCoreFirst: "适合更信任全球盈利质量，把美股/全球核心作为主要底仓。",
  aggressiveSatellite: "适合能承受高波动，允许主题仓位跟随主线变化。",
  retirement: "适合长期防守型资金，红利、防守仓和等待资金比例更高。",
  custom: "适合已经有清晰资产配置想法的用户。",
};

function timestamp() {
  return new Date().toISOString();
}

function cloneAllocation(allocation: AllocationTemplate): AllocationTemplate {
  return { ...allocation };
}

function toPct(value: number) {
  return Math.round(value * 1000) / 10;
}

const targetTemplates: TargetTemplate[] = [
  {
    code: "510300",
    name: "沪深300ETF",
    bucket: "chinaCore",
    weight: 0.6,
    role: "A股核心底仓，覆盖大盘龙头。",
    tradeHint: "按策略月投入拆分执行；估值或市场热度偏高时只做低速定投。",
    riskNote: "宽基也会受盈利周期和情绪影响，不适合短期满仓追入。",
  },
  {
    code: "510500",
    name: "中证500ETF",
    bucket: "chinaCore",
    weight: 0.4,
    role: "补充中盘成长和经济修复弹性。",
    tradeHint: "和沪深300搭配分批，避免单一风格过度集中。",
    riskNote: "中盘波动通常高于大盘，弱周期里可能回撤更深。",
  },
  {
    code: "513500",
    name: "标普500ETF",
    bucket: "globalCore",
    weight: 0.45,
    role: "全球核心资产，降低单一市场波动。",
    tradeHint: "用小额长期定投摊平汇率和估值波动。",
    riskNote: "QDII可能有溢价、限购和汇率波动，买入前需要核对实时溢价。",
  },
  {
    code: "513100",
    name: "纳指ETF",
    bucket: "globalCore",
    weight: 0.55,
    role: "美股科技成长暴露，承接AI和软件龙头盈利。",
    tradeHint: "只适合分批，若美债收益率上行或估值过热应降速。",
    riskNote: "集中度和估值敏感度较高，不能替代防守仓。",
  },
  {
    code: "515180",
    name: "红利ETF",
    bucket: "defensive",
    weight: 1,
    role: "防守仓和现金流补充，降低组合净值波动。",
    tradeHint: "作为再平衡资金池，市场过热时优先提高防守比例。",
    riskNote: "红利资产并非无波动，利率和周期行业盈利变化会影响表现。",
  },
  {
    code: "159819",
    name: "人工智能ETF",
    bucket: "satellite",
    weight: 1,
    role: "卫星仓，跟踪AI基础设施和应用扩散机会。",
    tradeHint: "只在主线热度不过热且策略允许时分批，超过热度阈值暂停新增。",
    riskNote: "主题波动大，适合观察仓或小比例增强，不适合作为核心仓。",
  },
];

export function createStrategyTemplate(goal: StrategyGoal, index = 1): StrategyProfile {
  const base: Record<StrategyGoal, Omit<StrategyProfile, "id" | "createdAt">> = {
    steadyDca: {
      name: "稳健定投策略",
      goal: "steadyDca",
      style: "conservative",
      monthlyAmount: 2000,
      volatility: "medium",
      riskLevel: "low",
      horizonYears: 3,
      maxDrawdownPct: 20,
      allowSatellite: false,
      allowOverseas: true,
      allocation: cloneAllocation(strategyTemplates.conservative),
      satelliteCapPct: 5,
      heatControl: { normalHeatMax: 60, reduceHeatMin: 70, pauseHeatMin: 82 },
      recommendationReason: "优先保证执行稳定，避免刚开始定投就被主题波动打乱节奏。",
      riskRules: ["主题仓只观察不重仓", "高估资产降速", "等待资金不低于10%"],
    },
    balancedCore: {
      name: "长期宽基均衡策略",
      goal: "balancedCore",
      style: "mainline",
      monthlyAmount: 3000,
      volatility: "medium",
      riskLevel: "medium",
      horizonYears: 5,
      maxDrawdownPct: 30,
      allowSatellite: true,
      allowOverseas: true,
      allocation: cloneAllocation(strategyTemplates.mainline),
      satelliteCapPct: 15,
      heatControl: { normalHeatMax: 65, reduceHeatMin: 75, pauseHeatMin: 85 },
      recommendationReason: "核心宽基负责长期收益，卫星仓只在主线和价格同时合格时动用。",
      riskRules: ["卫星仓不超过总资产15%", "过热时暂停卫星新增", "A股和全球核心不互相替代"],
    },
    globalCoreFirst: {
      name: "全球核心优先策略",
      goal: "globalCoreFirst",
      style: "usCore",
      monthlyAmount: 3000,
      volatility: "medium",
      riskLevel: "medium",
      horizonYears: 5,
      maxDrawdownPct: 32,
      allowSatellite: true,
      allowOverseas: true,
      allocation: { chinaCore: 0.1, globalCore: 0.5, defensive: 0.2, satellite: 0.1, reserve: 0.1 },
      satelliteCapPct: 10,
      heatControl: { normalHeatMax: 62, reduceHeatMin: 72, pauseHeatMin: 82 },
      recommendationReason: "以美股/全球核心作为长期底仓，但保留A股低估修复、红利防守和现金再平衡空间。",
      riskRules: ["QDII溢价高时暂停新增", "美债收益率上行时降低加速买入", "A股低估修复时不完全缺席"],
    },
    aggressiveSatellite: {
      name: "主线进攻增强策略",
      goal: "aggressiveSatellite",
      style: "growth",
      monthlyAmount: 5000,
      volatility: "high",
      riskLevel: "high",
      horizonYears: 5,
      maxDrawdownPct: 45,
      allowSatellite: true,
      allowOverseas: true,
      allocation: { chinaCore: 0.25, globalCore: 0.25, defensive: 0.15, satellite: 0.25, reserve: 0.1 },
      satelliteCapPct: 25,
      heatControl: { normalHeatMax: 68, reduceHeatMin: 78, pauseHeatMin: 88 },
      recommendationReason: "适合主动跟踪AI、半导体、CPO等主线，但必须用热度阈值限制追高。",
      riskRules: ["主题仓分批建仓", "热度超过88暂停新增", "单一主题不超过卫星仓一半"],
    },
    retirement: {
      name: "养老防守策略",
      goal: "retirement",
      style: "dividend",
      monthlyAmount: 2000,
      volatility: "low",
      riskLevel: "low",
      horizonYears: 10,
      maxDrawdownPct: 18,
      allowSatellite: false,
      allowOverseas: true,
      allocation: cloneAllocation(strategyTemplates.dividend),
      satelliteCapPct: 5,
      heatControl: { normalHeatMax: 58, reduceHeatMin: 68, pauseHeatMin: 80 },
      recommendationReason: "更重视现金流、回撤和长期复利，不把主题机会作为主要收益来源。",
      riskRules: ["防守仓和红利仓为主", "主题仓只做观察", "权益大涨后年度再平衡"],
    },
    custom: {
      name: "自定义策略",
      goal: "custom",
      style: "balanced",
      monthlyAmount: 3000,
      volatility: "medium",
      riskLevel: "medium",
      horizonYears: 3,
      maxDrawdownPct: 30,
      allowSatellite: true,
      allowOverseas: true,
      allocation: cloneAllocation(strategyTemplates.balanced),
      satelliteCapPct: 15,
      heatControl: { normalHeatMax: 65, reduceHeatMin: 75, pauseHeatMin: 85 },
      recommendationReason: "保留基础均衡框架，后续根据用户目标调整。",
      riskRules: ["先确定仓位上限", "再确定标的", "最后确定执行节奏"],
    },
  };

  const template = base[goal];
  return {
    ...template,
    id: `strategy-${goal}-${Date.now()}-${index}`,
    createdAt: timestamp(),
  };
}

export function createDefaultStrategies(): StrategyProfile[] {
  return builtinStrategySpecs.map((spec) => ({
    ...createStrategyTemplate(spec.goal, spec.index),
    id: spec.id,
    createdAt: timestamp(),
  }));
}

export function ensureBuiltinStrategies(strategies: StrategyProfile[]): StrategyProfile[] {
  if (!Array.isArray(strategies) || !strategies.length) return createDefaultStrategies();

  const seenGoals = new Set<StrategyGoal>();
  const next = strategies.filter((strategy) => {
    if (strategy.goal === "custom") return true;
    if (seenGoals.has(strategy.goal)) return false;
    seenGoals.add(strategy.goal);
    return true;
  });

  for (const spec of builtinStrategySpecs) {
    const exists = next.some((strategy) => strategy.id === spec.id || strategy.goal === spec.goal);
    if (!exists) {
      next.push({
        ...createStrategyTemplate(spec.goal, spec.index),
        id: spec.id,
        createdAt: timestamp(),
      });
    }
  }
  return next;
}

export function createDefaultAccounts(): AccountProfile[] {
  return [
    {
      id: "account-default",
      name: "默认账户",
      strategyId: "strategy-balanced-core",
      holdings: defaultHoldings.map((holding) => ({ ...holding })),
      executionLogs: [],
      dailyReturns: createDefaultDailyReturns(),
      cashReserve: 0,
      createdAt: timestamp(),
    },
  ];
}

export function getStrategyTargetRecommendations(strategy: StrategyProfile): StrategyTargetRecommendation[] {
  const byBucket = targetTemplates.reduce<Record<HoldingBucket, TargetTemplate[]>>(
    (map, item) => {
      map[item.bucket].push(item);
      return map;
    },
    { chinaCore: [], globalCore: [], defensive: [], satellite: [] },
  );

  const buckets: HoldingBucket[] = ["chinaCore", "globalCore", "defensive", "satellite"];
  return buckets.flatMap((bucket) => {
    const bucketAllocation = strategy.allocation[bucket] ?? 0;
    if (bucketAllocation <= 0) return [];
    if (bucket === "globalCore" && !strategy.allowOverseas) return [];
    if (bucket === "satellite" && (!strategy.allowSatellite || strategy.satelliteCapPct <= 0)) return [];

    return byBucket[bucket].map((item) => ({
      id: `${strategy.id}-${item.code}`,
      code: item.code,
      name: item.name,
      bucket: item.bucket,
      allocationPct: toPct(bucketAllocation * item.weight),
      role: item.role,
      tradeHint:
        bucket === "satellite"
          ? `${item.tradeHint} 当前策略卫星上限 ${strategy.satelliteCapPct}%，暂停阈值 ${strategy.heatControl.pauseHeatMin} 分。`
          : item.tradeHint,
      riskNote: item.riskNote,
    }));
  });
}

export function createInitialHoldingsFromStrategy(strategy: StrategyProfile): HoldingItem[] {
  return getStrategyTargetRecommendations(strategy).map((target) => ({
    id: `holding-${target.code}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    code: target.code,
    name: target.name,
    bucket: target.bucket,
    costAmount: 0,
    marketValue: 0,
    todayReturnPct: 0,
    bucketShare: Math.max(0.1, target.allocationPct),
  }));
}

function heatLevel(value: number): MarketHeatLevel {
  if (value >= 86) return "overheated";
  if (value >= 76) return "hot";
  if (value >= 66) return "warm";
  if (value >= 45) return "normal";
  return "cold";
}

function indicator(
  key: string,
  label: string,
  value: number,
  unit: string,
  detail: string,
): MarketHeatIndicator {
  return { key, label, value: Math.round(value), unit, level: heatLevel(value), detail };
}

export function buildMarketRecommendation(
  mainlineScan: MainlineScanResponse | null,
  lowValuationScan: LowValuationScanResponse | null,
): MarketRecommendation {
  const mainlines = mainlineScan?.results ?? [];
  const top = mainlines[0];
  const averageHeat = mainlines.length
    ? mainlines.slice(0, 8).reduce((sum, item) => sum + item.heatScore, 0) / Math.min(8, mainlines.length)
    : 55;
  const averageValuation = mainlines.length
    ? mainlines.slice(0, 8).reduce((sum, item) => sum + item.valuationPercentile, 0) / Math.min(8, mainlines.length)
    : 55;
  const averageFundFlow = mainlines.length
    ? mainlines.slice(0, 8).reduce((sum, item) => sum + item.fundFlowProxy, 0) / Math.min(8, mainlines.length)
    : 55;
  const overheatedCount = mainlines.filter((item) => item.heatScore >= 82 || item.valuationPercentile >= 86).length;
  const lowValueCount = lowValuationScan?.results.filter((item) => item.statusKey === "top").length ?? 0;

  const indicators = [
    indicator("heat", "主线热度", averageHeat, "分", `前8个主线候选平均热度，最高方向：${top?.name ?? "暂无"}`),
    indicator("valuation", "估值拥挤", averageValuation, "分位", "主线候选的估值/拥挤代理，越高越不适合追高。"),
    indicator("fund", "资金强弱", averageFundFlow, "分", "成交、换手和资金代理指标，越高说明短期资金越集中。"),
    indicator("overheated", "过热数量", overheatedCount * 12, "个", `${overheatedCount} 个方向处在过热或高拥挤区。`),
    indicator("lowValue", "低估机会", Math.min(100, lowValueCount * 25), "个", `${lowValueCount} 个方向进入低估可定投区。`),
  ];

  const compositeHeat =
    averageHeat * 0.35 +
    averageValuation * 0.25 +
    averageFundFlow * 0.2 +
    Math.min(100, overheatedCount * 12) * 0.15 -
    Math.min(30, lowValueCount * 6);
  const level = heatLevel(compositeHeat);

  if (level === "overheated" || level === "hot") {
    return {
      title: "市场偏热，先控制卫星仓",
      action: "核心宽基低速执行，卫星仓降速或暂停，等待回调后再提高买入。",
      reason: "主线热度和估值拥挤同时偏高，容易出现追高后回撤；此时策略应强调仓位上限和等待资金。",
      heatLevel: level,
      suggestedStyle: "balanced",
      suggestedMonthlyMultiplier: 0.5,
      satelliteThrottle: level === "overheated" ? 0 : 0.3,
      indicators,
    };
  }

  if (lowValueCount >= 2 && averageHeat < 70) {
    return {
      title: "低估机会改善，适合均衡定投",
      action: "提高核心宽基和低估值方向的定投权重，卫星仓仍保持小比例验证。",
      reason: "低估值池出现多个可定投方向，且主线热度没有极端拥挤，赔率比追热门主题更好。",
      heatLevel: level,
      suggestedStyle: "mainline",
      suggestedMonthlyMultiplier: 1,
      satelliteThrottle: 0.3,
      indicators,
    };
  }

  return {
    title: "市场温和，按策略正常执行",
    action: "核心仓正常定投，卫星仓只按主线候选和热度阈值分批执行。",
    reason: "资金热度、估值拥挤和低估值机会没有给出极端信号，最重要的是按既定策略稳定执行。",
    heatLevel: level,
    suggestedStyle: "mainline",
    suggestedMonthlyMultiplier: 1,
    satelliteThrottle: 0.5,
    indicators,
  };
}

export function createStrategyFromRecommendation(recommendation: MarketRecommendation) {
  if (recommendation.heatLevel === "hot" || recommendation.heatLevel === "overheated") {
    const strategy = createStrategyTemplate("steadyDca");
    strategy.name = "市场偏热防守策略";
    strategy.style = recommendation.suggestedStyle;
    strategy.monthlyAmount = Math.round(strategy.monthlyAmount * recommendation.suggestedMonthlyMultiplier);
    strategy.allocation = { chinaCore: 0.25, globalCore: 0.25, defensive: 0.35, satellite: 0.05, reserve: 0.1 };
    strategy.satelliteCapPct = 5;
    strategy.recommendationReason = recommendation.reason;
    return strategy;
  }

  const strategy = createStrategyTemplate("balancedCore");
  strategy.recommendationReason = recommendation.reason;
  strategy.allocation.satellite = recommendation.satelliteThrottle >= 0.5 ? 0.15 : 0.1;
  strategy.allocation.reserve = recommendation.satelliteThrottle >= 0.5 ? 0.1 : 0.15;
  return strategy;
}
