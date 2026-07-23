import { stockOpportunityUniverse } from "./stockOpportunityUniverse.mjs";

const klineFields = "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61";
const browserHeaders = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
};

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchJsonWithRetry(url, { headers = {}, attempts = 3, timeoutMs = 10000 } = {}) {
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
      if (attempt < attempts) {
        await sleep(250 * attempt);
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("请求失败");
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

function pct(current, previous) {
  if (!current || !previous) return 0;
  return ((current - previous) / previous) * 100;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number.isFinite(value) ? value : 0) * factor) / factor;
}

function inferSecid(code) {
  const normalized = String(code ?? "").trim();
  const market = normalized.startsWith("6") ? "1" : "0";
  return `${market}.${normalized}`;
}

function toSecucode(code) {
  const normalized = String(code ?? "").trim();
  return `${normalized}.${normalized.startsWith("6") ? "SH" : "SZ"}`;
}

function normalizeStock(stock) {
  return {
    code: stock.code,
    name: stock.name,
    industry: stock.industry ?? "搜索结果",
    theme: stock.theme ?? stock.industry ?? "用户检索",
    qualityScore: Number.isFinite(stock.qualityScore) ? stock.qualityScore : 55,
    valuationRisk: Number.isFinite(stock.valuationRisk) ? stock.valuationRisk : 65,
    cycleScore: Number.isFinite(stock.cycleScore) ? stock.cycleScore : 55,
    discoverySource: stock.discoverySource ?? "实时扫描",
  };
}

function uniqueStocks(stocks) {
  const seen = new Set();
  return stocks.map(normalizeStock).filter((stock) => {
    if (!stock.code || seen.has(stock.code)) return false;
    seen.add(stock.code);
    return true;
  });
}

function inferThemeFromIndustry(industry) {
  const text = String(industry ?? "");
  if (/软件|互联网|IT|通信|计算机/.test(text)) return "数字经济/AI应用";
  if (/半导体|电子|元件|光学|芯片/.test(text)) return "半导体/AI硬件";
  if (/汽车|电池|新能源/.test(text)) return "新能源制造";
  if (/电力|设备|储能|电网/.test(text)) return "电力设备/储能";
  if (/有色|钢铁|化工|材料|金属/.test(text)) return "周期材料";
  if (/医药|医疗/.test(text)) return "医药健康";
  if (/银行|保险|证券/.test(text)) return "金融修复";
  if (/消费|食品|白酒|家电/.test(text)) return "消费资产";
  return text || "实时热度";
}

function isCyclicalIndustry(industry) {
  return /有色|小金属|贵金属|金属|钢铁|煤炭|化学|化工|材料|非金属|玻璃|水泥|建材|通用设备|专用设备|工程机械|电机|电网|电池|光伏|半导体|元件|电子|航运|港口|物流|能源|稀土|塑料|橡胶/.test(
    String(industry ?? ""),
  );
}

function marketCapElasticityScore(marketCap) {
  const cap = Number(marketCap) || 0;
  if (cap >= 3000000000 && cap <= 80000000000) return 12;
  if (cap > 80000000000 && cap <= 200000000000) return 6;
  if (cap > 0 && cap < 3000000000) return 4;
  return 0;
}

function dailyHeatScore(row) {
  const change = Number(row.f3) || 0;
  const turnover = Number(row.f8) || 0;
  const inflowRatio = Number(row.f184) || 0;
  const netInflow = Math.abs(Number(row.f62) || 0);
  return clamp(
    change * 1.9 +
      Math.max(0, inflowRatio) * 1.2 +
      Math.min(24, turnover) * 1.25 +
      Math.log10(Math.max(1, netInflow)) * 1.9 +
      marketCapElasticityScore(row.f20),
  );
}

function cyclicalDiscoveryScore(row) {
  const industry = String(row.f100 ?? "");
  const change = Number(row.f3) || 0;
  const turnover = Number(row.f8) || 0;
  const inflowRatio = Number(row.f184) || 0;
  return clamp(
    (isCyclicalIndustry(industry) ? 38 : 0) +
      Math.min(32, turnover * 1.55) +
      Math.max(0, change) * 1.15 +
      Math.max(0, inflowRatio) * 0.9 +
      marketCapElasticityScore(row.f20),
  );
}

function smallCapElasticityDiscoveryScore(row) {
  const marketCap = Number(row.f20) || 0;
  const turnover = Number(row.f8) || 0;
  const change = Number(row.f3) || 0;
  const inflowRatio = Number(row.f184) || 0;
  const sizeBonus = marketCap > 0 && marketCap <= 60000000000 ? 34 : marketCap <= 120000000000 ? 16 : 0;
  return clamp(sizeBonus + Math.min(30, turnover * 1.4) + Math.max(0, change) * 1.2 + Math.max(0, inflowRatio) * 0.7);
}

function valueBlueChipDiscoveryScore(row) {
  const pe = Number(row.f9) || 0;
  const pb = Number(row.f23) || 0;
  const marketCap = Number(row.f20) || 0;
  const turnover = Number(row.f8) || 0;
  const change = Number(row.f3) || 0;
  if (pe <= 0 || pb <= 0 || marketCap < 50000000000) return 0;
  return clamp(
    72 -
      Math.max(0, pe - 12) * 2.1 -
      Math.max(0, pb - 1.8) * 8 +
      Math.min(12, Math.log10(Math.max(1, marketCap / 100000000)) * 2.2) +
      Math.min(8, turnover * 1.2) +
      Math.max(-8, Math.min(8, change)),
  );
}

function toDynamicStock(row, sourceTag) {
  const industry = row.f100 ?? "实时发现";
  const heat = dailyHeatScore(row);
  const cycleHeat = cyclicalDiscoveryScore(row);
  return {
    code: row.f12,
    name: row.f14 ?? row.f12,
    industry,
    theme: `${inferThemeFromIndustry(industry)} · ${sourceTag}`,
    qualityScore: Math.round(clamp(40 + heat * 0.25 + marketCapElasticityScore(row.f20))),
    valuationRisk: Math.round(clamp(54 + Math.max(0, Number(row.f3) || 0) * 0.8 + Math.min(22, Number(row.f8) || 0) * 0.55)),
    cycleScore: Math.round(clamp(42 + cycleHeat * 0.58)),
    discoverySource: sourceTag,
  };
}

