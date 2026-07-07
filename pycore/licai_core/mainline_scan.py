from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .rules import number


Payload = dict[str, Any]
KLINE_FIELDS = "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61"
CACHE_PATH = Path(".cache") / "mainline-scan.json"
LEGACY_CACHE_PATH = Path(".cache") / "mainline-scan-python.json"
CACHE_TTL_SECONDS = 15 * 60


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def clamp(value: float, min_value: float = 0, max_value: float = 100) -> float:
    return max(min_value, min(max_value, value if value == value else 0))


def pct(current: float, previous: float) -> float:
    if not current or not previous:
        return 0.0
    return ((current - previous) / previous) * 100


def score_from_return(value: float, center: float = 0, scale: float = 20) -> float:
    return clamp(50 + ((value - center) / scale) * 50)


def fetch_klines(secid: str) -> list[Payload]:
    url = (
        f"https://push2his.eastmoney.com/api/qt/stock/kline/get?secid={secid}"
        "&ut=fa5fd1943c7b386f172d6893dbfba10b&klt=101&fqt=1&end=20500101&lmt=150"
        f"&fields1=f1,f2,f3,f4,f5,f6&fields2={KLINE_FIELDS}"
    )
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json,text/plain,*/*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Cache-Control": "no-cache",
            "Connection": "close",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
            "Referer": "https://quote.eastmoney.com/",
        },
    )

    last_error: Exception | None = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=12) as response:
                raw = response.read().decode("utf-8")
            break
        except urllib.error.HTTPError as error:
            raise RuntimeError(f"行情请求失败 {error.code}") from error
        except Exception as error:  # noqa: BLE001 - public quote endpoints often close transiently.
            last_error = error
            if attempt < 2:
                time.sleep(0.7 * (attempt + 1))
                continue
            raise RuntimeError(str(last_error)) from error

    data = json.loads(raw)
    lines = data.get("data", {}).get("klines")
    if not isinstance(lines, list) or len(lines) < 30:
        raise RuntimeError("行情数据不足")

    klines: list[Payload] = []
    for line in lines:
        parts = str(line).split(",")
        if len(parts) < 11:
            continue
        date, open_, close, high, low, volume, amount, amplitude, change_pct, change_amount, turnover = parts[:11]
        klines.append(
            {
                "date": date,
                "open": number(open_),
                "close": number(close),
                "high": number(high),
                "low": number(low),
                "volume": number(volume),
                "amount": number(amount),
                "amplitude": number(amplitude),
                "changePct": number(change_pct),
                "changeAmount": number(change_amount),
                "turnover": number(turnover),
            }
        )

    if len(klines) < 30:
        raise RuntimeError("有效行情数据不足")
    return klines


def fetch_candidate_series(candidate: Payload) -> Payload:
    errors: list[str] = []
    for security in candidate.get("securities") or []:
        try:
            return {"security": security, "klines": fetch_klines(str(security.get("secid")))}
        except Exception as error:  # noqa: BLE001 - preserve all provider failures for fallback.
            errors.append(f"{security.get('name')}:{error}")
    raise RuntimeError("; ".join(errors) or "候选没有证券代码")


def friendly_provider_error(error: Exception) -> str:
    message = str(error)
    if "Remote end closed connection without response" in message or "RemoteDisconnected" in message:
        return "东方财富公开行情连接被临时断开，已自动降级到缓存或快照。"
    if "timed out" in message or "timeout" in message.lower():
        return "东方财富公开行情响应超时，已自动降级到缓存或快照。"
    if "有效候选不足" in message:
        return message
    return "东方财富公开行情暂时不可用，已自动降级到缓存或快照。"


def safe_close(klines: list[Payload], offset: int) -> float:
    if len(klines) > offset:
        return number(klines[-offset - 1].get("close"))
    return number(klines[0].get("close"))


def moving_average(items: list[Payload], key: str) -> float:
    if not items:
        return 0.0
    return sum(number(item.get(key)) for item in items) / len(items)


def analyze_klines(candidate: Payload, series: Payload, benchmark: Payload) -> Payload:
    klines = series["klines"]
    close = number(klines[-1].get("close"))
    returns20 = pct(close, safe_close(klines, 20))
    returns60 = pct(close, safe_close(klines, 60))
    returns120 = pct(close, safe_close(klines, 120))

    recent20 = klines[-20:]
    previous20 = klines[-40:-20]
    amount_recent = moving_average(recent20, "amount")
    amount_previous = moving_average(previous20, "amount")
    volume_trend = clamp(50 + pct(amount_recent, amount_previous))

    turnover_recent = moving_average(recent20, "turnover")
    turnover_previous = moving_average(previous20, "turnover")
    turnover_trend = clamp(50 + pct(turnover_recent or amount_recent, turnover_previous or amount_previous))
    fund_flow_proxy = clamp(volume_trend * 0.6 + turnover_trend * 0.4)

    relative20 = returns20 - number(benchmark.get("returns20"))
    relative60 = returns60 - number(benchmark.get("returns60"))
    relative120 = returns120 - number(benchmark.get("returns120"))
    relative_strength = clamp(
        score_from_return(relative20, 0, 12) * 0.35
        + score_from_return(relative60, 0, 22) * 0.4
        + score_from_return(relative120, 0, 35) * 0.25
    )

    trend_continuity = clamp(
        (25 if returns20 > 0 else 0)
        + (25 if returns60 > returns20 * 0.5 else 0)
        + (25 if returns120 > returns60 * 0.5 else 0)
        + (25 if close > safe_close(klines, 60) else 0)
    )

    heat_score = clamp(
        max(0, returns20) * 1.3
        + max(0, returns60) * 0.75
        + max(0, returns120) * 0.35
        + max(0, volume_trend - 55) * 0.7
        + max(0, turnover_trend - 55) * 0.4
    )
    valuation_percentile = clamp(45 + heat_score * 0.45 + max(0, returns120) * 0.18)
    valuation_constraint = 100 - max(valuation_percentile, heat_score)
    industry_policy_score = number(candidate.get("industryScore")) * 0.6 + number(candidate.get("policyScore")) * 0.4
    score = clamp(
        fund_flow_proxy * 0.3
        + relative_strength * 0.25
        + trend_continuity * 0.15
        + valuation_constraint * 0.2
        + industry_policy_score * 0.1
    )

    if heat_score >= 82:
        stage = "高热拥挤"
    elif fund_flow_proxy >= 75 and relative_strength >= 68 and trend_continuity >= 70:
        stage = "业绩验证"
    elif fund_flow_proxy >= 68 and relative_strength >= 62:
        stage = "订单验证"
    elif fund_flow_proxy >= 62:
        stage = "预期驱动"
    else:
        stage = "观察期"

    if heat_score >= 86 or valuation_percentile >= 88:
        status_key = "overheated"
        status = "过热等待"
    elif score >= 72 and heat_score < 78:
        status_key = "top"
        status = "主线候选"
    elif score >= 62:
        status_key = "watch"
        status = "可小仓观察"
    else:
        status_key = "rejected"
        status = "暂不进入"

    suggested_satellite_ratio = {
        "top": "卫星仓的50%-100%",
        "watch": "卫星仓的20%-50%",
        "overheated": "0%-20%",
        "rejected": "0%-20%",
    }[status_key]

    action = {
        "top": "可作为主线卫星候选，按估值分批",
        "watch": "小仓观察或等待回调确认",
        "overheated": "不追高，等待热度回落",
        "rejected": "暂不进入本月卫星仓",
    }[status_key]

    reason = {
        "top": "资金方向、相对强弱和趋势持续性同时较强，且热度没有极端拥挤。",
        "watch": "有资金或趋势线索，但证据链还不够完整。",
        "overheated": "资金热度和涨幅都较高，短期追入的安全边际不足。",
        "rejected": "资金、强弱或趋势持续性不足，不应只凭故事进入卫星仓。",
    }[status_key]

    tags = "、".join(str(tag) for tag in candidate.get("tags") or [])
    security_name = series.get("security", {}).get("name", "-")

    return {
        "candidateId": candidate.get("candidateId"),
        "name": candidate.get("name"),
        "category": candidate.get("category"),
        "representativeIndex": candidate.get("representativeIndex"),
        "representativeEtfs": candidate.get("representativeEtfs") or [],
        "returns20": round(returns20, 2),
        "returns60": round(returns60, 2),
        "returns120": round(returns120, 2),
        "volumeTrend": round(volume_trend),
        "turnoverTrend": round(turnover_trend),
        "fundFlowProxy": round(fund_flow_proxy),
        "valuationPercentile": round(valuation_percentile),
        "heatScore": round(heat_score),
        "score": round(score),
        "stage": stage,
        "status": status,
        "statusKey": status_key,
        "suggestedSatelliteRatio": suggested_satellite_ratio,
        "action": action,
        "reason": reason,
        "evidence": {
            "fund": f"资金代理 {round(fund_flow_proxy)} 分，成交/换手趋势 {round(volume_trend)}/{round(turnover_trend)} 分。",
            "strength": f"20/60/120日收益 {returns20:.1f}% / {returns60:.1f}% / {returns120:.1f}%，相对宽基强弱 {round(relative_strength)} 分。",
            "heat": f"热度 {round(heat_score)} 分，估值/拥挤代理分位 {round(valuation_percentile)}%。",
            "policy": f"{tags}；产业/政策元数据 {round(industry_policy_score)} 分。",
        },
        "source": f"东方财富公开行情，{security_name}",
        "updatedAt": now_iso(),
    }


def read_cache() -> Payload | None:
    for path in (CACHE_PATH, LEGACY_CACHE_PATH):
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
    return None


def parse_time(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None


def is_fresh_cache(payload: Payload) -> bool:
    updated_at = parse_time(str(payload.get("updatedAt") or ""))
    if not updated_at:
        return False
    return (datetime.now(timezone.utc) - updated_at).total_seconds() <= CACHE_TTL_SECONDS


def as_cache_payload(payload: Payload, message: str = "使用最近主线扫描缓存，手动深度刷新可重新读取公开行情。") -> Payload:
    cached = deepcopy(payload)
    cached["mode"] = "cache" if cached.get("mode") == "live" else cached.get("mode", "cache")
    cached["message"] = message
    return cached


def write_cache(payload: Payload) -> None:
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def fallback_payload(payload: Payload, mode: str = "fallback", message: str | None = None) -> Payload:
    fallback = deepcopy(payload.get("fallback") or {})
    fallback["mode"] = mode
    if message:
        fallback["message"] = message
    return fallback


def scan_mainlines(payload: Payload) -> Payload:
    universe = payload.get("universe") if isinstance(payload.get("universe"), list) else []
    force_fallback = bool(payload.get("forceFallback"))
    force_refresh = bool(payload.get("forceRefresh"))
    if force_fallback:
        return fallback_payload(payload, "fallback")

    cached_before_scan = read_cache()
    if not force_refresh and cached_before_scan and cached_before_scan.get("results"):
        return as_cache_payload(
            cached_before_scan,
            "使用15分钟内主线扫描缓存，避免重复请求公开行情。"
            if is_fresh_cache(cached_before_scan)
            else "使用最近主线扫描缓存；需要实时重扫时请手动刷新。",
        )

    if not force_refresh and not (cached_before_scan and cached_before_scan.get("results")):
        return fallback_payload(payload, "fallback", "暂无主线扫描缓存，先展示内置快照；需要实时重扫时请手动刷新。")

    try:
        benchmark = {"returns20": 0, "returns60": 0, "returns120": 0}
        benchmark_candidate = next((item for item in universe if item.get("candidateId") == "cn_hs300"), None)
        if benchmark_candidate:
            try:
                benchmark_series = fetch_candidate_series(benchmark_candidate)
                benchmark_klines = benchmark_series["klines"]
                benchmark_close = number(benchmark_klines[-1].get("close"))
                benchmark = {
                    "returns20": pct(benchmark_close, safe_close(benchmark_klines, 20)),
                    "returns60": pct(benchmark_close, safe_close(benchmark_klines, 60)),
                    "returns120": pct(benchmark_close, safe_close(benchmark_klines, 120)),
                }
            except Exception:
                benchmark = {"returns20": 0, "returns60": 0, "returns120": 0}

        results: list[Payload] = []
        with ThreadPoolExecutor(max_workers=8) as executor:
            future_map = {executor.submit(fetch_candidate_series, candidate): candidate for candidate in universe}
            for future in as_completed(future_map):
                candidate = future_map[future]
                try:
                    series = future.result()
                    results.append(analyze_klines(candidate, series, benchmark))
                except Exception:
                    continue

        results.sort(key=lambda item: number(item.get("score")), reverse=True)
        if len(results) < 8:
            raise RuntimeError(f"有效候选不足：{len(results)}")

        output = {
            "mode": "live",
            "source": "东方财富公开行情",
            "updatedAt": now_iso(),
            "benchmark": "沪深300",
            "message": f"扫描 {len(universe)} 个候选，成功 {len(results)} 个。",
            "results": results,
        }
        write_cache(output)
        return output
    except Exception as error:
        cached = read_cache()
        if cached and cached.get("results"):
            return as_cache_payload(cached, friendly_provider_error(error))
        return fallback_payload(payload, "fallback", friendly_provider_error(error))
