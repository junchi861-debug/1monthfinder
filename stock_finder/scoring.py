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
    if math.isnan(value):
        return 0.0
    return float(np.clip((value - low) / (high - low), 0, 1))


def _inverse_clip_score(value: float, low: float, high: float) -> float:
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

    score = 100 * (
        0.45 * momentum_score
        + 0.30 * risk_score
        + 0.15 * liquidity_score
        + 0.10 * np.clip(rsi_score, 0, 1)
    )

    if score >= 70:
        action = "candidate"
    elif score >= 55:
        action = "watch"
    else:
        action = "avoid"

    return {
        "score": round(float(score), 2),
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
