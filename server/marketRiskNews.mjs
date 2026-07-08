const rssSources = [
  { name: "Federal Reserve", url: "https://www.federalreserve.gov/feeds/press_all.xml" },
  { name: "SEC", url: "https://www.sec.gov/news/pressreleases.rss" },
  { name: "BLS", url: "https://www.bls.gov/feed/news_release.rss" },
  { name: "US Treasury", url: "https://home.treasury.gov/news/press-releases/rss" },
];

const signalTemplates = [
  {
    key: "speculation",
    name: "投机狂热",
    history: "1929年前的融资买股、2000年前的互联网IPO狂热，都体现为价格叙事强于盈利证据。",
    keywords: ["bubble", "mania", "speculation", "ipo", "record high", "valuation", "meme", "ai boom", "dot-com", "overvalued"],
    weight: 18,
  },
  {
    key: "leverage",
    name: "杠杆扩张",
    history: "1929年的保证金交易和2000年前后的高风险融资，都会放大下跌时的踩踏。",
    keywords: ["margin debt", "leverage", "borrow", "debt", "credit growth", "financing", "loan", "risk taking"],
    weight: 16,
  },
  {
    key: "liquidity",
    name: "流动性转向",
    history: "泡沫破裂前常见货币条件收紧，利率和长债收益率会压缩高估值资产。",
    keywords: ["rate hike", "higher rates", "inflation", "tightening", "yield", "treasury", "balance sheet", "liquidity"],
    weight: 18,
  },
  {
    key: "credit",
    name: "信用压力",
    history: "大萧条和互联网泡沫后都出现信用链条收缩，企业融资和偿债压力扩大。",
    keywords: ["default", "bankruptcy", "delinquency", "credit spread", "bank stress", "commercial real estate", "downgrade"],
    weight: 18,
  },
  {
    key: "earnings",
    name: "盈利证据变差",
    history: "2000年前后很多公司仍有故事但盈利兑现不足，盈利下修会刺破估值假设。",
    keywords: ["profit warning", "guidance cut", "earnings miss", "layoff", "slowdown", "recession", "demand weakness"],
    weight: 16,
  },
  {
    key: "breadth",
    name: "市场宽度变窄",
    history: "泡沫尾部常见指数由少数龙头支撑，市场内部已经开始分化。",
    keywords: ["market breadth", "concentration", "mega cap", "narrow rally", "equal weight", "leadership"],
    weight: 14,
  },
];

function stripTags(value) {
  return String(value ?? "")
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function pickTag(raw, tag) {
  const match = raw.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return stripTags(match?.[1] ?? "");
}

function parseRssItems(xml, sourceName) {
  const itemMatches = [...String(xml).matchAll(/<item\b[\s\S]*?<\/item>/gi)];
  return itemMatches.slice(0, 20).map((match) => {
    const raw = match[0];
    return {
      title: pickTag(raw, "title"),
      summary: pickTag(raw, "description"),
      url: pickTag(raw, "link"),
      publishedAt: pickTag(raw, "pubDate"),
      source: sourceName,
    };
  });
}

async function fetchFeed(source) {
  const response = await fetch(source.url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      Accept: "application/rss+xml, application/xml, text/xml",
    },
  });
  if (!response.ok) throw new Error(`${source.name}: HTTP ${response.status}`);
  return parseRssItems(await response.text(), source.name);
}

function scoreItem(item) {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  const signals = signalTemplates
    .map((template) => {
      const hits = template.keywords.filter((keyword) => text.includes(keyword));
      return hits.length
        ? {
            key: template.key,
            name: template.name,
            hits,
            score: Math.min(template.weight, hits.length * Math.max(6, template.weight / 2)),
          }
        : null;
    })
    .filter(Boolean);
  return {
    ...item,
    signals,
    riskScore: Math.round(signals.reduce((sum, signal) => sum + signal.score, 0)),
    takeaway: signals.length
      ? `命中${signals.map((signal) => signal.name).join("、")}。这类新闻本身不代表危机，但如果连续多日聚集，需要降低追高和高波动仓位。`
      : "未命中主要危机征兆关键词，作为普通新闻参考。",
  };
}

function classifyRisk(score) {
  if (score >= 70) return { level: "danger", label: "高风险聚集" };
  if (score >= 45) return { level: "warn", label: "风险升温" };
  if (score >= 22) return { level: "neutral", label: "局部信号" };
  return { level: "good", label: "未见聚集" };
}