async function fetchMarketSnapshotFromHost(baseUrl, { fast = false } = {}) {
  const all = [];
  for (let page = 1; page <= (fast ? 12 : 60); page += 1) {
    const url =
      `${baseUrl}/api/qt/clist/get?pn=${page}&pz=100&po=1&np=1&fltt=2&invt=2&fid=f3` +
      "&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23" +
      "&fields=f12,f14,f13,f100,f3,f62,f184,f8,f20,f9,f23";

    const json = await fetchJsonWithRetry(url, {
      headers: { Referer: "https://quote.eastmoney.com/" },
      attempts: 4,
      timeoutMs: 9000,
    });
    const rows = json?.data?.diff ?? [];
    all.push(...rows);
    if (!Array.isArray(rows) || rows.length < 100) break;
  }

  const validRows = all.filter((item) => /^\d{6}$/.test(String(item.f12 ?? "")) && !/ST|退/.test(String(item.f14 ?? "")));
  if (!validRows.length) throw new Error("全市场快照为空");
  return validRows;
}

async function fetchMarketSnapshot({ fast = false } = {}) {
  const hosts = ["https://push2.eastmoney.com", "https://push2delay.eastmoney.com"];
  const errors = [];
  for (const host of hosts) {
    try {
      return await fetchMarketSnapshotFromHost(host, { fast });
    } catch (error) {
      errors.push(`${host.replace("https://", "")}: ${error instanceof Error ? error.message : "未知错误"}`);
    }
  }
  throw new Error(errors.join("；"));
}

function buildDiscoveryUniverse(rows) {
  const picked = [];
  const seen = new Set();
  const addGroup = (stocks, limit) => {
    let added = 0;
    for (const stock of stocks) {
      if (picked.length >= 260) break;
      if (seen.has(stock.code)) continue;
      picked.push(stock);
      seen.add(stock.code);
      added += 1;
      if (added >= limit) break;
    }
  };

  const byDailyHeat = [...rows].sort((a, b) => dailyHeatScore(b) - dailyHeatScore(a)).map((row) => toDynamicStock(row, "日内热度"));
  const byCycleHeat = rows
    .filter((row) => isCyclicalIndustry(row.f100))
    .sort((a, b) => cyclicalDiscoveryScore(b) - cyclicalDiscoveryScore(a))
    .map((row) => toDynamicStock(row, "强周期候选"));
  const bySmallCap = [...rows]
    .sort((a, b) => smallCapElasticityDiscoveryScore(b) - smallCapElasticityDiscoveryScore(a))
    .map((row) => toDynamicStock(row, "小市值弹性"));
  const byTurnover = [...rows]
    .filter((row) => Number(row.f8) >= 8)
    .sort((a, b) => Number(b.f8 || 0) - Number(a.f8 || 0))
    .map((row) => toDynamicStock(row, "换手异动"));
  const byValueBlueChip = [...rows]
    .filter((row) => valueBlueChipDiscoveryScore(row) > 0)
    .sort((a, b) => valueBlueChipDiscoveryScore(b) - valueBlueChipDiscoveryScore(a))
    .map((row) => toDynamicStock(row, "低估值白马"));

  addGroup(byCycleHeat, 90);
  addGroup(byValueBlueChip, 60);
  addGroup(byDailyHeat, 45);
  addGroup(byTurnover, 45);
  addGroup(bySmallCap, 35);
  return picked;
}

function toSinaStock(row, sourceTag) {
  const marketCap = Number(row.mktcap || 0) * 10000;
  const turnover = Number(row.turnoverratio) || 0;
  const change = Number(row.changepercent) || 0;
  const elasticity = marketCap > 0 && marketCap <= 60000000000 ? 12 : marketCap <= 160000000000 ? 6 : 0;
  return {
    code: row.code,
    name: row.name ?? row.code,
    industry: "新浪实时候选",
    theme: `动态行情 · ${sourceTag}`,
    qualityScore: Math.round(clamp(42 + Math.max(0, change) * 0.3 + Math.min(20, turnover) * 0.65 + elasticity)),
    valuationRisk: Math.round(clamp(54 + Math.max(0, change) * 0.8 + Math.min(22, turnover) * 0.45)),
    cycleScore: Math.round(clamp(44 + Math.min(32, turnover * 1.4) + Math.max(0, change) * 0.8 + elasticity)),
    discoverySource: sourceTag,
  };
}

function sinaCycleProxyScore(row) {
  const turnover = Number(row.turnoverratio) || 0;
  const amount = Number(row.amount) || 0;
  const marketCap = Number(row.mktcap || 0) * 10000;
  const change = Number(row.changepercent) || 0;
  return clamp(
    Math.min(40, turnover * 1.55) +
      Math.min(28, Math.log10(Math.max(1, amount)) * 2.35) +
      marketCapElasticityScore(marketCap) +
      Math.max(-8, Math.min(12, change * 0.8)),
  );
}

function sinaValueBlueChipScore(row) {
  const pe = Number(row.per) || 0;
  const pb = Number(row.pb) || 0;
  const marketCap = Number(row.mktcap || 0) * 10000;
  const amount = Number(row.amount) || 0;
  if (pe <= 0 || pb <= 0 || marketCap < 50000000000) return 0;
  return clamp(
    76 -
      Math.max(0, pe - 12) * 2.2 -
      Math.max(0, pb - 1.8) * 7 +
      Math.min(12, Math.log10(Math.max(1, marketCap / 100000000)) * 2.2) +
      Math.min(10, Math.log10(Math.max(1, amount)) * 0.9),
  );
}

function sinaSmallCapScore(row) {
  const marketCap = Number(row.mktcap || 0) * 10000;
  const turnover = Number(row.turnoverratio) || 0;
  const change = Number(row.changepercent) || 0;
  const amount = Number(row.amount) || 0;
  const sizeBonus = marketCap > 3000000000 && marketCap <= 60000000000 ? 32 : marketCap <= 120000000000 ? 12 : 0;
  return clamp(sizeBonus + Math.min(32, turnover * 1.35) + Math.max(0, change) * 0.9 + Math.min(12, Math.log10(Math.max(1, amount)) * 0.8));
}

async function fetchSinaRows(sort, pageLimit = 4) {
  const rows = [];
  for (let page = 1; page <= pageLimit; page += 1) {
    const url =
      `https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeData?page=${page}` +
      `&num=80&sort=${encodeURIComponent(sort)}&asc=0&node=hs_a&symbol=&_s_r_a=page`;
    const data = await fetchJsonWithRetry(url, {
      headers: { Referer: "https://vip.stock.finance.sina.com.cn/" },
      attempts: 3,
      timeoutMs: 9000,
    });
    if (!Array.isArray(data) || !data.length) break;
    rows.push(
      ...data
        .filter((item) => /^\d{6}$/.test(String(item.code ?? "")))
        .filter((item) => String(item.symbol ?? "").startsWith("sh") || String(item.symbol ?? "").startsWith("sz"))
        .filter((item) => !/ST|退|^N/.test(String(item.name ?? "")))
        .map((item) => item),
    );
    if (data.length < 80) break;
  }
  return rows;
}

