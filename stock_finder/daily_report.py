from __future__ import annotations

import csv
import json
import math
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd

from stock_finder.data import WatchItem, fetch_history, load_watchlist
from stock_finder.scoring import score_history


TIMEZONE = "Asia/Seoul"
HOLDING_DAYS = 21
PRICE_HISTORY_DAYS = 260
MIN_HISTORY_DAYS = 90

PIPELINE_RULES = [
    {
        "id": "universe",
        "label": "모데이터",
        "description": "watchlist에 들어 있는 전체 관심 종목입니다.",
    },
    {
        "id": "data_ready",
        "label": "가격 데이터 확보",
        "description": "최근 가격과 거래량을 내려받은 종목만 남깁니다.",
    },
    {
        "id": "liquidity",
        "label": "유동성 통과",
        "description": "최근 평균 거래대금이 너무 작지 않은 종목만 남깁니다.",
    },
    {
        "id": "risk",
        "label": "리스크 통과",
        "description": "단기 변동성과 최근 최대 낙폭이 과도하지 않은 종목만 남깁니다.",
    },
    {
        "id": "momentum",
        "label": "모멘텀 통과",
        "description": "최근 1개월과 3개월 흐름이 기준 이상인 종목만 남깁니다.",
    },
    {
        "id": "final_score",
        "label": "최종 후보",
        "description": "종합 점수 70점 이상인 1개월 보유 후보입니다.",
    },
]

FILTERS = {
    "min_liquidity_score": 0.35,
    "max_vol_21d": 0.90,
    "min_drawdown_63d": -0.35,
    "min_ret_21d": -0.03,
    "min_ret_63d": -0.08,
    "candidate_score": 70,
    "watch_score": 55,
}

SCORE_WEIGHTS = {
    "momentum": 0.45,
    "risk": 0.30,
    "liquidity": 0.15,
    "rsi_balance": 0.10,
}


@dataclass(frozen=True)
class ReportData:
    latest: dict[str, object]
    history: dict[str, object]
    prices: dict[str, object]


