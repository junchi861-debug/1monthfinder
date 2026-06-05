from __future__ import annotations

import json
import math
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd

from stock_finder.config_loader import (
    DEFAULT_CHART_CONFIG_PATH,
    DEFAULT_STRATEGY_CONFIG_PATH,
    config_source_label,
    load_dashboard_chart_config,
    load_market_strategy_config,
)

STRATEGY_CONFIG = load_market_strategy_config()
CHART_CONFIG = load_dashboard_chart_config()

TIMEZONE = str(STRATEGY_CONFIG.get("timezone", "Asia/Seoul"))
TRADING_DAYS_PER_YEAR = int(STRATEGY_CONFIG.get("trading_days_per_year", 252))
PERIODS: dict[str, dict[str, object]] = STRATEGY_CONFIG["periods"]
ASSET_CLASSES: dict[str, dict[str, object]] = STRATEGY_CONFIG["asset_classes"]
VALIDATED_FILTERS: list[str] = STRATEGY_CONFIG["validated_filters"]
ISSUE_FILTERS: list[str] = STRATEGY_CONFIG["issue_filters"]
ALGORITHMS: dict[str, dict[str, object]] = STRATEGY_CONFIG["algorithms"]
DEFAULT_ALGORITHM_BY_PERIOD: dict[str, str] = STRATEGY_CONFIG["default_algorithm_by_period"]
SIGNALS: dict[str, dict[str, str]] = STRATEGY_CONFIG["signals"]


@dataclass(frozen=True)
class StrategyResult:
    rows: list[dict[str, object]]
    funnel: list[dict[str, object]]
    backtest: dict[str, object]
    quality_report: dict[str, object]
    final_candidates: list[dict[str, object]]
    watch: list[dict[str, object]]


def _load_runtime_configs(
    strategy_config_path: str | Path | None = None,
    chart_config_path: str | Path | None = None,
) -> None:
    global STRATEGY_CONFIG, CHART_CONFIG, TIMEZONE, TRADING_DAYS_PER_YEAR
    global PERIODS, ASSET_CLASSES, VALIDATED_FILTERS, ISSUE_FILTERS
    global ALGORITHMS, DEFAULT_ALGORITHM_BY_PERIOD, SIGNALS

    if strategy_config_path:
        STRATEGY_CONFIG = load_market_strategy_config(strategy_config_path)
    if chart_config_path:
        CHART_CONFIG = load_dashboard_chart_config(chart_config_path)

    TIMEZONE = str(STRATEGY_CONFIG.get("timezone", "Asia/Seoul"))
    TRADING_DAYS_PER_YEAR = int(STRATEGY_CONFIG.get("trading_days_per_year", 252))
    PERIODS = STRATEGY_CONFIG["periods"]
    ASSET_CLASSES = STRATEGY_CONFIG["asset_classes"]
    VALIDATED_FILTERS = STRATEGY_CONFIG["validated_filters"]
    ISSUE_FILTERS = STRATEGY_CONFIG["issue_filters"]
    ALGORITHMS = STRATEGY_CONFIG["algorithms"]
    DEFAULT_ALGORITHM_BY_PERIOD = STRATEGY_CONFIG["default_algorithm_by_period"]
    SIGNALS = STRATEGY_CONFIG["signals"]


def _algorithm_options() -> list[dict[str, str]]:
    return [
        {
            "key": key,
            "label": str(config["label"]),
            "short_label": str(config.get("short_label", config["label"])),
            "description": str(config.get("description", "")),
        }
        for key, config in ALGORITHMS.items()
    ]


def _period_payload(config: dict[str, object], result: StrategyResult, algorithm_key: str) -> dict[str, object]:
    return {
        "label": config["label"],
        "description": config["description"],
        "holding_days": config["holding_days"],
        "algorithm": algorithm_key,
        "algorithm_label": ALGORITHMS[algorithm_key]["label"],
        "rows": result.rows,
        "funnel": result.funnel,
        "backtest": result.backtest,
        "quality_report": result.quality_report,
        "final_candidates": result.final_candidates,
        "watch": result.watch,
    }