async function fetchSinaDynamicUniverse({ fast = false } = {}) {
  const [changeRows, turnoverRows, amountRows] = await Promise.all([
    fetchSinaRows("changepercent", fast ? 3 : 6),
    fetchSinaRows("turnoverratio", fast ? 4 : 10),
    fetchSinaRows("amount", fast ? 8 : 80),
  ]);
  const picked = [];
  const seen = new Set();
  const addGroup = (rows, limit, sourceTag) => {
    let added = 0;
    for (const row of rows) {
      if (picked.length >= (fast ? 110 : 260)) break;
      if (seen.has(row.code)) continue;
      picked.push(toSinaStock(row, sourceTag));
      seen.add(row.code);
      added += 1;
      if (added >= limit) break;
    }
  };

  const byCycleProxy = [...amountRows]
    .sort((a, b) => sinaCycleProxyScore(b) - sinaCycleProxyScore(a))
    .filter((row) => sinaCycleProxyScore(row) >= 45);
  const byValueBlueChip = [...amountRows]
    .sort((a, b) => sinaValueBlueChipScore(b) - sinaValueBlueChipScore(a))
    .filter((row) => sinaValueBlueChipScore(row) > 0);
  const byDailyHeat = [...changeRows].sort((a, b) => Number(b.changepercent || 0) - Number(a.changepercent || 0));
  const byTurnover = [...turnoverRows].sort((a, b) => Number(b.turnoverratio || 0) - Number(a.turnoverratio || 0));
  const bySmallCap = [...amountRows].sort((a, b) => sinaSmallCapScore(b) - sinaSmallCapScore(a));

  addGroup(byCycleProxy, fast ? 42 : 90, "强周期/高换手");
  addGroup(byValueBlueChip, fast ? 30 : 60, "低估值白马");
  addGroup(byDailyHeat, fast ? 18 : 45, "涨幅热度");
  addGroup(byTurnover, fast ? 14 : 45, "换手异动");
  addGroup(bySmallCap, fast ? 10 : 35, "小市值弹性");
  const universe = uniqueStocks(picked);
  if (!universe.length) throw new Error("新浪实时候选为空");
  return universe;
}

async function fetchDynamicUniverse({ fast = false } = {}) {
  try {
    const rows = await fetchMarketSnapshot({ fast });
    const universe = buildDiscoveryUniverse(rows).slice(0, fast ? 80 : 260);
    if (!universe.length) throw new Error("动态候选池为空");
    return { universe, provider: "东方财富全市场行业快照" };
  } catch (error) {
    const universe = await fetchSinaDynamicUniverse({ fast });
    return {
      universe,
      provider: `新浪实时涨幅/换手/成交额榜，东方财富快照不可用：${error instanceof Error ? error.message : "未知错误"}`,
    };
  }
}

async function fetchHotUniverse() {
  const url =
    "https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=80&po=1&np=1&fltt=2&invt=2&fid=f3" +
    "&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23" +
    "&fields=f12,f14,f13,f100,f3,f62,f184,f8,f20";

  const json = await fetchJsonWithRetry(url, {
    headers: { Referer: "https://quote.eastmoney.com/" },
    attempts: 4,
    timeoutMs: 9000,
  });
  const rows = json?.data?.diff;
  if (!Array.isArray(rows) || !rows.length) throw new Error("实时热门个股为空");

  return rows
    .filter((item) => /^\d{6}$/.test(String(item.f12 ?? "")))
    .filter((item) => !/ST|退/.test(String(item.f14 ?? "")))
    .map((item) => toDynamicStock(item, "日内热度"));
}

function movingAverage(points, size, index) {
  if (index + 1 < size) return null;
  const slice = points.slice(index + 1 - size, index + 1);
  return slice.reduce((sum, point) => sum + point.close, 0) / size;
}

function attachMovingAverage(points) {
  return points.map((point, index) => ({
    ...point,
    ma20: movingAverage(points, 20, index),
    ma60: movingAverage(points, 60, index),
  }));
}

async function fetchKlines(code) {
  try {
    return await fetchTencentKlines(code);
  } catch (tencentError) {
    try {
      return await fetchEastmoneyKlines(code);
    } catch (eastmoneyError) {
      const eastmoneyMessage = eastmoneyError instanceof Error ? eastmoneyError.message : "东方财富K线失败";
      const tencentMessage = tencentError instanceof Error ? tencentError.message : "腾讯K线失败";
      throw new Error(`${tencentMessage}；${eastmoneyMessage}`);
    }
  }
}

async function fetchEastmoneyKlines(code) {
  const secid = inferSecid(code);
  const url =
    `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${encodeURIComponent(secid)}` +
    `&ut=fa5fd1943c7b386f172d6893dbfba10b&klt=101&fqt=1&end=20500101&lmt=120` +
    `&fields1=f1,f2,f3,f4,f5,f6&fields2=${klineFields}`;

  const json = await fetchJsonWithRetry(url, {
    headers: { Referer: "https://quote.eastmoney.com/" },
    attempts: 2,
    timeoutMs: 8000,
  });
  const lines = json?.data?.klines;
  if (!Array.isArray(lines) || lines.length < 65) {
    throw new Error("行情数据不足");
  }

  return attachMovingAverage(
    lines.map((line) => {
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
    }),
  );
}

async function fetchTencentKlines(code) {
  const symbol = String(code) === "000300" ? "sh000300" : `${String(code).startsWith("6") ? "sh" : "sz"}${code}`;
  const url = `https://proxy.finance.qq.com/ifzqgtimg/appstock/app/fqkline/get?param=${symbol},day,,,120,qfq`;
  const json = await fetchJsonWithRetry(url, {
    headers: { Referer: "https://gu.qq.com/" },
    attempts: 3,
    timeoutMs: 9000,
  });
  const node = json?.data?.[symbol];
  const rows = node?.qfqday ?? node?.day;
  if (!Array.isArray(rows) || rows.length < 65) {
    throw new Error("腾讯K线数据不足");
  }

  return attachMovingAverage(
    rows.map((row) => {
      const [date, open, close, high, low, volume] = row;
      const closeValue = Number(close);
      const volumeValue = Number(volume);
      return {
        date,
        open: Number(open),
        close: closeValue,
        high: Number(high),
        low: Number(low),
        volume: volumeValue,
        amount: volumeValue * closeValue * 100,
        amplitude: 0,
        changePct: 0,
        changeAmount: 0,
        turnover: 0,
      };
    }),
  );
}

