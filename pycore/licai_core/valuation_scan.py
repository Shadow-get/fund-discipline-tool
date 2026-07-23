from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from typing import Any

from .rules import number


Payload = dict[str, Any]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def clamp(value: float, min_value: float = 0, max_value: float = 100) -> float:
    return max(min_value, min(max_value, value if value == value else 0))


def safe_round(value: float, digits: int = 2) -> float:
    return round(value, digits)


def percentile_discount(percentile: float) -> float:
    return clamp(100 - percentile)


def dividend_score(dividend_yield: float) -> float:
    return clamp((dividend_yield / 6.0) * 100)


def earnings_yield(pe: float) -> float:
    if pe <= 0:
        return 0.0
    return 100.0 / pe


def spread_score(spread: float) -> float:
    return clamp(50 + spread * 8)


def classify_stage(value_score: float, cycle_score: float, profit_trend_score: float, trend_confirmation_score: float) -> str:
    if profit_trend_score < 42:
        return "盈利出清"
    if value_score >= 72 and trend_confirmation_score < 45:
        return "低估左侧"
    if value_score >= 70 and cycle_score >= 64:
        return "低估修复初期"
    if value_score >= 62:
        return "估值修复观察"
    return "估值合理"


def classify_status(value_score: float, score: float, logic_risk_score: float) -> tuple[str, str]:
    if value_score >= 66 and logic_risk_score >= 66:
        return "trap", "便宜但需验证"
    if score >= 76 and value_score >= 70 and logic_risk_score < 55:
        return "top", "低估可定投"
    if score >= 64 or value_score >= 68:
        return "watch", "低估观察"
    return "fair", "暂不进入"


