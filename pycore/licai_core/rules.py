from __future__ import annotations

from math import isfinite
from typing import Any, Callable


StrategyTemplate = dict[str, float]
Payload = dict[str, Any]


STRATEGY_TEMPLATES: dict[str, StrategyTemplate] = {
    "conservative": {"chinaCore": 0.2, "globalCore": 0.2, "defensive": 0.45, "satellite": 0.05, "reserve": 0.1},
    "balanced": {"chinaCore": 0.25, "globalCore": 0.25, "defensive": 0.25, "satellite": 0.15, "reserve": 0.1},
    "growth": {"chinaCore": 0.25, "globalCore": 0.3, "defensive": 0.15, "satellite": 0.2, "reserve": 0.1},
    "dividend": {"chinaCore": 0.2, "globalCore": 0.2, "defensive": 0.45, "satellite": 0.05, "reserve": 0.1},
    "usCore": {"chinaCore": 0.2, "globalCore": 0.35, "defensive": 0.2, "satellite": 0.15, "reserve": 0.1},
    "mainline": {"chinaCore": 0.25, "globalCore": 0.25, "defensive": 0.25, "satellite": 0.15, "reserve": 0.1},
}

BUCKET_LABELS = {
    "chinaCore": "A股核心宽基",
    "globalCore": "美股/全球核心宽基",
    "defensive": "防御仓",
    "satellite": "产业增强/主线机会",
    "reserve": "等待资金",
}

ORDERED_BUCKETS = ["chinaCore", "globalCore", "defensive", "satellite"]

STATE_REASONS = {
    "cheap": "估值有安全边际，可以提高买入速度，但仍保留分批原则。",
    "fair": "价格接近合理区间，保持原计划执行。",
    "expensive": "安全边际下降，降低新增资金，避免情绪追高。",
    "high": "估值已经偏高，只保留参与权，等待回调恢复正常定投。",
    "overheated": "热度和估值都偏高，新增资金以等待为主。",
    "broken": "产业或盈利逻辑破坏，不因为价格便宜而自动买入。",
}


def number(value: Any, default: float = 0.0) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return default
    return result if isfinite(result) else default


def get_dca_multiplier(state: str) -> float:
    if state == "cheap":
        return 1.5
    if state == "fair":
        return 1.0
    if state == "expensive":
        return 0.5
    if state == "high":
        return 0.3
    if state == "overheated":
        return 0.1
    return 0.0


def get_state_reason(state: str) -> str:
    return STATE_REASONS.get(state, STATE_REASONS["broken"])


def get_execution_frequency(monthly_amount: float, volatility: str) -> str:
    if monthly_amount <= 1000:
        return "monthly"
    if monthly_amount <= 5000:
        return "weekly"
    if volatility == "high":
        return "daily"
    return "weekly"


def generate_monthly_plan(payload: Payload) -> Payload:
    monthly_amount = number(payload.get("monthlyAmount"))
    style = str(payload.get("style") or "balanced")
    states = payload.get("states") if isinstance(payload.get("states"), dict) else {}
    volatility = str(payload.get("volatility") or "medium")
    overrides = payload.get("overrides") if isinstance(payload.get("overrides"), dict) else {}
    template = STRATEGY_TEMPLATES.get(style, STRATEGY_TEMPLATES["balanced"])

    lines: list[Payload] = []
    for key in ORDERED_BUCKETS:
        ratio = number(template.get(key))
        state = str(states.get(key) or "fair")
        override = overrides.get(key) if isinstance(overrides.get(key), dict) else None
        target_amount = monthly_amount * ratio
        multiplier = (
            number(override.get("multiplier")) if override and "multiplier" in override else 1.0 if key == "defensive" and state == "cheap" else get_dca_multiplier(state)
        )
        actual_buy = max(0.0, target_amount * multiplier)
        deferred = max(0.0, target_amount - actual_buy)

        lines.append(
            {
                "key": key,
                "name": BUCKET_LABELS[key],
                "ratio": ratio,
                "state": state,
                "targetAmount": target_amount,
                "actualBuy": actual_buy,
                "deferred": deferred,
                "reason": override.get("reason") if override and override.get("reason") else get_state_reason(state),
            }
        )

    deferred_total = sum(number(item.get("deferred")) for item in lines)
    base_reserve = monthly_amount * number(template.get("reserve"))
    total_buy = sum(number(item.get("actualBuy")) for item in lines)

    return {
        "totalMonthlyAmount": monthly_amount,
        "executionFrequency": get_execution_frequency(monthly_amount, volatility),
        "totalBuy": total_buy,
        "reserve": base_reserve + deferred_total,
        "lines": lines,
        "explanations": [
            "月度只决定一次策略，执行可以按周或按日拆分，避免每天被情绪带着改计划。",
            "未买入的资金进入等待资金，不强行投入同一板块。",
            "宽基负责长期定投，产业增强可以低速定投，热点主线只做触发式建仓。",
        ],
    }