function makeEstimatedFinancial(stock, summary = "暂未读取到最新财报，使用候选来源和本地质量锚估算。") {
  const qualityAnchorScore = Math.round(clamp(stock.qualityScore));
  return {
    mode: "estimate",
    report: "极速扫描估算",
    reportDate: "",
    revenueYoy: 0,
    profitYoy: 0,
    roe: 0,
    grossMargin: 0,
    netMargin: 0,
    debtRatio: 0,
    cashToRevenue: 0,
    financialScore: qualityAnchorScore,
    growthScore: 0,
    profitabilityScore: 0,
    balanceScore: 0,
    cashFlowScore: 0,
    qualityAnchorScore,
    highlights: [`极速扫描模式暂不逐只读取财报，使用质量锚 ${qualityAnchorScore} 分。`],
    deductions: ["需要搜索单只股票或进入深度扫描后，才能读取最新财报分项。"],
    summary,
  };
}

async function fetchFinancialSnapshot(stock, { estimateOnly = false } = {}) {
  if (estimateOnly) {
    return makeEstimatedFinancial(stock, "极速扫描未读取逐股财报，当前财报分只是候选质量锚；搜索单股可查看真实财报。");
  }

  const secucode = toSecucode(stock.code);
  const url =
    `https://datacenter.eastmoney.com/securities/api/data/get?type=RPT_F10_FINANCE_MAINFINADATA` +
    `&sty=APP_F10_MAINFINADATA&filter=(SECUCODE%3D%22${encodeURIComponent(secucode)}%22)&p=1&ps=4&st=REPORT_DATE&sr=-1`;

  try {
    const json = await fetchJsonWithRetry(url, {
      headers: { Referer: "https://emweb.securities.eastmoney.com/" },
      attempts: 2,
      timeoutMs: 9000,
    });
    const latest = json?.result?.data?.[0];
    if (!latest) throw new Error("财报数据不足");

    const revenueYoy = Number(latest.TOTALOPERATEREVETZ ?? 0);
    const profitYoy = Number(latest.PARENTNETPROFITTZ ?? 0);
    const roe = Number(latest.ROEJQ ?? 0);
    const grossMargin = Number(latest.XSMLL ?? 0);
    const netMargin = Number(latest.XSJLL ?? 0);
    const debtRatio = Number(latest.ZCFZL ?? 0);
    const cashToRevenue = Number(latest.JYXJLYYSR ?? 0);
    const growthScore = clamp(50 + revenueYoy * 0.45 + profitYoy * 0.35, 5, 95);
    const profitabilityScore = clamp(45 + roe * 3 + netMargin * 1.2 + (grossMargin - 15) * 0.45, 5, 95);
    const balanceScore = clamp(85 - Math.max(0, debtRatio - 45) * 0.9 + Math.max(0, 45 - debtRatio) * 0.18, 5, 95);
    const cashFlowScore = clamp(50 + cashToRevenue * 1.6, 5, 95);
    const qualityAnchorScore = Math.round(clamp(stock.qualityScore));
    const financialScore = clamp(
      growthScore * 0.3 +
        profitabilityScore * 0.23 +
        balanceScore * 0.17 +
        cashFlowScore * 0.12 +
        qualityAnchorScore * 0.18,
    );
    const highlights = [];
    const deductions = [];

    if (revenueYoy >= 10) highlights.push(`营收同比增长 ${round(revenueYoy)}%，需求端仍有扩张。`);
    if (profitYoy >= 10) highlights.push(`归母净利同比增长 ${round(profitYoy)}%，利润端仍在兑现。`);
    if (roe >= 10) highlights.push(`ROE ${round(roe)}%，资本回报处在较好区间。`);
    if (grossMargin >= 25) highlights.push(`毛利率 ${round(grossMargin)}%，产品/成本结构有一定韧性。`);
    if (cashToRevenue >= 10) highlights.push(`经营现金流/营收 ${round(cashToRevenue)}%，现金回款质量较好。`);
    if (qualityAnchorScore >= 75) highlights.push(`长期质量锚 ${qualityAnchorScore} 分，说明公司在行业地位或经营确定性上仍有加分。`);

    if (revenueYoy < 0) deductions.push(`营收同比 ${round(revenueYoy)}%，最新一期收入动能承压。`);
    if (profitYoy < 0) deductions.push(`归母净利同比 ${round(profitYoy)}%，利润端是本次财报分的主要扣分项。`);
    if (roe < 6) deductions.push(`ROE ${round(roe)}%，单期资本回报偏低。`);
    if (debtRatio > 65) deductions.push(`资产负债率 ${round(debtRatio)}%，制造业扩张期常见，但会提高安全边际要求。`);
    if (cashToRevenue < 0) deductions.push(`经营现金流/营收 ${round(cashToRevenue)}%，需要跟踪回款与库存压力。`);

    const summary =
      financialScore >= 75
        ? "财报综合质量较强，增长、盈利或现金流能支撑趋势观察。"
        : financialScore >= 58
          ? "财报综合质量中性，需要结合价格位置和后续季报继续确认。"
          : financialScore >= 42
            ? "财报综合质量偏弱，主要适合观察修复信号，不适合只凭题材追高。"
            : "财报综合质量较弱，除非后续出现明确业绩拐点或价格充分出清，否则应降低优先级。";

    return {
      mode: "live",
      report: latest.REPORT_DATE_NAME ?? latest.REPORT_TYPE ?? "最近财报",
      reportDate: String(latest.REPORT_DATE ?? "").slice(0, 10),
      revenueYoy: round(revenueYoy),
      profitYoy: round(profitYoy),
      roe: round(roe),
      grossMargin: round(grossMargin),
      netMargin: round(netMargin),
      debtRatio: round(debtRatio),
      cashToRevenue: round(cashToRevenue),
      financialScore: Math.round(financialScore),
      growthScore: Math.round(growthScore),
      profitabilityScore: Math.round(profitabilityScore),
      balanceScore: Math.round(balanceScore),
      cashFlowScore: Math.round(cashFlowScore),
      qualityAnchorScore,
      highlights: highlights.length ? highlights : ["暂未出现特别突出的财报加分项。"],
      deductions: deductions.length ? deductions : ["暂未出现明显财报扣分项。"],
      summary,
    };
  } catch {
    return makeEstimatedFinancial(stock, "暂未读取到最新财报，使用本地质量元数据估算。");
  }
}