def analyze_candidate(candidate: Payload, risk_free_yield: float) -> Payload:
    pe = number(candidate.get("pe"))
    pb = number(candidate.get("pb"))
    pe_percentile = number(candidate.get("pePercentile"), 50)
    pb_percentile = number(candidate.get("pbPercentile"), 50)
    dividend_yield_value = number(candidate.get("dividendYield"))
    roe = number(candidate.get("roe"))
    quality_score = number(candidate.get("qualityScore"), 50)
    profit_trend_score = number(candidate.get("profitTrendScore"), 50)
    cycle_score = number(candidate.get("cycleScore"), 50)
    trend_confirmation_score = number(candidate.get("trendConfirmationScore"), 50)
    liquidity_score = number(candidate.get("liquidityScore"), 60)
    logic_risk_score = number(candidate.get("logicRiskScore"), 50)

    ey = earnings_yield(pe)
    ey_spread = ey - risk_free_yield
    value_score = clamp(
        percentile_discount(pe_percentile) * 0.3
        + percentile_discount(pb_percentile) * 0.22
        + dividend_score(dividend_yield_value) * 0.2
        + spread_score(ey_spread) * 0.18
        + clamp(roe * 4) * 0.1
    )
    quality_composite = clamp(quality_score * 0.5 + profit_trend_score * 0.3 + liquidity_score * 0.2)
    score = clamp(
        value_score * 0.42
        + quality_composite * 0.24
        + cycle_score * 0.18
        + trend_confirmation_score * 0.1
        + liquidity_score * 0.06
        - logic_risk_score * 0.22
    )
    margin_of_safety = clamp(value_score * 0.68 + spread_score(ey_spread) * 0.22 - logic_risk_score * 0.18)
    status_key, status = classify_status(value_score, score, logic_risk_score)
    stage = classify_stage(value_score, cycle_score, profit_trend_score, trend_confirmation_score)

    suggested_ratio = {
        "top": "核心/防守仓的5%-15%，分批定投",
        "watch": "观察仓0%-5%，等待盈利或资金确认",
        "trap": "0%-3%跟踪，不因便宜重仓",
        "fair": "暂不新增，等待估值或基本面改善",
    }[status_key]
    action = {
        "top": "可纳入低估值定投池，按月或按周分批",
        "watch": "先观察，等盈利修复或资金企稳后再提高",
        "trap": "便宜但逻辑有瑕疵，只做验证清单",
        "fair": "估值吸引力不足，不进入低估值池",
    }[status_key]
    reason = {
        "top": "估值分位、盈利收益率和质量指标同时具备安全边际。",
        "watch": "价格已有折价，但盈利周期或趋势确认还不充分。",
        "trap": "估值便宜，但需求、盈利或行业逻辑存在较大验证压力。",
        "fair": "当前折价不足，或风险调整后的赔率不够。",
    }[status_key]

    return {
        "candidateId": candidate.get("candidateId"),
        "name": candidate.get("name"),
        "category": candidate.get("category"),
        "representativeIndex": candidate.get("representativeIndex"),
        "representativeEtfs": candidate.get("representativeEtfs") or [],
        "pe": safe_round(pe, 2),
        "pb": safe_round(pb, 2),
        "pePercentile": round(pe_percentile),
        "pbPercentile": round(pb_percentile),
        "dividendYield": safe_round(dividend_yield_value, 2),
        "earningsYield": safe_round(ey, 2),
        "earningsYieldSpread": safe_round(ey_spread, 2),
        "roe": safe_round(roe, 2),
        "valueScore": round(value_score),
        "qualityScore": round(quality_composite),
        "cycleScore": round(cycle_score),
        "logicRiskScore": round(logic_risk_score),
        "marginOfSafety": round(margin_of_safety),
        "score": round(score),
        "stage": stage,
        "statusKey": status_key,
        "status": status,
        "suggestedRatio": suggested_ratio,
        "action": action,
        "reason": reason,
        "evidence": {
            "valuation": f"PE/PB 分位 {round(pe_percentile)}%/{round(pb_percentile)}%，盈利收益率 {ey:.1f}%，相对无风险收益率利差 {ey_spread:.1f}%。",
            "dividend": f"股息率 {dividend_yield_value:.1f}%，ROE {roe:.1f}%，质量/盈利趋势 {round(quality_composite)}/{round(profit_trend_score)} 分。",
            "cycle": f"周期修复 {round(cycle_score)} 分，趋势确认 {round(trend_confirmation_score)} 分。",
            "risk": f"逻辑风险 {round(logic_risk_score)} 分；{candidate.get('riskNote') or '需要继续跟踪盈利与估值。'}",
        },
        "source": candidate.get("source") or "内置估值样本，需要定期更新",
        "updatedAt": now_iso(),
    }


def fallback_payload(payload: Payload, mode: str = "fallback", message: str | None = None) -> Payload:
    fallback = deepcopy(payload.get("fallback") or {})
    fallback["mode"] = mode
    if message:
        fallback["message"] = message
    return fallback


def scan_low_valuation(payload: Payload) -> Payload:
    universe = payload.get("universe") if isinstance(payload.get("universe"), list) else []
    if not universe:
        return fallback_payload(payload, "fallback", "缺少低估值候选池，使用内置快照。")

    risk_free_yield = number(payload.get("riskFreeYield"), 2.2)
    results = [analyze_candidate(candidate, risk_free_yield) for candidate in universe]
    results.sort(key=lambda item: number(item.get("score")), reverse=True)

    return {
        "mode": "model",
        "source": "内置估值样本 + 低估值评分模型",
        "updatedAt": now_iso(),
        "riskFreeYield": risk_free_yield,
        "message": f"扫描 {len(results)} 个低估值候选，公式使用盈利收益率法、博格公式思想和估值分位约束。",
        "methodology": [
            "盈利收益率 = 100 / PE，用来和无风险收益率比较。",
            "安全边际来自 PE/PB 历史分位、股息率、盈利收益率利差和逻辑风险折扣。",
            "巴菲特/芒格/段永平思想：好生意、好价格、现金流、能力圈和长期赔率必须同时考虑。",
            "彼得林奇周期股框架：周期行业不能只看低PE，还要看供需、利润阶段和趋势确认。",
            "低估不等于买入；质量、盈利趋势、周期位置和逻辑风险会扣分。",
        ],
        "results": results,
    }
