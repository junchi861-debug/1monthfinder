from __future__ import annotations

import numpy as np
import pandas as pd


def pct_return(close: pd.Series, window: int) -> float:
    if len(close) <= window:
        return np.nan
    return float(close.iloc[-1] / close.iloc[-window - 1] - 1)


def annualized_volatility(close: pd.Series, window: int = 21) -> float:
    returns = close.pct_change().dropna().tail(window)
    if returns.empty:
        return np.nan
    return float(returns.std() * np.sqrt(252))


def max_drawdown(close: pd.Series, window: int = 63) -> float:
    sample = close.tail(window)
    if sample.empty:
        return np.nan
    peak = sample.cummax()
    drawdown = sample / peak - 1
    return float(drawdown.min())


def rsi(close: pd.Series, window: int = 14) -> float:
    delta = close.diff()
    gains = delta.clip(lower=0)
    losses = -delta.clip(upper=0)
    if len(close) <= window:
        return np.nan

    avg_gain = gains.ewm(alpha=1 / window, adjust=False, min_periods=window).mean()
    avg_loss = losses.ewm(alpha=1 / window, adjust=False, min_periods=window).mean()
    latest_gain = float(avg_gain.iloc[-1])
    latest_loss = float(avg_loss.iloc[-1])
    if np.isnan(latest_gain) or np.isnan(latest_loss):
        return np.nan
    if latest_loss == 0:
        return 50.0 if latest_gain == 0 else 100.0
    if latest_gain == 0:
        return 0.0
    rs = latest_gain / latest_loss
    return float(100 - (100 / (1 + rs)))


def average_traded_value(close: pd.Series, volume: pd.Series, window: int = 21) -> float:
    traded_value = (close * volume).tail(window)
    if traded_value.empty:
        return np.nan
    return float(traded_value.mean())