async function searchRemoteStocks(query) {
  const normalized = String(query ?? "").trim();
  if (!normalized) return [];
  const localMatches = stockOpportunityUniverse.filter((stock) => stock.code.includes(normalized) || stock.name.includes(normalized));

  try {
    const url =
      `https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(normalized)}` +
      `&type=14&token=D43BF722C8E33BDC906FB84D85E326E8&count=8`;
    const json = await fetchJsonWithRetry(url, {
      headers: { Referer: "https://www.eastmoney.com/" },
      attempts: 3,
      timeoutMs: 9000,
    });
    const remoteBase = (json?.QuotationCodeTable?.Data ?? [])
      .filter((item) => /^\d{6}$/.test(String(item.Code ?? "")) && ["0", "1"].includes(String(item.MktNum ?? "")))
      .map((item) => {
        return {
          code: item.Code,
          name: item.Name ?? item.Code,
          industry: item.SecurityTypeName ?? "用户检索",
          theme: "用户检索",
          qualityScore: 55,
          valuationRisk: 65,
          cycleScore: 55,
          discoverySource: "用户检索",
        };
      });

    if (remoteBase.length) {
      try {
        const rows = await fetchMarketSnapshot();
        const rowByCode = new Map(rows.map((row) => [row.f12, row]));
        return uniqueStocks(
          remoteBase.map((stock) => {
            const row = rowByCode.get(stock.code);
            return row ? toDynamicStock(row, "用户检索") : stock;
          }),
        ).slice(0, 8);
      } catch {
        return uniqueStocks(remoteBase).slice(0, 8);
      }
    }

    if (/^\d{6}$/.test(normalized)) {
      return uniqueStocks([
        {
          code: normalized,
          name: normalized,
          industry: "用户检索",
          theme: "用户检索",
          qualityScore: 55,
          valuationRisk: 65,
          cycleScore: 55,
          discoverySource: "用户检索",
        },
      ]);
    }

    return uniqueStocks(localMatches).slice(0, 8);
  } catch {
    if (/^\d{6}$/.test(normalized)) {
      return uniqueStocks([
        {
          code: normalized,
          name: normalized,
          industry: "用户检索",
          theme: "用户检索",
          qualityScore: 55,
          valuationRisk: 65,
          cycleScore: 55,
          discoverySource: "用户检索",
        },
      ]);
    }
    return uniqueStocks(localMatches).slice(0, 8);
  }
}

function average(points, key, size, offset = 0) {
  const end = Math.max(0, points.length - offset);
  const start = Math.max(0, end - size);
  const slice = points.slice(start, end);
  if (!slice.length) return 0;
  return slice.reduce((sum, point) => sum + (Number(point[key]) || 0), 0) / slice.length;
}

function hasRecentTrend(points) {
  const last = points.at(-1);
  const close40 = points.at(-41)?.close ?? points[0]?.close;
  const high40 = Math.max(...points.slice(-40).map((point) => point.high));
  const return40 = pct(last.close, close40);
  const drawdownFromHigh = pct(last.close, high40);
  const trendDays = points.slice(-40).filter((point) => point.ma20 && point.close >= point.ma20).length;
  return return40 >= 8 || (trendDays >= 24 && drawdownFromHigh > -12);
}

function classifyStage(last, return40, volumeRatio, biasMa20, maxDrawdown) {
  if (last.ma20 && last.ma60 && last.close > last.ma20 && last.ma20 > last.ma60 && return40 > 10 && biasMa20 < 18) {
    return "第二阶段：趋势确认";
  }
  if (last.ma20 && last.close >= last.ma20 && volumeRatio < 0.9 && Math.abs(biasMa20) <= 5) {
    return "缩量回踩观察";
  }
  if (return40 > 25 || biasMa20 > 18) {
    return "第三阶段：偏热震荡";
  }
  if (maxDrawdown < -18 || (last.ma20 && last.close < last.ma20)) {
    return "走弱剔除观察";
  }
  return "第一阶段：底部转强";
}

function assessMetric(label, value, status, explanation) {
  return { label, value, status, explanation };
}

function classifyStrategyFit(stock, financial, return40, volumeRatio, relative40, riskPenalty, biasMa20) {
  const source = stock.discoverySource ?? "";
  const isValue = source.includes("白马") || (financial.profitabilityScore >= 68 && financial.balanceScore >= 55 && riskPenalty < 65 && return40 < 18);
  const isCycle = source.includes("周期") || source.includes("换手") || (return40 >= 18 && volumeRatio >= 1.05 && relative40 >= 8);
  const isMomentum = source.includes("热度") || return40 >= 30 || biasMa20 >= 15;
  const isSmallCap = source.includes("小市值");

  if (isValue) {
    return {
      style: "质量价值/低估值白马",
      master: "更接近巴菲特/芒格的长期质量框架",
      fit: financial.financialScore >= 65 ? "较适配" : "部分适配",
      explanation:
        "这类票重点看商业模式、ROE、现金流、负债率、估值和分红稳定性，不追求短期爆发。适合作为长期观察池，但需要好价格和安全边际。",
    };
  }

  if (isCycle) {
    return {
      style: "强周期趋势/景气反转",
      master: "更接近彼得林奇周期股 + 奥尼尔/温斯坦趋势确认",
      fit: return40 >= 20 && volumeRatio >= 1 ? "较适配" : "部分适配",
      explanation:
        "这类票不是典型巴菲特/芒格优选，因为利润和估值会随周期剧烈波动。它可以进入观察池，但核心是景气拐点、价格趋势、放量确认和严格止损。",
    };
  }

  if (isSmallCap) {
    return {
      style: "小市值弹性/主题扩散",
      master: "更接近彼得林奇成长发现，但需要更强风控",
      fit: "谨慎适配",
      explanation:
        "这类票可能弹性大，但确定性通常弱于白马龙头。适合先观察，不适合用长期价值股的仓位方式处理。",
    };
  }

  if (isMomentum) {
    return {
      style: "短线热度/资金推动",
      master: "更接近奥尼尔动量交易，不是巴菲特/芒格框架",
      fit: "低适配",
      explanation:
        "如果只有日内热度、缺少40日趋势和财报支撑，就只能放在候选层，不应进入核心观察池。",
    };
  }

  return {
    style: "综合观察",
    master: "混合框架",
    fit: "中性",
    explanation: "当前证据不够鲜明，需要继续观察趋势、财报和估值是否形成一致方向。",
  };
}