function buildChineseConclusion(signalSummary, overallScore) {
  const active = signalSummary.filter((signal) => signal.count > 0).sort((a, b) => b.count - a.count);
  const topNames = active.slice(0, 3).map((signal) => signal.name);
  if (overallScore >= 70) {
    return {
      conclusion: `今日风险信号高度聚集，主要集中在${topNames.join("、") || "多类风险"}。`,
      action: "进入防守观察：降低追高、减少高估值主题新增、保留现金，等待价格和信用信号修复。",
      reasons: active.map((signal) => `${signal.name}命中 ${signal.count} 条：${signal.history}`).slice(0, 4),
    };
  }
  if (overallScore >= 45) {
    return {
      conclusion: `今日风险信号开始升温，重点关注${topNames.join("、") || "流动性和信用"}。`,
      action: "控制节奏：主题仓只做小比例验证，避免一次性买入，等待回踩和财报确认。",
      reasons: active.map((signal) => `${signal.name}命中 ${signal.count} 条：${signal.history}`).slice(0, 4),
    };
  }
  if (overallScore >= 22) {
    return {
      conclusion: `今日只有局部风险信号，暂未形成类似1929/2000前夕的多因子共振。`,
      action: "维持观察：不因单条新闻改变策略，但继续跟踪估值、利率、信用和盈利修正。",
      reasons: active.length
        ? active.map((signal) => `${signal.name}命中 ${signal.count} 条：${signal.history}`).slice(0, 3)
        : ["新闻源暂未捕获明显风险聚集。"],
    };
  }
  return {
    conclusion: "今日未见明显危机征兆聚集，市场风险雷达保持常规观察。",
    action: "按既定策略执行，不因为单日新闻做大幅仓位变化；继续观察流动性、信用和盈利数据。",
    reasons: ["六类历史风险模板未出现明显同步升温。"],
  };
}

function buildFallbackNews(message) {
  const updatedAt = new Date().toISOString();
  const items = [
    {
      title: "新闻源暂不可用，先展示历史危机征兆模板",
      summary: "可关注投机狂热、杠杆扩张、流动性转向、信用压力、盈利下修、市场宽度变窄六类信号是否同时出现。",
      url: "",
      publishedAt: updatedAt,
      source: "本地模型",
    },
  ].map(scoreItem);

  return {
    mode: "fallback",
    source: "本地危机征兆模板",
    updatedAt,
    message,
    conclusion: "新闻源暂不可用，无法给出实时风险结论；先按历史模板观察六类信号。",
    action: "不要根据本地模板直接调整仓位，等待新闻源恢复或结合外部宏观数据确认。",
    reasons: ["当前只展示历史危机征兆框架，不代表实时新闻风险。"],
    overallRisk: { score: 0, ...classifyRisk(0) },
    templates: signalTemplates,
    items,
    signalSummary: signalTemplates.map((template) => ({
      key: template.key,
      name: template.name,
      count: 0,
      score: 0,
      history: template.history,
    })),
  };
}

export async function scanMarketRiskNews({ forceFallback = false } = {}) {
  if (forceFallback) {
    return buildFallbackNews("使用本地危机征兆模板，不读取新闻源。");
  }

  try {
    const settled = await Promise.allSettled(rssSources.map(fetchFeed));
    const errors = settled
      .filter((item) => item.status === "rejected")
      .map((item) => item.reason?.message ?? "未知错误");
    const rawItems = settled
      .filter((item) => item.status === "fulfilled")
      .flatMap((item) => item.value);
    const items = rawItems
      .map(scoreItem)
      .filter((item) => item.title)
      .sort((a, b) => b.riskScore - a.riskScore || String(b.publishedAt).localeCompare(String(a.publishedAt)))
      .slice(0, 30);

    if (!items.length) throw new Error(errors.join("; ") || "新闻源没有返回可用条目");

    const signalSummary = signalTemplates.map((template) => {
      const related = items.filter((item) => item.signals.some((signal) => signal.key === template.key));
      return {
        key: template.key,
        name: template.name,
        count: related.length,
        score: Math.round(related.reduce((sum, item) => sum + item.riskScore, 0) / Math.max(1, related.length)),
        history: template.history,
      };
    });
    const overallScore = Math.round(
      Math.min(
        100,
        signalSummary.reduce((sum, signal) => sum + Math.min(18, signal.count * 7 + signal.score * 0.08), 0),
      ),
    );
    const chineseConclusion = buildChineseConclusion(signalSummary, overallScore);

    return {
      mode: errors.length ? "partial" : "live",
      source: "Official RSS feeds",
      updatedAt: new Date().toISOString(),
      message: errors.length ? `部分新闻源不可用：${errors.join("; ")}` : `读取 ${rssSources.length} 个新闻源，捕获 ${items.length} 条。`,
      ...chineseConclusion,
      overallRisk: { score: overallScore, ...classifyRisk(overallScore) },
      templates: signalTemplates,
      items,
      signalSummary,
    };
  } catch (error) {
    return buildFallbackNews(`新闻源暂不可用，使用本地模板。原因：${error instanceof Error ? error.message : "未知错误"}`);
  }
}
