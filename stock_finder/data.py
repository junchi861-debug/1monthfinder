from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pandas as pd


@dataclass(frozen=True)
class WatchItem:
    symbol: str
    name: str = ""


def load_watchlist(path: str | Path) -> list[WatchItem]:
    frame = pd.read_csv(path)
    if "symbol" not in frame.columns:
        raise ValueError("watchlist must contain a 'symbol' column")

    items: list[WatchItem] = []
    for row in frame.fillna("").to_dict("records"):
        symbol = str(row["symbol"]).strip()
        if symbol:
            items.append(WatchItem(symbol=symbol, name=str(row.get("name", "")).strip()))
    return items


def fetch_history(symbol: str, period: str = "18mo") -> pd.DataFrame:
    try:
        import yfinance as yf
    except ModuleNotFoundError as exc:
        raise RuntimeError("yfinance is required for live downloads. Run: pip install -r requirements.txt") from exc

    data = yf.download(
        symbol,
        period=period,
        auto_adjust=True,
        progress=False,
        threads=False,
    )
    if data.empty:
        raise ValueError(f"no price data returned for {symbol}")

    if isinstance(data.columns, pd.MultiIndex):
        data.columns = data.columns.get_level_values(0)

    data = data.rename(columns={column: column.lower().replace(" ", "_") for column in data.columns})
    required = {"open", "high", "low", "close", "volume"}
    missing = required.difference(data.columns)
    if missing:
        raise ValueError(f"{symbol} is missing columns: {', '.join(sorted(missing))}")

    return data.dropna(subset=["close"]).copy()
