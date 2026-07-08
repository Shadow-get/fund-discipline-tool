import { mainlineUniverse } from "./mainlineUniverse.mjs";

const periodKlt = {
  day: "101",
  week: "102",
  month: "103",
};

const periodLimit = {
  day: 180,
  week: 180,
  month: 120,
};

const klineFields = "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61";

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

function normalizeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number > -900 ? number : fallback;
}

function inferSecid(code) {
  const normalized = String(code ?? "").trim();
  if (!/^\d{6}$/.test(normalized)) return null;
  const market = normalized.startsWith("5") || normalized.startsWith("6") ? "1" : "0";
  return `${market}.${normalized}`;
}

function pct(current, previous) {
  if (!current || !previous) return 0;
  return ((current - previous) / previous) * 100;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(normalizeNumber(value) * factor) / factor;
}

function uniqueLevels(levels) {
  const result = [];
  for (const level of levels.filter((item) => Number.isFinite(item.value) && item.value > 0)) {
    const duplicated = result.some((item) => Math.abs(item.value / level.value - 1) < 0.012);
    if (!duplicated) result.push(level);
  }
  return result;
}

function movingAverage(points, windowSize, index) {
  if (index + 1 < windowSize) return null;
  const slice = points.slice(index + 1 - windowSize, index + 1);
  const sum = slice.reduce((total, item) => total + item.close, 0);
  return round(sum / windowSize);
}

function attachMovingAverages(points) {
  return points.map((point, index) => ({
    ...point,
    ma5: movingAverage(points, 5, index),
    ma10: movingAverage(points, 10, index),
    ma20: movingAverage(points, 20, index),
    ma60: movingAverage(points, 60, index),
  }));
}

function findTarget(query) {
  const normalized = String(query ?? "").trim();
  if (!normalized) return mainlineUniverse[0];

  const lower = normalized.toLowerCase();
  return (
    mainlineUniverse.find(
      (item) =>
        item.candidateId.toLowerCase() === lower ||
        item.name.toLowerCase() === lower ||
        item.representativeIndex.toLowerCase() === lower ||
        item.representativeEtfs.includes(normalized) ||
        item.securities.some((security) => security.secid === normalized || security.name.toLowerCase() === lower),
    ) ?? null
  );
}

function makeTargetPayload(query, target) {
  if (target) {
    const security = target.securities[0];
    return {
      id: target.candidateId,
      name: target.name,
      category: target.category,
      representativeIndex: target.representativeIndex,
      code: target.representativeEtfs[0] ?? security.secid,
      secid: security.secid,
    };
  }

  const code = String(query ?? "").trim();
  return {
    id: code,
    name: code,
    category: "自定义",
    representativeIndex: code,
    code,
    secid: inferSecid(code) ?? code,
  };
}