async function analyzeStock(stock, points, benchmark, { estimateFinancial = false } = {}) {
  const financial = await fetchFinancialSnapshot(stock, { estimateOnly: estimateFinancial });
  const last = points.at(-1);
  const close20 = points.at(-21)?.close ?? points[0].close;
  const close40 = points.at(-41)?.close ?? points[0].close;
  const close60 = points.at(-61)?.close ?? points[0].close;
  const return20 = pct(last.close, close20);
  const return40 = pct(last.close, close40);
  const return60 = pct(last.close, close60);
  const relative40 = return40 - (benchmark?.return40 ?? 0);
  const amountRecent = average(points, "amount", 10);
  const amountBase = average(points, "amount", 30, 10);
  const volumeRatio = amountBase ? amountRecent / amountBase : 1;
  const high40 = Math.max(...points.slice(-40).map((point) => point.high));
  const low40 = Math.min(...points.slice(-40).map((point) => point.low));
  const maxDrawdown = high40 ? pct(last.close, high40) : 0;
  const biasMa20 = last.ma20 ? pct(last.close, last.ma20) : 0;
  const support = last.ma20 && last.ma20 < last.close ? last.ma20 : low40;
  const pressure = high40 > last.close ? high40 : null;
  const stage = classifyStage(last, return40, volumeRatio, biasMa20, maxDrawdown);

  const trendScore = clamp(
    (return40 > 0 ? 18 : 0) +
      clamp(return40 * 1.5, 0, 35) +
      (last.ma20 && last.close > last.ma20 ? 18 : 0) +
      (last.ma20 && last.ma60 && last.ma20 > last.ma60 ? 18 : 0) +
      (relative40 > 0 ? 11 : 0),
  );
  const volumeScore = clamp(45 + (volumeRatio - 1) * 35 + (amountRecent > 800000000 ? 10 : 0));
  const qualityScore = clamp(stock.qualityScore * 0.45 + financial.financialScore * 0.55);
  const riskPenalty = clamp(stock.valuationRisk * 0.45 + Math.max(0, biasMa20 - 12) * 2 + Math.max(0, -maxDrawdown - 12) * 1.6);
  const score = clamp(trendScore * 0.36 + volumeScore * 0.16 + clamp(50 + relative40 * 2) * 0.15 + qualityScore * 0.25 + (100 - riskPenalty) * 0.08);
  const trendQualified = hasRecentTrend(points);
  const valueWatchCandidate =
    String(stock.discoverySource ?? "").includes("白马") ||
    (financial.financialScore >= 58 && financial.profitabilityScore >= 68 && financial.balanceScore >= 55 && riskPenalty < 68);

  const status =
    valueWatchCandidate && score >= 38
      ? "跟踪观察"
      : !trendQualified || score < 50
      ? "暂不观察"
      : score >= 66 && riskPenalty < 78
        ? "重点观察"
        : riskPenalty >= 84 || biasMa20 > 24
          ? "过热等待"
          : "跟踪观察";
  const rating =
    score >= 78 && financial.financialScore >= 65 && riskPenalty < 70
      ? "A"
      : score >= 66
        ? "B+"
        : score >= 56
          ? "B"
          : riskPenalty >= 82
            ? "C"
            : "B-";
  const ratingText =
    rating === "A"
      ? "机构式评级：强观察"
      : rating === "B+"
        ? "机构式评级：重点跟踪"
        : rating === "B"
          ? "机构式评级：中性观察"
          : rating === "C"
            ? "机构式评级：风险偏高"
            : "机构式评级：弱观察";

  const action =
    valueWatchCandidate && status === "跟踪观察"
      ? "放入价值观察池，等待估值、安全边际和趋势修复共振"
      : status === "重点观察"
      ? "等待回踩MA20或放量突破后的低风险确认点"
      : status === "跟踪观察"
        ? "放入观察池，记录支撑、压力和量能变化"
        : status === "过热等待"
          ? "不追高，等待缩量回踩或估值消化"
          : "暂不进入个股观察池";

  const reason =
    valueWatchCandidate && status === "跟踪观察"
      ? "财报盈利能力和资产负债结构能进入价值观察，但短期趋势不足，不适合作为强周期/动量买点。"
      : status === "重点观察"
      ? "40日趋势、相对强弱和均线结构较好，且质量过滤没有明显扣分。"
      : status === "跟踪观察"
        ? "近40天有转强迹象，但趋势、量能或质量证据还不够完整。"
        : status === "过热等待"
          ? "短期涨幅或均线偏离偏高，追高赔率下降。"
          : "近40天趋势证据不足，或价格已经跌回关键均线下方。";
  const watchPlan = [
    pressure
      ? `强势确认：放量站上 ${round(pressure)} 附近的40日压力位后，再看是否能缩量守住。`
      : "强势确认：当前已经接近40日高位，更需要观察突破后是否还能放量承接。",
    `低风险观察：回踩 ${round(support)} 附近不破，且成交额明显缩量，说明抛压可能减轻。`,
    `失效条件：收盘连续跌破MA20且量能放大，或40日相对强度继续转弱，应从重点名单降级。`,
  ];
  const riskChecklist = [
    financial.profitYoy < 0 ? "利润同比仍在下滑，后续季报如果没有改善，趋势股容易变成纯情绪交易。" : "后续季报需要继续验证利润增长是否能跟上股价表现。",
    riskPenalty >= 70 ? "估值/涨幅/回撤风险偏高，不能把观察评级理解成直接买入评级。" : "当前风险扣分不算极端，但仍要用支撑位控制试错成本。",
    volumeRatio < 0.9 ? "量能没有明显放大，说明资金确认度还不足。" : "放量后若不能继续上攻，要警惕放量滞涨或冲高回落。",
  ];
  const strategyFit = classifyStrategyFit(stock, financial, return40, volumeRatio, relative40, riskPenalty, biasMa20);
  const indicatorAssessments = [
    assessMetric(
      "40日趋势",
      `${round(return40)}%`,
      return40 >= 25 ? "good" : return40 >= 8 ? "neutral" : return40 >= 0 ? "warn" : "bad",
      return40 >= 25
        ? "很好，说明中期价格已经形成明显上升趋势，但也要警惕涨幅过快。"
        : return40 >= 8
          ? "中性偏好，已有转强迹象，但还不是特别强。"
          : return40 >= 0
            ? "偏弱，只是止跌或小幅反弹，趋势证据不够。"
            : "不好，40日仍下跌，不应作为趋势买点；若是价值白马，只能放入价值观察。",
    ),
    assessMetric(
      "相对沪深300",
      `${round(relative40)}%`,
      relative40 >= 12 ? "good" : relative40 >= 0 ? "neutral" : relative40 >= -8 ? "warn" : "bad",
      relative40 >= 12
        ? "很好，说明它不只是跟着市场涨，而是明显跑赢基准。"
        : relative40 >= 0
          ? "尚可，至少没有输给基准。"
          : relative40 >= -8
            ? "偏弱，跑输基准，资金偏好不够强。"
            : "不好，显著跑输基准，优先级应降低。",
    ),
    assessMetric(
      "量能",
      `${round(volumeRatio)}x`,
      volumeRatio >= 1.3 ? "good" : volumeRatio >= 0.9 ? "neutral" : "warn",
      volumeRatio >= 1.3
        ? "较好，近10日成交额明显高于前期，说明资金关注度提升。"
        : volumeRatio >= 0.9
          ? "中性，量能没有明显萎缩，但资金确认度还需要继续看。"
          : "偏弱，缩量上涨容易缺少持续性，适合等回踩确认。",
    ),
    assessMetric(
      "MA20偏离",
      `${round(biasMa20)}%`,
      biasMa20 >= 0 && biasMa20 <= 12 ? "good" : biasMa20 > 12 && biasMa20 <= 24 ? "warn" : biasMa20 < 0 ? "bad" : "bad",
      biasMa20 >= 0 && biasMa20 <= 12
        ? "较好，价格在20日均线上方但没有过度乖离。"
        : biasMa20 > 12 && biasMa20 <= 24
          ? "偏热，趋势强但追高赔率下降。"
          : biasMa20 < 0
            ? "不好，价格在20日均线下方，趋势确认不足。"
            : "风险较高，短期过热，适合等回落而不是追。",
    ),
    assessMetric(
      "财报综合",
      `${financial.financialScore}`,
      financial.financialScore >= 70 ? "good" : financial.financialScore >= 55 ? "neutral" : financial.financialScore >= 42 ? "warn" : "bad",
      financial.financialScore >= 70
        ? "较好，财报能给趋势提供基本面支撑。"
        : financial.financialScore >= 55
          ? "中性，基本面不算差，但需要后续财报继续验证。"
          : financial.financialScore >= 42
            ? "偏弱，更像周期修复或题材交易，不能当成高质量长期股。"
            : "不好，财报压力较大，除非出现明确拐点，否则优先级低。",
    ),
    assessMetric(
      "风险扣分",
      `${Math.round(riskPenalty)}`,
      riskPenalty < 55 ? "good" : riskPenalty < 72 ? "neutral" : riskPenalty < 84 ? "warn" : "bad",
      riskPenalty < 55
        ? "较好，估值/涨幅/回撤压力暂不极端。"
        : riskPenalty < 72
          ? "中性，仍需要控制买点和仓位。"
          : riskPenalty < 84
            ? "偏高，短期追高容易承担较大回撤。"
            : "风险很高，系统倾向等待而不是进入。",
    ),
  ];
  const institutionalView = {
    conclusion: `${ratingText}，当前更像“${status}”而不是无条件买入。`,
    cycle: `${stage}。发现来源：${stock.discoverySource ?? "实时扫描"}。系统用40日趋势、MA20/MA60结构和相对沪深300强弱判断所处阶段。`,
    financial: `${financial.summary} 财报分由动能 ${financial.growthScore}、盈利 ${financial.profitabilityScore}、资产负债 ${financial.balanceScore}、现金流 ${financial.cashFlowScore}、长期质量锚 ${financial.qualityAnchorScore} 加权得到。`,
    technical: `趋势分 ${Math.round(trendScore)}，量能分 ${Math.round(volumeScore)}，风险扣分 ${Math.round(riskPenalty)}。${pressure ? `上方压力 ${round(pressure)}。` : "上方暂无明确40日压力。"}支撑参考 ${round(support)}。`,
    strategyFit,
    indicatorAssessments,
    watchPlan,
    riskChecklist,
  };

  return {
    code: stock.code,
    name: stock.name,
    industry: stock.industry,
    theme: stock.theme,
    discoverySource: stock.discoverySource ?? "实时扫描",
    close: round(last.close),
    return20: round(return20),
    return40: round(return40),
    return60: round(return60),
    relative40: round(relative40),
    volumeRatio: round(volumeRatio),
    biasMa20: round(biasMa20),
    maxDrawdown: round(maxDrawdown),
    trendScore: Math.round(trendScore),
    qualityScore: Math.round(qualityScore),
    riskScore: Math.round(riskPenalty),
    score: Math.round(score),
    stage,
    status,
    rating,
    ratingText,
    action,
    reason,
    institutionalView,
    support: round(support),
    pressure: pressure ? round(pressure) : null,
    method: "40日趋势 + 温斯坦阶段 + 奥尼尔量价/相对强度 + 芒格质量过滤",
    financial,
    evidence: {
      trend: `40日涨幅 ${round(return40)}%，相对沪深300 ${round(relative40)}%，MA20偏离 ${round(biasMa20)}%。`,
      volume: `近10日成交额约为前30日的 ${round(volumeRatio)} 倍。`,
      quality: `${financial.summary} 财报质量 ${financial.financialScore} 分，综合质量 ${Math.round(qualityScore)} 分。`,
      risk: pressure ? `支撑约 ${round(support)}，上方40日压力约 ${round(pressure)}。` : `支撑约 ${round(support)}，当前接近40日高位。`,
    },
    updatedAt: new Date().toISOString(),
  };
}

