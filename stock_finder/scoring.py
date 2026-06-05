from __future__ import annotations

import math

import numpy as np
import pandas as pd

from stock_finder.indicators import (
    annualized_volatility,
    average_traded_value,
    max_drawdown,
    pct_return,
    rsi,
)


def _clip_score(value: float, low: float, high: float) -> float:
    if math.isnan(value) or math.isinf(value) or high == low:
        return 0.0
    return float(np.clip((value - low) / (high - low), 0, 1))


def _inverse_clip_score(value: float, low: float, high: float) -> float:
    if math.isnan(value) or math.isinf(value) or high == low:
        return 0.0
    return 1 - _clip_score(value, low, high)


def score_history(history: pd.DataFrame) -> dict[str, float | str]:
    close = history["close"]
    volume = history["volume"]

    ret_21d = pct_return(close, 21)
    ret_63d = pct_return(close, 63)
    vol_21d = annualized_volatility(close, 21)
    drawdown_63d = max_drawdown(close, 63)
    rsi_14 = rsi(close, 14)
    traded_value_21d = average_traded_value(close, volume, 21)

    momentum_score = 0.6 * _clip_score(ret_21d, -0.03, 0.12) + 0.4 * _clip_score(ret_63d, -0.08, 0.25)
    risk_score = 0.55 * _inverse_clip_score(vol_21d, 0.18, 0.75) + 0.45 * _clip_score(drawdown_63d, -0.30, -0.03)
    rsi_score = 1 - abs((rsi_14 if not math.isnan(rsi_14) else 50) - 55) / 55
    liquidity_score = _clip_score(math.log10(traded_value_21d) if traded_value_21d > 0 else np.nan, 6, 9)

    legacy_score = 100 * (
        0.45 * momentum_score
        + 0.30 * risk_score
        + 0.15 * liquidity_score
        + 0.10 * np.clip(rsi_score, 0, 1)
    )

    score = legacy_score
    action = "candidate" if score >= 70 else "watch" if score >= 55 else "avoid"
    configured_parts = _configured_one_month_score(history)
    score_basis = "legacy_score_history"
    if configured_parts is not None:
        score = float(configured_parts["score"])
        action = str(configured_parts["expected_action"])
        score_basis = str(configured_parts["score_basis"])

    result = {
        "score": round(float(score), 2),
        "legacy_score": round(float(legacy_score), 2),
        "score_basis": score_basis,
        "expected_action": action,
        "last_close": round(float(close.iloc[-1]), 4),
        "ret_21d": round(float(ret_21d), 4),
        "ret_63d": round(float(ret_63d), 4),
        "vol_21d": round(float(vol_21d), 4),
        "max_drawdown_63d": round(float(drawdown_63d), 4),
        "rsi_14": round(float(rsi_14), 2),
        "traded_value_21d": round(float(traded_value_21d), 2),
        "liquidity_score": round(float(liquidity_score), 4),
    }
    if configured_parts is not None:
        result.update(configured_parts["component_scores"])
    return result


def _configured_one_month_score(history: pd.DataFrame) -> dict[str, object] | None:
    try:
        from stock_finder.market_report import _action_for_row, _features_at, _period_score
    except Exception:
        return None

    try:
        features = _features_at(history, len(history) - 1)
        score_parts = _period_score("1m", features, "balanced")
        row = {**features, **score_parts}
        action = _action_for_row(row, "1m", "balanced")
    except Exception:
        return None

    return {
        "score": float(score_parts["score"]),
        "expected_action": action,
        "score_basis": "market_signals:1m:balanced",
        "component_scores": {
            "momentum_score": score_parts["momentum_score"],
            "risk_score": score_parts["risk_score"],
            "liquidity_score": score_parts["liquidity_score"],
            "issue_score": score_parts["issue_score"],
            "trend_score": score_parts["trend_score"],
            "market_regime": features.get("market_regime"),
        },
    }
