import { fallbackLowValuationScan } from "./lowValuationSnapshot.mjs";
import { lowValuationUniverse } from "./lowValuationUniverse.mjs";

const browserHeaders = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
};
const dynamicQuoteFields = "f12,f14,f100,f2,f3,f6,f8,f9,f20,f23,f62,f184";

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchJsonWithRetry(url, { headers = {}, attempts = 3, timeoutMs = 9000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        headers: { ...browserHeaders, ...headers },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(220 * attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("请求失败");
}

async function mapInChunks(items, size, mapper) {
  const results = [];
  for (let index = 0; index < items.length; index += size) {
    const chunk = items.slice(index, index + size);
    results.push(...(await Promise.allSettled(chunk.map(mapper))));
  }
  return results;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value, digits = 2) {
  return Number(number(value).toFixed(digits));
}

function nowIso() {
  return new Date().toISOString();
}

function safeLog10(value) {
  return Math.log10(Math.max(1, number(value, 1)));
}

function percentileRank(value, sortedValues) {
  if (!sortedValues.length) return 50;
  let left = 0;
  let right = sortedValues.length;
  while (left < right) {
    const middle = Math.floor((left + right) / 2);
    if (sortedValues[middle] <= value) left = middle + 1;
    else right = middle;
  }
  return Math.round((left / sortedValues.length) * 100);
}

async function fetchDynamicMarketRows({ fast = false } = {}) {
  const hosts = ["https://push2.eastmoney.com", "https://push2delay.eastmoney.com"];
  const errors = [];

  for (const host of hosts) {
    try {
      const sortPlans = [
        { fid: "f9", po: 0, pages: fast ? 5 : 12 },
        { fid: "f23", po: 0, pages: fast ? 5 : 12 },
        { fid: "f3", po: 1, pages: fast ? 3 : 8 },
        { fid: "f184", po: 1, pages: fast ? 3 : 8 },
      ];
      const requests = sortPlans.flatMap((plan) =>
        Array.from({ length: plan.pages }, (_, index) => ({
          ...plan,
          page: index + 1,
        })),
      );
      const settled = await mapInChunks(requests, 8, async ({ fid, po, page }) => {
        const url =
          `${host}/api/qt/clist/get?pn=${page}&pz=100&po=${po}&np=1&fltt=2&invt=2&fid=${fid}` +
          "&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23" +
          `&fields=${dynamicQuoteFields}`;
        const json = await fetchJsonWithRetry(url, {
          headers: { Referer: "https://quote.eastmoney.com/" },
          attempts: 3,
          timeoutMs: 8500,
        });
        const rows = json?.data?.diff ?? [];
        return Array.isArray(rows) ? rows : [];
      });
      const all = [];
      const seen = new Set();
      for (const item of settled) {
        if (item.status !== "fulfilled") continue;
        for (const row of item.value) {
          const code = String(row.f12 ?? "");
          if (!code || seen.has(code)) continue;
          seen.add(code);
          all.push(row);
        }
      }

      const validRows = all
        .filter((row) => /^\d{6}$/.test(String(row.f12 ?? "")))
        .filter((row) => !/ST|退|^N/.test(String(row.f14 ?? "")))
        .filter((row) => {
          const pe = number(row.f9);
          const pb = number(row.f23);
          const marketCap = number(row.f20);
          return pe > 0 && pe <= 80 && pb > 0 && pb <= 8 && marketCap >= 5_000_000_000;
        });
      if (validRows.length >= 80) return validRows;
      throw new Error(`动态低估候选不足：${validRows.length}`);
    } catch (error) {
      errors.push(`${host.replace("https://", "")}: ${error instanceof Error ? error.message : "未知错误"}`);
    }
  }

  throw new Error(errors.join("；"));
}

function percentileDiscount(percentile) {
  return clamp(100 - percentile);
}

function dividendScore(dividendYield) {
  return clamp((dividendYield / 6) * 100);
}

function earningsYield(pe) {
  return pe > 0 ? 100 / pe : 0;
}

function spreadScore(spread) {
  return clamp(50 + spread * 8);
}

function classifyStage(valueScore, cycleScore, profitTrendScore, trendConfirmationScore) {
  if (profitTrendScore < 42) return "盈利出清";
  if (valueScore >= 72 && trendConfirmationScore < 45) return "低估左侧";
  if (valueScore >= 70 && cycleScore >= 64) return "低估修复初期";
  if (valueScore >= 62) return "估值修复观察";
  return "估值合理";
}

function classifyStatus(valueScore, score, logicRiskScore) {
  if (valueScore >= 66 && logicRiskScore >= 66) return ["trap", "便宜但需验证"];
  if (score >= 76 && valueScore >= 70 && logicRiskScore < 55) return ["top", "低估可定投"];
  if (score >= 64 || valueScore >= 68) return ["watch", "低估观察"];
  return ["fair", "暂不进入"];
}

function fallbackPayload(fallback, mode = "fallback", message) {
  return {
    ...fallback,
    mode,
    message: message ?? fallback.message,
  };
}

export function analyzeLowValuationCandidate(candidate, riskFreeYield = 2.2) {
  const pe = number(candidate.pe);
  const pb = number(candidate.pb);
  const pePercentile = number(candidate.pePercentile, 50);
  const pbPercentile = number(candidate.pbPercentile, 50);
  const dividendYieldValue = number(candidate.dividendYield);
  const roe = number(candidate.roe);
  const qualityScore = number(candidate.qualityScore, 50);
  const profitTrendScore = number(candidate.profitTrendScore, 50);
  const cycleScore = number(candidate.cycleScore, 50);
  const trendConfirmationScore = number(candidate.trendConfirmationScore, 50);
  const liquidityScore = number(candidate.liquidityScore, 60);
  const logicRiskScore = number(candidate.logicRiskScore, 50);

  const ey = earningsYield(pe);
  const eySpread = ey - riskFreeYield;
  const valueScore = clamp(
    percentileDiscount(pePercentile) * 0.3 +
      percentileDiscount(pbPercentile) * 0.22 +
      dividendScore(dividendYieldValue) * 0.2 +
      spreadScore(eySpread) * 0.18 +
      clamp(roe * 4) * 0.1,
  );
  const qualityComposite = clamp(qualityScore * 0.5 + profitTrendScore * 0.3 + liquidityScore * 0.2);
  const score = clamp(
    valueScore * 0.42 +
      qualityComposite * 0.24 +
      cycleScore * 0.18 +
      trendConfirmationScore * 0.1 +
      liquidityScore * 0.06 -
      logicRiskScore * 0.22,
  );
  const marginOfSafety = clamp(valueScore * 0.68 + spreadScore(eySpread) * 0.22 - logicRiskScore * 0.18);
  const [statusKey, status] = classifyStatus(valueScore, score, logicRiskScore);

  const ratioByStatus = {
    top: "核心/防守仓的5%-15%，分批定投",
    watch: "观察仓0%-5%，等待盈利或资金确认",
    trap: "0%-3%跟踪，不因便宜重仓",
    fair: "暂不新增，等待估值或基本面改善",
  };
  const actionByStatus = {
    top: "可纳入低估值定投池，按月或按周分批",
    watch: "先观察，等盈利修复或资金企稳后再提高",
    trap: "便宜但逻辑有瑕疵，只做验证清单",
    fair: "估值吸引力不足，不进入低估值池",
  };
  const reasonByStatus = {
    top: "估值分位、盈利收益率和质量指标同时具备安全边际。",
    watch: "价格已有折价，但盈利周期或趋势确认还不充分。",
    trap: "估值便宜，但需求、盈利或行业逻辑存在较大验证压力。",
    fair: "当前折价不足，或风险调整后的赔率不够。",
  };

  return {
    candidateId: candidate.candidateId,
    name: candidate.name,
    category: candidate.category,
    representativeIndex: candidate.representativeIndex,
    representativeEtfs: candidate.representativeEtfs ?? [],
    pe: round(pe, 2),
    pb: round(pb, 2),
    pePercentile: Math.round(pePercentile),
    pbPercentile: Math.round(pbPercentile),
    dividendYield: round(dividendYieldValue, 2),
    earningsYield: round(ey, 2),
    earningsYieldSpread: round(eySpread, 2),
    roe: round(roe, 2),
    valueScore: Math.round(valueScore),
    qualityScore: Math.round(qualityComposite),
    cycleScore: Math.round(cycleScore),
    logicRiskScore: Math.round(logicRiskScore),
    marginOfSafety: Math.round(marginOfSafety),
    score: Math.round(score),
    stage: classifyStage(valueScore, cycleScore, profitTrendScore, trendConfirmationScore),
    statusKey,
    status,
    suggestedRatio: ratioByStatus[statusKey],
    action: actionByStatus[statusKey],
    reason: reasonByStatus[statusKey],
    evidence: {
      valuation: `PE/PB 分位 ${Math.round(pePercentile)}%/${Math.round(pbPercentile)}%，盈利收益率 ${ey.toFixed(1)}%，相对无风险收益率利差 ${eySpread.toFixed(1)}%。`,
      dividend: `股息率 ${dividendYieldValue.toFixed(1)}%，ROE ${roe.toFixed(1)}%，质量/盈利趋势 ${Math.round(qualityComposite)}/${Math.round(profitTrendScore)} 分。`,
      cycle: `周期修复 ${Math.round(cycleScore)} 分，趋势确认 ${Math.round(trendConfirmationScore)} 分。`,
      risk: `逻辑风险 ${Math.round(logicRiskScore)} 分；${candidate.riskNote ?? "需要继续跟踪盈利与估值。"}`,
    },
    source: candidate.source ?? "低估值候选池，需要定期更新",
    updatedAt: nowIso(),
  };
}

function analyzeDynamicLowValuationRow(row, context, riskFreeYield = 2.2) {
  const pe = number(row.f9);
  const pb = number(row.f23);
  const pePercentile = percentileRank(pe, context.peValues);
  const pbPercentile = percentileRank(pb, context.pbValues);
  const close = number(row.f2);
  const dailyChangePct = number(row.f3);
  const amount = number(row.f6);
  const turnoverRate = number(row.f8);
  const fundFlowRatio = number(row.f184);
  const marketCap = number(row.f20);
  const industry = String(row.f100 ?? "动态行情");
  const ey = earningsYield(pe);
  const eySpread = ey - riskFreeYield;
  const roe = pe > 0 ? (pb / pe) * 100 : 0;
  const marketCapScore = clamp(38 + (safeLog10(marketCap) - 9) * 13);
  const liquidityScore = clamp(34 + safeLog10(amount) * 4.5 + Math.min(22, turnoverRate * 1.2));
  const profitTrendScore = clamp(48 + dailyChangePct * 2.1 + fundFlowRatio * 0.75);
  const trendConfirmationScore = clamp(42 + Math.max(0, dailyChangePct) * 3 + Math.max(0, fundFlowRatio) * 1.2 + Math.min(18, turnoverRate));
  const cycleScore = clamp(trendConfirmationScore * 0.56 + liquidityScore * 0.24 + marketCapScore * 0.2);
  const valueScore = clamp(
    percentileDiscount(pePercentile) * 0.34 +
      percentileDiscount(pbPercentile) * 0.3 +
      spreadScore(eySpread) * 0.24 +
      clamp(roe * 5) * 0.12,
  );
  const qualityScore = clamp(clamp(roe * 5) * 0.46 + marketCapScore * 0.32 + liquidityScore * 0.22);
  const logicRiskScore = clamp(
    36 +
      (pe < 5 ? 8 : 0) +
      (roe < 4 ? 12 : 0) +
      (dailyChangePct < -2 ? 9 : 0) +
      (fundFlowRatio < -5 ? 10 : 0) +
      (turnoverRate > 18 ? 8 : 0) -
      marketCapScore * 0.1,
  );
  const score = clamp(
    valueScore * 0.46 +
      qualityScore * 0.2 +
      cycleScore * 0.18 +
      trendConfirmationScore * 0.1 +
      liquidityScore * 0.06 -
      logicRiskScore * 0.2,
  );
  const marginOfSafety = clamp(valueScore * 0.72 + spreadScore(eySpread) * 0.2 - logicRiskScore * 0.16);
  const [statusKey, status] = classifyStatus(valueScore, score, logicRiskScore);
  const stage = classifyStage(valueScore, cycleScore, profitTrendScore, trendConfirmationScore);
  const code = String(row.f12 ?? "");

  const ratioByStatus = {
    top: "观察仓5%-10%，只分批验证",
    watch: "观察仓0%-5%，等趋势和财报确认",
    trap: "0%-3%跟踪，不因低PE重仓",
    fair: "暂不新增，等待折价扩大",
  };
  const actionByStatus = {
    top: "可放入动态低估观察池，按回踩和财报分批验证",
    watch: "先观察，等待资金和盈利修复更清楚",
    trap: "低估但风险高，只保留验证清单",
    fair: "动态折价不足，不进入低估池",
  };
  const reasonByStatus = {
    top: "实时 PE/PB 和盈利收益率处在全市场低位，且当日资金/活跃度没有明显恶化。",
    watch: "实时估值有折价，但资金或趋势确认还不充分。",
    trap: "实时估值便宜，但资金、ROE或短线表现提示低估陷阱风险。",
    fair: "当前实时折价不足，或风险调整后的赔率不够。",
  };

  return {
    candidateId: `dynamic_${code}`,
    code,
    name: String(row.f14 ?? code),
    category: industry || "动态个股",
    representativeIndex: `${String(row.f14 ?? code)}（${code}）`,
    representativeEtfs: [code],
    close: round(close, 2),
    dailyChangePct: round(dailyChangePct, 2),
    turnoverRate: round(turnoverRate, 2),
    fundFlowRatio: round(fundFlowRatio, 2),
    amount: Math.round(amount),
    dynamic: true,
    pe: round(pe, 2),
    pb: round(pb, 2),
    pePercentile,
    pbPercentile,
    dividendYield: 0,
    earningsYield: round(ey, 2),
    earningsYieldSpread: round(eySpread, 2),
    roe: round(roe, 2),
    valueScore: Math.round(valueScore),
    qualityScore: Math.round(qualityScore),
    cycleScore: Math.round(cycleScore),
    logicRiskScore: Math.round(logicRiskScore),
    marginOfSafety: Math.round(marginOfSafety),
    score: Math.round(score),
    stage,
    statusKey,
    status,
    suggestedRatio: ratioByStatus[statusKey],
    action: actionByStatus[statusKey],
    reason: reasonByStatus[statusKey],
    evidence: {
      valuation: `实时 PE/PB ${pe.toFixed(2)}/${pb.toFixed(2)}，全市场动态分位 ${pePercentile}%/${pbPercentile}%，盈利收益率 ${ey.toFixed(1)}%，利差 ${eySpread.toFixed(1)}%。`,
      dividend: `当日涨跌 ${dailyChangePct.toFixed(2)}%，换手 ${turnoverRate.toFixed(2)}%，主力净流入占比 ${fundFlowRatio.toFixed(2)}%。`,
      cycle: `动态修复 ${Math.round(cycleScore)} 分，活跃度 ${Math.round(liquidityScore)} 分，趋势确认 ${Math.round(trendConfirmationScore)} 分。`,
      risk: `逻辑风险 ${Math.round(logicRiskScore)} 分；动态低估仍需核对最新财报、行业景气和是否存在一次性盈利。`,
    },
    source: `东方财富全市场快照：${industry || "行业未知"}`,
    updatedAt: nowIso(),
  };
}

export async function scanLowValuationDynamic({ riskFreeYield = 2.2, fast = false } = {}) {
  const rows = await fetchDynamicMarketRows({ fast });
  const peValues = rows.map((row) => number(row.f9)).filter((value) => value > 0).sort((a, b) => a - b);
  const pbValues = rows.map((row) => number(row.f23)).filter((value) => value > 0).sort((a, b) => a - b);
  const context = { peValues, pbValues };
  const results = rows
    .map((row) => analyzeDynamicLowValuationRow(row, context, number(riskFreeYield, 2.2)))
    .filter((item) => item.valueScore >= 55 || item.marginOfSafety >= 45 || item.cycleScore >= 62)
    .sort((a, b) => b.score - a.score)
    .slice(0, 80);

  if (results.length < 8) {
    throw new Error(`动态低估扫描有效候选不足：${results.length}`);
  }

  return {
    mode: "live",
    source: "东方财富全市场动态快照",
    updatedAt: nowIso(),
    riskFreeYield: number(riskFreeYield, 2.2),
    message: `读取 ${rows.length} 条实时行情，筛出 ${results.length} 个动态低估/回弹候选。`,
    methodology: [
      "实时 PE/PB 来自公开行情快照，分位为当次全市场横截面动态分位。",
      "趋势回弹使用当日涨跌、换手、成交额和主力净流入占比做动态确认。",
      "动态结果只用于交易时间观察，真实买入仍需核对财报、行业逻辑和风险事件。",
    ],
    results,
  };
}

export function scanLowValuation({
  universe = lowValuationUniverse,
  fallback = fallbackLowValuationScan,
  riskFreeYield = 2.2,
} = {}) {
  if (!Array.isArray(universe) || !universe.length) {
    return fallbackPayload(fallback, "fallback", "缺少低估值候选池，使用内置快照。");
  }

  const results = universe
    .map((candidate) => analyzeLowValuationCandidate(candidate, number(riskFreeYield, 2.2)))
    .sort((a, b) => b.score - a.score);

  return {
    mode: "model",
    source: "低估值候选池 + 即时评分模型",
    updatedAt: nowIso(),
    riskFreeYield: number(riskFreeYield, 2.2),
    message: `扫描 ${results.length} 个低估值候选，使用盈利收益率法、博格公式思想、估值分位和质量风险约束即时重算。`,
    methodology: [
      "盈利收益率 = 100 / PE，用来和无风险收益率比较。",
      "安全边际来自 PE/PB 历史分位、股息率、盈利收益率利差和逻辑风险折扣。",
      "巴菲特/芒格/段永平思想：好生意、好价格、现金流、能力圈和长期赔率必须同时考虑。",
      "彼得林奇周期股框架：周期行业不能只看低PE，还要看供需、利润阶段和趋势确认。",
      "低估不等于买入；质量、盈利趋势、周期位置和逻辑风险会扣分。",
    ],
    results,
  };
}