def get_harvest_plan(payload: Payload) -> Payload:
    start_principal = number(payload.get("startPrincipal"))
    annual_contribution = number(payload.get("annualContribution"))
    end_value = number(payload.get("endValue"))
    valuation_percentile = number(payload.get("valuationPercentile"))
    current_weight = number(payload.get("currentWeight"))
    target_weight = number(payload.get("targetWeight"))
    original_monthly_dca = number(payload.get("originalMonthlyDca"))

    profit = max(0.0, end_value - start_principal - annual_contribution)
    is_over_target = current_weight > target_weight * 1.2
    harvest_ratio = 0.0
    reason = "年度收益或估值条件不足，不机械收割。"

    if profit > 0 and valuation_percentile < 40:
        harvest_ratio = 0.1
        reason = "有浮盈但估值仍低，只象征性收割，保留复利。"
    elif profit > annual_contribution * 0.08 and valuation_percentile >= 55:
        harvest_ratio = 0.4
        reason = "年度收益较好且估值合理偏高，可收割部分收益平滑下一年现金流。"

    if valuation_percentile >= 70:
        harvest_ratio = max(harvest_ratio, 0.6)
        reason = "估值分位较高，适合把部分浮盈转为下一年定投资金。"

    if valuation_percentile >= 85 and is_over_target:
        harvest_ratio = 0.8
        reason = "估值过热且仓位超标，收益收割可叠加再平衡。"

    harvest_amount = profit * harvest_ratio
    monthly_boost = harvest_amount / 12

    return {
        "profit": profit,
        "harvestRatio": harvest_ratio,
        "harvestAmount": harvest_amount,
        "monthlyBoost": monthly_boost,
        "nextYearMonthlyDca": original_monthly_dca + monthly_boost,
        "reason": reason,
        "risk": "如果市场进入单边牛市，过早收割可能降低复利，因此该策略只作为A股增强模块。",
    }


def get_portfolio_health(payload: Payload) -> Payload:
    holdings = {
        "chinaCore": number(payload.get("chinaCore")),
        "globalCore": number(payload.get("globalCore")),
        "defensive": number(payload.get("defensive")),
        "satellite": number(payload.get("satellite")),
        "reserve": number(payload.get("reserve")),
    }
    total = sum(holdings.values())
    weights = {key: value / total if total else 0.0 for key, value in holdings.items()}

    warnings: list[str] = []
    if weights["satellite"] > 0.25:
        warnings.append("卫星仓超过25%，主题风险偏高，建议回到目标仓位。")
    if weights["chinaCore"] + weights["globalCore"] < 0.4:
        warnings.append("核心仓不足，组合可能过度依赖主题或短期风格。")
    if weights["reserve"] < 0.05:
        warnings.append("等待资金不足，市场回调时可用资金偏少。")
    if weights["defensive"] < 0.15:
        warnings.append("防御仓较低，组合回撤承受压力会更大。")

    return {
        "total": total,
        "weights": weights,
        "status": "需要调整" if warnings else "结构均衡",
        "warnings": warnings,
    }


def get_sell_plan(payload: Payload) -> Payload:
    total_assets = number(payload.get("totalAssets"))
    current_amount = number(payload.get("currentAmount"))
    target_weight = number(payload.get("targetWeight"))
    base_ratio = number(payload.get("baseRatio"))
    heat_score = number(payload.get("heatScore"))
    fund_price = number(payload.get("fundPrice"))

    target_amount = total_assets * target_weight
    base_amount = target_amount * base_ratio
    overweight = current_amount - target_amount
    sellable = current_amount - base_amount
    suggested_sell = max(0.0, min(overweight, sellable))

    if suggested_sell <= 0:
        return {
            "needSell": False,
            "targetAmount": target_amount,
            "baseAmount": base_amount,
            "suggestedSell": 0,
            "message": "当前没有明显超配，不建议为了猜顶部而卖出。",
        }

    days = 20 if heat_score >= 85 else 40 if heat_score >= 70 else 60
    daily_sell_amount = suggested_sell / days
    daily_shares = daily_sell_amount / fund_price if fund_price > 0 else 0

    return {
        "needSell": True,
        "targetAmount": target_amount,
        "baseAmount": base_amount,
        "suggestedSell": suggested_sell,
        "days": days,
        "dailySellAmount": daily_sell_amount,
        "dailyShares": daily_shares,
        "weeklySellAmount": daily_sell_amount * 5,
        "monthlySellAmount": suggested_sell,
        "stopAtAmount": max(target_amount, base_amount),
        "message": "严重超配且热度较高，可采用日度分批卖出。" if heat_score >= 85 else "仓位超目标，优先用周度或月度再平衡。",
    }


def get_valuation_trade(payload: Payload) -> Payload:
    return {
        "multiplier": get_dca_multiplier(str(payload.get("state") or "broken")),
        "sellPlan": get_sell_plan(payload),
    }


ActionHandler = Callable[[Payload], Any]

ACTIONS: dict[str, ActionHandler] = {
    "dca_multiplier": lambda payload: get_dca_multiplier(str(payload.get("state") or "broken")),
    "monthly_plan": generate_monthly_plan,
    "harvest_plan": get_harvest_plan,
    "portfolio_health": get_portfolio_health,
    "sell_plan": get_sell_plan,
    "valuation_trade": get_valuation_trade,
}


def dispatch_rule(action: str, payload: Payload) -> Any:
    handler = ACTIONS.get(action)
    if not handler:
        raise ValueError(f"Unknown rule action: {action}")
    return handler(payload)