async function fetchEastmoneyKlines(secid, period) {
  const klt = periodKlt[period] ?? periodKlt.week;
  const limit = periodLimit[period] ?? periodLimit.week;
  const url =
    `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${encodeURIComponent(secid)}` +
    `&ut=fa5fd1943c7b386f172d6893dbfba10b&klt=${klt}&fqt=1&end=20500101&lmt=${limit}` +
    `&fields1=f1,f2,f3,f4,f5,f6&fields2=${klineFields}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      Referer: "https://quote.eastmoney.com/",
    },
  });

  if (!response.ok) {
    throw new Error(`东方财富 K 线请求失败：HTTP ${response.status}`);
  }

  const json = await response.json();
  const lines = json?.data?.klines;
  if (!Array.isArray(lines) || lines.length < 30) {
    throw new Error("东方财富 K 线返回数据不足");
  }

  return lines.map((line) => {
    const [date, open, close, high, low, volume, amount, amplitude, changePct, changeAmount, turnover] = String(line).split(",");
    return {
      date,
      open: normalizeNumber(open),
      close: normalizeNumber(close),
      high: normalizeNumber(high),
      low: normalizeNumber(low),
      volume: normalizeNumber(volume),
      amount: normalizeNumber(amount),
      amplitude: normalizeNumber(amplitude),
      changePct: normalizeNumber(changePct),
      changeAmount: normalizeNumber(changeAmount),
      turnover: normalizeNumber(turnover),
    };
  });
}

function makeFallbackKlines(period, seed = 1) {
  const now = new Date();
  const count = period === "month" ? 90 : 140;
  const base = 1 + (seed % 17) * 0.22;
  let close = base * 100;
  const stepDays = period === "month" ? 30 : period === "week" ? 7 : 1;

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (count - index) * stepDays);
    const wave = Math.sin(index / 8 + seed) * 0.018 + Math.cos(index / 17) * 0.01;
    const drift = index > count * 0.55 ? 0.002 : -0.0003;
    const open = close;
    close = Math.max(1, close * (1 + wave + drift));
    const high = Math.max(open, close) * (1 + 0.012 + Math.abs(wave) * 0.4);
    const low = Math.min(open, close) * (1 - 0.012 - Math.abs(wave) * 0.35);

    return {
      date: date.toISOString().slice(0, 10),
      open: round(open),
      close: round(close),
      high: round(high),
      low: round(low),
      volume: Math.round(800000 + index * 12000 + Math.abs(wave) * 6000000),
      amount: Math.round(120000000 + index * 1800000 + Math.abs(wave) * 900000000),
      amplitude: round(((high - low) / close) * 100),
      changePct: round(pct(close, open)),
      changeAmount: round(close - open),
      turnover: round(1 + Math.abs(wave) * 80),
    };
  });
}

function getAverage(points, key, size, offset = 0) {
  const end = Math.max(0, points.length - offset);
  const start = Math.max(0, end - size);
  const slice = points.slice(start, end);
  if (!slice.length) return 0;
  return slice.reduce((sum, item) => sum + normalizeNumber(item[key]), 0) / slice.length;
}

function getLocalExtremes(points) {
  const lows = [];
  const highs = [];
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];
    if (current.low <= previous.low && current.low <= next.low) {
      lows.push({ label: "前低支撑", value: current.low, date: current.date, kind: "support" });
    }
    if (current.high >= previous.high && current.high >= next.high) {
      highs.push({ label: "前高压力", value: current.high, date: current.date, kind: "resistance" });
    }
  }
  return { lows, highs };
}

function volumeRatioAt(points, index, windowSize = 20) {
  const previous = getAverage(points.slice(0, index), "volume", windowSize);
  return previous ? points[index].volume / previous : 1;
}

function hasCrossedUp(previousFast, previousSlow, currentFast, currentSlow) {
  return previousFast != null && previousSlow != null && currentFast != null && currentSlow != null && previousFast <= previousSlow && currentFast > currentSlow;
}

function hasCrossedDown(previousFast, previousSlow, currentFast, currentSlow) {
  return previousFast != null && previousSlow != null && currentFast != null && currentSlow != null && previousFast >= previousSlow && currentFast < currentSlow;
}

function createEvent(point, type, label, volumeRatio, severity, reason, hint) {
  return {
    date: point.date,
    type,
    label,
    price: round(point.close),
    volumeRatio: round(volumeRatio),
    severity,
    reason,
    hint,
  };
}

function detectTechnicalEvents(points) {
  const events = [];
  const start = Math.max(1, points.length - 80);

  for (let index = start; index < points.length; index += 1) {
    const point = points[index];
    const previous = points[index - 1];
    const volumeRatio = volumeRatioAt(points, index);
    const previous20High = Math.max(...points.slice(Math.max(0, index - 20), index).map((item) => item.high));
    const previous20Low = Math.min(...points.slice(Math.max(0, index - 20), index).map((item) => item.low));
    const recent60High = Math.max(...points.slice(Math.max(0, index - 60), index).map((item) => item.high));
    const wasSideways =
      index > 35 &&
      Math.abs(pct(points[index - 1].close, points[Math.max(0, index - 20)].close)) < 8 &&
      Math.abs(pct(points[index - 1].close, points[Math.max(0, index - 40)].close)) < 12;

    if (hasCrossedUp(previous.ma5, previous.ma20, point.ma5, point.ma20)) {
      events.push(
        createEvent(
          point,
          "goldenCross",
          "MA5金叉MA20",
          volumeRatio,
          "good",
          "短期均线上穿中期均线，说明短线价格开始重新强于中期趋势。",
          "金叉不是买入命令，最好结合放量、站上平台高点或回踩不破一起确认。",
        ),
      );
    }

    if (hasCrossedDown(previous.ma5, previous.ma20, point.ma5, point.ma20)) {
      events.push(
        createEvent(
          point,
          "deathCross",
          "MA5死叉MA20",
          volumeRatio,
          "danger",
          "短期均线跌破中期均线，说明短线动能转弱。",
          "死叉后要观察是否只是回踩，若同时跌破MA20或放量下跌，风险会更高。",
        ),
      );
    }

    if (point.close > previous20High && volumeRatio >= 1.35) {
      events.push(
        createEvent(
          point,
          "volumeBreakout",
          "放量突破",
          volumeRatio,
          "good",
          "收盘价突破近20期平台高点，同时成交量明显高于均量。",
          "这是趋势确认信号之一，但若距离MA20太远，仍要防止突破后回踩。",
        ),
      );
    }

    if (wasSideways && point.close > recent60High && volumeRatio >= 1.5) {
      events.push(
        createEvent(
          point,
          "volumeStart",
          "放量启动",
          volumeRatio,
          "good",
          "长期横盘后价格突破近60期高点，并出现明显放量。",
          "这类节点可能是周期行情启动，但需要后续不跌回平台内来确认。",
        ),
      );
    }

    if (point.ma20 && Math.abs(pct(point.close, point.ma20)) <= 2.5 && point.close >= point.ma20 && volumeRatio <= 0.72) {
      events.push(
        createEvent(
          point,
          "shrinkPullback",
          "缩量回踩MA20",
          volumeRatio,
          "neutral",
          "价格回到MA20附近，但成交量低于均量，抛压暂时不重。",
          "缩量回踩更像观察区，等止跌或重新放量上行再确认。",
        ),
      );
    }

    if (volumeRatio <= 0.55) {
      events.push(
        createEvent(
          point,
          "dryVolume",
          "大缩量",
          volumeRatio,
          "warn",
          "成交量明显低于均量，说明市场交易意愿下降。",
          "大缩量可能是惜售，也可能是资金退潮，要结合价格是否守住支撑判断。",
        ),
      );
    }

    if (volumeRatio >= 1.6 && Math.abs(point.changePct) <= 1.2 && point.high >= previous20High * 0.98) {
      events.push(
        createEvent(
          point,
          "volumeStall",
          "放量滞涨",
          volumeRatio,
          "warn",
          "成交量明显放大，但价格没有有效上行，且靠近前高或压力区。",
          "这常代表分歧加大，追高赔率下降，需要看后续能否继续放量突破。",
        ),
      );
    }

    if (point.close < previous20Low && volumeRatio >= 1.35) {
      events.push(
        createEvent(
          point,
          "volumeBreakdown",
          "放量破位",
          volumeRatio,
          "danger",
          "收盘跌破近20期平台低点，同时成交量明显放大。",
          "这是风险信号，说明不是普通回调，后续要观察能否快速收回平台。",
        ),
      );
    }
  }

  return events
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter((event, index, list) => {
      const previousSame = list[index - 1];
      return !(previousSame && previousSame.type === event.type && previousSame.date === event.date);
    })
    .slice(-18);
}

function candlePattern(point) {
  const range = Math.max(point.high - point.low, 0.0001);
  const body = Math.abs(point.close - point.open);
  const upper = point.high - Math.max(point.open, point.close);
  const lower = Math.min(point.open, point.close) - point.low;

  if (body / range <= 0.18) return "十字星：多空接近平衡，通常代表犹豫，需要看下一根K线选择方向。";
  if (lower / range >= 0.45 && upper / range <= 0.25) return "下影线较长：盘中有下探，但收回较多，说明低位有一定承接。";
  if (upper / range >= 0.45 && lower / range <= 0.25) return "上影线较长：盘中冲高后回落，说明上方有抛压或追高资金被压制。";
  if (point.changePct >= 3) return "长阳线：买盘较强，若配合放量更像趋势确认。";
  if (point.changePct <= -3) return "长阴线：卖压较强，若配合放量要防止趋势破位。";
  return point.close >= point.open ? "小阳线：价格温和上行，趋势需要结合量能确认。" : "小阴线：价格温和回落，重点看是否跌破均线或平台。";
}

function volumePriceComment(point, volumeRatio) {
  if (point.changePct > 0.8 && volumeRatio >= 1.25) return "价涨量增：上涨得到成交量配合，短期资金确认度提高。";
  if (point.changePct > 0.8 && volumeRatio < 0.85) return "价涨量缩：价格上涨但成交量不足，可能是反弹或惜售推动，持续性要继续观察。";
  if (point.changePct < -0.8 && volumeRatio >= 1.25) return "价跌量增：下跌伴随放量，说明抛压较重，风险高于普通回调。";
  if (point.changePct < -0.8 && volumeRatio < 0.85) return "价跌量缩：回落时成交量变小，暂时更像回踩或观望。";
  if (volumeRatio >= 1.5) return "量增价平：成交明显放大但价格变化不大，说明多空分歧加大。";
  if (volumeRatio <= 0.6) return "明显缩量：交易意愿下降，等待方向选择。";
  return "量价平衡：成交量和价格变化都不极端，暂时按趋势和支撑压力观察。";
}

function buildDynamicGuide({ last, volumeRatio, status, support, resistance, events, ma20, ma60 }) {
  const latestEvents = events.slice(-4).reverse();
  const guide = [
    {
      title: "当前K线形态",
      summary: candlePattern(last),
      detail: "先看实体和上下影线：实体越长代表方向越强，上影线代表上方压力，下影线代表下方承接。",
      tone: last.changePct >= 0 ? "good" : "warn",
    },
    {
      title: "量价关系",
      summary: volumePriceComment(last, volumeRatio),
      detail: `当前成交量约为20期均量的 ${round(volumeRatio)} 倍。量能是确认信号，不是单独的买卖理由。`,
      tone: volumeRatio >= 1.4 && last.changePct < 0 ? "danger" : volumeRatio >= 1.2 ? "good" : volumeRatio <= 0.65 ? "warn" : "neutral",
    },
    {
      title: "均线信号",
      summary:
        ma20 && ma60 && ma20 > ma60
          ? "MA20在MA60上方，中期趋势结构偏健康。"
          : ma20 && ma60
            ? "MA20不在MA60上方，中期趋势还需要修复。"
            : "均线数据不足，先看价格区间。",
      detail: latestEvents.find((event) => event.type === "goldenCross" || event.type === "deathCross")?.reason ?? "金叉/死叉用于判断短线动能是否重新强于中期趋势，需要结合量能确认。",
      tone: status === "bullish" ? "good" : status === "broken" ? "danger" : "warn",
    },
    {
      title: "操作观察位",
      summary: support
        ? `最近支撑是 ${support.label} ${round(support.value)}，距离当前约 ${support.distancePct}%。`
        : resistance
          ? `最近压力是 ${resistance.label} ${round(resistance.value)}，距离当前约 ${resistance.distancePct}%。`
          : "暂时没有非常清晰的支撑压力。",
      detail: resistance ? `上方压力：${resistance.label} ${round(resistance.value)}，距离当前约 ${resistance.distancePct}%。` : "不要把支撑压力当作确定预测，它更适合用来规划分批和风控。",
      tone: status === "overheated" ? "warn" : "neutral",
    },
  ];

  if (latestEvents.length) {
    guide.push({
      title: "近期关键节点",
      summary: latestEvents.map((event) => `${event.date} ${event.label}`).join("；"),
      detail: latestEvents[0].hint,
      tone: latestEvents[0].severity,
    });
  }

  return guide;
}

function analyzeTechnical(points, period) {
  const last = points.at(-1);
  const close = last?.close ?? 0;
  const recent = points.slice(-80);
  const recent20 = points.slice(-20);
  const recent60 = points.slice(-60);
  const ma5 = last?.ma5 ?? null;
  const ma10 = last?.ma10 ?? null;
  const ma20 = last?.ma20 ?? null;
  const ma60 = last?.ma60 ?? null;
  const ma20Before = points.at(-6)?.ma20 ?? ma20;
  const ma60Before = points.at(-12)?.ma60 ?? ma60;
  const periodLabel = period === "month" ? "月线" : period === "day" ? "日线" : "周线";
  const { lows, highs } = getLocalExtremes(recent);
  const swingLow = lows.filter((item) => item.value <= close * 1.01).sort((a, b) => b.value - a.value)[0];
  const swingHigh = highs.filter((item) => item.value >= close * 0.99).sort((a, b) => a.value - b.value)[0];
  const platformLow = Math.min(...recent20.map((item) => item.low));
  const platformHigh = Math.max(...recent20.map((item) => item.high));

  const supportCandidates = uniqueLevels([
    ma20 && ma20 <= close ? { label: "MA20支撑", value: ma20, kind: "support" } : null,
    ma60 && ma60 <= close ? { label: "MA60支撑", value: ma60, kind: "support" } : null,
    swingLow,
    { label: "20期平台低点", value: platformLow, kind: "support" },
  ].filter(Boolean))
    .map((item) => ({ ...item, distancePct: round(((close - item.value) / close) * 100) }))
    .filter((item) => item.distancePct >= 0)
    .sort((a, b) => a.distancePct - b.distancePct)
    .slice(0, 3);

  const resistanceCandidates = uniqueLevels([
    ma20 && ma20 >= close ? { label: "MA20压力", value: ma20, kind: "resistance" } : null,
    ma60 && ma60 >= close ? { label: "MA60压力", value: ma60, kind: "resistance" } : null,
    swingHigh,
    { label: "20期平台高点", value: platformHigh, kind: "resistance" },
  ].filter(Boolean))
    .map((item) => ({ ...item, distancePct: round(((item.value - close) / close) * 100) }))
    .filter((item) => item.distancePct >= 0)
    .sort((a, b) => a.distancePct - b.distancePct)
    .slice(0, 3);

  const support = supportCandidates[0];
  const resistance = resistanceCandidates[0];
  const returns20 = pct(close, points.at(-21)?.close ?? points[0]?.close);
  const returns60 = pct(close, points.at(-61)?.close ?? points[0]?.close);
  const returns120 = pct(close, points.at(-121)?.close ?? points[0]?.close);
  const biasMa20 = ma20 ? pct(close, ma20) : 0;
  const high60 = Math.max(...recent60.map((item) => item.high));
  const drawdownPct = high60 ? pct(close, high60) : 0;
  const recentVolume = getAverage(points, "volume", 5);
  const previousVolume = getAverage(points, "volume", 20, 5);
  const volumeRatio = previousVolume ? recentVolume / previousVolume : 1;
  const ma20Slope = ma20 && ma20Before ? pct(ma20, ma20Before) : 0;
  const ma60Slope = ma60 && ma60Before ? pct(ma60, ma60Before) : 0;

  let status = "neutral";
  let trendLabel = `${periodLabel}震荡`;
  let conclusion = "均线结构尚未给出强趋势信号，先观察支撑和压力的突破情况。";
  let riskNote = "避免只看单日涨跌，优先等待周线/月线确认。";

  if (ma20 && close < ma20 && ma60 && ma20 < ma60) {
    status = "broken";
    trendLabel = `${periodLabel}走弱`;
    conclusion = `价格跌破 MA20 且 MA20 低于 MA60，趋势处于修复区，等待重新站回 MA20。`;
    riskNote = support ? `下方先看 ${support.label} ${round(support.value)}，若继续跌破需要降低仓位预期。` : "支撑不清晰，暂不适合追反弹。";
  } else if (ma20 && close < ma20) {
    status = "watch";
    trendLabel = `${periodLabel}回踩`;
    conclusion = `价格低于 MA20，但中期均线尚未完全转弱，适合观察能否在支撑位止跌。`;
    riskNote = support ? `距离最近支撑约 ${support.distancePct}%；支撑未确认前不宜一次性加仓。` : "尚未形成清晰支撑。";
  } else if (biasMa20 > 12 || returns20 > 18) {
    status = "overheated";
    trendLabel = `${periodLabel}偏热`;
    conclusion = `价格明显高于 MA20，短期涨幅和均线偏离较大，趋势虽强但追高赔率下降。`;
    riskNote = resistance ? `上方压力约 ${resistance.distancePct}%；更好的动作是等回踩 MA20 或平台支撑。` : "上方压力不清晰，但均线偏离已经偏高。";
  } else if (ma20 && ma60 && close > ma20 && ma20 > ma60 && ma20Slope > 0 && ma60Slope >= -1) {
    status = "bullish";
    trendLabel = `${periodLabel}多头`;
    conclusion = `价格位于 MA20 上方，MA20 高于 MA60，趋势结构仍健康。`;
    riskNote = support ? `最近支撑约 ${support.distancePct}%；若放量跌破 MA20，趋势等级需要下调。` : "继续观察 MA20 是否能保持上行。";
  }

  const latestVolumeRatio = volumeRatioAt(points, points.length - 1);
  const events = detectTechnicalEvents(points);
  const dailyCommentary = {
    pattern: candlePattern(last),
    volumePrice: volumePriceComment(last, latestVolumeRatio),
    trend: conclusion,
    conclusion: riskNote,
  };
  const guide = buildDynamicGuide({
    last,
    volumeRatio: latestVolumeRatio,
    status,
    support,
    resistance,
    events,
    ma20,
    ma60,
  });

  return {
    close: round(close),
    changePct: round(last?.changePct ?? pct(close, points.at(-2)?.close)),
    returns20: round(returns20),
    returns60: round(returns60),
    returns120: round(returns120),
    ma5,
    ma10,
    ma20,
    ma60,
    biasMa20: round(biasMa20),
    volumeRatio: round(volumeRatio),
    drawdownPct: round(drawdownPct),
    supportLevels: supportCandidates,
    resistanceLevels: resistanceCandidates,
    events,
    guide,
    dailyCommentary,
    trendLabel,
    status,
    conclusion,
    riskNote,
  };
}

export async function fetchMarketKline({ code = "cn_hs300", period = "week" } = {}) {
  const normalizedPeriod = periodKlt[period] ? period : "week";
  const target = findTarget(code);
  const targetPayload = makeTargetPayload(code, target);
  const secids = target?.securities?.map((item) => item.secid) ?? [inferSecid(code)].filter(Boolean);
  const errors = [];

  for (const secid of secids) {
    try {
      const points = attachMovingAverages(await fetchEastmoneyKlines(secid, normalizedPeriod));
      return {
        mode: "live",
        source: "东方财富公开行情",
        updatedAt: new Date().toISOString(),
        period: normalizedPeriod,
        target: { ...targetPayload, secid },
        message: `成功读取 ${targetPayload.name} ${normalizedPeriod} K线。`,
        points,
        analysis: analyzeTechnical(points, normalizedPeriod),
      };
    } catch (error) {
      errors.push(`${secid}:${error instanceof Error ? error.message : "未知错误"}`);
    }
  }

  const seed = Array.from(String(code)).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const fallbackPoints = attachMovingAverages(makeFallbackKlines(normalizedPeriod, seed));
  return {
    mode: "fallback",
    source: "本地降级走势",
    updatedAt: new Date().toISOString(),
    period: normalizedPeriod,
    target: targetPayload,
    message: `公开 K 线暂不可用，展示本地降级走势。原因：${errors.join("; ") || "未匹配到标的"}`,
    points: fallbackPoints,
    analysis: analyzeTechnical(fallbackPoints, normalizedPeriod),
  };
}
