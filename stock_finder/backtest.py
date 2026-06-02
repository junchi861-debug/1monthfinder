from __future__ import annotations

import pandas as pd

from stock_finder.scoring import score_history


def walk_forward_scores(
    symbol: str,
    history: pd.DataFrame,
    lookback_days: int = 90,
    holding_days: int = 21,
    step_days: int = 21,
    embargo_days: int = 0,
) -> pd.DataFrame:
    rows: list[dict[str, float | str]] = []
    embargo_days = max(0, int(embargo_days))
    if len(history) < lookback_days + embargo_days + holding_days + 1:
        return pd.DataFrame(rows)

    for end in range(lookback_days + embargo_days, len(history) - holding_days, step_days):
        train_end = end - embargo_days
        train = history.iloc[train_end - lookback_days : train_end]
        entry_close = float(history["close"].iloc[end])
        exit_close = float(history["close"].iloc[end + holding_days])
        forward_return = exit_close / entry_close - 1

        row = score_history(train)
        row.update(
            {
                "symbol": symbol,
                "as_of": str(history.index[train_end - 1].date()),
                "entry_date": str(history.index[end].date()),
                "exit_date": str(history.index[end + holding_days].date()),
                "entry_close": round(entry_close, 4),
                "exit_close": round(exit_close, 4),
                "forward_21d_return": round(forward_return, 4),
                "embargo_days": embargo_days,
            }
        )
        rows.append(row)

    return pd.DataFrame(rows)
