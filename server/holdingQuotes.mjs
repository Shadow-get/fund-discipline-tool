function inferSecid(code) {
  const normalized = String(code ?? "").trim();
  if (!/^\d{6}$/.test(normalized)) return null;
  const market = normalized.startsWith("5") || normalized.startsWith("6") ? "1" : "0";
  return `${market}.${normalized}`;
}

function normalizeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > -900 ? number : 0;
}

export async function fetchHoldingQuotes(codes = []) {
  const uniqueCodes = Array.from(new Set(codes.map((code) => String(code).trim()).filter(Boolean)));
  const secids = uniqueCodes.map(inferSecid).filter(Boolean);

  if (!secids.length) {
    return {
      mode: "fallback",
      source: "本地持仓",
      updatedAt: new Date().toISOString(),
      message: "没有可查询的 6 位基金/ETF 代码，继续使用手动涨跌。",
      quotes: [],
    };
  }

  const fields = "f12,f14,f2,f3,f4,f18";
  const url =
    `https://push2.eastmoney.com/api/qt/ulist.np/get?secids=${encodeURIComponent(secids.join(","))}` +
    `&fields=${fields}&fltt=2&invt=2&ut=bd1d9ddb04089700cf9c27f6f7426281`;

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      Referer: "https://quote.eastmoney.com/",
    },
  });

  if (!response.ok) {
    throw new Error(`东方财富行情请求失败：HTTP ${response.status}`);
  }

  const json = await response.json();
  const list = json?.data?.diff;
  if (!Array.isArray(list)) {
    throw new Error("东方财富行情返回格式异常");
  }

  const updatedAt = new Date().toISOString();
  const quotes = list.map((item) => ({
    code: String(item.f12 ?? ""),
    name: String(item.f14 ?? ""),
    price: normalizeNumber(item.f2),
    changePct: normalizeNumber(item.f3),
    changeAmount: normalizeNumber(item.f4),
    previousClose: normalizeNumber(item.f18),
    source: "东方财富公开行情",
    updatedAt,
  }));

  return {
    mode: "live",
    source: "东方财富公开行情",
    updatedAt,
    message: `成功刷新 ${quotes.length}/${uniqueCodes.length} 个持仓代码。`,
    quotes,
  };
}
