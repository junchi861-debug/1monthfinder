from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

from stock_finder.backtest import walk_forward_scores
from stock_finder.data import fetch_history, load_watchlist
from stock_finder.scoring import score_history


def _ensure_parent(path: str | Path) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)


def build_candidates(args: argparse.Namespace) -> None:
    rows: list[dict[str, object]] = []
    for item in load_watchlist(args.watchlist):
        try:
            history = fetch_history(item.symbol, period=args.period)
            row = score_history(history)
            row.update({"symbol": item.symbol, "name": item.name})
            rows.append(row)
        except Exception as exc:
            rows.append({"symbol": item.symbol, "name": item.name, "error": str(exc)})

    frame = pd.DataFrame(rows)
    if "score" in frame.columns:
        frame = frame.sort_values("score", ascending=False, na_position="last")

    _ensure_parent(args.out)
    frame.to_csv(args.out, index=False, encoding="utf-8-sig")
    print(f"saved {len(frame)} rows to {args.out}")


def build_backtest(args: argparse.Namespace) -> None:
    frames: list[pd.DataFrame] = []
    for item in load_watchlist(args.watchlist):
        try:
            history = fetch_history(item.symbol, period=args.period)
            frame = walk_forward_scores(
                item.symbol,
                history,
                lookback_days=args.lookback_days,
                holding_days=args.holding_days,
                step_days=args.step_days,
            )
            if not frame.empty:
                frame["name"] = item.name
                frames.append(frame)
        except Exception as exc:
            frames.append(pd.DataFrame([{"symbol": item.symbol, "name": item.name, "error": str(exc)}]))

    result = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()
    _ensure_parent(args.out)
    result.to_csv(args.out, index=False, encoding="utf-8-sig")
    print(f"saved {len(result)} rows to {args.out}")


def make_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Find one-month stock trade candidates.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    candidates = subparsers.add_parser("candidates", help="score current one-month candidates")
    candidates.add_argument("--watchlist", default="config/watchlist.csv")
    candidates.add_argument("--period", default="18mo")
    candidates.add_argument("--out", default="reports/candidates.csv")
    candidates.set_defaults(func=build_candidates)

    backtest = subparsers.add_parser("backtest", help="run simple walk-forward validation")
    backtest.add_argument("--watchlist", default="config/watchlist.csv")
    backtest.add_argument("--period", default="3y")
    backtest.add_argument("--lookback-days", type=int, default=90)
    backtest.add_argument("--holding-days", type=int, default=21)
    backtest.add_argument("--step-days", type=int, default=21)
    backtest.add_argument("--out", default="reports/backtest.csv")
    backtest.set_defaults(func=build_backtest)

    return parser


def main() -> None:
    parser = make_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
