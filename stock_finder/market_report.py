from __future__ import annotations

import json
import math
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd


TIMEZONE = "Asia/Seoul"
TRADING_DAYS_PER_YEAR = 252

PERIODS: dict[str, dict[str, object]] = {
    "1d": {
        "label": "1일",
        "holding_days": 1,
        "min_lookback": 40,
        "step": 5,
        "description": "하루 단위 단기 관심도, 거래대금 급증, 짧은 모멘텀을 봅니다.",
    },
    "1w": {
        "label": "1주",
        "holding_days": 5,
        "min_lookback": 60,
        "step": 5,
        "description": "1주 보유를 전제로 5일/20일 흐름과 거래량 확산을 봅니다.",
    },
    "1m": {
        "label": "1달",
        "holding_days": 21,
        "min_lookback": 90,
        "step": 10,
        "description": "21거래일 보유를 전제로 1개월/3개월 모멘텀과 낙폭을 봅니다.",
    },
    "1y": {
        "label": "1년",
        "holding_days": 252,
        "min_lookback": 280,
        "step": 21,
        "description": "1년 보유를 전제로 장기 추세, 저변동성, 유동성을 봅니다.",
    },
}

ASSET_CLASSES = {
    "kr": {
        "label": "국내 주식",
        "status": "active",
        "source": "FinanceDataReader KRX listing and daily prices",
    },
    "us": {
        "label": "미국 주식",
        "status": "planned",
        "source": "SEC/Nasdaq universe, earnings, options, social attention",
    },
    "crypto": {
        "label": "코인",
        "status": "planned",
        "source": "Upbit KRW markets, CoinGecko categories, funding/open-interest feeds",
    },
}

VALIDATED_FILTERS = [
    "유동성: 거래대금과 거래량이 충분한 종목만 우선 분석",
    "모멘텀: 최근 수익률과 상대강도 기반 점수",
    "추세: 이동평균과 52주 고점 근접도",
    "저변동성: 단기 급등락과 최대 낙폭 페널티",
    "거래비용 반영: 백테스트 수익률에서 비용 차감",
    "동일 규칙 검증: 과거 시점에서도 같은 필터와 점수로 거래 성과 산출",
]

ISSUE_FILTERS = [
    "커뮤니티형 관심도 대리변수: 거래대금 급증, 거래량 급증, 신고가 근접",
    "급등 이슈 감지: 1일/1주 수익률과 거래량 동반 상승",
    "테마 확산 후보: 관심도 점수가 높은 종목을 별도 표시",
    "추후 확장: 네이버 데이터랩, Reddit, Stocktwits, 뉴스 키워드 API 연결",
]


@dataclass(frozen=True)
class StrategyResult:
    rows: list[dict[str, object]]
    funnel: list[dict[str, object]]
    backtest: dict[str, object]
    final_candidates: list[dict[str, object]]
    watch: list[dict[str, object]]