def build_market_site_data(
    out_dir: str | Path = "site/data",
    domestic_limit: int = 250,
    years: int = 3,
    transaction_cost: float = 0.0015,
    strategy_config_path: str | Path | None = None,
    chart_config_path: str | Path | None = None,
) -> dict[str, object]:
    _load_runtime_configs(strategy_config_path, chart_config_path)

    generated_at = datetime.now(ZoneInfo(TIMEZONE)).replace(microsecond=0)
    listing = _load_krx_listing()
    universe = _build_domestic_universe(listing)
    selected = _select_history_universe(universe, domestic_limit)

    start = (generated_at.date() - timedelta(days=max(420, int(years * 370)))).isoformat()
    histories = _load_histories(selected, start=start)

    period_results: dict[str, dict[str, object]] = {}
    for period_key, config in PERIODS.items():
        algorithm_results = {}
        for algorithm_key in ALGORITHMS:
            result = _build_strategy(period_key, config, algorithm_key, universe, selected, histories, transaction_cost)
            algorithm_results[algorithm_key] = _period_payload(config, result, algorithm_key)

        default_algorithm = DEFAULT_ALGORITHM_BY_PERIOD.get(period_key, "balanced")
        default_payload = algorithm_results[default_algorithm]
        period_results[period_key] = {
            "label": config["label"],
            "description": config["description"],
            "holding_days": config["holding_days"],
            "default_algorithm": default_algorithm,
            "algorithm_options": _algorithm_options(),
            "algorithms": algorithm_results,
            "algorithm": default_algorithm,
            "rows": default_payload["rows"],
            "funnel": default_payload["funnel"],
            "backtest": default_payload["backtest"],
            "quality_report": default_payload["quality_report"],
            "final_candidates": default_payload["final_candidates"],
            "watch": default_payload["watch"],
        }

    out_path = Path(out_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    signal_tracking = _build_signal_tracking_report(period_results, histories, out_path, generated_at)
    report = {
        "generated_at": generated_at.isoformat(),
        "timezone": TIMEZONE,
        "config_sources": {
            "strategy": config_source_label(strategy_config_path, DEFAULT_STRATEGY_CONFIG_PATH),
            "charts": config_source_label(chart_config_path, DEFAULT_CHART_CONFIG_PATH),
        },
        "asset_classes": ASSET_CLASSES,
        "algorithms": ALGORITHMS,
        "signals": SIGNALS,
        "chart_config": CHART_CONFIG,
        "validated_filters": VALIDATED_FILTERS,
        "issue_filters": ISSUE_FILTERS,
        "domestic": {
            "source": ASSET_CLASSES["kr"]["source"],
            "universe_summary": _universe_summary(universe, selected, histories),
            "raw_universe": _clean(universe),
            "history_symbols": [{"symbol": row["symbol"], "name": row["name"], "market": row["market"]} for row in selected],
            "periods": period_results,
            "signal_tracking": signal_tracking,
        },
        "us": _planned_asset("미국 주식"),
        "crypto": _planned_asset("코인"),
    }

    (out_path / "market_report.json").write_text(
        json.dumps(_clean(report), ensure_ascii=False, indent=2, allow_nan=False),
        encoding="utf-8",
    )
    (out_path / "chart_config.json").write_text(
        json.dumps(_clean(CHART_CONFIG), ensure_ascii=False, indent=2, allow_nan=False),
        encoding="utf-8",
    )
    (out_path / "strategy_config.json").write_text(
        json.dumps(_clean(STRATEGY_CONFIG), ensure_ascii=False, indent=2, allow_nan=False),
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
    algorithm_key: str,
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
        score_parts = _period_score(period_key, features, algorithm_key)
        row = {
            "symbol": symbol,
            "name": base["name"],
            "market": base["market"],
            "tags": base.get("tags", []),
            "as_of": _date_string(history.index[-1]),
            "algorithm": algorithm_key,
            "algorithm_label": ALGORITHMS[algorithm_key]["label"],
            **features,
            **score_parts,
        }
        row["final_action"] = _action_for_row(row, period_key, algorithm_key)
        row["trade_signal"] = _signal_for_action(row["final_action"])
        row["reason"] = _reason_for_row(row, period_key, algorithm_key)
        rows.append(_clean(row))

    _attach_cross_sectional_percentiles(rows)
    rows = sorted(rows, key=lambda row: _number(row.get("score")), reverse=True)
    for index, row in enumerate(rows, start=1):
        row["rank"] = index
        _apply_risk_and_regime_filters(row, period_key, algorithm_key)

    backtest = _backtest_period(period_key, config, algorithm_key, selected_by_symbol, histories, transaction_cost)
    strategy_ok = _strategy_validation(backtest)
    for row in rows:
        row["strategy_validation"] = strategy_ok
        if row["final_action"] == "candidate" and not strategy_ok["passed"] and not _keeps_short_term_candidates(period_key, algorithm_key):
            row["final_action"] = "watch"
            row["trade_signal"] = _signal_for_action(row["final_action"])
            row["reason"] = "점수는 높지만 과거 동일 규칙 검증 기준을 아직 통과하지 못했습니다."
            blocked_by = list(row.get("candidate_blocked_by") or [])
            if "strategy_validation" not in blocked_by:
                blocked_by.append("strategy_validation")
            row["candidate_blocked_by"] = blocked_by

    _promote_target_candidates(rows, period_key, algorithm_key, strategy_ok)
    _apply_correlation_diversification(rows, histories, period_key, algorithm_key)
    _attach_exit_plans(rows, period_key, algorithm_key)
    for row in rows:
        row["trade_signal"] = _signal_for_action(row["final_action"])

    funnel = _build_period_funnel(period_key, algorithm_key, universe, selected, histories, rows)
    quality_report = _signal_quality_report(rows, backtest, strategy_ok, period_key, algorithm_key)
    final_candidates = [row for row in rows if row["final_action"] == "candidate"][:20]
    watch = [row for row in rows if row["final_action"] == "watch"][:20]
    _attach_price_history(final_candidates + watch, histories)

    return StrategyResult(
        rows=rows[:500],
        funnel=funnel,
        backtest=backtest,
        quality_report=quality_report,
        final_candidates=final_candidates,
        watch=watch,
    )


def _attach_price_history(rows: list[dict[str, object]], histories: dict[str, pd.DataFrame], days: int = 90) -> None:
    for row in rows:
        history = histories.get(str(row.get("symbol", "")))
        if history is not None:
            row["price_history"] = _price_points(history, days)


def _price_points(history: pd.DataFrame, days: int) -> list[dict[str, object]]:
    points = []
    for index, row in history.tail(days).iterrows():
        close = row.get("close")
        if pd.isna(close):
            continue
        points.append({"date": _date_string(index), "close": round(float(close), 4)})
    return points


def _features_at(history: pd.DataFrame, position: int) -> dict[str, object]:
    sample = history.iloc[: position + 1]
    close = sample["close"]
    high = sample["high"] if "high" in sample else close
    low = sample["low"] if "low" in sample else close
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
    atr_14_pct = _atr_pct(high, low, close, 14)

    amount_5d = amount.tail(5).mean()
    amount_20d = amount.tail(20).mean()
    amount_60d = amount.tail(60).mean()
    volume_5d = volume.tail(5).mean()
    volume_60d = volume.tail(60).mean()
    amount_surge = float(amount_5d / amount_60d) if amount_60d and not pd.isna(amount_60d) else np.nan
    volume_surge = float(volume_5d / volume_60d) if volume_60d and not pd.isna(volume_60d) else np.nan
    high_proximity = float(close.iloc[-1] / high_252) if high_252 and not pd.isna(high_252) else np.nan

    features = {
        "history_days": len(sample),
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
        "atr_14_pct": _round(atr_14_pct, 4),
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
    features["market_regime"] = _market_regime_for_features(features)
    return features


def _period_score(period_key: str, features: dict[str, object], algorithm_key: str = "balanced") -> dict[str, object]:
    components_config = STRATEGY_CONFIG.get("components", {})
    shared_components = components_config.get("shared", {})
    period_components = components_config.get("periods", {}).get(period_key, {})
    components = {
        "liquidity": _score_component(shared_components.get("liquidity", {}), features),
        "attention": _score_component(shared_components.get("attention", {}), features),
        "trend": _score_component(shared_components.get("trend", {}), features),
        "momentum": _score_component(period_components.get("momentum", {}), features),
        "risk": _score_component(period_components.get("risk", {}), features),
    }
    weights = _algorithm_score_weights(period_key, algorithm_key)
    score = 100 * sum(_number(weight) * _number(components.get(name)) for name, weight in weights.items())

    return {
        "score": round(float(np.clip(score, 0, 100)), 2),
        "momentum_score": round(float(components["momentum"]), 4),
        "risk_score": round(float(components["risk"]), 4),
        "liquidity_score": round(float(components["liquidity"]), 4),
        "issue_score": round(float(components["attention"]), 4),
        "trend_score": round(float(components["trend"]), 4),
    }


def _attach_cross_sectional_percentiles(rows: list[dict[str, object]]) -> None:
    fields = {
        "score": "score_percentile",
        "momentum_score": "momentum_percentile",
        "risk_score": "risk_percentile",
        "liquidity_score": "liquidity_percentile",
        "issue_score": "issue_percentile",
        "trend_score": "trend_percentile",
    }
    if not rows:
        return

    for field, output in fields.items():
        values = pd.Series([_number(row.get(field), default=np.nan) for row in rows], dtype="float64")
        if values.dropna().empty:
            continue
        percentiles = values.rank(method="average", pct=True)
        for row, percentile in zip(rows, percentiles, strict=False):
            if pd.notna(percentile):
                row[output] = round(float(percentile), 4)


def _market_regime_for_features(features: dict[str, object]) -> str:
    vol_21d = _number(features.get("vol_21d"), default=np.nan)
    ret_63d = _number(features.get("ret_63d"), default=np.nan)
    drawdown_63d = _number(features.get("max_drawdown_63d"), default=np.nan)
    above_ma20 = bool(features.get("above_ma20"))
    above_ma60 = bool(features.get("above_ma60"))

    if (math.isfinite(vol_21d) and vol_21d >= 0.75) or (math.isfinite(drawdown_63d) and drawdown_63d <= -0.25):
        return "volatile"
    if above_ma20 and above_ma60 and (not math.isfinite(ret_63d) or ret_63d >= 0.04):
        return "trend_up"
    if not above_ma60 and math.isfinite(ret_63d) and ret_63d <= -0.04:
        return "trend_down"
    return "range"


def _score_component(config: object, features: dict[str, object]) -> float:
    if not isinstance(config, dict):
        return 0.0

    kind = str(config.get("type") or config.get("method") or "clip")
    if kind == "weighted_sum":
        return float(
            sum(
                _number(item.get("weight"), default=1.0) * _score_component(item, features)
                for item in config.get("items", [])
                if isinstance(item, dict)
            )
        )

    feature = str(config.get("feature", ""))
    value = features.get(feature)
    if kind == "boolean":
        return 1.0 if bool(value) else 0.0
    if kind == "clip_log10":
        return _clip(_safe_log10(value), _number(config.get("low")), _number(config.get("high")))
    if kind == "inverse_clip":
        return _inverse_clip(_number(value, default=np.nan), _number(config.get("low")), _number(config.get("high")))
    return _clip(_number(value, default=np.nan), _number(config.get("low")), _number(config.get("high")))


def _algorithm_score_weights(period_key: str, algorithm_key: str) -> dict[str, float]:
    algorithm = ALGORITHMS.get(algorithm_key) or ALGORITHMS.get("balanced") or {}
    by_period = algorithm.get("score_weights_by_period", {}) if isinstance(algorithm, dict) else {}
    if not isinstance(by_period, dict):
        return {}
    weights = by_period.get(period_key) or by_period.get("default") or {}
    return weights if isinstance(weights, dict) else {}


def _action_for_row(row: dict[str, object], period_key: str, algorithm_key: str) -> str:
    score = _number(row.get("score"))
    regime = str(row.get("market_regime") or "range")
    if score >= _candidate_threshold(period_key, algorithm_key, regime):
        return "candidate"
    if score >= _watch_threshold(period_key, algorithm_key, regime):
        return "watch"
    return "avoid"


def _apply_risk_and_regime_filters(row: dict[str, object], period_key: str, algorithm_key: str) -> None:
    initial_action = str(row.get("final_action") or "avoid")
    row["action_before_safety_filters"] = initial_action
    blocked_by: list[str] = []

    risk_gate = _risk_gate_for_row(row, period_key)
    row["risk_gate"] = risk_gate
    if not risk_gate["passed"] and _downgrade_action(row.get("final_action"), risk_gate["downgrade_action"]):
        if initial_action == "candidate":
            blocked_by.append("risk_gate")
        row["final_action"] = risk_gate["downgrade_action"]
        row["reason"] = _combine_reasons(row.get("reason"), risk_gate["summary"])

    regime_filter = _market_regime_filter_for_row(row, period_key, algorithm_key)
    row["market_regime_filter"] = regime_filter
    if not regime_filter["passed"] and _downgrade_action(row.get("final_action"), regime_filter["downgrade_action"]):
        if initial_action == "candidate":
            blocked_by.append("market_regime_filter")
        row["final_action"] = regime_filter["downgrade_action"]
        row["reason"] = _combine_reasons(row.get("reason"), regime_filter["summary"])

    if blocked_by:
        row["candidate_blocked_by"] = blocked_by


def _risk_gate_for_row(row: dict[str, object], period_key: str) -> dict[str, object]:
    config = STRATEGY_CONFIG.get("risk_gate", {})
    if not isinstance(config, dict) or config.get("enabled") is False:
        return _gate_result(True, "리스크 게이트 비활성", [], "pass")

    shared = config.get("shared", {}) if isinstance(config.get("shared"), dict) else {}
    periods = config.get("periods", {}) if isinstance(config.get("periods"), dict) else {}
    period_config = periods.get(period_key, {}) if isinstance(periods.get(period_key), dict) else {}
    rules = {**shared, **period_config}
    reasons: list[str] = []
    downgrade_action = "pass"

    def fail(reason: str, action: str = "watch") -> None:
        nonlocal downgrade_action
        reasons.append(reason)
        if action == "avoid":
            downgrade_action = "avoid"
        elif downgrade_action == "pass":
            downgrade_action = "watch"

    min_history = int(_number(rules.get("min_history_days"), PERIODS.get(period_key, {}).get("min_lookback", 0)))
    history_days = int(_number(row.get("history_days"), 0))
    if min_history and history_days < min_history:
        fail(f"가격 이력 {history_days}일로 기준 {min_history}일 미만", "avoid")

    min_liquidity_score = _number(rules.get("min_liquidity_score"), 0)
    if _number(row.get("liquidity_score")) < min_liquidity_score:
        fail(f"유동성 점수 {_number(row.get('liquidity_score')):.2f} < {min_liquidity_score:.2f}", "avoid")

    min_amount_20d = _number(rules.get("min_amount_20d"), 0)
    amount_20d = _number(row.get("amount_20d"), default=np.nan)
    if min_amount_20d and (not math.isfinite(amount_20d) or amount_20d < min_amount_20d):
        fail(f"20일 평균 거래대금 {amount_20d:,.0f} < {min_amount_20d:,.0f}", "avoid")

    min_risk_score = _number(rules.get("min_risk_score"), 0)
    if _number(row.get("risk_score")) < min_risk_score:
        fail(f"리스크 점수 {_number(row.get('risk_score')):.2f} < {min_risk_score:.2f}")

    max_abs_1d_return = _number(rules.get("max_abs_1d_return"), 0)
    ret_1d = _number(row.get("ret_1d"), default=np.nan)
    if max_abs_1d_return and math.isfinite(ret_1d) and abs(ret_1d) > max_abs_1d_return:
        fail(f"1일 등락률 {ret_1d:.1%}로 과열/급락 기준 {max_abs_1d_return:.1%} 초과")

    vol_feature = str(rules.get("max_volatility_feature") or "")
    max_volatility = _number(rules.get("max_volatility"), 0)
    volatility = _number(row.get(vol_feature), default=np.nan) if vol_feature else np.nan
    if max_volatility and math.isfinite(volatility) and volatility > max_volatility:
        fail(f"{vol_feature} {volatility:.2f} > {max_volatility:.2f}")

    drawdown_feature = str(rules.get("max_drawdown_feature") or "")
    max_drawdown = _number(rules.get("max_drawdown"), default=np.nan)
    drawdown = _number(row.get(drawdown_feature), default=np.nan) if drawdown_feature else np.nan
    if math.isfinite(max_drawdown) and math.isfinite(drawdown) and drawdown <= max_drawdown:
        fail(f"{drawdown_feature} {drawdown:.1%} <= {max_drawdown:.1%}")

    passed = not reasons
    return _gate_result(passed, "리스크 게이트 통과" if passed else " · ".join(reasons[:3]), reasons, downgrade_action)


def _market_regime_filter_for_row(row: dict[str, object], period_key: str, algorithm_key: str) -> dict[str, object]:
    config = STRATEGY_CONFIG.get("market_regime_filter", {})
    guards = config.get("candidate_guards", {}) if isinstance(config, dict) else {}
    regime = str(row.get("market_regime") or "range")
    guard = guards.get(regime, {}) if isinstance(guards, dict) else {}
    if not isinstance(guard, dict) or not guard:
        return _gate_result(True, f"{regime} 국면 추가 제한 없음", [], "pass")

    reasons: list[str] = []
    for field in ("min_liquidity_score", "min_momentum_score", "min_risk_score", "min_trend_score"):
        if field not in guard:
            continue
        row_field = field.removeprefix("min_")
        threshold = _number(guard.get(field))
        value = _number(row.get(row_field))
        if value < threshold:
            reasons.append(f"{regime} 국면 {row_field} {value:.2f} < {threshold:.2f}")

    if guard.get("requires_above_ma20") and not bool(row.get("above_ma20")):
        reasons.append(f"{regime} 국면에서 20일선 회복 전")
    if guard.get("requires_above_ma60") and not bool(row.get("above_ma60")):
        reasons.append(f"{regime} 국면에서 60일선 회복 전")

    passed = not reasons
    summary = f"{regime} 국면 필터 통과" if passed else " · ".join(reasons[:3])
    action = str(guard.get("downgrade_action") or "watch")
    if action not in {"watch", "avoid"}:
        action = "watch"
    return _gate_result(passed, summary, reasons, "pass" if passed else action)


def _gate_result(passed: bool, summary: str, reasons: list[str], downgrade_action: str) -> dict[str, object]:
    action = downgrade_action if downgrade_action in {"watch", "avoid"} else "pass"
    return {
        "passed": passed,
        "summary": summary,
        "reasons": reasons or [summary],
        "downgrade_action": action,
    }


def _downgrade_action(current_action: object, downgrade_action: object) -> bool:
    current = str(current_action or "avoid")
    downgrade = str(downgrade_action or "pass")
    if downgrade == "avoid":
        return current in {"candidate", "watch"}
    if downgrade == "watch":
        return current == "candidate"
    return False


def _combine_reasons(existing: object, addition: object) -> str:
    base = str(existing or "").strip()
    extra = str(addition or "").strip()
    if not base:
        return extra
    if not extra or extra in base:
        return base
    return f"{base} 안전필터: {extra}"


def _signal_for_action(action: object) -> str:
    action_key = str(action)
    signal_config = SIGNALS.get(action_key, {})
    return str(signal_config.get("trade_signal", action_key))


def _reason_for_row(row: dict[str, object], period_key: str, algorithm_key: str) -> str:
    if row["final_action"] == "candidate":
        if _keeps_short_term_candidates(period_key, algorithm_key):
            return "1일 단기 알고리즘에서 거래대금, 탄력, 관심도 기준 상위권입니다. 검증 지표와 함께 확인하세요."
        return "점수 기준을 통과했습니다. 과거 동일 규칙 검증 결과와 함께 확인하세요."
    if _number(row.get("liquidity_score")) < 0.35:
        return "유동성 점수가 낮아 제외했습니다."
    if _number(row.get("risk_score")) < 0.25:
        return "변동성 또는 낙폭 리스크가 큽니다."
    if _number(row.get("momentum_score")) < 0.35:
        return "기간별 모멘텀이 약합니다."
    return "관찰 대상입니다."


def _candidate_threshold(period_key: str, algorithm_key: str, regime_key: str | None = None) -> float:
    return _configured_threshold("candidate_score", period_key, algorithm_key, 70, regime_key)


def _watch_threshold(period_key: str, algorithm_key: str, regime_key: str | None = None) -> float:
    return _configured_threshold("watch_score", period_key, algorithm_key, 55, regime_key)


def _signal_threshold(period_key: str, algorithm_key: str, regime_key: str | None = None) -> float:
    configured = _configured_threshold("signal_score", period_key, algorithm_key, None, regime_key)
    return configured if configured is not None else _candidate_threshold(period_key, algorithm_key, regime_key)


def _target_candidate_count(period_key: str, algorithm_key: str) -> int | None:
    overrides = STRATEGY_CONFIG.get("target_candidates", {}).get("period_algorithm_overrides", {})
    value = overrides.get(f"{period_key}:{algorithm_key}") if isinstance(overrides, dict) else None
    return int(value) if value is not None else None


def _keeps_short_term_candidates(period_key: str, algorithm_key: str) -> bool:
    config = STRATEGY_CONFIG.get("short_term_candidate_algorithms", {})
    algorithms = config.get(period_key, []) if isinstance(config, dict) else []
    return algorithm_key in algorithms


def _short_term_guardrail(row: dict[str, object]) -> bool:
    guardrail = STRATEGY_CONFIG.get("short_term_guardrail", {})
    return (
        _number(row.get("score")) >= _number(guardrail.get("min_score"), 50)
        and _number(row.get("liquidity_score")) >= _number(guardrail.get("min_liquidity_score"), 0.35)
        and _number(row.get("issue_score")) >= _number(guardrail.get("min_issue_score"), 0.30)
        and _number(row.get("risk_score")) >= _number(guardrail.get("min_risk_score"), 0.10)
    )


def _configured_threshold(
    group: str,
    period_key: str,
    algorithm_key: str,
    fallback: float | None,
    regime_key: str | None = None,
) -> float | None:
    config = STRATEGY_CONFIG.get("thresholds", {}).get(group, {})
    if not isinstance(config, dict):
        return fallback

    threshold: float | None = None
    period_algorithm = config.get("period_algorithm_overrides", {})
    if isinstance(period_algorithm, dict) and f"{period_key}:{algorithm_key}" in period_algorithm:
        threshold = _number(period_algorithm[f"{period_key}:{algorithm_key}"])

    algorithm_overrides = config.get("algorithm_overrides", {})
    if threshold is None and isinstance(algorithm_overrides, dict) and algorithm_key in algorithm_overrides:
        threshold = _number(algorithm_overrides[algorithm_key])

    period_overrides = config.get("period_overrides", {})
    if threshold is None and isinstance(period_overrides, dict) and period_key in period_overrides:
        threshold = _number(period_overrides[period_key])

    if threshold is None and "default" in config and config["default"] is not None:
        threshold = _number(config["default"])
    if threshold is None:
        threshold = fallback
    if threshold is None:
        return None

    adjustments = config.get("regime_adjustments", {})
    if regime_key and isinstance(adjustments, dict) and regime_key in adjustments:
        threshold += _number(adjustments[regime_key])
    return threshold


def _promote_target_candidates(
    rows: list[dict[str, object]],
    period_key: str,
    algorithm_key: str,
    strategy_ok: dict[str, object],
) -> None:
    target = _target_candidate_count(period_key, algorithm_key)
    if not target:
        return

    selected_symbols = set(
        row["symbol"]
        for row in rows
        if _short_term_guardrail(row) and _allows_opportunity_watch(row)
    )
    selected_symbols = set([row["symbol"] for row in rows if row["symbol"] in selected_symbols][:target])
    if len(selected_symbols) < target:
        for row in rows:
            if row["symbol"] in selected_symbols or _number(row.get("score")) < 45 or not _allows_opportunity_watch(row):
                continue
            selected_symbols.add(row["symbol"])
            if len(selected_symbols) >= target:
                break

    for row in rows:
        if row["symbol"] in selected_symbols:
            row["final_action"] = "watch"
            row["strategy_validation"] = strategy_ok
            row["opportunity_action"] = "top_issue_watch"
            row["opportunity_signal"] = "warning"
            row["opportunity_ranked"] = True
            row["reason"] = "1일 단기 알고리즘 기준 상위 3개 검증 관찰입니다. 실거래 후보가 아니라 당일 이슈성 신호와 리스크를 함께 확인하세요."
        elif row["final_action"] == "candidate":
            row["final_action"] = "watch"
            row["opportunity_action"] = "score_watch"
            row["reason"] = "후보 기준은 넘었지만 1일 단기 알고리즘은 검증 관찰로만 표시합니다."


def _allows_opportunity_watch(row: dict[str, object]) -> bool:
    for key in ("risk_gate", "market_regime_filter"):
        gate = row.get(key)
        if isinstance(gate, dict) and not gate.get("passed") and gate.get("downgrade_action") == "avoid":
            return False
    return True


def _apply_correlation_diversification(
    rows: list[dict[str, object]],
    histories: dict[str, pd.DataFrame],
    period_key: str,
    algorithm_key: str,
) -> None:
    config = STRATEGY_CONFIG.get("diversification", {})
    if not isinstance(config, dict) or config.get("enabled") is False:
        return

    window = max(5, int(_number(config.get("return_window_days"), 63)))
    threshold = _number(config.get("correlation_threshold"), 0.88)
    max_group = max(1, int(_number(config.get("max_correlated_candidates"), 2)))
    min_score = _number(config.get("min_score_for_group"), 55)
    selected: list[dict[str, object]] = []
    selected_returns: dict[str, pd.Series] = {}

    for row in rows:
        row["diversification_filter"] = {"passed": True, "summary": "상관 중복 제한 통과", "group": None}
        if row.get("final_action") != "candidate" or _number(row.get("score")) < min_score:
            continue

        symbol = str(row.get("symbol") or "")
        series = _returns_for_symbol(histories.get(symbol), window)
        if series.empty:
            row["diversification_filter"] = {
                "passed": True,
                "summary": "상관계수 계산 표본 부족, 점수 순위 유지",
                "group": None,
            }
            selected.append(row)
            selected_returns[symbol] = series
            continue

        correlated = []
        for kept in selected:
            kept_symbol = str(kept.get("symbol") or "")
            corr = _return_correlation(series, selected_returns.get(kept_symbol))
            if corr is not None and corr >= threshold:
                correlated.append((kept, corr))

        if len(correlated) >= max_group:
            lead = correlated[0][0]
            lead_symbol = str(lead.get("symbol") or "")
            lead_name = str(lead.get("name") or lead_symbol)
            row["final_action"] = "watch"
            row["opportunity_action"] = "correlation_watch"
            blocked_by = list(row.get("candidate_blocked_by") or [])
            if "correlation_diversification" not in blocked_by:
                blocked_by.append("correlation_diversification")
            row["candidate_blocked_by"] = blocked_by
            row["diversification_filter"] = {
                "passed": False,
                "summary": f"{lead_name} 등 이미 선택된 후보와 최근 {window}일 상관이 높아 관찰로 낮췄습니다.",
                "group": lead_symbol,
                "max_correlation": round(float(max(corr for _, corr in correlated)), 4),
                "threshold": threshold,
                "max_correlated_candidates": max_group,
            }
            row["reason"] = _combine_reasons(row.get("reason"), row["diversification_filter"]["summary"])
            continue

        if correlated:
            lead = correlated[0][0]
            max_corr = max(corr for _, corr in correlated)
            row["diversification_filter"] = {
                "passed": True,
                "summary": f"상관 후보군 {len(correlated) + 1}/{max_group}개 범위 안에서 유지",
                "group": str(lead.get("symbol") or ""),
                "max_correlation": round(float(max_corr), 4),
                "threshold": threshold,
                "max_correlated_candidates": max_group,
            }
        selected.append(row)
        selected_returns[symbol] = series


def _returns_for_symbol(history: pd.DataFrame | None, window: int) -> pd.Series:
    if history is None or "close" not in history or len(history) < max(5, window // 2):
        return pd.Series(dtype="float64")
    returns = history["close"].dropna().astype(float).pct_change().dropna().tail(window)
    returns.index = pd.RangeIndex(len(returns))
    return returns


def _return_correlation(left: pd.Series, right: pd.Series | None) -> float | None:
    if right is None or left.empty or right.empty:
        return None
    length = min(len(left), len(right))
    if length < 5:
        return None
    corr = left.tail(length).reset_index(drop=True).corr(right.tail(length).reset_index(drop=True))
    if pd.isna(corr) or not math.isfinite(float(corr)):
        return None
    return float(corr)


def _attach_exit_plans(rows: list[dict[str, object]], period_key: str, algorithm_key: str) -> None:
    for row in rows:
        row["exit_plan"] = _exit_plan_for_row(row, period_key, algorithm_key)


def _exit_plan_for_row(row: dict[str, object], period_key: str, algorithm_key: str) -> dict[str, object]:
    config = _exit_rule_config(period_key)
    entry = _number(row.get("last_close"), default=np.nan)
    if not math.isfinite(entry) or entry <= 0:
        return {
            "status": "unavailable",
            "basis": "missing_entry_price",
            "message": "진입 기준가가 없어 매도 계획을 계산하지 못했습니다.",
        }

    holding_days = int(PERIODS.get(period_key, {}).get("holding_days", 0) or 0)
    time_stop_days = config.get("time_stop_days")
    if time_stop_days is None:
        time_stop_days = holding_days
    atr_pct = _number(row.get("atr_14_pct"), default=np.nan)
    if not math.isfinite(atr_pct) or atr_pct <= 0:
        atr_pct = max(_number(row.get("vol_21d"), 0) / math.sqrt(TRADING_DAYS_PER_YEAR), _number(config.get("min_stop_pct"), 0.03))

    stop_pct = float(np.clip(
        atr_pct * _number(config.get("stop_atr_multiple"), 2.0),
        _number(config.get("min_stop_pct"), 0.03),
        _number(config.get("max_stop_pct"), 0.12),
    ))
    take_profit_r = _number(config.get("take_profit_r_multiple"), 2.0)
    take_profit_pct = stop_pct * take_profit_r
    weak_days = int(_number(config.get("weak_momentum_exit_days"), max(1, holding_days // 4 or 1)))
    trailing_pct = _number(config.get("trailing_stop_pct"), stop_pct)
    action = str(row.get("final_action") or "avoid")
    status = "active" if action == "candidate" else "watch_only" if action == "watch" else "inactive"
    message = (
        f"손절 {stop_pct:.1%}, 1차 목표 {take_profit_pct:.1%}, "
        f"시간 손절 {int(time_stop_days)}거래일을 매수 점수와 별도로 관리합니다."
    )
    if _number(row.get("momentum_score")) < 0.35:
        message += f" 모멘텀이 약해 {weak_days}거래일 안에 회복 확인이 필요합니다."

    return _clean(
        {
            "status": status,
            "basis": "atr_volatility_exit_rule",
            "period": period_key,
            "algorithm": algorithm_key,
            "entry_price": round(float(entry), 4),
            "stop_loss_pct": round(stop_pct, 4),
            "stop_loss_price": round(float(entry * (1 - stop_pct)), 4),
            "take_profit_pct": round(take_profit_pct, 4),
            "take_profit_price": round(float(entry * (1 + take_profit_pct)), 4),
            "trailing_stop_pct": round(float(trailing_pct), 4),
            "time_stop_days": int(time_stop_days),
            "weak_momentum_exit_days": weak_days,
            "message": message,
        }
    )


def _exit_rule_config(period_key: str) -> dict[str, object]:
    config = STRATEGY_CONFIG.get("exit_rules", {})
    if not isinstance(config, dict):
        return {}
    base = config.get("default", {}) if isinstance(config.get("default"), dict) else {}
    periods = config.get("periods", {}) if isinstance(config.get("periods"), dict) else {}
    period = periods.get(period_key, {}) if isinstance(periods.get(period_key), dict) else {}
    return {**base, **period}


def _backtest_period(
    period_key: str,
    config: dict[str, object],
    algorithm_key: str,
    selected_by_symbol: dict[str, dict[str, object]],
    histories: dict[str, pd.DataFrame],
    transaction_cost: float,
) -> dict[str, object]:
    holding_days = int(config["holding_days"])
    min_lookback = int(config["min_lookback"])
    step = int(config["step"])
    embargo_days = _backtest_embargo_days()
    cost_model = _backtest_cost_model(transaction_cost)
    validation_scope = {
        "scope": "current_universe_history",
        "universe": "latest_krx_amount_ranked_symbols",
        "price_history": "historical_daily_prices_for_current_symbols",
        "bias_warning": "과거 시점별 상장/거래대금 유니버스가 아니라 최신 유니버스 기준 검증입니다.",
    }
    trades: list[dict[str, object]] = []

    for symbol, history in histories.items():
        base = selected_by_symbol.get(symbol)
        if base is None or len(history) <= min_lookback + embargo_days + holding_days:
            continue
        for position in range(min_lookback + embargo_days, len(history) - holding_days, step):
            feature_position = position - embargo_days
            features = _features_at(history, feature_position)
            scored = _period_score(period_key, features, algorithm_key)
            if scored["score"] < _signal_threshold(period_key, algorithm_key, str(features.get("market_regime") or "range")):
                continue
            entry = float(history["close"].iloc[position])
            exit_price = float(history["close"].iloc[position + holding_days])
            gross = exit_price / entry - 1
            net = gross - float(cost_model["total_cost"])
            path = history["close"].iloc[position : position + holding_days + 1].dropna().astype(float)
            path_returns = path / entry - 1 if not path.empty else pd.Series(dtype="float64")
            max_adverse = float(path_returns.min()) if not path_returns.empty else gross
            max_favorable = float(path_returns.max()) if not path_returns.empty else gross
            trades.append(
                {
                    "as_of": _date_string(history.index[feature_position]),
                    "date": _date_string(history.index[position]),
                    "exit_date": _date_string(history.index[position + holding_days]),
                    "symbol": symbol,
                    "name": base["name"],
                    "score": scored["score"],
                    "market_regime": features.get("market_regime"),
                    "gross_return": round(gross, 4),
                    "net_return": round(net, 4),
                    "max_adverse_return": round(max_adverse, 4),
                    "max_favorable_return": round(max_favorable, 4),
                }
            )

    if not trades:
        return _empty_backtest(cost_model, embargo_days=embargo_days)

    frame = pd.DataFrame(trades)
    max_positions = _backtest_max_positions()
    selected_trades = _select_portfolio_trades(frame, max_positions, embargo_days)
    top_frame = pd.DataFrame(selected_trades)
    if top_frame.empty:
        return _empty_backtest(cost_model, signal_count=int(len(frame)), max_positions=max_positions, embargo_days=embargo_days)

    equity = _portfolio_equity_curve(top_frame, max_positions)
    returns = top_frame["net_return"].astype(float)
    regime_counts = top_frame["market_regime"].fillna("unknown").astype(str).value_counts().to_dict()
    metrics = {
        "trade_count": int(len(top_frame)),
        "signal_count": int(len(frame)),
        "sample_days": int(top_frame["date"].nunique()),
        "exit_days": int(top_frame["exit_date"].nunique()),
        "win_rate": round(float((returns > 0).mean()), 4),
        "average_return": round(float(returns.mean()), 4),
        "median_return": round(float(returns.median()), 4),
        "best_return": round(float(returns.max()), 4),
        "worst_return": round(float(returns.min()), 4),
        "average_max_adverse_return": round(float(top_frame["max_adverse_return"].astype(float).mean()), 4) if "max_adverse_return" in top_frame else None,
        "worst_max_adverse_return": round(float(top_frame["max_adverse_return"].astype(float).min()), 4) if "max_adverse_return" in top_frame else None,
        "average_max_favorable_return": round(float(top_frame["max_favorable_return"].astype(float).mean()), 4) if "max_favorable_return" in top_frame else None,
        "cumulative_return": round(float(equity[-1]["equity"] - 1), 4) if equity else 0,
        "max_drawdown": round(float(_equity_max_drawdown([point["equity"] for point in equity])), 4),
        "transaction_cost": cost_model["transaction_cost"],
        "slippage_cost": cost_model["slippage_cost"],
        "spread_cost": cost_model["spread_cost"],
        "total_cost": cost_model["total_cost"],
        "portfolio_model": "slot_limited_exit_marked",
        "max_positions": max_positions,
        "embargo_days": embargo_days,
        "validation_scope": validation_scope["scope"],
        "universe_selection": validation_scope["universe"],
        "validation_bias_warning": validation_scope["bias_warning"],
        "regime_counts": regime_counts,
    }

    best = top_frame.sort_values("net_return", ascending=False).head(5).to_dict("records")
    worst = top_frame.sort_values("net_return", ascending=True).head(5).to_dict("records")

    return {
        "metrics": _clean(metrics),
        "equity_curve": _clean(equity[-260:]),
        "best_trades": _clean(best),
        "worst_trades": _clean(worst),
        "validation": _strategy_validation({"metrics": metrics}),
        "validation_scope": validation_scope,
    }


def _backtest_max_positions() -> int:
    validation_config = STRATEGY_CONFIG.get("validation", {})
    configured = _number(validation_config.get("max_positions"), 5)
    return max(1, int(configured))


def _backtest_embargo_days() -> int:
    validation_config = STRATEGY_CONFIG.get("validation", {})
    configured = _number(validation_config.get("embargo_days"), 0)
    return max(0, int(configured))


def _backtest_cost_model(transaction_cost: float) -> dict[str, float]:
    validation_config = STRATEGY_CONFIG.get("validation", {})
    cost_config = validation_config.get("trading_costs", {}) if isinstance(validation_config, dict) else {}
    if not isinstance(cost_config, dict):
        cost_config = {}
    slippage_cost = _number(cost_config.get("slippage_bps"), 0) / 10000
    spread_cost = _number(cost_config.get("spread_bps"), 0) / 10000
    base_cost = _number(transaction_cost)
    return {
        "transaction_cost": round(base_cost, 6),
        "slippage_cost": round(slippage_cost, 6),
        "spread_cost": round(spread_cost, 6),
        "total_cost": round(base_cost + slippage_cost + spread_cost, 6),
    }


def _select_portfolio_trades(frame: pd.DataFrame, max_positions: int, embargo_days: int = 0) -> list[dict[str, object]]:
    if frame.empty:
        return []

    selected: list[dict[str, object]] = []
    open_positions: list[dict[str, object]] = []
    ordered = frame.sort_values(["date", "score"], ascending=[True, False])

    for trade_date, group in ordered.groupby("date", sort=True):
        current_date = str(trade_date)
        current_timestamp = pd.Timestamp(current_date)
        open_positions = [
            trade
            for trade in open_positions
            if pd.Timestamp(str(trade.get("exit_date"))) + pd.Timedelta(days=max(0, int(embargo_days))) > current_timestamp
        ]
        held_symbols = {str(trade.get("symbol")) for trade in open_positions}
        slots = max(0, max_positions - len(open_positions))
        if slots <= 0:
            continue

        entry_rank = 0
        for row in group.sort_values("score", ascending=False).to_dict("records"):
            symbol = str(row.get("symbol"))
            if symbol in held_symbols:
                continue
            entry_rank += 1
            row["entry_rank"] = entry_rank
            selected.append(row)
            open_positions.append(row)
            held_symbols.add(symbol)
            slots -= 1
            if slots <= 0:
                break

    return selected


def _portfolio_equity_curve(trades: pd.DataFrame, max_positions: int) -> list[dict[str, object]]:
    if trades.empty:
        return []

    equity = 1.0
    rows = []
    allocation = 1 / max(1, max_positions)
    for exit_date, group in trades.sort_values("exit_date").groupby("exit_date", sort=True):
        slot_return = float(group["net_return"].astype(float).sum()) * allocation
        equity *= 1 + slot_return
        rows.append(
            {
                "date": str(exit_date),
                "equity": round(equity, 4),
                "return": round(slot_return, 4),
                "closed_trades": int(len(group)),
            }
        )
    return rows


def _empty_backtest(
    cost_model: dict[str, float] | float,
    signal_count: int = 0,
    max_positions: int | None = None,
    embargo_days: int | None = None,
) -> dict[str, object]:
    if isinstance(cost_model, dict):
        costs = cost_model
    else:
        costs = _backtest_cost_model(float(cost_model))
    max_positions = max_positions or _backtest_max_positions()
    embargo_days = _backtest_embargo_days() if embargo_days is None else max(0, int(embargo_days))
    metrics = {
        "trade_count": 0,
        "signal_count": signal_count,
        "sample_days": 0,
        "exit_days": 0,
        "win_rate": None,
        "average_return": None,
        "median_return": None,
        "best_return": None,
        "worst_return": None,
        "average_max_adverse_return": None,
        "worst_max_adverse_return": None,
        "average_max_favorable_return": None,
        "cumulative_return": None,
        "max_drawdown": None,
        "transaction_cost": costs["transaction_cost"],
        "slippage_cost": costs["slippage_cost"],
        "spread_cost": costs["spread_cost"],
        "total_cost": costs["total_cost"],
        "portfolio_model": "slot_limited_exit_marked",
        "max_positions": max_positions,
        "embargo_days": embargo_days,
        "validation_scope": "current_universe_history",
        "universe_selection": "latest_krx_amount_ranked_symbols",
        "validation_bias_warning": "과거 시점별 상장/거래대금 유니버스가 아니라 최신 유니버스 기준 검증입니다.",
        "regime_counts": {},
    }
    return {"metrics": metrics, "equity_curve": [], "best_trades": [], "worst_trades": [], "validation": _strategy_validation({"metrics": metrics})}


def _strategy_validation(backtest: dict[str, object]) -> dict[str, object]:
    validation_config = STRATEGY_CONFIG.get("validation", {})
    min_trades = int(_number(validation_config.get("min_trades"), 20))
    min_win_rate = _number(validation_config.get("min_win_rate"), 0.48)
    min_average_return = _number(validation_config.get("min_average_return"), -0.005)
    max_drawdown_floor = _number(validation_config.get("max_drawdown_floor"), -0.45)
    metrics = backtest.get("metrics", {})
    trade_count = int(metrics.get("trade_count") or 0)
    win_rate = metrics.get("win_rate")
    average_return = metrics.get("average_return")
    max_drawdown = metrics.get("max_drawdown")
    passed = (
        trade_count >= min_trades
        and win_rate is not None
        and float(win_rate) >= min_win_rate
        and average_return is not None
        and float(average_return) > min_average_return
        and (max_drawdown is None or float(max_drawdown) > max_drawdown_floor)
    )
    reasons = []
    if trade_count < min_trades:
        reasons.append(f"검증 거래 표본 {min_trades}건 미만")
    if win_rate is not None and float(win_rate) < min_win_rate:
        reasons.append("승률 기준 미달")
    if average_return is not None and float(average_return) <= min_average_return:
        reasons.append("평균 수익률 기준 미달")
    if max_drawdown is not None and float(max_drawdown) <= max_drawdown_floor:
        reasons.append("최대 낙폭 기준 미달")
    warnings = []
    scope = metrics.get("validation_scope")
    if scope == "current_universe_history":
        warnings.append("최신 유니버스 기준 검증이므로 생존편향/현재 거래대금 편향 가능성이 있습니다.")
    return {
        "passed": passed,
        "reasons": reasons or ["검증 기준 통과"],
        "warnings": warnings,
        "scope": scope,
    }


def _signal_quality_report(
    rows: list[dict[str, object]],
    backtest: dict[str, object],
    strategy_ok: dict[str, object],
    period_key: str,
    algorithm_key: str,
) -> dict[str, object]:
    metrics = backtest.get("metrics", {}) if isinstance(backtest, dict) else {}
    trade_count = int(metrics.get("trade_count") or 0)
    win_rate = metrics.get("win_rate")
    average_return = metrics.get("average_return")
    max_drawdown = metrics.get("max_drawdown")
    initial_candidates = [row for row in rows if row.get("action_before_safety_filters") == "candidate"]
    final_candidates = [row for row in rows if row.get("final_action") == "candidate"]
    watch = [row for row in rows if row.get("final_action") == "watch"]
    risk_blocked = [row for row in initial_candidates if "risk_gate" in (row.get("candidate_blocked_by") or [])]
    regime_blocked = [row for row in initial_candidates if "market_regime_filter" in (row.get("candidate_blocked_by") or [])]
    validation_blocked = [row for row in initial_candidates if "strategy_validation" in (row.get("candidate_blocked_by") or [])]
    blocked_total = len({str(row.get("symbol")) for row in risk_blocked + regime_blocked + validation_blocked})

    score = 52.0
    min_trades = int(_number(STRATEGY_CONFIG.get("validation", {}).get("min_trades"), 20))
    score += min(12.0, trade_count / max(1, min_trades) * 8.0)
    score += 14.0 if strategy_ok.get("passed") else -8.0
    if win_rate is not None:
        score += float(np.clip((float(win_rate) - 0.48) * 80, -12, 12))
    if average_return is not None:
        score += float(np.clip(float(average_return) * 450, -10, 12))
    if max_drawdown is not None and float(max_drawdown) <= -0.35:
        score -= 8.0
    if initial_candidates:
        score -= min(18.0, blocked_total / len(initial_candidates) * 18.0)
    if not final_candidates and initial_candidates:
        score -= 6.0

    score = round(float(np.clip(score, 0, 100)), 1)
    signal = "candidate" if score >= 72 else "watch" if score >= 52 else "warning"
    warnings = list(strategy_ok.get("warnings") or [])
    if risk_blocked:
        warnings.append(f"리스크 게이트로 후보 {len(risk_blocked)}개 하향")
    if regime_blocked:
        warnings.append(f"시장 국면 필터로 후보 {len(regime_blocked)}개 하향")
    if validation_blocked:
        warnings.append(f"전략 검증 기준으로 후보 {len(validation_blocked)}개 하향")
    if metrics.get("validation_bias_warning"):
        warnings.append(str(metrics["validation_bias_warning"]))

    reason = (
        f"검증 {trade_count}건 · 승률 {_rate_text(win_rate)} · 평균 {_return_text(average_return)} · "
        f"초기 후보 {len(initial_candidates)}개 중 안전필터 하향 {blocked_total}개"
    )
    action = "후보 유지" if signal == "candidate" else "관찰 우선" if signal == "watch" else "신규 진입 보류"

    return _clean(
        {
            "period": period_key,
            "algorithm": algorithm_key,
            "score": score,
            "signal": signal,
            "reason": reason,
            "action": action,
            "candidate_count": len(final_candidates),
            "watch_count": len(watch),
            "initial_candidate_count": len(initial_candidates),
            "blocked_candidate_count": blocked_total,
            "risk_gate_blocked_count": len(risk_blocked),
            "market_regime_blocked_count": len(regime_blocked),
            "strategy_validation_blocked_count": len(validation_blocked),
            "trade_count": trade_count,
            "win_rate": win_rate,
            "average_return": average_return,
            "max_drawdown": max_drawdown,
            "strategy_validation_passed": bool(strategy_ok.get("passed")),
            "warnings": _unique_strings(warnings),
            "blocked_symbols": [
                {
                    "symbol": row.get("symbol"),
                    "name": row.get("name"),
                    "blocked_by": row.get("candidate_blocked_by") or [],
                    "reason": row.get("reason"),
                }
                for row in initial_candidates
                if row.get("candidate_blocked_by")
            ][:12],
            "basis": "current_universe_daily_history_with_safety_filters",
        }
    )


def _rate_text(value: object) -> str:
    number = _number(value, default=np.nan)
    return "-" if not math.isfinite(number) else f"{number:.1%}"


def _return_text(value: object) -> str:
    number = _number(value, default=np.nan)
    return "-" if not math.isfinite(number) else f"{number:.2%}"


def _unique_strings(values: list[object]) -> list[str]:
    result = []
    seen = set()
    for value in values:
        text = str(value or "").strip()
        if not text or text in seen:
            continue
        seen.add(text)
        result.append(text)
    return result


def _build_signal_tracking_report(
    period_results: dict[str, dict[str, object]],
    histories: dict[str, pd.DataFrame],
    out_path: Path,
    generated_at: datetime,
) -> dict[str, object]:
    config = STRATEGY_CONFIG.get("signal_tracking", {})
    if not isinstance(config, dict) or config.get("enabled") is False:
        return {"enabled": False, "basis": "disabled"}

    snapshot_dir = out_path / str(config.get("snapshot_dir") or "signal_snapshots")
    snapshot_dir.mkdir(parents=True, exist_ok=True)
    horizons = _tracking_horizons(config)
    current_snapshot = _build_signal_snapshot(period_results, generated_at, config)
    previous_snapshots = _load_signal_snapshots(snapshot_dir, exclude_as_of=str(current_snapshot.get("as_of") or ""))
    outcomes: list[dict[str, object]] = []
    unresolved = 0
    for snapshot in previous_snapshots:
        result = _snapshot_outcomes(snapshot, histories, horizons)
        outcomes.extend(result["resolved"])
        unresolved += int(result["unresolved_count"])

    performance = _aggregate_algorithm_performance(outcomes)
    summary = _tracking_summary(outcomes, performance, current_snapshot)
    _write_signal_snapshot(snapshot_dir, current_snapshot)
    recent_limit = max(1, int(_number(config.get("recent_outcome_limit"), 80)))
    return _clean(
        {
            "enabled": True,
            "basis": "daily_signal_snapshots_with_current_history_outcomes",
            "snapshot_dir": snapshot_dir.name,
            "horizons": horizons,
            "snapshot_count": len(previous_snapshots) + 1,
            "current_snapshot": {
                "as_of": current_snapshot.get("as_of"),
                "generated_at": current_snapshot.get("generated_at"),
                "signal_count": len(current_snapshot.get("signals") or []),
                "periods": current_snapshot.get("periods") or {},
            },
            "summary": summary,
            "performance_by_algorithm": performance,
            "recent_outcomes": sorted(outcomes, key=lambda item: str(item.get("snapshot_as_of") or ""), reverse=True)[:recent_limit],
            "unresolved_count": unresolved,
            "warnings": [
                "스냅샷은 생성일 이후 데이터가 충분히 쌓인 항목만 성과 계산됩니다.",
                "현재 확보한 일봉 이력 기준이므로 실제 체결가/슬리피지는 별도 검증이 필요합니다.",
            ],
        }
    )


def _tracking_horizons(config: dict[str, object]) -> list[int]:
    raw = config.get("horizons") or [1, 3, 5, 20]
    if not isinstance(raw, list):
        raw = [1, 3, 5, 20]
    horizons = sorted({max(1, int(_number(value, 0))) for value in raw if _number(value, 0) > 0})
    return horizons or [1, 3, 5, 20]


def _build_signal_snapshot(
    period_results: dict[str, dict[str, object]],
    generated_at: datetime,
    config: dict[str, object] | None = None,
) -> dict[str, object]:
    config = config or {}
    track_actions = set(config.get("track_actions") or ["candidate", "watch"])
    max_rows = max(1, int(_number(config.get("max_rows_per_period_algorithm"), 60)))
    periods: dict[str, object] = {}
    signals: list[dict[str, object]] = []

    for period_key, period in period_results.items():
        algorithms = period.get("algorithms") if isinstance(period, dict) else {}
        if not isinstance(algorithms, dict) or not algorithms:
            algorithms = {str(period.get("algorithm") or "default"): period}
        period_counts = {"candidate": 0, "watch": 0, "tracked": 0}
        for algorithm_key, payload in algorithms.items():
            if not isinstance(payload, dict):
                continue
            rows = payload.get("rows") or []
            if not isinstance(rows, list):
                continue
            tracked = [
                row
                for row in rows
                if isinstance(row, dict) and str(row.get("final_action") or "") in track_actions
            ][:max_rows]
            for row in tracked:
                signal = _snapshot_row(row, period_key, str(algorithm_key), payload)
                signals.append(signal)
                action = str(signal.get("final_action") or "watch")
                if action in period_counts:
                    period_counts[action] += 1
                period_counts["tracked"] += 1
        periods[period_key] = period_counts

    generated_date = generated_at.date().isoformat()
    as_of = _snapshot_as_of(signals) or generated_date
    return _clean(
        {
            "schema_version": 1,
            "generated_at": generated_at.isoformat(),
            "as_of": as_of,
            "timezone": TIMEZONE,
            "basis": "market_report_default_and_algorithm_rows",
            "periods": periods,
            "signals": signals,
        }
    )


def _snapshot_row(row: dict[str, object], period_key: str, algorithm_key: str, payload: dict[str, object]) -> dict[str, object]:
    fields = [
        "symbol",
        "name",
        "market",
        "as_of",
        "rank",
        "score",
        "score_percentile",
        "final_action",
        "trade_signal",
        "reason",
        "market_regime",
        "momentum_score",
        "risk_score",
        "liquidity_score",
        "issue_score",
        "trend_score",
        "last_close",
        "ret_1d",
        "ret_5d",
        "ret_21d",
        "vol_21d",
        "atr_14_pct",
        "candidate_blocked_by",
        "risk_gate",
        "market_regime_filter",
        "diversification_filter",
        "exit_plan",
    ]
    result = {field: row.get(field) for field in fields if field in row}
    result.update(
        {
            "period": period_key,
            "algorithm": algorithm_key,
            "algorithm_label": row.get("algorithm_label") or payload.get("algorithm_label") or algorithm_key,
            "holding_days": payload.get("holding_days"),
            "entry_close": row.get("last_close"),
            "tracking_key": f"{period_key}:{algorithm_key}:{row.get('symbol')}:{row.get('as_of')}",
        }
    )
    return result


def _snapshot_as_of(signals: list[dict[str, object]]) -> str | None:
    dates = sorted({str(row.get("as_of") or "") for row in signals if row.get("as_of")})
    return dates[-1] if dates else None


def _write_signal_snapshot(snapshot_dir: Path, snapshot: dict[str, object]) -> Path:
    as_of = str(snapshot.get("as_of") or datetime.now(ZoneInfo(TIMEZONE)).date().isoformat())[:10]
    target = snapshot_dir / f"{as_of}.json"
    target.write_text(json.dumps(_clean(snapshot), ensure_ascii=False, indent=2, allow_nan=False), encoding="utf-8")
    return target


def _load_signal_snapshots(snapshot_dir: Path, exclude_as_of: str = "") -> list[dict[str, object]]:
    snapshots = []
    if not snapshot_dir.exists():
        return snapshots
    for path in sorted(snapshot_dir.glob("*.json")):
        try:
            snapshot = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if not isinstance(snapshot, dict):
            continue
        if exclude_as_of and str(snapshot.get("as_of") or "")[:10] == exclude_as_of[:10]:
            continue
        snapshots.append(snapshot)
    return snapshots


def _snapshot_outcomes(
    snapshot: dict[str, object],
    histories: dict[str, pd.DataFrame],
    horizons: list[int],
) -> dict[str, object]:
    resolved: list[dict[str, object]] = []
    unresolved_count = 0
    signals = snapshot.get("signals") or []
    if not isinstance(signals, list):
        return {"resolved": resolved, "unresolved_count": 0}

    for signal in signals:
        if not isinstance(signal, dict):
            continue
        history = histories.get(str(signal.get("symbol") or ""))
        outcomes = _outcomes_for_signal(signal, history, horizons, str(snapshot.get("as_of") or ""))
        if outcomes:
            resolved.extend(outcomes)
        else:
            unresolved_count += 1
    return {"resolved": resolved, "unresolved_count": unresolved_count}


def _outcomes_for_signal(
    signal: dict[str, object],
    history: pd.DataFrame | None,
    horizons: list[int],
    snapshot_as_of: str,
) -> list[dict[str, object]]:
    if history is None or "close" not in history or history.empty:
        return []
    as_of = str(signal.get("as_of") or snapshot_as_of or "")[:10]
    entry_position = _history_position_for_date(history, as_of)
    if entry_position is None:
        return []
    close = history["close"].dropna().astype(float)
    if entry_position >= len(close):
        return []
    entry_price = _number(signal.get("entry_close"), default=np.nan)
    if not math.isfinite(entry_price) or entry_price <= 0:
        entry_price = float(close.iloc[entry_position])
    if entry_price <= 0:
        return []

    rows: list[dict[str, object]] = []
    for horizon in horizons:
        exit_position = entry_position + horizon
        if exit_position >= len(close):
            continue
        path = close.iloc[entry_position : exit_position + 1]
        path_returns = path / entry_price - 1
        raw_return = float(close.iloc[exit_position] / entry_price - 1)
        rule = _rule_exit_outcome(signal.get("exit_plan"), path, entry_price, horizon)
        rows.append(
            _clean(
                {
                    "snapshot_as_of": as_of,
                    "symbol": signal.get("symbol"),
                    "name": signal.get("name"),
                    "period": signal.get("period"),
                    "algorithm": signal.get("algorithm"),
                    "algorithm_label": signal.get("algorithm_label"),
                    "final_action": signal.get("final_action"),
                    "score": signal.get("score"),
                    "horizon": horizon,
                    "entry_price": round(float(entry_price), 4),
                    "exit_date": _date_string(close.index[exit_position]),
                    "return": round(raw_return, 4),
                    "max_adverse_return": round(float(path_returns.min()), 4),
                    "max_favorable_return": round(float(path_returns.max()), 4),
                    "win": raw_return > 0,
                    "rule_return": rule.get("return"),
                    "rule_exit_day": rule.get("exit_day"),
                    "rule_exit_reason": rule.get("reason"),
                    "basis": "close_to_close_snapshot_outcome",
                }
            )
        )
    return rows


def _history_position_for_date(history: pd.DataFrame, as_of: str) -> int | None:
    if not as_of:
        return None
    close = history["close"].dropna()
    if close.empty:
        return None
    target = pd.Timestamp(as_of)
    dates = pd.Series(pd.to_datetime(close.index).date, index=range(len(close)))
    eligible = [index for index, value in dates.items() if pd.Timestamp(value) <= target]
    if not eligible:
        return None
    return int(eligible[-1])


def _rule_exit_outcome(exit_plan: object, path: pd.Series, entry_price: float, horizon: int) -> dict[str, object]:
    if not isinstance(exit_plan, dict) or path.empty:
        return {"return": None, "exit_day": None, "reason": "no_exit_plan"}
    stop_price = _number(exit_plan.get("stop_loss_price"), default=np.nan)
    target_price = _number(exit_plan.get("take_profit_price"), default=np.nan)
    time_stop_days = int(_number(exit_plan.get("time_stop_days"), horizon))
    time_stop_days = max(1, min(horizon, time_stop_days))
    for day, close in enumerate(path.iloc[1:], start=1):
        price = float(close)
        if math.isfinite(stop_price) and price <= stop_price:
            return {"return": round(price / entry_price - 1, 4), "exit_day": day, "reason": "stop_loss"}
        if math.isfinite(target_price) and price >= target_price:
            return {"return": round(price / entry_price - 1, 4), "exit_day": day, "reason": "take_profit"}
        if day >= time_stop_days:
            return {"return": round(price / entry_price - 1, 4), "exit_day": day, "reason": "time_stop"}
    price = float(path.iloc[-1])
    return {"return": round(price / entry_price - 1, 4), "exit_day": min(horizon, len(path) - 1), "reason": "horizon_close"}


def _aggregate_algorithm_performance(outcomes: list[dict[str, object]]) -> list[dict[str, object]]:
    if not outcomes:
        return []
    frame = pd.DataFrame(outcomes)
    required = {"period", "algorithm", "final_action", "horizon", "return"}
    if not required.issubset(frame.columns):
        return []
    rows: list[dict[str, object]] = []
    group_fields = ["period", "algorithm", "final_action", "horizon"]
    for keys, group in frame.groupby(group_fields, dropna=False):
        returns = group["return"].astype(float)
        rule_returns = group["rule_return"].dropna().astype(float) if "rule_return" in group else pd.Series(dtype="float64")
        row = {
            "period": keys[0],
            "algorithm": keys[1],
            "final_action": keys[2],
            "horizon": int(keys[3]),
            "sample_count": int(len(group)),
            "win_rate": round(float((returns > 0).mean()), 4),
            "average_return": round(float(returns.mean()), 4),
            "median_return": round(float(returns.median()), 4),
            "best_return": round(float(returns.max()), 4),
            "worst_return": round(float(returns.min()), 4),
            "average_max_adverse_return": round(float(group["max_adverse_return"].astype(float).mean()), 4) if "max_adverse_return" in group else None,
            "average_max_favorable_return": round(float(group["max_favorable_return"].astype(float).mean()), 4) if "max_favorable_return" in group else None,
            "rule_average_return": round(float(rule_returns.mean()), 4) if not rule_returns.empty else None,
        }
        rows.append(_clean(row))
    return sorted(rows, key=lambda item: (str(item["period"]), str(item["algorithm"]), int(item["horizon"]), str(item["final_action"])))


def _tracking_summary(
    outcomes: list[dict[str, object]],
    performance: list[dict[str, object]],
    current_snapshot: dict[str, object],
) -> dict[str, object]:
    candidate_perf = [
        row for row in performance
        if row.get("final_action") == "candidate" and int(row.get("horizon") or 0) in {3, 5, 20}
    ]
    sample_count = sum(int(row.get("sample_count") or 0) for row in candidate_perf)
    avg_return = (
        sum(_number(row.get("average_return")) * int(row.get("sample_count") or 0) for row in candidate_perf) / sample_count
        if sample_count else None
    )
    avg_win_rate = (
        sum(_number(row.get("win_rate")) * int(row.get("sample_count") or 0) for row in candidate_perf) / sample_count
        if sample_count else None
    )
    score = 42.0 + min(18.0, len(outcomes) / 10)
    if avg_win_rate is not None:
        score += float(np.clip((avg_win_rate - 0.5) * 90, -12, 16))
    if avg_return is not None:
        score += float(np.clip(avg_return * 500, -12, 16))
    score = round(float(np.clip(score, 0, 100)), 1)
    signal = "candidate" if score >= 72 else "watch" if score >= 52 else "warning"
    return _clean(
        {
            "score": score,
            "signal": signal,
            "outcome_count": len(outcomes),
            "candidate_sample_count": sample_count,
            "average_candidate_return": round(float(avg_return), 4) if avg_return is not None else None,
            "average_candidate_win_rate": round(float(avg_win_rate), 4) if avg_win_rate is not None else None,
            "current_signal_count": len(current_snapshot.get("signals") or []),
            "message": (
                f"성과 표본 {len(outcomes)}개 · 후보 평균 {_return_text(avg_return)} · 후보 승률 {_rate_text(avg_win_rate)}"
                if outcomes else "이전 스냅샷이 없어 성과 표본을 아직 누적 중입니다."
            ),
        }
    )


def _build_period_funnel(
    period_key: str,
    algorithm_key: str,
    universe: list[dict[str, object]],
    selected: list[dict[str, object]],
    histories: dict[str, pd.DataFrame],
    rows: list[dict[str, object]],
) -> list[dict[str, object]]:
    selected_symbols = {row["symbol"] for row in selected}
    history_symbols = set(histories)
    row_by_symbol = {row["symbol"]: row for row in rows}
    funnel_thresholds = STRATEGY_CONFIG.get("funnel_thresholds", {})
    min_liquidity = _number(funnel_thresholds.get("min_liquidity_score"), 0.35)
    min_momentum = _number(funnel_thresholds.get("min_momentum_score"), 0.35)
    min_risk = _number(funnel_thresholds.get("min_risk_score"), 0.25)
    stages = [
        ("raw_universe", "모데이터", "KOSPI/KOSDAQ 전체 상장 목록", [row["symbol"] for row in universe]),
        ("core_stock", "국내 주식 분류", "스팩/ETF 등은 태그로 분리하고 보통주 중심 분석군을 만듭니다.", [row["symbol"] for row in selected]),
        ("history_ready", "가격 이력 확보", "기간별 지표와 백테스트가 가능한 종목만 남깁니다.", list(history_symbols)),
        ("liquidity", "유동성 검증", f"거래대금 기반 유동성 점수 {min_liquidity:g} 이상", [symbol for symbol, row in row_by_symbol.items() if _number(row.get("liquidity_score")) >= min_liquidity]),
        ("validated", "검증 필터", "모멘텀, 추세, 리스크 점수를 통과한 종목", [symbol for symbol, row in row_by_symbol.items() if _number(row.get("momentum_score")) >= min_momentum and _number(row.get("risk_score")) >= min_risk]),
        ("safety_gate", "안전 게이트", "데이터 부족, 거래대금 부족, 급등락, 과변동성, 하락 국면 후보를 하향합니다.", [symbol for symbol, row in row_by_symbol.items() if _row_safety_gate_passed(row)]),
        ("issue", "이슈/관심도 필터", "거래량·거래대금 급증과 신고가 근접도 기반 관심도", [symbol for symbol, row in row_by_symbol.items() if _number(row.get("issue_score")) >= _issue_threshold(period_key)]),
        ("final", "최종 후보", _final_stage_description(period_key, algorithm_key), [row["symbol"] for row in rows if row.get("final_action") == "candidate"]),
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


def _row_safety_gate_passed(row: dict[str, object]) -> bool:
    for key in ("risk_gate", "market_regime_filter"):
        gate = row.get(key)
        if isinstance(gate, dict) and not gate.get("passed"):
            return False
    return True


def _issue_threshold(period_key: str) -> float:
    thresholds = STRATEGY_CONFIG.get("funnel_thresholds", {}).get("issue_score_min_by_period", {})
    if isinstance(thresholds, dict) and period_key in thresholds:
        return _number(thresholds[period_key])
    return 0.20


def _final_stage_description(period_key: str, algorithm_key: str) -> str:
    if _keeps_short_term_candidates(period_key, algorithm_key):
        return "1일 단기 알고리즘 상위 3개를 검증 관찰로 표시"
    return "점수와 과거 동일 규칙 검증을 함께 통과"


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


def _atr_pct(high: pd.Series, low: pd.Series, close: pd.Series, window: int) -> float:
    if len(close) < max(2, window):
        return np.nan
    high = high.astype(float)
    low = low.astype(float)
    close = close.astype(float)
    previous_close = close.shift(1)
    true_range = pd.concat(
        [
            high - low,
            (high - previous_close).abs(),
            (low - previous_close).abs(),
        ],
        axis=1,
    ).max(axis=1)
    sample = true_range.dropna().tail(window)
    latest = close.iloc[-1]
    if sample.empty or not latest:
        return np.nan
    return float(sample.mean() / latest)


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
    if math.isnan(value) or math.isinf(value) or high == low:
        return 0.0
    return 1 - _clip(value, low, high)


def _safe_log10(value: object) -> float:
    number = _number(value, default=0.0)
    if number <= 0:
        return np.nan
    return math.log10(number)


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