def build_daily_site_data(
    watchlist_path: str | Path = "config/watchlist.csv",
    out_dir: str | Path = "site/data",
    period: str = "18mo",
) -> ReportData:
    items = load_watchlist(watchlist_path)
    generated_at = datetime.now(ZoneInfo(TIMEZONE)).replace(microsecond=0)

    rows: list[dict[str, object]] = []
    histories: dict[str, pd.DataFrame] = {}

    for item in items:
        row: dict[str, object] = {"symbol": item.symbol, "name": item.name}
        try:
            history = fetch_history(item.symbol, period=period)
            histories[item.symbol] = history
            row.update(score_history(history))
            row["as_of"] = _date_string(history.index[-1])
            row["source_rows"] = int(len(history))
        except Exception as exc:
            row.update(
                {
                    "score": None,
                    "expected_action": "error",
                    "final_action": "error",
                    "as_of": None,
                    "source_rows": 0,
                    "error": str(exc),
                }
            )
        rows.append(_clean(row))

    rows = _rank_and_explain(rows)
    funnel = _build_funnel(rows)
    latest = _build_latest(generated_at, items, rows, funnel)
    history = _build_score_history(generated_at, items, histories)
    prices = _build_price_history(generated_at, items, histories)

    out_path = Path(out_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    _write_json(out_path / "latest.json", latest)
    _write_json(out_path / "history.json", history)
    _write_json(out_path / "prices.json", prices)
    _write_csv(out_path / "candidates.csv", rows)

    return ReportData(latest=latest, history=history, prices=prices)


def _rank_and_explain(rows: list[dict[str, object]]) -> list[dict[str, object]]:
    rows = sorted(rows, key=lambda row: (row.get("score") is None, -(float(row.get("score") or 0))))

    rank = 1
    for row in rows:
        row["pipeline"] = _row_pipeline(row)
        row["final_action"] = _final_action(row)
        row["stop_stage"] = _stop_stage(row)
        row["reason"] = _reason(row)
        if row.get("score") is not None:
            row["rank"] = rank
            rank += 1
        else:
            row["rank"] = None

    return rows


def _build_latest(
    generated_at: datetime,
    items: list[WatchItem],
    rows: list[dict[str, object]],
    funnel: list[dict[str, object]],
) -> dict[str, object]:
    valid_rows = [row for row in rows if row.get("score") is not None]
    candidates = [row for row in rows if row.get("final_action") == "candidate"]
    watch = [row for row in rows if row.get("final_action") == "watch"]
    avoid = [row for row in rows if row.get("final_action") == "avoid"]
    errors = [row for row in rows if row.get("final_action") == "error"]

    summary = {
        "generated_date": generated_at.date().isoformat(),
        "generated_at": generated_at.isoformat(),
        "timezone": TIMEZONE,
        "as_of": max((str(row["as_of"]) for row in valid_rows if row.get("as_of")), default=None),
        "universe_count": len(items),
        "data_ready_count": len(valid_rows),
        "candidate_count": len(candidates),
        "watch_count": len(watch),
        "avoid_count": len(avoid),
        "error_count": len(errors),
        "top_symbol": candidates[0]["symbol"] if candidates else None,
        "top_name": candidates[0]["name"] if candidates else None,
        "top_score": candidates[0]["score"] if candidates else None,
        "average_score": round(float(np.mean([float(row["score"]) for row in valid_rows])), 2) if valid_rows else None,
    }

    return {
        "generated_at": generated_at.isoformat(),
        "timezone": TIMEZONE,
        "holding_days": HOLDING_DAYS,
        "score_weights": SCORE_WEIGHTS,
        "filters": FILTERS,
        "pipeline_rules": PIPELINE_RULES,
        "summary": summary,
        "raw_universe": [{"symbol": item.symbol, "name": item.name} for item in items],
        "funnel": funnel,
        "top_candidates": candidates[:10],
        "watch": watch[:10],
        "rows": rows,
    }


def _build_score_history(
    generated_at: datetime,
    items: list[WatchItem],
    histories: dict[str, pd.DataFrame],
) -> dict[str, object]:
    history_rows: list[dict[str, object]] = []
    names = {item.symbol: item.name for item in items}

    for symbol, history in histories.items():
        if len(history) < MIN_HISTORY_DAYS:
            continue

        start = max(MIN_HISTORY_DAYS, len(history) - PRICE_HISTORY_DAYS)
        for position in range(start, len(history)):
            sample = history.iloc[: position + 1]
            try:
                row = score_history(sample)
                row.update(
                    {
                        "date": _date_string(sample.index[-1]),
                        "symbol": symbol,
                        "name": names.get(symbol, ""),
                        "as_of": _date_string(sample.index[-1]),
                    }
                )
                row = _clean(row)
                row["pipeline"] = _row_pipeline(row)
                row["final_action"] = _final_action(row)
                history_rows.append(row)
            except Exception:
                continue

    snapshots = []
    if history_rows:
        frame = pd.DataFrame(history_rows)
        for date, group in frame.groupby("date", sort=True):
            valid_scores = group["score"].dropna().astype(float)
            sorted_group = group.sort_values("score", ascending=False, na_position="last")
            top = sorted_group.iloc[0] if not sorted_group.empty else None
            snapshots.append(
                {
                    "date": str(date),
                    "candidate_count": int((group["final_action"] == "candidate").sum()),
                    "watch_count": int((group["final_action"] == "watch").sum()),
                    "avoid_count": int((group["final_action"] == "avoid").sum()),
                    "top_symbol": str(top["symbol"]) if top is not None else None,
                    "top_score": round(float(top["score"]), 2) if top is not None and pd.notna(top["score"]) else None,
                    "average_score": round(float(valid_scores.mean()), 2) if not valid_scores.empty else None,
                    "scored_count": int(len(valid_scores)),
                }
            )

    return {
        "generated_at": generated_at.isoformat(),
        "timezone": TIMEZONE,
        "lookback_trading_days": PRICE_HISTORY_DAYS,
        "snapshots": _clean(snapshots[-PRICE_HISTORY_DAYS:]),
        "rows": _clean(history_rows),
    }


def _build_price_history(
    generated_at: datetime,
    items: list[WatchItem],
    histories: dict[str, pd.DataFrame],
) -> dict[str, object]:
    symbols: dict[str, object] = {}
    names = {item.symbol: item.name for item in items}

    for symbol, history in histories.items():
        prices = []
        sample = history.tail(PRICE_HISTORY_DAYS)
        for index, row in sample.iterrows():
            close = row.get("close")
            volume = row.get("volume")
            if pd.isna(close):
                continue
            prices.append(
                {
                    "date": _date_string(index),
                    "close": round(float(close), 4),
                    "volume": int(volume) if pd.notna(volume) else None,
                }
            )

        symbols[symbol] = {
            "name": names.get(symbol, ""),
            "prices": prices,
        }

    return {
        "generated_at": generated_at.isoformat(),
        "timezone": TIMEZONE,
        "lookback_trading_days": PRICE_HISTORY_DAYS,
        "symbols": _clean(symbols),
    }


def _row_pipeline(row: dict[str, object]) -> list[dict[str, object]]:
    reached = True
    stages = []
    for rule in PIPELINE_RULES:
        if not reached:
            status = "not_reached"
        else:
            passed = _passes(rule["id"], row)
            status = "pass" if passed else "fail"
            if not passed:
                reached = False

        stages.append(
            {
                "id": rule["id"],
                "label": rule["label"],
                "status": status,
            }
        )

    return stages


def _build_funnel(rows: list[dict[str, object]]) -> list[dict[str, object]]:
    remaining = rows[:]
    funnel = []

    for rule in PIPELINE_RULES:
        before = len(remaining)
        passed_rows = [row for row in remaining if _passes(rule["id"], row)]
        passed_symbols = {str(row["symbol"]) for row in passed_rows}
        failed_rows = [row for row in remaining if str(row["symbol"]) not in passed_symbols]

        funnel.append(
            {
                "id": rule["id"],
                "label": rule["label"],
                "description": rule["description"],
                "before_count": before,
                "count": len(passed_rows),
                "drop_count": before - len(passed_rows),
                "symbols": [str(row["symbol"]) for row in passed_rows],
                "dropped_symbols": [str(row["symbol"]) for row in failed_rows],
            }
        )
        remaining = passed_rows

    return funnel


def _passes(stage_id: str, row: dict[str, object]) -> bool:
    if stage_id == "universe":
        return True
    if stage_id == "data_ready":
        return row.get("score") is not None and not row.get("error")
    if stage_id == "liquidity":
        return _number(row.get("liquidity_score")) >= FILTERS["min_liquidity_score"]
    if stage_id == "risk":
        return (
            _number(row.get("vol_21d"), default=999) <= FILTERS["max_vol_21d"]
            and _number(row.get("max_drawdown_63d"), default=-999) >= FILTERS["min_drawdown_63d"]
        )
    if stage_id == "momentum":
        return (
            _number(row.get("ret_21d"), default=-999) >= FILTERS["min_ret_21d"]
            and _number(row.get("ret_63d"), default=-999) >= FILTERS["min_ret_63d"]
        )
    if stage_id == "final_score":
        return _number(row.get("score")) >= FILTERS["candidate_score"]
    raise ValueError(f"unknown pipeline stage: {stage_id}")


def _final_action(row: dict[str, object]) -> str:
    if row.get("score") is None or row.get("error"):
        return "error"
    pipeline = row.get("pipeline") or _row_pipeline(row)
    final_stage = pipeline[-1]
    if final_stage["status"] == "pass":
        return "candidate"
    if _passes("data_ready", row) and _passes("liquidity", row) and _number(row.get("score")) >= FILTERS["watch_score"]:
        return "watch"
    return "avoid"


def _stop_stage(row: dict[str, object]) -> str | None:
    pipeline = row.get("pipeline") or _row_pipeline(row)
    for stage in pipeline:
        if stage["status"] == "fail":
            return str(stage["id"])
    return None


def _reason(row: dict[str, object]) -> str:
    action = row.get("final_action")
    if action == "error":
        return "가격 데이터를 확보하지 못했습니다."
    if action == "candidate":
        return "최종 후보: 점수, 모멘텀, 리스크 필터를 모두 통과했습니다."

    stop_stage = row.get("stop_stage")
    if stop_stage == "liquidity":
        return "유동성 기준을 통과하지 못했습니다."
    if stop_stage == "risk":
        return "변동성 또는 최대 낙폭이 기준보다 큽니다."
    if stop_stage == "momentum":
        return "최근 1개월 또는 3개월 모멘텀이 약합니다."
    if stop_stage == "final_score":
        return "필터는 통과했지만 최종 점수가 70점 미만입니다."
    return "관찰 또는 제외 대상입니다."


def _number(value: object, default: float = 0.0) -> float:
    if value is None:
        return default
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    if math.isnan(number) or math.isinf(number):
        return default
    return number


def _date_string(value: object) -> str:
    if hasattr(value, "date"):
        return value.date().isoformat()
    return str(value)[:10]


def _clean(value: object) -> object:
    if isinstance(value, dict):
        return {key: _clean(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_clean(item) for item in value]
    if isinstance(value, tuple):
        return [_clean(item) for item in value]
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        value = float(value)
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if pd.isna(value) if not isinstance(value, (str, bytes)) else False:
        return None
    return value


def _write_json(path: Path, data: dict[str, object]) -> None:
    path.write_text(json.dumps(_clean(data), ensure_ascii=False, indent=2, allow_nan=False), encoding="utf-8")


def _write_csv(path: Path, rows: list[dict[str, object]]) -> None:
    fields = [
        "rank",
        "symbol",
        "name",
        "final_action",
        "score",
        "reason",
        "as_of",
        "last_close",
        "ret_21d",
        "ret_63d",
        "vol_21d",
        "max_drawdown_63d",
        "rsi_14",
        "traded_value_21d",
        "liquidity_score",
        "source_rows",
        "error",
    ]
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow(_clean(row))