def build_market_site_data(
    out_dir: str | Path = "site/data",
    domestic_limit: int = 250,
    years: int = 3,
    transaction_cost: float = 0.0015,
) -> dict[str, object]:
    generated_at = datetime.now(ZoneInfo(TIMEZONE)).replace(microsecond=0)
    listing = _load_krx_listing()
    universe = _build_domestic_universe(listing)
    selected = _select_history_universe(universe, domestic_limit)

    start = (generated_at.date() - timedelta(days=max(420, int(years * 370)))).isoformat()
    histories = _load_histories(selected, start=start)

    period_results: dict[str, dict[str, object]] = {}
    for period_key, config in PERIODS.items():
        result = _build_strategy(period_key, config, universe, selected, histories, transaction_cost)
        period_results[period_key] = {
            "label": config["label"],
            "description": config["description"],
            "holding_days": config["holding_days"],
            "rows": result.rows,
            "funnel": result.funnel,
            "backtest": result.backtest,
            "final_candidates": result.final_candidates,
            "watch": result.watch,
        }

    report = {
        "generated_at": generated_at.isoformat(),
        "timezone": TIMEZONE,
        "asset_classes": ASSET_CLASSES,
        "validated_filters": VALIDATED_FILTERS,
        "issue_filters": ISSUE_FILTERS,
        "domestic": {
            "source": ASSET_CLASSES["kr"]["source"],
            "universe_summary": _universe_summary(universe, selected, histories),
            "raw_universe": _clean(universe),
            "history_symbols": [{"symbol": row["symbol"], "name": row["name"], "market": row["market"]} for row in selected],
            "periods": period_results,
        },
        "us": _planned_asset("미국 주식"),
        "crypto": _planned_asset("코인"),
    }

    out_path = Path(out_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    (out_path / "market_report.json").write_text(
        json.dumps(_clean(report), ensure_ascii=False, indent=2, allow_nan=False),
        encoding="utf-8",
    )
    return report


def _load_krx_listing() -> pd.DataFrame:
    try:
        import FinanceDataReader as fdr
    except ModuleNotFoundError as exc:
        raise RuntimeError("FinanceDataReader is required. Run: pip install -r requirements.txt") from exc

    frame = fdr.StockListing("KRX")
    required = {"Code", "Name", "Market", "Close", "Volume", "Amount", "Marcap"}
    missing = required.difference(frame.columns)
    if missing:
        raise ValueError(f"KRX listing is missing columns: {', '.join(sorted(missing))}")
    return frame


def _build_domestic_universe(listing: pd.DataFrame) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for row in listing.fillna("").to_dict("records"):
        market = str(row.get("Market", "")).strip()
        if market not in {"KOSPI", "KOSDAQ"}:
            continue
        name = str(row.get("Name", "")).strip()
        tags = _stock_tags(name, row)
        rows.append(
            {
                "symbol": str(row.get("Code", "")).zfill(6),
                "name": name,
                "market": market,
                "close": _number(row.get("Close")),
                "change_pct": _number(row.get("ChagesRatio", row.get("Change", 0))) / 100,
                "volume": int(_number(row.get("Volume"))),
                "amount": _number(row.get("Amount")),
                "market_cap": _number(row.get("Marcap")),
                "tags": tags,
                "analysis_group": "core" if not tags else "tagged",
            }
        )
    return sorted(rows, key=lambda item: _number(item.get("amount")), reverse=True)


def _stock_tags(name: str, row: dict[str, object]) -> list[str]:
    tags: list[str] = []
    dept = str(row.get("Dept", "") or "")
    if name.endswith("우") or "우B" in name or "우선주" in dept:
        tags.append("우선주")
    if "스팩" in name or "SPAC" in name.upper():
        tags.append("스팩")
    if "리츠" in name or "REIT" in name.upper():
        tags.append("리츠")
    if "ETF" in dept.upper() or "ETN" in dept.upper():
        tags.append("ETF/ETN")
    return tags


def _select_history_universe(universe: list[dict[str, object]], limit: int) -> list[dict[str, object]]:
    tradable = [
        row
        for row in universe
        if row["market"] in {"KOSPI", "KOSDAQ"}
        and _number(row.get("amount")) >= 1_000_000_000
        and "스팩" not in row.get("tags", [])
        and "ETF/ETN" not in row.get("tags", [])
    ]
    return tradable[: max(1, int(limit))]


def _load_histories(selected: list[dict[str, object]], start: str) -> dict[str, pd.DataFrame]:
    import FinanceDataReader as fdr

    histories: dict[str, pd.DataFrame] = {}
    for row in selected:
        symbol = str(row["symbol"])
        try:
            frame = fdr.DataReader(symbol, start)
            frame = frame.rename(columns={column: column.lower() for column in frame.columns})
            if {"open", "high", "low", "close", "volume"}.issubset(frame.columns) and len(frame) > 40:
                histories[symbol] = frame.dropna(subset=["close"]).copy()
        except Exception:
            continue
    return histories


def _build_strategy(
    period_key: str,
    config: dict[str, object],
    universe: list[dict[str, object]],
    selected: list[dict[str, object]],
    histories: dict[str, pd.DataFrame],
    transaction_cost: float,
) -> StrategyResult:
    selected_by_symbol = {str(row["symbol"]): row for row in selected}
    rows: list[dict[str, object]] = []

    for symbol, base in selected_by_symbol.items():
        history = histories.get(symbol)
        if history is None or len(history) < int(config["min_lookback"]):
            continue
        features = _features_at(history, len(history) - 1)
        score_parts = _period_score(period_key, features)
        row = {
            "symbol": symbol,
            "name": base["name"],
            "market": base["market"],
            "tags": base.get("tags", []),
            "as_of": _date_string(history.index[-1]),
            **features,
            **score_parts,
        }
        row["final_action"] = _action_for_row(row)
        row["reason"] = _reason_for_row(row)
        rows.append(_clean(row))

    rows = sorted(rows, key=lambda row: _number(row.get("score")), reverse=True)
    for index, row in enumerate(rows, start=1):
        row["rank"] = index

    backtest = _backtest_period(period_key, config, selected_by_symbol, histories, transaction_cost)
    strategy_ok = _strategy_validation(backtest)
    for row in rows:
        row["strategy_validation"] = strategy_ok
        if row["final_action"] == "candidate" and not strategy_ok["passed"]:
            row["final_action"] = "watch"
            row["reason"] = "점수는 높지만 과거 동일 규칙 검증 기준을 아직 통과하지 못했습니다."

    funnel = _build_period_funnel(period_key, universe, selected, histories, rows)
    final_candidates = [row for row in rows if row["final_action"] == "candidate"][:20]
    watch = [row for row in rows if row["final_action"] == "watch"][:20]

    return StrategyResult(
        rows=rows[:500],
        funnel=funnel,
        backtest=backtest,
        final_candidates=final_candidates,
        watch=watch,
    )


def _features_at(history: pd.DataFrame, position: int) -> dict[str, object]:
    sample = history.iloc[: position + 1]
    close = sample["close"]
    volume = sample["volume"]
    amount = close * volume
    returns = close.pct_change()

    ret_1d = _return(close, 1)
    ret_5d = _return(close, 5)
    ret_21d = _return(close, 21)
    ret_63d = _return(close, 63)
    ret_126d = _return(close, 126)
    ret_252d = _return(close, 252)
    vol_5d = _volatility(returns, 5)
    vol_21d = _volatility(returns, 21)
    vol_63d = _volatility(returns, 63)
    drawdown_63d = _max_drawdown(close, 63)
    drawdown_252d = _max_drawdown(close, 252)
    ma20 = close.rolling(20).mean().iloc[-1] if len(close) >= 20 else np.nan
    ma60 = close.rolling(60).mean().iloc[-1] if len(close) >= 60 else np.nan
    ma120 = close.rolling(120).mean().iloc[-1] if len(close) >= 120 else np.nan
    high_252 = close.tail(252).max() if len(close) else np.nan

    amount_5d = amount.tail(5).mean()
    amount_20d = amount.tail(20).mean()
    amount_60d = amount.tail(60).mean()
    volume_5d = volume.tail(5).mean()
    volume_60d = volume.tail(60).mean()
    amount_surge = float(amount_5d / amount_60d) if amount_60d and not pd.isna(amount_60d) else np.nan
    volume_surge = float(volume_5d / volume_60d) if volume_60d and not pd.isna(volume_60d) else np.nan
    high_proximity = float(close.iloc[-1] / high_252) if high_252 and not pd.isna(high_252) else np.nan

    return {
        "last_close": round(float(close.iloc[-1]), 4),
        "ret_1d": _round(ret_1d, 4),
        "ret_5d": _round(ret_5d, 4),
        "ret_21d": _round(ret_21d, 4),
        "ret_63d": _round(ret_63d, 4),
        "ret_126d": _round(ret_126d, 4),
        "ret_252d": _round(ret_252d, 4),
        "vol_5d": _round(vol_5d, 4),
        "vol_21d": _round(vol_21d, 4),
        "vol_63d": _round(vol_63d, 4),
        "max_drawdown_63d": _round(drawdown_63d, 4),
        "max_drawdown_252d": _round(drawdown_252d, 4),
        "amount_5d": _round(amount_5d, 2),
        "amount_20d": _round(amount_20d, 2),
        "amount_60d": _round(amount_60d, 2),
        "amount_surge": _round(amount_surge, 4),
        "volume_surge": _round(volume_surge, 4),
        "high_proximity": _round(high_proximity, 4),
        "above_ma20": bool(close.iloc[-1] > ma20) if not pd.isna(ma20) else False,
        "above_ma60": bool(close.iloc[-1] > ma60) if not pd.isna(ma60) else False,
        "above_ma120": bool(close.iloc[-1] > ma120) if not pd.isna(ma120) else False,
    }


def _period_score(period_key: str, features: dict[str, object]) -> dict[str, object]:
    liquidity = _clip(math.log10(_number(features.get("amount_20d"))), 9.0, 11.5)
    attention = (
        0.45 * _clip(_number(features.get("amount_surge")), 0.8, 3.0)
        + 0.35 * _clip(_number(features.get("volume_surge")), 0.8, 2.8)
        + 0.20 * _clip(_number(features.get("high_proximity")), 0.80, 1.02)
    )
    trend = (
        0.35 * float(bool(features.get("above_ma20")))
        + 0.30 * float(bool(features.get("above_ma60")))
        + 0.35 * float(bool(features.get("above_ma120")))
    )

    if period_key == "1d":
        momentum = 0.65 * _clip(_number(features.get("ret_1d")), -0.02, 0.08) + 0.35 * _clip(_number(features.get("ret_5d")), -0.04, 0.12)
        risk = _inverse_clip(_number(features.get("vol_5d")), 0.20, 1.60)
        score = 100 * (0.35 * attention + 0.25 * momentum + 0.20 * liquidity + 0.10 * risk + 0.10 * trend)
    elif period_key == "1w":
        momentum = 0.65 * _clip(_number(features.get("ret_5d")), -0.03, 0.14) + 0.35 * _clip(_number(features.get("ret_21d")), -0.06, 0.22)
        risk = 0.6 * _inverse_clip(_number(features.get("vol_21d")), 0.20, 1.10) + 0.4 * _clip(_number(features.get("max_drawdown_63d")), -0.35, -0.03)
        score = 100 * (0.40 * momentum + 0.20 * attention + 0.15 * liquidity + 0.15 * risk + 0.10 * trend)
    elif period_key == "1m":
        momentum = 0.60 * _clip(_number(features.get("ret_21d")), -0.03, 0.12) + 0.40 * _clip(_number(features.get("ret_63d")), -0.08, 0.25)
        risk = 0.55 * _inverse_clip(_number(features.get("vol_21d")), 0.18, 0.75) + 0.45 * _clip(_number(features.get("max_drawdown_63d")), -0.30, -0.03)
        score = 100 * (0.45 * momentum + 0.25 * risk + 0.15 * liquidity + 0.10 * attention + 0.05 * trend)
    else:
        momentum = 0.55 * _clip(_number(features.get("ret_126d")), -0.10, 0.35) + 0.45 * _clip(_number(features.get("ret_252d")), -0.20, 0.60)
        risk = 0.50 * _inverse_clip(_number(features.get("vol_63d")), 0.15, 0.65) + 0.50 * _clip(_number(features.get("max_drawdown_252d")), -0.45, -0.08)
        score = 100 * (0.35 * momentum + 0.25 * risk + 0.15 * liquidity + 0.15 * trend + 0.10 * attention)

    return {
        "score": round(float(np.clip(score, 0, 100)), 2),
        "momentum_score": round(float(momentum), 4),
        "risk_score": round(float(risk), 4),
        "liquidity_score": round(float(liquidity), 4),
        "issue_score": round(float(attention), 4),
        "trend_score": round(float(trend), 4),
    }


def _action_for_row(row: dict[str, object]) -> str:
    if _number(row.get("score")) >= 70:
        return "candidate"
    if _number(row.get("score")) >= 55:
        return "watch"
    return "avoid"


def _reason_for_row(row: dict[str, object]) -> str:
    if row["final_action"] == "candidate":
        return "점수 기준을 통과했습니다. 과거 동일 규칙 검증 결과와 함께 확인하세요."
    if _number(row.get("liquidity_score")) < 0.35:
        return "유동성 점수가 낮아 제외했습니다."
    if _number(row.get("risk_score")) < 0.25:
        return "변동성 또는 낙폭 리스크가 큽니다."
    if _number(row.get("momentum_score")) < 0.35:
        return "기간별 모멘텀이 약합니다."
    return "관찰 대상입니다."


def _backtest_period(
    period_key: str,
    config: dict[str, object],
    selected_by_symbol: dict[str, dict[str, object]],
    histories: dict[str, pd.DataFrame],
    transaction_cost: float,
) -> dict[str, object]:
    holding_days = int(config["holding_days"])
    min_lookback = int(config["min_lookback"])
    step = int(config["step"])
    trades: list[dict[str, object]] = []

    for symbol, history in histories.items():
        base = selected_by_symbol.get(symbol)
        if base is None or len(history) <= min_lookback + holding_days:
            continue
        for position in range(min_lookback, len(history) - holding_days, step):
            features = _features_at(history, position)
            scored = _period_score(period_key, features)
            if scored["score"] < 70:
                continue
            entry = float(history["close"].iloc[position])
            exit_price = float(history["close"].iloc[position + holding_days])
            gross = exit_price / entry - 1
            net = gross - transaction_cost
            trades.append(
                {
                    "date": _date_string(history.index[position]),
                    "exit_date": _date_string(history.index[position + holding_days]),
                    "symbol": symbol,
                    "name": base["name"],
                    "score": scored["score"],
                    "gross_return": round(gross, 4),
                    "net_return": round(net, 4),
                }
            )

    if not trades:
        return _empty_backtest(transaction_cost)

    frame = pd.DataFrame(trades)
    top_frame = frame.sort_values(["date", "score"], ascending=[True, False]).groupby("date").head(5)
    daily = top_frame.groupby("date")["net_return"].mean().reset_index()
    equity = _equity_curve(daily)
    returns = top_frame["net_return"].astype(float)
    metrics = {
        "trade_count": int(len(top_frame)),
        "signal_count": int(len(frame)),
        "sample_days": int(daily["date"].nunique()),
        "win_rate": round(float((returns > 0).mean()), 4),
        "average_return": round(float(returns.mean()), 4),
        "median_return": round(float(returns.median()), 4),
        "best_return": round(float(returns.max()), 4),
        "worst_return": round(float(returns.min()), 4),
        "cumulative_return": round(float(equity[-1]["equity"] - 1), 4) if equity else 0,
        "max_drawdown": round(float(_equity_max_drawdown([point["equity"] for point in equity])), 4),
        "transaction_cost": transaction_cost,
    }

    best = top_frame.sort_values("net_return", ascending=False).head(5).to_dict("records")
    worst = top_frame.sort_values("net_return", ascending=True).head(5).to_dict("records")

    return {
        "metrics": _clean(metrics),
        "equity_curve": _clean(equity[-260:]),
        "best_trades": _clean(best),
        "worst_trades": _clean(worst),
        "validation": _strategy_validation({"metrics": metrics}),
    }


def _empty_backtest(transaction_cost: float) -> dict[str, object]:
    metrics = {
        "trade_count": 0,
        "signal_count": 0,
        "sample_days": 0,
        "win_rate": None,
        "average_return": None,
        "median_return": None,
        "best_return": None,
        "worst_return": None,
        "cumulative_return": None,
        "max_drawdown": None,
        "transaction_cost": transaction_cost,
    }
    return {"metrics": metrics, "equity_curve": [], "best_trades": [], "worst_trades": [], "validation": _strategy_validation({"metrics": metrics})}


def _strategy_validation(backtest: dict[str, object]) -> dict[str, object]:
    metrics = backtest.get("metrics", {})
    trade_count = int(metrics.get("trade_count") or 0)
    win_rate = metrics.get("win_rate")
    average_return = metrics.get("average_return")
    max_drawdown = metrics.get("max_drawdown")
    passed = (
        trade_count >= 20
        and win_rate is not None
        and float(win_rate) >= 0.48
        and average_return is not None
        and float(average_return) > -0.005
        and (max_drawdown is None or float(max_drawdown) > -0.45)
    )
    reasons = []
    if trade_count < 20:
        reasons.append("검증 거래 표본 20건 미만")
    if win_rate is not None and float(win_rate) < 0.48:
        reasons.append("승률 기준 미달")
    if average_return is not None and float(average_return) <= -0.005:
        reasons.append("평균 수익률 기준 미달")
    if max_drawdown is not None and float(max_drawdown) <= -0.45:
        reasons.append("최대 낙폭 기준 미달")
    return {"passed": passed, "reasons": reasons or ["검증 기준 통과"]}


def _build_period_funnel(
    period_key: str,
    universe: list[dict[str, object]],
    selected: list[dict[str, object]],
    histories: dict[str, pd.DataFrame],
    rows: list[dict[str, object]],
) -> list[dict[str, object]]:
    selected_symbols = {row["symbol"] for row in selected}
    history_symbols = set(histories)
    row_by_symbol = {row["symbol"]: row for row in rows}
    stages = [
        ("raw_universe", "모데이터", "KOSPI/KOSDAQ 전체 상장 목록", [row["symbol"] for row in universe]),
        ("core_stock", "국내 주식 분류", "스팩/ETF 등은 태그로 분리하고 보통주 중심 분석군을 만듭니다.", [row["symbol"] for row in selected]),
        ("history_ready", "가격 이력 확보", "기간별 지표와 백테스트가 가능한 종목만 남깁니다.", list(history_symbols)),
        ("liquidity", "유동성 검증", "거래대금 기반 유동성 점수 0.35 이상", [symbol for symbol, row in row_by_symbol.items() if _number(row.get("liquidity_score")) >= 0.35]),
        ("validated", "검증 필터", "모멘텀, 추세, 리스크 점수를 통과한 종목", [symbol for symbol, row in row_by_symbol.items() if _number(row.get("momentum_score")) >= 0.35 and _number(row.get("risk_score")) >= 0.25]),
        ("issue", "이슈/관심도 필터", "거래량·거래대금 급증과 신고가 근접도 기반 관심도", [symbol for symbol, row in row_by_symbol.items() if _number(row.get("issue_score")) >= _issue_threshold(period_key)]),
        ("final", "최종 후보", "점수와 과거 동일 규칙 검증을 함께 통과", [row["symbol"] for row in rows if row.get("final_action") == "candidate"]),
    ]

    funnel = []
    previous = None
    for stage_id, label, description, symbols in stages:
        symbol_set = set(symbols)
        if previous is not None:
            symbol_set = symbol_set.intersection(previous)
        before_count = len(previous) if previous is not None else len(symbol_set)
        funnel.append(
            {
                "id": stage_id,
                "label": label,
                "description": description,
                "before_count": before_count,
                "count": len(symbol_set),
                "drop_count": max(0, before_count - len(symbol_set)),
                "symbols": sorted(symbol_set)[:120],
            }
        )
        previous = symbol_set
    return funnel


def _issue_threshold(period_key: str) -> float:
    return {"1d": 0.45, "1w": 0.35, "1m": 0.20, "1y": 0.15}[period_key]


def _equity_curve(daily: pd.DataFrame) -> list[dict[str, object]]:
    equity = 1.0
    rows = []
    for row in daily.sort_values("date").to_dict("records"):
        equity *= 1 + float(row["net_return"])
        rows.append({"date": row["date"], "equity": round(equity, 4), "return": round(float(row["net_return"]), 4)})
    return rows


def _equity_max_drawdown(values: list[float]) -> float:
    if not values:
        return 0.0
    series = pd.Series(values)
    drawdown = series / series.cummax() - 1
    return float(drawdown.min())


def _universe_summary(
    universe: list[dict[str, object]],
    selected: list[dict[str, object]],
    histories: dict[str, pd.DataFrame],
) -> dict[str, object]:
    kospi = sum(1 for row in universe if row["market"] == "KOSPI")
    kosdaq = sum(1 for row in universe if row["market"] == "KOSDAQ")
    tagged = sum(1 for row in universe if row.get("tags"))
    return {
        "total_count": len(universe),
        "kospi_count": kospi,
        "kosdaq_count": kosdaq,
        "tagged_count": tagged,
        "history_target_count": len(selected),
        "history_ready_count": len(histories),
        "total_amount": round(sum(_number(row.get("amount")) for row in universe), 2),
    }


def _planned_asset(label: str) -> dict[str, object]:
    return {
        "status": "planned",
        "summary": f"{label}은 데이터 소스와 필터 구조를 분리해 다음 단계에서 연결합니다.",
        "periods": {},
    }


def _return(close: pd.Series, window: int) -> float:
    if len(close) <= window:
        return np.nan
    return float(close.iloc[-1] / close.iloc[-window - 1] - 1)


def _volatility(returns: pd.Series, window: int) -> float:
    sample = returns.dropna().tail(window)
    if sample.empty:
        return np.nan
    return float(sample.std() * np.sqrt(TRADING_DAYS_PER_YEAR))


def _max_drawdown(close: pd.Series, window: int) -> float:
    sample = close.tail(window)
    if sample.empty:
        return np.nan
    return float((sample / sample.cummax() - 1).min())


def _clip(value: float, low: float, high: float) -> float:
    if math.isnan(value) or math.isinf(value) or high == low:
        return 0.0
    return float(np.clip((value - low) / (high - low), 0, 1))


def _inverse_clip(value: float, low: float, high: float) -> float:
    return 1 - _clip(value, low, high)


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


def _round(value: object, digits: int) -> float | None:
    number = _number(value, default=np.nan)
    if math.isnan(number):
        return None
    return round(float(number), digits)


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
    try:
        if not isinstance(value, (str, bytes)) and pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    return value