function makeFallbackScan(message) {
  const now = new Date().toISOString();
  const results = stockOpportunityUniverse.map((stock, index) => {
    const return40 = 4 + ((index * 7) % 28);
    const biasMa20 = -3 + ((index * 5) % 22);
    const riskScore = Math.round(stock.valuationRisk * 0.55 + Math.max(0, biasMa20 - 12) * 2);
    const score = clamp(return40 * 1.2 + stock.qualityScore * 0.35 + stock.cycleScore * 0.25 - riskScore * 0.18);
    const status = return40 >= 18 && score >= 58 ? "重点观察" : return40 >= 10 && score >= 48 ? "跟踪观察" : return40 >= 24 ? "过热等待" : "暂不观察";
    const financial = {
      mode: "estimate",
      report: "本地质量估算",
      reportDate: "",
      revenueYoy: 0,
      profitYoy: 0,
      roe: 0,
      grossMargin: 0,
      netMargin: 0,
      debtRatio: 0,
      cashToRevenue: 0,
      financialScore: stock.qualityScore,
      growthScore: 0,
      profitabilityScore: 0,
      balanceScore: 0,
      cashFlowScore: 0,
      qualityAnchorScore: stock.qualityScore,
      highlights: [`本地质量锚 ${stock.qualityScore} 分，只用于开发兜底。`],
      deductions: ["未读取实时财报，不能作为真实财报判断。"],
      summary: "内置样本未读取实时财报，使用本地质量评分估算。",
    };
    return {
      code: stock.code,
      name: stock.name,
      industry: stock.industry,
      theme: stock.theme,
      close: 0,
      return20: round(return40 * 0.45),
      return40: round(return40),
      return60: round(return40 * 1.2),
      relative40: round(return40 - 8),
      volumeRatio: round(0.8 + ((index * 3) % 9) / 10),
      biasMa20: round(biasMa20),
      maxDrawdown: round(-4 - ((index * 2) % 14)),
      trendScore: Math.round(clamp(return40 * 2.2)),
      qualityScore: stock.qualityScore,
      riskScore,
      score: Math.round(score),
      stage: status === "过热等待" ? "第三阶段：偏热震荡" : status === "跟踪观察" ? "第二阶段：趋势确认" : "第一阶段：底部转强",
      status,
      rating: score >= 68 ? "B+" : score >= 56 ? "B" : "B-",
      ratingText: score >= 68 ? "机构式评级：重点跟踪" : score >= 56 ? "机构式评级：中性观察" : "机构式评级：弱观察",
      action: status === "暂不观察" ? "暂不进入个股观察池" : "放入观察池，等待回踩或突破确认",
      reason: "当前为内置样本估算，用于验证页面和规则流程。",
      institutionalView: {
        conclusion: "当前为手动兜底样本，不代表实时机构评级。",
        cycle: "未读取实时K线，只能展示规则结构。",
        financial: `未读取实时财报，使用本地质量锚 ${stock.qualityScore} 分。`,
        technical: "未读取实时行情，趋势、量能、支撑压力都不能作为真实判断。",
        strategyFit: {
          style: "开发兜底",
          master: "无",
          fit: "不适用",
          explanation: "内置样本只用于页面兜底，不参与真实策略判断。",
        },
        indicatorAssessments: [
          {
            label: "实时性",
            value: "不可用",
            status: "bad",
            explanation: "没有读取实时行情和财报，不能作为真实观察结论。",
          },
        ],
        watchPlan: ["刷新实时扫描后再判断。", "若实时接口失败，只能把它当页面演示数据。"],
        riskChecklist: ["没有实时行情。", "没有实时财报。", "不能作为真实观察结论。"],
      },
      support: 0,
      pressure: null,
      method: "内置样本：40日趋势 + 质量过滤",
      financial,
      evidence: {
        trend: `40日趋势代理 ${round(return40)}%，真实投资前需要刷新实时行情。`,
        volume: "成交额为样本估算。",
        quality: `质量过滤 ${stock.qualityScore} 分。`,
        risk: "内置样本不作为真实价格依据。",
      },
      updatedAt: now,
    };
  });

  return {
    mode: "fallback",
    source: "内置个股样本",
    updatedAt: now,
    message,
    methodology: ["近40日趋势筛选", "温斯坦阶段分析", "奥尼尔量价与相对强度", "芒格/巴菲特质量过滤"],
    sectorSummary: buildSectorSummary(results),
    results: results.sort((a, b) => b.score - a.score),
  };
}

