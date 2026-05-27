from __future__ import annotations

import pandas as pd

from stock_finder.scoring import score_history


def walk_forward_scores(
    symbol: str,
    history: pd.DataFrame,
    lookback_days: int = 90,
    holding_days: int = 21,
    step_days: int = 21,
) -> pd.DataFrame:
    rows: list[dict[str, float | str]] = []
    if len(history) < lookback_days + holding_days + 1:
        return pd.DataFrame(rows)

    for end in range(lookback_days, len(history) - holding_days, step_days):
        train = history.iloc[:end]
        entry_close = float(history["close"].iloc[end])
        exit_close = float(history["close"].iloc[end + holding_days])
        forward_return = exit_close / entry_close - 1

        row = score_history(train)
        row.update(
            {
                "symbol": symbol,
                "as_of": str(history.index[end].date()),
                "exit_date": str(history.index[end + holding_days].date()),
                "entry_close": round(entry_close, 4),
                "exit_close": round(exit_close, 4),
                "forward_21d_return": round(forward_return, 4),
            }
        )
        rows.append(row)

    return pd.DataFrame(rows)
