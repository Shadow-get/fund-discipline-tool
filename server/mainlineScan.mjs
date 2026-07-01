import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fallbackMainlineScan } from "./mainlineSnapshot.mjs";
import { mainlineUniverse } from "./mainlineUniverse.mjs";

const cachePath = resolve(process.cwd(), ".cache", "mainline-scan.json");
const klineFields =
  "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61";

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

function pct(current, previous) {
  if (!current || !previous) return 0;
  return ((current - previous) / previous) * 100;
}

function scoreFromReturn(value, center = 0, scale = 20) {
  return clamp(50 + ((value - center) / scale) * 50);
}

async function fetchKlines(secid) {
  const url =
    `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}` +
    `&ut=fa5fd1943c7b386f172d6893dbfba10b&klt=101&fqt=1&end=20500101&lmt=150` +
    `&fields1=f1,f2,f3,f4,f5,f6&fields2=${klineFields}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      Referer: "https://quote.eastmoney.com/",
    },
  });

  if (!response.ok) {
    throw new Error(`行情请求失败 ${response.status}`);
  }

  const json = await response.json();
  const lines = json?.data?.klines;
  if (!Array.isArray(lines) || lines.length < 30) {
    throw new Error("行情数据不足");
  }

  return lines.map((line) => {
    const [date, open, close, high, low, volume, amount, amplitude, changePct, changeAmount, turnover] = String(line).split(",");
    return {
      date,
      open: Number(open),
      close: Number(close),
      high: Number(high),
      low: Number(low),
      volume: Number(volume),
      amount: Number(amount),
      amplitude: Number(amplitude),
      changePct: Number(changePct),
      changeAmount: Number(changeAmount),
      turnover: Number(turnover),
    };
  });
}

async function fetchCandidateSeries(candidate) {
  const errors = [];
  for (const security of candidate.securities) {
    try {
      const klines = await fetchKlines(security.secid);
      return { security, klines };
    } catch (error) {
      errors.push(`${security.name}:${error.message}`);
    }
  }

  throw new Error(errors.join("; "));
}

function analyzeKlines(candidate, series, benchmark) {
  const klines = series.klines;
  const last = klines.at(-1);
  const close = last?.close ?? 0;
  const close20 = klines.at(-21)?.close ?? klines[0].close;
  const close60 = klines.at(-61)?.close ?? klines[0].close;
  const close120 = klines.at(-121)?.close ?? klines[0].close;
  const returns20 = pct(close, close20);
  const returns60 = pct(close, close60);
  const returns120 = pct(close, close120);

  const recent20 = klines.slice(-20);
  const previous20 = klines.slice(-40, -20);
  const amountRecent = recent20.reduce((sum, item) => sum + item.amount, 0) / Math.max(1, recent20.length);
  const amountPrevious = previous20.reduce((sum, item) => sum + item.amount, 0) / Math.max(1, previous20.length);
  const volumeTrend = clamp(50 + pct(amountRecent, amountPrevious));

  const turnoverRecent = recent20.reduce((sum, item) => sum + (item.turnover || 0), 0) / Math.max(1, recent20.length);
  const turnoverPrevious = previous20.reduce((sum, item) => sum + (item.turnover || 0), 0) / Math.max(1, previous20.length);
  const turnoverTrend = clamp(50 + pct(turnoverRecent || amountRecent, turnoverPrevious || amountPrevious));
  const fundFlowProxy = clamp(volumeTrend * 0.6 + turnoverTrend * 0.4);

  const benchmark20 = benchmark?.returns20 ?? 0;
  const benchmark60 = benchmark?.returns60 ?? 0;
  const benchmark120 = benchmark?.returns120 ?? 0;
  const relative20 = returns20 - benchmark20;
  const relative60 = returns60 - benchmark60;
  const relative120 = returns120 - benchmark120;
  const relativeStrength = clamp(
    scoreFromReturn(relative20, 0, 12) * 0.35 +
      scoreFromReturn(relative60, 0, 22) * 0.4 +
      scoreFromReturn(relative120, 0, 35) * 0.25,
  );

  const trendContinuity = clamp(
    (returns20 > 0 ? 25 : 0) +
      (returns60 > returns20 * 0.5 ? 25 : 0) +
      (returns120 > returns60 * 0.5 ? 25 : 0) +
      (close > close60 ? 25 : 0),
  );

  const heatScore = clamp(
    Math.max(0, returns20) * 1.3 +
      Math.max(0, returns60) * 0.75 +
      Math.max(0, returns120) * 0.35 +
      Math.max(0, volumeTrend - 55) * 0.7 +
      Math.max(0, turnoverTrend - 55) * 0.4,
  );
  const valuationPercentile = clamp(45 + heatScore * 0.45 + Math.max(0, returns120) * 0.18);
  const valuationConstraint = 100 - Math.max(valuationPercentile, heatScore);

  const score = clamp(
    fundFlowProxy * 0.3 +
      relativeStrength * 0.25 +
      trendContinuity * 0.15 +
      valuationConstraint * 0.2 +
      (candidate.industryScore * 0.6 + candidate.policyScore * 0.4) * 0.1,
  );

  const stage =
    heatScore >= 82
      ? "高热拥挤"
      : fundFlowProxy >= 75 && relativeStrength >= 68 && trendContinuity >= 70
        ? "业绩验证"
        : fundFlowProxy >= 68 && relativeStrength >= 62
          ? "订单验证"
          : fundFlowProxy >= 62
            ? "预期驱动"
            : "观察期";

  const status =
    heatScore >= 86 || valuationPercentile >= 88
      ? "过热等待"
      : score >= 72 && heatScore < 78
        ? "主线候选"
        : score >= 62
          ? "可小仓观察"
          : "暂不进入";

  const suggestedSatelliteRatio =
    status === "主线候选" ? "卫星仓的50%-100%" : status === "可小仓观察" ? "卫星仓的20%-50%" : "0%-20%";

  const action =
    status === "主线候选"
      ? "可作为主线卫星候选，按估值分批"
      : status === "可小仓观察"
        ? "小仓观察或等待回调确认"
        : status === "过热等待"
          ? "不追高，等待热度回落"
          : "暂不进入本月卫星仓";

  const reason =
    status === "主线候选"
      ? "资金方向、相对强弱和趋势持续性同时较强，且热度没有极端拥挤。"
      : status === "过热等待"
        ? "资金热度和涨幅都较高，短期追入的安全边际不足。"
        : status === "可小仓观察"
          ? "有资金或趋势线索，但证据链还不够完整。"
          : "资金、强弱或趋势持续性不足，不应只凭故事进入卫星仓。";

  return {
    candidateId: candidate.candidateId,
    name: candidate.name,
    category: candidate.category,
    representativeIndex: candidate.representativeIndex,
    representativeEtfs: candidate.representativeEtfs,
    returns20: Number(returns20.toFixed(2)),
    returns60: Number(returns60.toFixed(2)),
    returns120: Number(returns120.toFixed(2)),
    volumeTrend: Math.round(volumeTrend),
    turnoverTrend: Math.round(turnoverTrend),
    fundFlowProxy: Math.round(fundFlowProxy),
    valuationPercentile: Math.round(valuationPercentile),
    heatScore: Math.round(heatScore),
    score: Math.round(score),
    stage,
    status,
    suggestedSatelliteRatio,
    action,
    reason,
    evidence: {
      fund: `资金代理 ${Math.round(fundFlowProxy)} 分，成交/换手趋势 ${Math.round(volumeTrend)}/${Math.round(turnoverTrend)} 分。`,
      strength: `20/60/120日收益 ${returns20.toFixed(1)}% / ${returns60.toFixed(1)}% / ${returns120.toFixed(1)}%，相对宽基强弱 ${Math.round(relativeStrength)} 分。`,
      heat: `热度 ${Math.round(heatScore)} 分，估值/拥挤代理分位 ${Math.round(valuationPercentile)}%。`,
      policy: `${candidate.tags.join("、")}；产业/政策元数据 ${Math.round(candidate.industryScore * 0.6 + candidate.policyScore * 0.4)} 分。`,
    },
    source: `东方财富公开行情：${series.security.name}`,
    updatedAt: new Date().toISOString(),
  };
}

async function readCache() {
  try {
    const raw = await readFile(cachePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeCache(payload) {
  await mkdir(dirname(cachePath), { recursive: true });
  await writeFile(cachePath, JSON.stringify(payload, null, 2), "utf8");
}

export async function scanMainlines({ forceFallback = false } = {}) {
  if (forceFallback) {
    return { ...fallbackMainlineScan, mode: "fallback" };
  }

  try {
    const benchmarkCandidate = mainlineUniverse.find((item) => item.candidateId === "cn_hs300");
    const benchmarkSeries = await fetchCandidateSeries(benchmarkCandidate);
    const benchmarkClose = benchmarkSeries.klines.at(-1).close;
    const benchmark = {
      returns20: pct(benchmarkClose, benchmarkSeries.klines.at(-21)?.close ?? benchmarkSeries.klines[0].close),
      returns60: pct(benchmarkClose, benchmarkSeries.klines.at(-61)?.close ?? benchmarkSeries.klines[0].close),
      returns120: pct(benchmarkClose, benchmarkSeries.klines.at(-121)?.close ?? benchmarkSeries.klines[0].close),
    };

    const settled = await Promise.allSettled(
      mainlineUniverse.map(async (candidate) => {
        const series = await fetchCandidateSeries(candidate);
        return analyzeKlines(candidate, series, benchmark);
      }),
    );

    const results = settled
      .filter((item) => item.status === "fulfilled")
      .map((item) => item.value)
      .sort((a, b) => b.score - a.score);

    if (results.length < 8) {
      throw new Error(`有效候选不足：${results.length}`);
    }

    const payload = {
      mode: "live",
      source: "东方财富公开行情",
      updatedAt: new Date().toISOString(),
      benchmark: "沪深300",
      message: `扫描 ${mainlineUniverse.length} 个候选，成功 ${results.length} 个。`,
      results,
    };

    await writeCache(payload);
    return payload;
  } catch (error) {
    const cached = await readCache();
    if (cached?.results?.length) {
      return {
        ...cached,
        mode: "cache",
        message: `公开行情暂不可用，使用最近缓存。原因：${error.message}`,
      };
    }

    return {
      ...fallbackMainlineScan,
      mode: "fallback",
      message: `公开行情暂不可用，且没有缓存，使用内置快照。原因：${error.message}`,
    };
  }
}