function buildSectorSummary(results) {
  const groups = new Map();
  for (const item of results) {
    const key = item.theme || item.industry || "未分类";
    const current = groups.get(key) ?? { name: key, count: 0, topCount: 0, avgScore: 0, avgReturn40: 0, leaders: [] };
    current.count += 1;
    current.topCount += item.status === "重点观察" || item.status === "跟踪观察" ? 1 : 0;
    current.avgScore += item.score;
    current.avgReturn40 += item.return40;
    current.leaders.push({ code: item.code, name: item.name, score: item.score, status: item.status });
    groups.set(key, current);
  }

  return Array.from(groups.values())
    .map((item) => ({
      ...item,
      avgScore: Math.round(item.avgScore / Math.max(1, item.count)),
      avgReturn40: round(item.avgReturn40 / Math.max(1, item.count)),
      leaders: item.leaders.sort((a, b) => b.score - a.score).slice(0, 3),
    }))
    .sort((a, b) => b.topCount - a.topCount || b.avgScore - a.avgScore)
    .slice(0, 8);
}

async function mapSettledWithConcurrency(items, limit, mapper) {
  const results = Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      try {
        results[index] = { status: "fulfilled", value: await mapper(items[index], index) };
      } catch (error) {
        results[index] = { status: "rejected", reason: error };
      }
    }
  });
  await Promise.all(workers);
  return results;
}

function makeLiveError(message, searchQuery = "") {
  return {
    mode: "error",
    source: "东方财富实时行情/财报接口",
    updatedAt: new Date().toISOString(),
    message,
    searchQuery,
    methodology: ["实时热度榜", "近40日趋势筛选", "温斯坦阶段分析", "奥尼尔量价与相对强度", "芒格/巴菲特质量过滤"],
    sectorSummary: [],
    results: [],
  };
}

export async function scanStockOpportunities({ forceFallback = false, query = "", fast = false } = {}) {
  const searchQuery = String(query ?? "").trim();
  if (forceFallback) {
    return makeFallbackScan("使用内置样本，不读取公开行情。");
  }

  try {
    const discovery = searchQuery
      ? { universe: await searchRemoteStocks(searchQuery), provider: "用户检索 + 实时K线/财报" }
      : await fetchDynamicUniverse({ fast });
    const universe = discovery.universe;
    if (!universe.length) {
      return makeLiveError(`未找到匹配个股：${searchQuery}`, searchQuery);
    }

    let benchmark = { return40: 0 };
    try {
      const benchmarkKlines = await fetchKlines("000300");
      benchmark = {
        return40: pct(benchmarkKlines.at(-1).close, benchmarkKlines.at(-41)?.close ?? benchmarkKlines[0].close),
      };
    } catch {
      benchmark = { return40: 0 };
    }

    const settled = await mapSettledWithConcurrency(universe, searchQuery ? 3 : fast ? 3 : 4, async (stock) =>
      analyzeStock(stock, await fetchKlines(stock.code), benchmark, { estimateFinancial: fast && !searchQuery }),
    );
    const results = settled
      .filter((item) => item.status === "fulfilled")
      .map((item) => item.value)
      .sort((a, b) => b.score - a.score);
    const failures = settled.filter((item) => item.status === "rejected");

    if (!results.length) {
      const firstReason = failures[0]?.reason instanceof Error ? failures[0].reason.message : "未知错误";
      return makeLiveError(`实时个股扫描失败，未返回有效行情。原因：${firstReason}`, searchQuery);
    }

    return {
      mode: "live",
      source: searchQuery
        ? "用户检索 + 腾讯/东方财富K线 + 东方财富财报"
        : `${discovery.provider} + 腾讯/东方财富K线${fast ? " + 极速财报估算" : " + 东方财富财报"}`,
      updatedAt: new Date().toISOString(),
      message: searchQuery
        ? `检索“${searchQuery}”，匹配 ${universe.length} 只，成功分析 ${results.length} 只${failures.length ? `，失败 ${failures.length} 只` : ""}。`
        : `动态发现候选 ${universe.length} 只，成功分析 ${results.length} 只${failures.length ? `，失败 ${failures.length} 只` : ""}。${fast ? "线上极速模式先估算财报，搜索单股可查看真实财报。" : ""}`,
      searchQuery,
      methodology: ["实时热度榜", "近40日趋势筛选", "温斯坦阶段分析", "奥尼尔量价与相对强度", "芒格/巴菲特质量过滤"],
      sectorSummary: buildSectorSummary(results),
      results,
    };
  } catch (error) {
    return makeLiveError(`实时个股扫描失败：${error instanceof Error ? error.message : "未知错误"}`, searchQuery);
  }
}
