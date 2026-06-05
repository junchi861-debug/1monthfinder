from __future__ import annotations

import json
import math
import re
import tempfile
import threading
import urllib.error
import urllib.parse
import urllib.request
from html import unescape
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import Any


KST = timezone(timedelta(hours=9), "KST")
PROJECT_ROOT = Path(__file__).resolve().parents[1]
INDEX_TRADING_CONFIG_PATH = PROJECT_ROOT / "config" / "algorithms" / "index_trading.json"
WEEKLY_OPTIONS_CONFIG_PATH = PROJECT_ROOT / "config" / "algorithms" / "weekly_options.json"
YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
NAVER_INDEX_TIME_URL = "https://finance.naver.com/sise/sise_index_time.naver"
NAVER_ITEM_TIME_URL = "https://finance.naver.com/item/sise_time.nhn"
SNAPSHOT_CACHE_SECONDS = 45
NAVER_RECENT_PAGES = 14
NAVER_FULL_SESSION_PAGES = 80
OPTIONS_SESSION_START = time(8, 45)
OPTIONS_SESSION_END = time(15, 45)
SIGNAL_LOG_PATH = PROJECT_ROOT / "site" / "data" / "options_signal_log.json"
SIGNAL_LOG_SCHEMA_VERSION = 1
SIGNAL_LOG_LOCK_TIMEOUT_SECONDS = 2.0
SIGNAL_LOG_LOCK = threading.Lock()
SIGNAL_LOG_WRITE_LOCK = threading.Lock()
_SNAPSHOT_CACHE: dict[str, Any] = {"created_at": 0.0, "payload": None}
_ALGORITHM_SETTINGS_CACHE: dict[str, Any] | None = None
CODEX_EXPERIMENTAL_PROFIT_EXTENSION_TAG = "codex_experimental_profit_extension"
TRADE_COLORS = {
    "entry": "#2f7f83",
    "stop": "#a95f59",
    "tp1": "#5275ad",
    "tp2": "#315f9d",
    "exit": "#657186",
    "mixed": "#b07a2a",
    "watch": "#a97022",
    "test": "#a97022",
    "risk": "#a95f59",
    "take_profit": "#5275ad",
}


@dataclass(frozen=True)
class MonitorInstrument:
    role: str
    symbol: str
    label: str
    provider: str = "yahoo"
    naver_code: str | None = None
    naver_kind: str | None = None


MAIN_INSTRUMENT = MonitorInstrument(
    role="main",
    symbol="KOSPI200.KS",
    label="KOSPI200 지수",
    provider="yahoo+naver",
    naver_code="KPI200",
    naver_kind="index",
)
SECONDARY_INSTRUMENT = MonitorInstrument(
    role="secondary",
    symbol="069500.KS",
    label="KODEX200 보조",
    provider="yahoo+naver",
    naver_code="069500",
    naver_kind="item",
)


def _algorithm_settings() -> dict[str, Any]:
    global _ALGORITHM_SETTINGS_CACHE
    if _ALGORITHM_SETTINGS_CACHE is not None:
        return _ALGORITHM_SETTINGS_CACHE

    settings: dict[str, Any] = {
        "fib_618_lower_wick_ratio": 0.35,
        "index_reset_near_tolerance": 0.2,
        "index_reset_lower_wick_ratio": 0.30,
        "default_entry_premium": 1.6,
        "default_contracts": 3,
        "reset_entry_premium": 1.6,
        "reset_contracts": 2,
        "tenkan_entry_premium": 2.3,
        "tenkan_contracts": 2,
        "index_execution_cost_points": 0.15,
        "option_spread_pct": 0.04,
        "option_slippage_pct": 0.015,
        "confidence_prior_success": 0.5,
        "confidence_prior_strength": 6,
        "min_samples_for_full_confidence": 20,
        "market_regimes": {
            "trend_up": {
                "fib_618_lower_wick_ratio_delta": -0.04,
                "index_reset_lower_wick_ratio_delta": -0.03,
                "index_reset_near_tolerance_multiplier": 1.2,
                "confidence_bonus": 4,
            },
            "range": {
                "fib_618_lower_wick_ratio_delta": 0,
                "index_reset_lower_wick_ratio_delta": 0,
                "index_reset_near_tolerance_multiplier": 1.0,
                "confidence_bonus": 0,
            },
            "volatile": {
                "fib_618_lower_wick_ratio_delta": 0.08,
                "index_reset_lower_wick_ratio_delta": 0.06,
                "index_reset_near_tolerance_multiplier": 0.85,
                "confidence_bonus": -6,
            },
            "trend_down": {
                "fib_618_lower_wick_ratio_delta": 0.10,
                "index_reset_lower_wick_ratio_delta": 0.08,
                "index_reset_near_tolerance_multiplier": 0.75,
                "confidence_bonus": -8,
            },
        },
    }

    index_config = _read_json_object(INDEX_TRADING_CONFIG_PATH)
    wick = _nested(
        index_config,
        "fibonacci",
        "reset_on_break",
        "call_retry_prepare",
        "wick_confirmation",
    )
    if isinstance(wick, dict):
        settings["index_reset_near_tolerance"] = _settings_number(
            wick.get("near_tolerance"),
            settings["index_reset_near_tolerance"],
        )
        settings["index_reset_lower_wick_ratio"] = _settings_number(
            wick.get("lower_wick_ratio_threshold"),
            settings["index_reset_lower_wick_ratio"],
        )

    weekly_config = _read_json_object(WEEKLY_OPTIONS_CONFIG_PATH)
    entry = weekly_config.get("entry") if isinstance(weekly_config, dict) else {}
    if isinstance(entry, dict):
        settings["default_contracts"] = _settings_int(entry.get("initial_contracts"), settings["default_contracts"])
        strike = entry.get("strike_selection")
        if isinstance(strike, dict):
            settings["default_entry_premium"] = _settings_number(strike.get("target_premium"), settings["default_entry_premium"])
        tenkan = entry.get("tenkan_kijun_continuation_entry")
        if isinstance(tenkan, dict):
            settings["tenkan_entry_premium"] = _settings_number(
                tenkan.get("preferred_entry_premium"),
                settings["tenkan_entry_premium"],
            )
            settings["tenkan_contracts"] = _settings_int(tenkan.get("contracts"), settings["tenkan_contracts"])

    reset_prepare = _nested(index_config, "fibonacci", "reset_on_break", "call_retry_prepare")
    if isinstance(reset_prepare, dict):
        premiums = reset_prepare.get("target_premium_range")
        if isinstance(premiums, list) and premiums:
            numeric = [_settings_number(value, float("nan")) for value in premiums]
            numeric = [value for value in numeric if math.isfinite(value)]
            if numeric:
                settings["reset_entry_premium"] = sum(numeric) / len(numeric)
        contracts = reset_prepare.get("contracts_range")
        if isinstance(contracts, list) and contracts:
            numeric_contracts = [_settings_int(value, 0) for value in contracts]
            numeric_contracts = [value for value in numeric_contracts if value > 0]
            if numeric_contracts:
                settings["reset_contracts"] = min(numeric_contracts)

    market_regimes = index_config.get("market_regimes") if isinstance(index_config, dict) else {}
    if isinstance(market_regimes, dict):
        settings["market_regimes"] = _merge_market_regimes(settings["market_regimes"], market_regimes)

    execution_quality = weekly_config.get("execution_quality") if isinstance(weekly_config, dict) else {}
    if isinstance(execution_quality, dict):
        settings["index_execution_cost_points"] = _settings_number(
            execution_quality.get("index_execution_cost_points"),
            settings["index_execution_cost_points"],
        )
        settings["option_spread_pct"] = _settings_number(
            execution_quality.get("option_spread_pct"),
            settings["option_spread_pct"],
        )
        settings["option_slippage_pct"] = _settings_number(
            execution_quality.get("option_slippage_pct"),
            settings["option_slippage_pct"],
        )

    confidence = weekly_config.get("confidence") if isinstance(weekly_config, dict) else {}
    if isinstance(confidence, dict):
        settings["confidence_prior_success"] = _settings_number(
            confidence.get("prior_success_rate"),
            settings["confidence_prior_success"],
        )
        settings["confidence_prior_strength"] = _settings_number(
            confidence.get("prior_strength"),
            settings["confidence_prior_strength"],
        )
        settings["min_samples_for_full_confidence"] = _settings_int(
            confidence.get("min_samples_for_full_confidence"),
            settings["min_samples_for_full_confidence"],
        )

    _ALGORITHM_SETTINGS_CACHE = settings
    return settings


def _merge_market_regimes(defaults: dict[str, Any], overrides: dict[str, Any]) -> dict[str, Any]:
    merged = {key: dict(value) for key, value in defaults.items() if isinstance(value, dict)}
    for key, value in overrides.items():
        if not isinstance(value, dict):
            continue
        base = merged.get(str(key), {})
        merged[str(key)] = {**base, **value}
    return merged


def _read_json_object(path: Path) -> dict[str, Any]:
    try:
        with path.open("r", encoding="utf-8") as file:
            data = json.load(file)
    except (OSError, json.JSONDecodeError):
        return {}
    return data if isinstance(data, dict) else {}


def _nested(data: dict[str, Any], *keys: str) -> Any:
    current: Any = data
    for key in keys:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current


def _settings_number(value: Any, default: float) -> float:
    number = _num(value)
    return number if number is not None else default


def _settings_int(value: Any, default: int) -> int:
    number = _num(value)
    return max(1, int(number)) if number is not None else default


def build_options_monitor_snapshot(use_cache: bool = True) -> dict[str, Any]:
    """Build a read-only intraday monitoring snapshot for the options screen."""

    now_ts = datetime.now(KST).timestamp()
    if use_cache and _SNAPSHOT_CACHE["payload"] and now_ts - float(_SNAPSHOT_CACHE["created_at"]) < SNAPSHOT_CACHE_SECONDS:
        return _SNAPSHOT_CACHE["payload"]

    generated_at = datetime.now(KST)
    main = _build_instrument_snapshot(MAIN_INSTRUMENT, generated_at)
    secondary = _build_instrument_snapshot(SECONDARY_INSTRUMENT, generated_at)
    etf_context = _build_etf_fibonacci_context(generated_at, secondary.get("candles") or [])
    if etf_context:
        main["etf_context"] = etf_context
        secondary["etf_context"] = etf_context
        main["signal"] = _attach_etf_context_to_signal(main.get("signal") or {}, etf_context)
        if main.get("ok"):
            session_candles = _latest_session_candles(main.get("candles") or [])
            main.update(
                _dashboard_payload(
                    session_candles,
                    main.get("levels") or {},
                    main.get("signals") or [],
                    main["signal"],
                    generated_at,
                )
            )
    main_session_candles = _latest_session_candles(main.get("candles") or [])
    main["recent_signals"] = _persist_signal_entries(
        _attach_signal_outcomes(main.get("recent_signals") or [], main_session_candles, generated_at),
        generated_at,
        main_session_candles,
    )
    main["signal_performance"] = _signal_performance_summary(main["recent_signals"])
    main["signal_log_source"] = "backend"
    payload = {
        "ok": bool(main.get("ok")),
        "mode": "monitor_only",
        "generated_at": _iso(generated_at),
        "poll_seconds": 60,
        "etf_context": etf_context,
        "source": {
            "name": "Yahoo Finance + Naver Finance",
            "key_required": False,
            "note": "Yahoo 5분봉과 네이버 1분 장중 시세를 합쳐 1분 예비 감지와 5분 확정 신호를 나눕니다. KODEX200 피보나치 컨텍스트는 ETF 분할매수 원칙이라 옵션 직접 비중 규칙으로 쓰지 않습니다. 주문/계좌 기능은 사용하지 않습니다.",
        },
        "main": main,
        "secondary": secondary,
        "signal_log": {
            "source": "backend",
            "entries": main["recent_signals"],
            "performance": main["signal_performance"],
            "path": str(SIGNAL_LOG_PATH),
        },
        "signal": main.get("signal", _empty_signal("neutral", "데이터 대기", "분봉 데이터를 기다리고 있습니다.")),
    }
    _SNAPSHOT_CACHE["created_at"] = now_ts
    _SNAPSHOT_CACHE["payload"] = payload
    return payload


def fetch_main_candles(range_value: str = "1mo") -> list[dict[str, Any]]:
    return _fetch_yahoo_candles(MAIN_INSTRUMENT.symbol, range_value=range_value)


def fetch_symbol_candles(symbol: str, range_value: str = "1y", interval: str = "1d") -> list[dict[str, Any]]:
    return _fetch_yahoo_candles(symbol, range_value=range_value, interval=interval)


def load_options_signal_log() -> dict[str, Any]:
    locked = SIGNAL_LOG_LOCK.acquire(timeout=SIGNAL_LOG_LOCK_TIMEOUT_SECONDS)
    try:
        archive = _read_signal_log()
    finally:
        if locked:
            SIGNAL_LOG_LOCK.release()
    entries = sorted(
        archive.get("entries") or [],
        key=lambda item: item.get("sourceAt") or item.get("createdAt") or "",
        reverse=True,
    )
    return {
        "ok": True,
        "source": "backend",
        "generated_at": _iso(datetime.now(KST)),
        "path": str(SIGNAL_LOG_PATH),
        "count": len(entries),
        "entries": entries,
    }


def clear_options_signal_log() -> dict[str, Any]:
    locked = SIGNAL_LOG_LOCK.acquire(timeout=SIGNAL_LOG_LOCK_TIMEOUT_SECONDS)
    if not locked:
        return {
            "ok": False,
            "source": "backend",
            "generated_at": _iso(datetime.now(KST)),
            "error": "signal log busy",
            "count": 0,
            "entries": [],
        }
    try:
        archive = _empty_signal_log()
        archive["cleared_at"] = _iso(datetime.now(KST))
        _write_signal_log_async(archive)
    finally:
        SIGNAL_LOG_LOCK.release()
    _SNAPSHOT_CACHE["created_at"] = 0.0
    _SNAPSHOT_CACHE["payload"] = None
    return {
        "ok": True,
        "source": "backend",
        "generated_at": archive["cleared_at"],
        "count": 0,
        "entries": [],
    }


def intraday_levels(candles: list[dict[str, Any]]) -> dict[str, float]:
    return _intraday_levels(candles)


def evaluate_candle_signal(candles: list[dict[str, Any]], levels: dict[str, float]) -> dict[str, Any]:
    latest_time = _parse_iso(candles[-1]["datetime"]) if candles else datetime.now(KST)
    return _evaluate_signal(candles, levels, latest_time)


def _build_instrument_snapshot(instrument: MonitorInstrument, generated_at: datetime) -> dict[str, Any]:
    try:
        candles, minute_candles = _fetch_monitor_bundle(instrument, generated_at)
    except Exception as exc:
        return {
            "ok": False,
            "role": instrument.role,
            "symbol": instrument.symbol,
            "label": instrument.label,
            "provider": instrument.provider,
            "error": str(exc),
            "candles": [],
            "latest": None,
            "levels": {},
            "signals": [],
            "signal": _empty_signal(
                "warning" if instrument.role == "main" else "neutral",
                "데이터 조회 실패",
                f"{instrument.label} 분봉을 가져오지 못했습니다.",
            ),
        }

    levels = _confirmed_levels(candles)
    latest = candles[-1] if candles else None
    signal = _evaluate_signal(candles, levels, generated_at)
    session_candles = _latest_session_candles(candles)
    minute_signal = (
        _minute_precheck_signal(minute_candles, session_candles, generated_at)
        if instrument.role == "main"
        else None
    )
    if minute_signal and _prefer_minute_signal(signal):
        signal = minute_signal
    signals = _signals_for_candles(session_candles) if instrument.role == "main" else []
    dashboard = (
        _dashboard_payload(session_candles, levels, signals, signal, generated_at)
        if instrument.role == "main"
        else {}
    )
    return {
        "ok": bool(candles),
        "role": instrument.role,
        "symbol": instrument.symbol,
        "label": instrument.label,
        "provider": instrument.provider,
        "interval": "5m",
        "precheck_interval": "1m" if minute_candles else None,
        "candles": candles[-96:],
        "minute_candles": minute_candles[-90:],
        "latest": latest,
        "levels": levels,
        "raw_levels": _intraday_levels(candles),
        "minute_signal": minute_signal,
        "signals": signals,
        "signal": signal,
        **dashboard,
    }


def _fetch_monitor_candles(instrument: MonitorInstrument, generated_at: datetime) -> list[dict[str, Any]]:
    candles, _minute_candles = _fetch_monitor_bundle(instrument, generated_at)
    return candles


def _fetch_monitor_bundle(
    instrument: MonitorInstrument,
    generated_at: datetime,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    yahoo_candles: list[dict[str, Any]] = []
    errors: list[str] = []
    try:
        yahoo_candles = _fetch_yahoo_candles(instrument.symbol)
    except Exception as exc:
        errors.append(f"Yahoo: {exc}")

    naver_candles: list[dict[str, Any]] = []
    naver_minute_candles: list[dict[str, Any]] = []
    if instrument.naver_code and instrument.naver_kind and _is_naver_live_window(generated_at):
        pages = _naver_page_budget(yahoo_candles, generated_at)
        try:
            naver_minute_candles = _fetch_naver_minute_candles(
                instrument.naver_code,
                instrument.naver_kind,
                pages,
                generated_at,
            )
            naver_candles = _aggregate_candles_to_5m(naver_minute_candles)
        except Exception as exc:
            errors.append(f"Naver: {exc}")

    candles = _merge_candles(yahoo_candles, naver_candles)
    if candles:
        return candles, naver_minute_candles
    raise RuntimeError("; ".join(errors) or "분봉 데이터 없음")


def _naver_page_budget(candles: list[dict[str, Any]], generated_at: datetime) -> int:
    if not _is_market_time(generated_at) or not candles:
        return NAVER_RECENT_PAGES
    latest = _parse_iso(candles[-1]["datetime"])
    age_minutes = int((generated_at - latest).total_seconds() // 60)
    if age_minutes > 60 or latest.date() != generated_at.date():
        return NAVER_FULL_SESSION_PAGES
    return NAVER_RECENT_PAGES


def _is_naver_live_window(moment: datetime) -> bool:
    if moment.weekday() >= 5:
        return False
    current_time = moment.time()
    return OPTIONS_SESSION_START <= current_time <= OPTIONS_SESSION_END


def _fetch_yahoo_candles(symbol: str, range_value: str = "5d", interval: str = "5m") -> list[dict[str, Any]]:
    query = urllib.parse.urlencode(
        {
            "range": range_value,
            "interval": interval,
            "includePrePost": "false",
            "events": "history",
        }
    )
    url = f"{YAHOO_CHART_URL.format(symbol=urllib.parse.quote(symbol))}?{query}"
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 1MonthFinder options monitor",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"Yahoo 응답 오류 {exc.code}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Yahoo 연결 실패: {exc.reason}") from exc

    chart = payload.get("chart", {})
    error = chart.get("error")
    if error:
        raise RuntimeError(error.get("description") or "Yahoo chart error")

    result = (chart.get("result") or [None])[0]
    if not result:
        raise RuntimeError("Yahoo chart result 없음")

    timestamps = result.get("timestamp") or []
    quote = ((result.get("indicators") or {}).get("quote") or [{}])[0]
    opens = quote.get("open") or []
    highs = quote.get("high") or []
    lows = quote.get("low") or []
    closes = quote.get("close") or []
    volumes = quote.get("volume") or []

    candles: list[dict[str, Any]] = []
    for index, raw_timestamp in enumerate(timestamps):
        close = _finite_at(closes, index)
        open_ = _finite_at(opens, index)
        high = _finite_at(highs, index)
        low = _finite_at(lows, index)
        if close is None or open_ is None or high is None or low is None:
            continue
        timestamp = datetime.fromtimestamp(int(raw_timestamp), tz=timezone.utc).astimezone(KST)
        candles.append(
            {
                "time": timestamp.strftime("%H:%M"),
                "datetime": _iso(timestamp),
                "date": timestamp.date().isoformat(),
                "open": round(open_, 4),
                "high": round(high, 4),
                "low": round(low, 4),
                "close": round(close, 4),
                "volume": int(_finite_at(volumes, index) or 0),
            }
        )

    if not candles:
        raise RuntimeError(f"유효한 {interval} 봉 없음")
    return candles


def _persist_signal_entries(
    entries: list[dict[str, Any]],
    generated_at: datetime,
    session_candles: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    if not entries:
        archive = _read_signal_log()
        ordered = sorted(
            archive.get("entries") or [],
            key=lambda item: item.get("sourceAt") or item.get("createdAt") or "",
            reverse=True,
        )
        ordered = _attach_signal_outcomes(ordered, session_candles or [], generated_at)
        return _attach_signal_confidence(ordered, _signal_performance_summary(ordered))

    locked = SIGNAL_LOG_LOCK.acquire(timeout=SIGNAL_LOG_LOCK_TIMEOUT_SECONDS)
    if not locked:
        normalized = [_normalize_signal_log_entry(entry, generated_at) for entry in entries][-80:]
        normalized = _attach_signal_outcomes(normalized, session_candles or [], generated_at)
        return _attach_signal_confidence(normalized, _signal_performance_summary(normalized))
    try:
        archive = _read_signal_log()
        merged: dict[str, dict[str, Any]] = {}
        for entry in archive.get("entries") or []:
            key = entry.get("key")
            if key:
                merged[str(key)] = entry

        for entry in entries:
            normalized = _normalize_signal_log_entry(entry, generated_at)
            key = normalized.get("key")
            if not key:
                continue
            existing = merged.get(str(key), {})
            merged[str(key)] = {**existing, **normalized}

        ordered = sorted(
            merged.values(),
            key=lambda item: item.get("sourceAt") or item.get("createdAt") or "",
            reverse=True,
        )
        ordered = _attach_signal_outcomes(ordered, session_candles or [], generated_at)
        performance = _signal_performance_summary(ordered)
        ordered = _attach_signal_confidence(ordered, performance)
        archive["entries"] = ordered
        archive["performance"] = performance
        archive["updated_at"] = _iso(generated_at)
        _write_signal_log_async(archive)
        return ordered
    finally:
        SIGNAL_LOG_LOCK.release()


def _normalize_signal_log_entry(entry: dict[str, Any], generated_at: datetime) -> dict[str, Any]:
    key = str(entry.get("key") or "").strip()
    if not key:
        kind = entry.get("type") or entry.get("title") or "signal"
        source_at = entry.get("sourceAt") or entry.get("datetime") or entry.get("time") or _iso(generated_at)
        key = f"{kind}:{source_at}:{entry.get('close', '')}"
    return {
        **entry,
        "key": key,
        "type": entry.get("type") or "watch",
        "title": entry.get("title") or "신호",
        "message": entry.get("message") or "",
        "time": entry.get("time") or "-",
        "sourceAt": entry.get("sourceAt") or entry.get("datetime") or "",
        "createdAt": entry.get("createdAt") or _iso(generated_at),
        "source": entry.get("source") or "backend_signal",
    }


def _attach_signal_outcomes(
    entries: list[dict[str, Any]],
    candles: list[dict[str, Any]],
    generated_at: datetime,
) -> list[dict[str, Any]]:
    if not entries or not candles:
        return entries

    candle_by_time = {str(candle.get("datetime")): index for index, candle in enumerate(candles) if candle.get("datetime")}
    latest_index = len(candles) - 1
    cost_model = _signal_execution_cost_model()
    updated = []
    for entry in entries:
        source_at = str(entry.get("sourceAt") or entry.get("datetime") or "")
        candle_index = candle_by_time.get(source_at)
        if candle_index is None:
            updated.append(entry)
            continue

        entry_close = _num(entry.get("close")) or _num(candles[candle_index].get("close"))
        if entry_close is None:
            updated.append(entry)
            continue

        lookahead = candles[candle_index + 1 :]
        highs = [_num(candle.get("high")) for candle in lookahead]
        lows = [_num(candle.get("low")) for candle in lookahead]
        highs = [value for value in highs if value is not None]
        lows = [value for value in lows if value is not None]
        horizons: dict[str, dict[str, Any]] = {}
        for label, offset in (("5m", 1), ("15m", 3), ("30m", 6)):
            if candle_index + offset <= latest_index:
                close = _num(candles[candle_index + offset].get("close"))
                if close is not None:
                    raw_return = (close / entry_close - 1) * 100
                    adjusted_return = ((close - entry_close - cost_model["index_points"]) / entry_close) * 100
                    horizons[label] = {
                        "basis": "kospi200_index_proxy",
                        "close": round(close, 4),
                        "return_pct": round(raw_return, 3),
                        "cost_adjusted_return_pct": round(adjusted_return, 3),
                    }

        outcome = {
            "performance_basis": "kospi200_index_proxy",
            "is_real_option_fill": False,
            "requires_option_quote_validation": True,
            "status": "ready" if horizons else "pending",
            "evaluated_at": _iso(generated_at),
            "bars_elapsed": max(0, latest_index - candle_index),
            "entry_index": round(entry_close, 4),
            "latest_index": round(float(candles[-1]["close"]), 4),
            "return_pct_latest": round((float(candles[-1]["close"]) / entry_close - 1) * 100, 3),
            "max_favorable_points": round(max(highs) - entry_close, 4) if highs else 0,
            "max_adverse_points": round(entry_close - min(lows), 4) if lows else 0,
            "cost_model": cost_model,
            "horizons": horizons,
        }
        if _entry_is_call_candidate(entry) and "15m" in horizons:
            outcome["success_15m"] = horizons["15m"]["cost_adjusted_return_pct"] > 0
        updated.append({**entry, "outcome": outcome})
    return updated


def _signal_execution_cost_model() -> dict[str, float]:
    settings = _algorithm_settings()
    index_points = _settings_number(settings.get("index_execution_cost_points"), 0.15)
    spread_pct = _settings_number(settings.get("option_spread_pct"), 0.04)
    slippage_pct = _settings_number(settings.get("option_slippage_pct"), 0.015)
    return {
        "basis": "index_proxy_only",
        "is_real_option_fill": False,
        "requires_option_quote_validation": True,
        "index_points": round(index_points, 4),
        "option_spread_pct": round(spread_pct, 4),
        "option_slippage_pct": round(slippage_pct, 4),
        "option_total_cost_pct": round(spread_pct + slippage_pct, 4),
    }


def _entry_is_call_candidate(entry: dict[str, Any]) -> bool:
    decision = str(entry.get("trade_decision") or "")
    rule = str(entry.get("rule") or entry.get("action") or "")
    trade = entry.get("trade") if isinstance(entry.get("trade"), dict) else {}
    return (
        decision in {"entry", "test"}
        or "ENTRY" in str(trade.get("status") or "").upper()
        or "FIB_618" in rule
        or "INDEX_RESET" in rule
        or "TENKAN_PULLBACK" in rule
    )


def _signal_performance_summary(entries: list[dict[str, Any]]) -> dict[str, Any]:
    settings = _algorithm_settings()
    prior_rate = _settings_number(settings.get("confidence_prior_success"), 0.5)
    prior_strength = _settings_number(settings.get("confidence_prior_strength"), 6)
    min_samples = _settings_int(settings.get("min_samples_for_full_confidence"), 20)
    grouped: dict[str, list[dict[str, Any]]] = {}
    for entry in entries:
        rule = str(entry.get("rule") or entry.get("action") or "unknown")
        grouped.setdefault(rule, []).append(entry)

    rules: list[dict[str, Any]] = []
    ready_total = 0
    success_total = 0
    for rule, rule_entries in grouped.items():
        ready = [entry for entry in rule_entries if (entry.get("outcome") or {}).get("status") == "ready"]
        successes = [
            entry
            for entry in ready
            if (entry.get("outcome") or {}).get("success_15m") is True
        ]
        returns_15m = [
            _num(((entry.get("outcome") or {}).get("horizons") or {}).get("15m", {}).get("cost_adjusted_return_pct"))
            for entry in ready
        ]
        returns_15m = [value for value in returns_15m if value is not None]
        mfe = [_num((entry.get("outcome") or {}).get("max_favorable_points")) for entry in ready]
        mae = [_num((entry.get("outcome") or {}).get("max_adverse_points")) for entry in ready]
        mfe = [value for value in mfe if value is not None]
        mae = [value for value in mae if value is not None]
        confidence = _bayesian_confidence(len(successes), len(ready), prior_rate, prior_strength, min_samples)
        ready_total += len(ready)
        success_total += len(successes)
        rules.append(
            {
                "rule": rule,
                "sample_count": len(rule_entries),
                "ready_count": len(ready),
                "success_15m_count": len(successes),
                "success_15m_rate": round(len(successes) / len(ready), 4) if ready else None,
                "avg_15m_cost_adjusted_return_pct": round(sum(returns_15m) / len(returns_15m), 3) if returns_15m else None,
                "avg_mfe_points": round(sum(mfe) / len(mfe), 3) if mfe else None,
                "avg_mae_points": round(sum(mae) / len(mae), 3) if mae else None,
                "confidence": confidence,
            }
        )

    rules.sort(key=lambda item: (item["confidence"]["score"], item["ready_count"], item["sample_count"]), reverse=True)
    return {
        "schema_version": 1,
        "generated_at": _iso(datetime.now(KST)),
        "rule_count": len(rules),
        "ready_count": ready_total,
        "success_15m_count": success_total,
        "success_15m_rate": round(success_total / ready_total, 4) if ready_total else None,
        "rules": rules[:12],
    }


def _attach_signal_confidence(entries: list[dict[str, Any]], performance: dict[str, Any]) -> list[dict[str, Any]]:
    rules = {
        str(item.get("rule")): item
        for item in performance.get("rules", [])
        if isinstance(item, dict) and item.get("rule")
    }
    updated = []
    for entry in entries:
        rule = str(entry.get("rule") or entry.get("action") or "")
        rule_performance = rules.get(rule, {})
        confidence = dict(rule_performance.get("confidence") or {})
        if confidence:
            metrics = entry.get("metrics") if isinstance(entry.get("metrics"), dict) else {}
            regime = metrics.get("market_regime") if isinstance(metrics.get("market_regime"), dict) else {}
            bonus = _num(regime.get("confidence_bonus")) if regime else None
            if bonus is not None and confidence.get("score") is not None:
                confidence["score"] = round(max(0.0, min(100.0, float(confidence["score"]) + bonus)), 1)
                confidence["regime_bonus"] = bonus
            confidence["rule"] = rule
            confidence["sample_count"] = rule_performance.get("sample_count", 0)
            confidence["ready_count"] = rule_performance.get("ready_count", 0)
        updated.append({**entry, "confidence": confidence or entry.get("confidence")})
    return updated


def _bayesian_confidence(
    successes: int,
    trials: int,
    prior_rate: float,
    prior_strength: float,
    min_samples: int,
) -> dict[str, Any]:
    prior_successes = prior_rate * prior_strength
    posterior = (successes + prior_successes) / max(1.0, trials + prior_strength)
    sample_weight = min(1.0, trials / max(1, min_samples))
    score = 100 * (posterior * (0.55 + 0.45 * sample_weight))
    return {
        "score": round(max(0.0, min(100.0, score)), 1),
        "posterior_success_rate": round(posterior, 4),
        "sample_weight": round(sample_weight, 4),
        "successes": int(successes),
        "trials": int(trials),
        "prior_success_rate": round(prior_rate, 4),
        "prior_strength": round(prior_strength, 2),
    }


def _read_signal_log() -> dict[str, Any]:
    if not SIGNAL_LOG_PATH.exists():
        return _empty_signal_log()
    try:
        with SIGNAL_LOG_PATH.open("r", encoding="utf-8") as file:
            data = json.load(file)
    except (OSError, json.JSONDecodeError):
        return _empty_signal_log()
    if data.get("schema_version") != SIGNAL_LOG_SCHEMA_VERSION:
        return _empty_signal_log()
    data.setdefault("entries", [])
    return data


def _empty_signal_log() -> dict[str, Any]:
    return {
        "schema_version": SIGNAL_LOG_SCHEMA_VERSION,
        "source": "1MonthFinder backend signal log",
        "updated_at": None,
        "cleared_at": None,
        "entries": [],
    }


def _write_signal_log(archive: dict[str, Any]) -> None:
    SIGNAL_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    body = json.dumps(archive, ensure_ascii=False, separators=(",", ":"))
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False, dir=SIGNAL_LOG_PATH.parent) as file:
        file.write(body)
        temp_name = file.name
    Path(temp_name).replace(SIGNAL_LOG_PATH)


def _write_signal_log_async(archive: dict[str, Any]) -> None:
    if not SIGNAL_LOG_WRITE_LOCK.acquire(blocking=False):
        return

    def runner() -> None:
        try:
            _write_signal_log(archive)
        finally:
            try:
                SIGNAL_LOG_WRITE_LOCK.release()
            except RuntimeError:
                pass

    thread = threading.Thread(target=runner, daemon=True)
    thread.start()


def _build_etf_fibonacci_context(generated_at: datetime, intraday_candles: list[dict[str, Any]]) -> dict[str, Any] | None:
    """KODEX200 ETF staged-buy context. This is not a direct options sizing rule."""

    daily_context = None
    try:
        daily_context = _daily_etf_fibonacci_context(
            _fetch_yahoo_candles(SECONDARY_INSTRUMENT.symbol, range_value="3mo", interval="1d"),
            generated_at,
        )
    except Exception:
        daily_context = None

    thirty_min_context = _thirty_minute_etf_context(intraday_candles)
    if not daily_context and not thirty_min_context:
        return None

    return {
        "source_asset": "KODEX200 ETF",
        "applicability": "ETF staged allocation rule; options context only",
        "is_direct_options_rule": False,
        "expert_context": True,
        "daily": daily_context,
        "thirty_minute": thirty_min_context,
        "allocation_model": {
            "first_tranche_pct": 30,
            "second_tranche_pct": 30,
            "third_tranche_pct": 20,
            "emergency_cash_pct": 20,
            "scout_pct_range": [5, 10],
            "second_tranche_cut_if_50_break_pct": 70,
            "cut_amount_of_total_pct": 20,
            "readd_plan": "If 50% fails on confirmed candle, remove about 70% of the second tranche and redeploy it with the third tranche near 61.8%, or chase only after a clean 50% reclaim.",
        },
        "options_usage": {
            "rule": "Use only as KODEX200/KOSPI200 higher-frame confluence. Do not map ETF 30/30/20/20 sizing to weekly option contracts.",
            "entry_bias": "Prefer option entries only when the 5m option signal aligns with KODEX200 daily/30m support and KOSPI200 5m kijun or 30MA support.",
            "risk_bias": "If KODEX200 confirms below the 30m 50% line, treat call option entries as test/watch until the 50% line is reclaimed or 61.8% support is tested.",
        },
    }


def _daily_etf_fibonacci_context(candles: list[dict[str, Any]], generated_at: datetime) -> dict[str, Any] | None:
    if not candles:
        return None
    anchor_date = date(generated_at.year, 4, 10)
    if generated_at.date() < anchor_date:
        anchor_date = date(generated_at.year - 1, 4, 10)
    scoped = [candle for candle in candles if str(candle.get("date", "")) >= anchor_date.isoformat()]
    if not scoped:
        scoped = candles[-40:]
    if len(scoped) < 2:
        return None

    anchor = scoped[0]
    high_candle = max(scoped, key=lambda candle: float(candle["high"]))
    anchor_low = float(anchor["low"])
    high = float(high_candle["high"])
    span = high - anchor_low
    if span <= 0:
        return None
    close = float(scoped[-1]["close"])
    pullback_236 = high - span * 0.236
    pullback_382 = high - span * 0.382
    pullback_50 = high - span * 0.5
    if close >= pullback_236:
        zone = "above_daily_23_6"
        message = "Daily trend remains above the first 23.6% pullback zone."
    elif close >= pullback_382:
        zone = "daily_23_6_to_38_2_bounce_zone"
        message = "Daily price is between 23.6% and 38.2%; a bounce here supports trend continuation."
    elif close >= pullback_50:
        zone = "below_daily_38_2_watch"
        message = "Daily 38.2% support is damaged; use only cautious option confirmation."
    else:
        zone = "deep_daily_pullback"
        message = "Daily pullback is deeper than 50%; call option entries need strong 5m reclaim evidence."

    return {
        "anchor_date": str(anchor.get("date")),
        "anchor_low": round(anchor_low, 4),
        "high_date": str(high_candle.get("date")),
        "high": round(high, 4),
        "close": round(close, 4),
        "pullback_236": round(pullback_236, 4),
        "pullback_382": round(pullback_382, 4),
        "pullback_50": round(pullback_50, 4),
        "zone": zone,
        "message": message,
    }


def _thirty_minute_etf_context(candles: list[dict[str, Any]]) -> dict[str, Any] | None:
    if len(candles) < 12:
        return None
    session = _latest_session_candles(candles)
    bars = _aggregate_candles_to_minutes(session if len(session) >= 12 else candles[-96:], 30)
    if len(bars) < 4:
        return None

    sample = bars[-10:]
    high = max(float(candle["high"]) for candle in sample)
    low = min(float(candle["low"]) for candle in sample)
    span = high - low
    if span <= 0:
        return None
    latest = bars[-1]
    close = float(latest["close"])
    previous_close = float(bars[-2]["close"]) if len(bars) >= 2 else close
    tolerance = max(span * 0.01, 0.01)
    pullback_382 = high - span * 0.382
    fib_50 = high - span * 0.5
    fib_618 = high - span * 0.618
    ma5 = sum(float(candle["close"]) for candle in bars[-5:]) / min(len(bars), 5)

    if close < fib_50 - tolerance:
        stance = "confirmed_below_50_reduce_second"
        action = "ETF rule says the 50% area is a falling-knife zone; reduce 70% of the second tranche and keep call options in test/watch mode."
        option_bias = "risk_overlay"
    elif previous_close < fib_50 <= close:
        stance = "reclaimed_50_chase_allowed"
        action = "A 50% reclaim allows a later chase, but options still need 5m tenkan/kijun confirmation."
        option_bias = "reclaim_confirmation"
    elif close <= fib_618 + tolerance:
        stance = "near_61_8_readd_zone"
        action = "ETF redeploy zone; for options, wait for a 5m lower-wick reclaim instead of averaging down."
        option_bias = "support_test"
    elif close >= pullback_382 and close >= ma5:
        stance = "first_bounce_scout_only"
        action = "30m 5MA first bounce is early; ETF scout is 5~10%, and options should stay small unless 5m support confirms."
        option_bias = "scout_only"
    else:
        stance = "between_levels_wait"
        action = "Wait for 30m fib support or 5m kijun/30MA confirmation."
        option_bias = "neutral"

    return {
        "time": latest.get("time"),
        "datetime": latest.get("datetime"),
        "box_high": round(high, 4),
        "box_low": round(low, 4),
        "close": round(close, 4),
        "pullback_382_from_high": round(pullback_382, 4),
        "fib_50": round(fib_50, 4),
        "fib_618": round(fib_618, 4),
        "ma5": round(ma5, 4),
        "stance": stance,
        "action": action,
        "option_bias": option_bias,
    }


def _aggregate_candles_to_minutes(candles: list[dict[str, Any]], minutes: int) -> list[dict[str, Any]]:
    grouped: dict[tuple[str, int, int], list[dict[str, Any]]] = {}
    for candle in candles:
        moment = _parse_iso(str(candle["datetime"]))
        bucket_minute = (moment.minute // minutes) * minutes
        key = (moment.date().isoformat(), moment.hour, bucket_minute)
        grouped.setdefault(key, []).append(candle)

    output: list[dict[str, Any]] = []
    for key in sorted(grouped):
        rows = grouped[key]
        first = rows[0]
        last = rows[-1]
        output.append(
            {
                "date": first["date"],
                "time": first["time"],
                "datetime": first["datetime"],
                "open": first["open"],
                "high": round(max(float(row["high"]) for row in rows), 4),
                "low": round(min(float(row["low"]) for row in rows), 4),
                "close": last["close"],
                "volume": sum(int(row.get("volume") or 0) for row in rows),
            }
        )
    return output


def _attach_etf_context_to_signal(signal: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    if not signal:
        return signal
    metrics = dict(signal.get("metrics") or {})
    daily = context.get("daily") or {}
    thirty = context.get("thirty_minute") or {}
    metrics.update(
        {
            "etf_context_active": True,
            "etf_context_source_asset": context.get("source_asset"),
            "etf_context_is_direct_options_rule": False,
            "etf_daily_zone": daily.get("zone"),
            "etf_daily_pullback_236": daily.get("pullback_236"),
            "etf_daily_pullback_382": daily.get("pullback_382"),
            "etf_30m_stance": thirty.get("stance"),
            "etf_30m_fib_382": thirty.get("pullback_382_from_high"),
            "etf_30m_fib_50": thirty.get("fib_50"),
            "etf_30m_fib_618": thirty.get("fib_618"),
            "etf_30m_option_bias": thirty.get("option_bias"),
            "etf_allocation_model": context.get("allocation_model"),
        }
    )
    updated = {**signal, "metrics": metrics}
    if signal.get("rule") in {"WAIT", "NO_DATA"} or signal.get("alert_level") == "silent":
        return updated

    note = _etf_context_note(context)
    if note and note not in str(updated.get("message") or ""):
        updated["message"] = f"{updated.get('message') or ''} {note}".strip()

    if thirty.get("option_bias") == "risk_overlay" and signal.get("trade_decision") == "entry":
        updated["type"] = "watch"
        updated["label"] = "CALL 보초"
        updated["title"] = f"ETF 30분 50% 이탈: {signal.get('title') or '콜 후보'} 보수 전환"
        updated["trade_decision"] = "test"
        updated["alert_level"] = "normal"
        updated["message"] = (
            f"{signal.get('message') or ''} KODEX200 30분 박스 50%가 확정 이탈된 상태라 원문 ETF 규칙상 떨어지는 칼날 구간입니다. "
            "옵션은 직접 분할매수하지 말고 보초/테스트만 허용하며, 50% 재회복 또는 61.8% 밑꼬리 확인 후 다시 판단합니다."
        )
        updated["metrics"]["etf_context_downgraded_option_entry"] = True
    return updated


def _etf_context_note(context: dict[str, Any]) -> str:
    daily = context.get("daily") or {}
    thirty = context.get("thirty_minute") or {}
    parts = ["KODEX200 피보나치 컨텍스트는 ETF 분할매수용이라 옵션 계약수로 직접 환산하지 않습니다."]
    if daily.get("pullback_236") and daily.get("pullback_382"):
        parts.append(f"일봉 23.6/38.2는 {daily['pullback_236']:.2f}/{daily['pullback_382']:.2f}.")
    if thirty.get("fib_50") and thirty.get("fib_618"):
        parts.append(f"30분 50/61.8은 {thirty['fib_50']:.2f}/{thirty['fib_618']:.2f}, 판단은 {thirty.get('stance')}.")
    return " ".join(parts)


def _fetch_naver_candles(code: str, kind: str, pages: int, generated_at: datetime) -> list[dict[str, Any]]:
    return _aggregate_candles_to_5m(_fetch_naver_minute_candles(code, kind, pages, generated_at))


def _fetch_naver_minute_candles(code: str, kind: str, pages: int, generated_at: datetime) -> list[dict[str, Any]]:
    quotes = _fetch_naver_time_quotes(code, kind, pages, generated_at)
    candles = _quotes_to_minute_candles(quotes)
    if not candles:
        raise RuntimeError("네이버 1분 시세 없음")
    return candles


def _fetch_naver_time_quotes(code: str, kind: str, pages: int, generated_at: datetime) -> list[dict[str, Any]]:
    quotes: list[dict[str, Any]] = []
    trade_date = generated_at.date()
    for page in range(1, pages + 1):
        page_quotes = _fetch_naver_time_page(code, kind, page, generated_at, trade_date)
        if not page_quotes:
            break
        quotes.extend(page_quotes)
        if page_quotes[-1]["datetime"].time() <= OPTIONS_SESSION_START:
            break
    quotes = _unique_ordered_quotes(quotes)
    if not quotes:
        raise RuntimeError("네이버 장중 시세 없음")
    return quotes


def _fetch_naver_time_page(
    code: str,
    kind: str,
    page: int,
    generated_at: datetime,
    trade_date: Any,
) -> list[dict[str, Any]]:
    base_url = NAVER_INDEX_TIME_URL if kind == "index" else NAVER_ITEM_TIME_URL
    query = urllib.parse.urlencode(
        {
            "code": code,
            "thistime": generated_at.strftime("%Y%m%d%H%M%S"),
            "page": page,
        }
    )
    url = f"{base_url}?{query}"
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 1MonthFinder options monitor",
            "Accept": "text/html,*/*",
            "Referer": "https://finance.naver.com/",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=6) as response:
            html = response.read().decode("euc-kr", "replace")
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"Naver 응답 오류 {exc.code}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Naver 연결 실패: {exc.reason}") from exc
    return _parse_naver_time_rows(html, kind, trade_date)


def _parse_naver_time_rows(html: str, kind: str, trade_date: Any) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for row_html in re.findall(r"<tr[^>]*>(.*?)</tr>", html, flags=re.I | re.S):
        cells = _table_cells(row_html)
        if len(cells) < 2 or not re.fullmatch(r"\d{2}:\d{2}", cells[0]):
            continue
        close = _parse_naver_number(cells[1])
        if close is None:
            continue
        volume_delta = _naver_volume_delta(cells, kind)
        hour, minute = (int(part) for part in cells[0].split(":"))
        timestamp = datetime.combine(trade_date, time(hour, minute), tzinfo=KST)
        rows.append(
            {
                "datetime": timestamp,
                "close": close,
                "volume_delta": volume_delta,
            }
        )
    return rows


def _table_cells(row_html: str) -> list[str]:
    cells: list[str] = []
    for cell_html in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row_html, flags=re.I | re.S):
        text = re.sub(r"<[^>]+>", " ", cell_html)
        text = unescape(text)
        text = " ".join(text.split())
        if text:
            cells.append(text)
    return cells


def _parse_naver_number(value: str) -> float | None:
    cleaned = value.replace(",", "").replace("+", "").strip()
    try:
        parsed = float(cleaned)
    except ValueError:
        return None
    return parsed if math.isfinite(parsed) else None


def _naver_volume_delta(cells: list[str], kind: str) -> int:
    index = 3 if kind == "index" else 6
    if len(cells) <= index:
        return 0
    value = _parse_naver_number(cells[index])
    if value is None:
        return 0
    multiplier = 1000 if kind == "index" else 1
    return max(0, int(value * multiplier))


def _unique_ordered_quotes(quotes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not quotes:
        return []
    unique = {quote["datetime"]: quote for quote in quotes}
    return [unique[key] for key in sorted(unique)]


def _quotes_to_minute_candles(quotes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    candles: list[dict[str, Any]] = []
    previous_close: float | None = None
    for quote in _unique_ordered_quotes(quotes):
        timestamp: datetime = quote["datetime"]
        close = round(float(quote["close"]), 4)
        open_ = close if previous_close is None else previous_close
        candles.append(
            {
                "time": timestamp.strftime("%H:%M"),
                "datetime": _iso(timestamp),
                "date": timestamp.date().isoformat(),
                "open": round(open_, 4),
                "high": round(max(open_, close), 4),
                "low": round(min(open_, close), 4),
                "close": close,
                "volume": int(quote.get("volume_delta") or 0),
                "partial": True,
                "source_interval": "1m",
            }
        )
        previous_close = close
    return candles


def _aggregate_candles_to_5m(candles_1m: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not candles_1m:
        return []
    buckets: dict[datetime, dict[str, Any]] = {}
    for quote in candles_1m:
        timestamp = _parse_iso(str(quote["datetime"]))
        bucket_time = timestamp.replace(minute=(timestamp.minute // 5) * 5, second=0, microsecond=0)
        open_ = float(quote["open"])
        high = float(quote["high"])
        low = float(quote["low"])
        close = float(quote["close"])
        bucket = buckets.get(bucket_time)
        if bucket is None:
            buckets[bucket_time] = {
                "time": bucket_time.strftime("%H:%M"),
                "datetime": _iso(bucket_time),
                "date": bucket_time.date().isoformat(),
                "open": open_,
                "high": high,
                "low": low,
                "close": close,
                "volume": int(quote.get("volume") or 0),
                "partial": True,
                "source_interval": "5m-from-1m",
            }
            continue
        bucket["high"] = max(float(bucket["high"]), high)
        bucket["low"] = min(float(bucket["low"]), low)
        bucket["close"] = close
        bucket["volume"] = int(bucket.get("volume") or 0) + int(quote.get("volume") or 0)

    candles = list(buckets.values())
    for candle in candles:
        candle["open"] = round(float(candle["open"]), 4)
        candle["high"] = round(float(candle["high"]), 4)
        candle["low"] = round(float(candle["low"]), 4)
        candle["close"] = round(float(candle["close"]), 4)
    return candles


def _aggregate_minute_quotes(quotes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return _aggregate_candles_to_5m(_quotes_to_minute_candles(quotes))


def _merge_candles(base: list[dict[str, Any]], overlay: list[dict[str, Any]]) -> list[dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}
    for candle in base:
        merged[str(candle["datetime"])] = candle
    for candle in overlay:
        merged[str(candle["datetime"])] = candle
    return [merged[key] for key in sorted(merged)]


def _latest_session_candles(candles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not candles:
        return []
    latest_date = candles[-1].get("date")
    if not latest_date:
        return candles
    return [candle for candle in candles if candle.get("date") == latest_date] or candles


def _signals_for_candles(candles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    signals: list[dict[str, Any]] = []
    last_rule = None
    for index in range(7, len(candles)):
        partial = candles[: index + 1]
        levels = _confirmed_levels(partial)
        signal = evaluate_candle_signal(partial, levels)
        rule = signal.get("rule")
        if not rule:
            continue
        if rule == "WAIT":
            last_rule = None
            continue
        if rule == last_rule:
            continue
        last_rule = rule
        latest = partial[-1]
        signals.append(
            {
                "point_index": index,
                "time": latest.get("time"),
                "datetime": latest.get("datetime"),
                "date": latest.get("date"),
                "type": signal.get("type", "watch"),
                "label": signal.get("label", ""),
                "title": signal.get("title") or signal.get("label") or "Signal",
                "message": signal.get("message") or "",
                "action": rule,
                "rule": rule,
                "alert": signal.get("label", ""),
                "alert_level": signal.get("alert_level"),
                "trade_decision": signal.get("trade_decision"),
                "metrics": signal.get("metrics") or {},
                "filter_pass": (signal.get("metrics") or {}).get("call_entry_filter_pass"),
                "index_value": latest.get("close"),
                "levels": _signal_levels(levels),
                "candle": {
                    "time": latest.get("time"),
                    "datetime": latest.get("datetime"),
                    "date": latest.get("date"),
                    "open": latest.get("open"),
                    "high": latest.get("high"),
                    "low": latest.get("low"),
                    "close": latest.get("close"),
                },
            }
        )
    return signals[-24:]


def _dashboard_payload(
    session_candles: list[dict[str, Any]],
    levels: dict[str, float],
    signals: list[dict[str, Any]],
    current_signal: dict[str, Any],
    generated_at: datetime,
) -> dict[str, Any]:
    series = _series_for_dashboard(session_candles)
    trade_plan = _trade_plan_for_signal(current_signal, session_candles, levels)
    events = _trade_events_for_dashboard(series, signals, levels, close_open_trade=False)
    current_marker = _marker_from_trade_plan(trade_plan, current_signal, series)
    markers = _merge_dashboard_markers(events, [current_marker] if current_marker else [])
    return {
        "series": series,
        "markers": markers,
        "events": events,
        "trade_plan": trade_plan,
        "recent_signals": _recent_signal_entries(signals, markers, generated_at),
        "dashboard_schema": 1,
    }


def _series_for_dashboard(candles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    series: list[dict[str, Any]] = []
    closes: list[float] = []
    for index, candle in enumerate(candles):
        close = float(candle["close"])
        closes.append(close)
        partial = candles[: index + 1]
        series.append(
            {
                **candle,
                "index": round(close, 4),
                "gma30": _geometric_average(closes[-30:]),
                "gma50": _geometric_average(closes[-50:]),
                "tenkan": _ichimoku_mid(partial, 9),
                "kijun": _ichimoku_mid(partial, 26),
            }
        )
    return series


def _trade_events_for_dashboard(
    series: list[dict[str, Any]],
    signals: list[dict[str, Any]],
    levels: dict[str, Any],
    close_open_trade: bool,
) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    grouped: dict[int, list[dict[str, Any]]] = {}
    for signal in signals:
        index = _clamp_index(signal.get("point_index"), len(series))
        grouped.setdefault(index, []).append(signal)

    active: dict[str, Any] | None = None
    trade_count = 0
    for index, point in enumerate(series):
        if active and index > int(active["entry_index"]):
            exit_event = _update_active_trade(active, point, index)
            if exit_event:
                events.append(exit_event)
                active = None

        for signal in grouped.get(index, []):
            if _is_entry_signal(signal):
                if active:
                    continue
                setup = _trade_setup_from_signal(signal, levels, _num(point.get("index")))
                if not setup:
                    continue
                trade_count += 1
                kind = "test" if setup.get("mode") == "test" else "entry"
                events.append(_trade_event(kind, trade_count, point, index, setup))
                active = {
                    "id": trade_count,
                    "setup": setup,
                    "entry_index": index,
                    "tp1_hit": False,
                    "open_contracts": setup.get("contracts", 1),
                    "realized_profit": 0.0,
                    "ambiguous_count": 0,
                    "best_premium": setup.get("entry", 0),
                }
                continue

            event = _signal_event(signal, point, index, active)
            if active and event["kind"] == "take_profit":
                events.append(event)
                active = None
            else:
                events.append(event)

    if active and close_open_trade and series:
        last_index = len(series) - 1
        events.append(_trade_event("exit", int(active["id"]), series[last_index], last_index, active["setup"], series[last_index].get("index")))

    return sorted(events[-36:], key=lambda item: (int(item.get("point_index", 0)), _event_priority(item.get("kind"))))


def _trade_plan_for_signal(signal: dict[str, Any], candles: list[dict[str, Any]], levels: dict[str, Any]) -> dict[str, Any]:
    latest = candles[-1] if candles else {}
    close = _num(latest.get("close"))
    if close is None:
        return _standby_trade_plan()

    signal_like = {
        **signal,
        "point_index": max(0, len(candles) - 1),
        "index_value": close,
        "levels": levels,
        "candle": latest,
    }
    setup = _trade_setup_from_signal(signal_like, levels, close)
    if setup:
        kind = "test" if setup.get("mode") == "test" else "entry"
        return {
            "tone": "warning" if kind == "test" else "buy",
            "status": f"CALL ENTRY {setup['contracts']}" if setup.get("contracts", 1) > 1 else "CALL TEST",
            "entry": setup.get("entry"),
            "stop": setup.get("stop"),
            "tp1": setup.get("tp1"),
            "tp2": setup.get("tp2"),
            "stopLabel": setup.get("stop_label"),
            "stopText": setup.get("stop_text"),
            "tp2Label": setup.get("tp2_label"),
            "tp2Text": setup.get("tp2_text"),
            "contracts": setup.get("contracts"),
            "tp1Gain": setup.get("tp1_gain"),
            "runnerTargetText": setup.get("runner_target_text"),
            "markerKind": kind,
        }

    if _is_late_session_signal(signal):
        premium = _option_premium_plan(signal)
        plan = _late_session_trade_plan(signal, premium)
        return {
            "tone": "buy" if signal.get("trade_decision") == "hold" else "warning",
            "status": plan["status"],
            "entry": plan["entry"],
            "stop": plan["stop"],
            "tp1": plan["tp1"],
            "tp2": plan["tp2"],
            "stopLabel": "기준",
            "stopText": plan["stopText"],
            "tp2Label": "시간",
            "tp2Text": plan["tp2Text"],
            "contracts": plan["contracts"],
            "markerKind": "watch" if signal.get("trade_decision") == "hold" else "take_profit",
        }

    rule = str(signal.get("rule") or signal.get("action") or "")
    if signal.get("trade_decision") == "take_profit" or "RUNNER_EXIT" in rule:
        premium = _option_premium_plan(signal)
        runner_exit = _num((signal.get("metrics") or {}).get("option_runner_exit_premium")) or premium["entry"]
        return {
            "tone": "warning",
            "status": "잔량청산",
            "entry": premium["entry"],
            "stop": runner_exit,
            "tp1": premium["tp1"],
            "tp2": runner_exit,
            "stopLabel": "잔량",
            "stopText": f"3회차 본청 {runner_exit:.2f}",
            "tp2Label": "판단",
            "tp2Text": "청산확인",
            "contracts": int((signal.get("metrics") or {}).get("option_runner_exit_contracts") or 1),
            "markerKind": "take_profit",
        }

    if signal.get("type") == "sell" or "BREAK" in rule:
        premium = _option_premium_plan(signal)
        return {
            "tone": "sell",
            "status": "STOP/EXIT",
            "entry": premium["entry"],
            "stop": premium["stop"],
            "tp1": premium["tp1"],
            "tp2": premium["tp2"],
            "markerKind": "stop",
        }

    if signal.get("type") == "warning":
        plan = _standby_trade_plan("WATCH")
        plan["tone"] = "warning"
        plan["markerKind"] = "watch"
        return plan

    return _standby_trade_plan()


def _standby_trade_plan(status: str = "대기") -> dict[str, Any]:
    return {
        "tone": "neutral",
        "status": status,
        "entry": None,
        "stop": None,
        "tp1": None,
        "tp2": None,
        "markers": [],
    }


def _marker_from_trade_plan(
    plan: dict[str, Any],
    signal: dict[str, Any],
    series: list[dict[str, Any]],
) -> dict[str, Any] | None:
    if not series or not plan or plan.get("status") == "대기":
        return None
    latest_index = len(series) - 1
    latest = series[latest_index]
    premium = {
        "entry": plan.get("entry") or 1.6,
        "stop": plan.get("stop") or plan.get("entry") or 1.6,
        "tp1": plan.get("tp1") or plan.get("entry") or 1.6,
        "tp2": plan.get("tp2") or plan.get("entry") or 1.6,
        "contracts": plan.get("contracts") or 1,
    }
    setup = {
        **premium,
        "current_stop": plan.get("stop") or premium["stop"],
        "index_entry": latest.get("index") or latest.get("close"),
        "index_stop": latest.get("index") or latest.get("close"),
        "index_tp1": latest.get("index") or latest.get("close"),
        "index_tp2": latest.get("index") or latest.get("close"),
        "risk": 1,
    }
    kind = plan.get("markerKind") or _signal_kind(signal)
    return _trade_event(kind, 1, latest, latest_index, setup, latest.get("index") or latest.get("close"))


def _merge_dashboard_markers(events: list[dict[str, Any]], live_markers: list[dict[str, Any]]) -> list[dict[str, Any]]:
    merged: list[dict[str, Any]] = []
    seen: set[str] = set()
    for marker in [*events, *live_markers]:
        key = f"{marker.get('kind')}:{marker.get('point_index')}:{marker.get('label')}:{marker.get('premium')}"
        if key in seen:
            continue
        seen.add(key)
        merged.append(marker)
    return merged[-40:]


def _recent_signal_entries(
    signals: list[dict[str, Any]],
    markers: list[dict[str, Any]],
    generated_at: datetime,
) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for signal in signals:
        rule = signal.get("rule") or signal.get("action")
        if not rule or rule == "WAIT" or signal.get("alert_level") == "silent":
            continue
        candle = signal.get("candle") or {}
        source_at = signal.get("datetime") or candle.get("datetime") or ""
        key = f"{rule}:{source_at or signal.get('time', '')}:{signal.get('index_value', '')}"
        entries.append(
            {
                "key": key,
                "type": signal.get("type", "watch"),
                "title": signal.get("title") or signal.get("label") or "신호",
                "message": signal.get("message") or "",
                "time": signal.get("time") or candle.get("time") or "-",
                "close": signal.get("index_value") or candle.get("close"),
                "rule": rule,
                "trade_decision": signal.get("trade_decision"),
                "metrics": signal.get("metrics") or {},
                "trade": _log_trade_from_signal(signal),
                "sourceAt": source_at,
                "createdAt": _iso(generated_at),
                "source": "backend_signal",
            }
        )
    for marker in markers:
        if marker.get("kind") not in {"entry", "test", "tp1", "tp2", "stop", "take_profit", "risk", "watch", "mixed"}:
            continue
        key = f"chart:{marker.get('kind')}:{marker.get('point_index')}:{marker.get('time')}:{marker.get('premium')}"
        entries.append(
            {
                "key": key,
                "type": _event_type(marker.get("kind")),
                "title": marker.get("title") or marker.get("label") or "차트 이벤트",
                "message": marker.get("detail") or "",
                "time": marker.get("time") or "-",
                "close": marker.get("index_value"),
                "rule": marker.get("kind"),
                "trade_decision": marker.get("kind"),
                "trade": marker.get("trade"),
                "sourceAt": marker.get("datetime") or "",
                "createdAt": _iso(generated_at),
                "source": "backend_chart_event",
            }
        )
    return sorted(entries, key=lambda item: item.get("sourceAt") or item.get("time") or "", reverse=True)[:36]


def _log_trade_from_signal(signal: dict[str, Any]) -> dict[str, Any] | None:
    premium = _option_premium_plan(signal)
    if _is_entry_signal(signal):
        return {
            "status": "CALL ENTRY" if premium["contracts"] > 1 else "CALL TEST",
            "entry": premium["entry"],
            "stop": premium["stop"],
            "tp1": premium["tp1"],
            "tp2": premium["tp2"],
            "contracts": premium["contracts"],
            "premium_basis": premium.get("premium_basis"),
            "requires_option_quote_validation": premium.get("requires_option_quote_validation", True),
        }
    if _is_late_session_signal(signal):
        return _late_session_trade_plan(signal, premium)
    if signal.get("trade_decision") in {"take_profit", "stop", "risk"}:
        return {
            "status": "잔량청산" if signal.get("trade_decision") == "take_profit" else "위험확인",
            "entry": premium["entry"],
            "stop": premium["stop"],
            "tp1": premium["tp1"],
            "tp2": premium["tp2"],
            "contracts": premium["contracts"],
            "premium_basis": premium.get("premium_basis"),
            "requires_option_quote_validation": premium.get("requires_option_quote_validation", True),
        }
    return None


def _is_entry_signal(signal: dict[str, Any]) -> bool:
    decision = signal.get("trade_decision")
    if decision:
        return decision in {"entry", "test"}
    action = str(signal.get("action") or signal.get("rule") or "")
    return signal.get("type") == "candidate" and "FIB_618" in action and signal.get("filter_pass") is not False


def _is_late_session_signal(signal: dict[str, Any]) -> bool:
    rule = str(signal.get("rule") or signal.get("action") or "")
    return "LATE_SESSION" in rule or "FINAL_1530" in rule


def _late_session_trade_plan(signal: dict[str, Any], premium: dict[str, Any]) -> dict[str, Any]:
    rule = str(signal.get("rule") or signal.get("action") or "")
    metrics = signal.get("metrics") or {}
    is_final = "FINAL_1530" in rule
    is_aggressive = "ACCELERATION_HOLD" in rule or signal.get("trade_decision") == "hold"
    is_exit_prep = "EXIT_PREP" in rule
    trailing_stop = _num(metrics.get("option_trailing_stop_after_3_3"))
    return {
        "status": "최종청산" if is_final else "공격홀딩" if is_aggressive else "장후반청산" if is_exit_prep else "시간관리",
        "entry": premium["entry"],
        "stop": trailing_stop if trailing_stop is not None else premium["stop"],
        "tp1": premium["tp1"],
        "tp2": premium["tp2"],
        "stopText": f"3.3 후 {trailing_stop:.2f} 방어" if is_aggressive and trailing_stop is not None else "기준/전환 확인",
        "tp2Text": "15:30까지" if is_aggressive else "15:30 준비",
        "contracts": 1,
        "premium_basis": premium.get("premium_basis"),
        "requires_option_quote_validation": premium.get("requires_option_quote_validation", True),
        "experimentalTag": metrics.get("codex_experimental_tag") or CODEX_EXPERIMENTAL_PROFIT_EXTENSION_TAG,
    }


def _trade_setup_from_signal(signal: dict[str, Any], levels: dict[str, Any], entry_override: float | None = None) -> dict[str, Any] | None:
    if not _is_entry_signal(signal):
        return None
    index_entry = entry_override if entry_override is not None else _num(signal.get("index_value"))
    if index_entry is None:
        return None

    action = str(signal.get("action") or signal.get("rule") or "")
    span = _level_span(levels, index_entry)
    buffer = max(span * 0.012, 0.12)
    min_risk = max(span * 0.018, 0.35)
    is_reset_entry = "INDEX_RESET" in action or "RESET_MID" in action
    is_tenkan_pullback = "TENKAN_PULLBACK" in action or "KIJUN_SUPPORT" in action
    metrics = signal.get("metrics") or {}

    def metric_level(key: str) -> float | None:
        return _num(metrics.get(key)) if metrics.get(key) is not None else _num(levels.get(key))

    if is_reset_entry:
        reference = _num(levels.get("reset_mid_618_100")) or _num(levels.get("fib_100"))
        stop_reference = _num(levels.get("reset_fib_100")) or _num(levels.get("fib_105")) or reference
    elif is_tenkan_pullback:
        reference = metric_level("tenkan_entry") or metric_level("tenkan") or _num(levels.get("fib_50"))
        stop_reference = metric_level("kijun_stop") or metric_level("kijun") or reference
    else:
        reference = _num(levels.get("fib_50")) if "FIB_50" in action else _num(levels.get("fib_618"))
        stop_reference = reference

    candle_low = _num((signal.get("candle") or {}).get("low"))
    stop_candidates = [
        value - buffer
        for value in (candle_low, stop_reference)
        if value is not None and value - buffer < index_entry
    ]
    if is_tenkan_pullback and stop_reference is not None:
        index_stop = stop_reference
    else:
        index_stop = min(stop_candidates) if stop_candidates else index_entry - min_risk
    risk = index_entry - index_stop
    if is_tenkan_pullback and (not math.isfinite(risk) or risk <= 0):
        risk = min_risk
        index_stop = index_entry - risk
    elif not is_tenkan_pullback and (not math.isfinite(risk) or risk < min_risk):
        risk = min_risk
        index_stop = index_entry - risk

    if is_reset_entry:
        targets = [levels.get("fib_100"), levels.get("fib_618"), levels.get("fib_50"), levels.get("fib_382"), levels.get("day_high")]
    elif is_tenkan_pullback:
        targets = [levels.get("day_high"), levels.get("fib_382"), levels.get("fib_50")]
    else:
        targets = [levels.get("fib_50"), levels.get("fib_382"), levels.get("day_high")]
    index_tp1 = _target_above(index_entry, targets, risk)
    index_tp2 = _target_above(index_tp1, targets, risk * 0.8)
    premium = _option_premium_plan(signal)
    tp1_gain = _num(metrics.get("option_tp1_gain"))
    extension_target = _num(metrics.get("runner_extension_target"))
    return {
        "direction": "CALL",
        "mode": "test" if signal.get("trade_decision") == "test" else "entry",
        "entry": premium["entry"],
        "stop": premium["stop"],
        "current_stop": premium["stop"],
        "tp1": premium["tp1"],
        "tp2": premium["tp2"],
        "contracts": premium["contracts"],
        "premium_basis": premium.get("premium_basis"),
        "requires_option_quote_validation": premium.get("requires_option_quote_validation", True),
        "tp1_contracts": 1 if premium["contracts"] > 1 else 0,
        "stop_label": "지수컷" if is_tenkan_pullback and stop_reference is not None else None,
        "stop_text": f"기준 {stop_reference:.2f} · 선물확인" if is_tenkan_pullback and stop_reference is not None else None,
        "tp2_label": "잔량" if is_tenkan_pullback else None,
        "tp2_text": "트레일" if is_tenkan_pullback else None,
        "tp1_gain": tp1_gain if tp1_gain is not None else premium["tp1"] - premium["entry"],
        "runner_target_text": f"1.6배 {extension_target:.2f}" if is_tenkan_pullback and extension_target is not None else "1.6배 홀딩" if is_tenkan_pullback else None,
        "index_entry": index_entry,
        "index_stop": index_stop,
        "index_tp1": index_tp1,
        "index_tp2": index_tp2,
        "risk": risk,
    }


def _option_premium_plan(signal: dict[str, Any]) -> dict[str, Any]:
    profile = _premium_profile(signal)
    entry = profile["entry"]
    return {
        "entry": entry,
        "stop": profile.get("stop", entry * profile.get("stop_multiplier", 0.7)),
        "tp1": profile.get("tp1", entry * profile.get("tp1_multiplier", 1.3)),
        "tp2": profile.get("tp2", entry * profile.get("tp2_multiplier", 1.45)),
        "contracts": int(profile.get("contracts") or 1),
        "premium_basis": profile.get("premium_basis", "planned_premium_not_live_quote"),
        "requires_option_quote_validation": True,
    }


def _premium_profile(signal: dict[str, Any]) -> dict[str, Any]:
    settings = _algorithm_settings()
    metrics = signal.get("metrics") or {}
    action = str(signal.get("action") or signal.get("rule") or "")
    if signal.get("trade_decision") == "test":
        return {"entry": 1.0, "contracts": 1, "stop_multiplier": 0.6, "tp1_multiplier": 1.3, "tp2_multiplier": 1.45, "premium_basis": "planned_test_premium_not_live_quote"}
    explicit_entry = _num(metrics.get("option_entry_premium"))
    if explicit_entry is not None:
        explicit_tp1 = _num(metrics.get("option_tp1_premium")) or explicit_entry * 1.13
        return {
            "entry": explicit_entry,
            "contracts": int(metrics.get("contracts") or metrics.get("option_runner_exit_contracts") or 1),
            "stop_multiplier": 0.68,
            "tp1": explicit_tp1,
            "tp2": max(explicit_tp1, explicit_entry * 1.37),
            "premium_basis": "signal_metric_planned_premium_not_live_quote",
        }
    if "INDEX_RESET" in action or "RESET_MID" in action:
        return {
            "entry": float(settings["reset_entry_premium"]),
            "contracts": int(settings["reset_contracts"]),
            "stop_multiplier": 0.7,
            "tp1_multiplier": 1.35,
            "tp2_multiplier": 1.55,
            "premium_basis": "reset_config_planned_premium_not_live_quote",
        }
    if "TENKAN_PULLBACK" in action or "KIJUN_SUPPORT" in action:
        entry = float(settings["tenkan_entry_premium"])
        return {
            "entry": entry,
            "contracts": int(settings["tenkan_contracts"]),
            "stop_multiplier": 0.68,
            "tp1": max(2.6, entry * 1.13),
            "tp2": max(2.6, entry * 1.37),
            "premium_basis": "tenkan_config_planned_premium_not_live_quote",
        }
    return {
        "entry": float(settings["default_entry_premium"]),
        "contracts": int(settings["default_contracts"]),
        "stop_multiplier": 0.7,
        "tp1_multiplier": 1.3,
        "tp2_multiplier": 1.45,
        "premium_basis": "default_config_planned_premium_not_live_quote",
    }


def _update_active_trade(active: dict[str, Any], point: dict[str, Any], point_index: int) -> dict[str, Any] | None:
    setup = active["setup"]
    price = _num(point.get("index"))
    high = _num(point.get("high")) or price
    low = _num(point.get("low")) or price
    if price is None or high is None or low is None:
        return None
    active_stop = max(setup["index_stop"], setup["index_entry"]) if active.get("tp1_hit") else setup["index_stop"]
    hit_stop = low <= active_stop
    hit_tp1 = not active.get("tp1_hit") and high >= setup["index_tp1"]
    hit_tp2 = high >= setup["index_tp2"]
    mixed_path = hit_stop and (hit_tp1 or hit_tp2)
    if mixed_path:
        active["ambiguous_count"] = int(active.get("ambiguous_count", 0)) + 1
    if hit_stop and (not mixed_path or price < setup["index_entry"]):
        return _trade_event("stop", int(active["id"]), point, point_index, setup, active_stop)
    if hit_tp1:
        active["tp1_hit"] = True
        setup["index_stop"] = max(setup["index_stop"], setup["index_entry"])
        setup["current_stop"] = setup["entry"]
        closed = min(int(active.get("open_contracts", 0)), int(setup.get("tp1_contracts", 0)))
        active["open_contracts"] = max(0, int(active.get("open_contracts", 0)) - closed)
        active["realized_profit"] = float(active.get("realized_profit", 0)) + (setup["tp1"] - setup["entry"]) * closed
        active["best_premium"] = max(float(active.get("best_premium", 0)), setup["tp1"])
    if hit_tp2:
        active["best_premium"] = max(float(active.get("best_premium", 0)), setup["tp2"])
        return _trade_event("tp2", int(active["id"]), point, point_index, setup, setup["index_tp2"])
    if hit_tp1:
        return _trade_event("tp1", int(active["id"]), point, point_index, setup, setup["index_tp1"])
    if mixed_path:
        return _trade_event("mixed", int(active["id"]), point, point_index, setup, price)
    return None


def _signal_event(signal: dict[str, Any], point: dict[str, Any], point_index: int, active: dict[str, Any] | None) -> dict[str, Any]:
    kind = _signal_kind(signal)
    setup = active["setup"] if active else _option_signal_setup(signal, point)
    return {
        "kind": kind,
        "trade_id": int(active["id"]) if active else 0,
        "point_index": point_index,
        "time": point.get("time") or signal.get("time") or "-",
        "datetime": point.get("datetime") or signal.get("datetime"),
        "index_value": _num(signal.get("index_value")) or _num(point.get("index")),
        "premium": setup["entry"],
        "label": _signal_label(kind),
        "title": _signal_title(kind, signal, active),
        "detail": _signal_detail(kind, signal, setup, active),
        "color": TRADE_COLORS.get(kind, TRADE_COLORS["watch"]),
        "trade": _trade_for_marker(setup, kind),
    }


def _option_signal_setup(signal: dict[str, Any], point: dict[str, Any]) -> dict[str, Any]:
    premium = _option_premium_plan(signal)
    index_value = _num(signal.get("index_value")) or _num(point.get("index")) or 0
    return {
        **premium,
        "mode": "test" if signal.get("trade_decision") == "test" else "signal",
        "current_stop": premium["stop"],
        "tp1_contracts": 1 if premium["contracts"] > 1 else 0,
        "index_entry": index_value,
        "index_stop": index_value,
        "index_tp1": index_value,
        "index_tp2": index_value,
        "risk": 1,
    }


def _trade_event(kind: str, trade_id: int, point: dict[str, Any], point_index: int, setup: dict[str, Any], override_price: Any = None) -> dict[str, Any]:
    price = _num(override_price) or _num(point.get("index")) or _num(point.get("close")) or setup.get("index_entry")
    premium = _premium_for_event(kind, setup, price)
    return {
        "kind": kind,
        "trade_id": trade_id,
        "point_index": point_index,
        "time": point.get("time") or "-",
        "datetime": point.get("datetime"),
        "index_value": price,
        "premium": premium,
        "label": _trade_label(kind),
        "title": _trade_title(kind, trade_id),
        "detail": _trade_detail(kind, setup, premium),
        "color": TRADE_COLORS.get(kind, TRADE_COLORS["watch"]),
        "trade": _trade_for_marker(setup, kind),
    }


def _premium_for_event(kind: str, setup: dict[str, Any], index_price: Any = None) -> float:
    if kind == "exit":
        return _planned_premium_at_index(setup, index_price)
    return {
        "entry": setup["entry"],
        "test": setup["entry"],
        "stop": setup.get("current_stop", setup["stop"]),
        "tp1": setup["tp1"],
        "tp2": setup["tp2"],
        "mixed": _planned_premium_at_index(setup, index_price),
        "watch": setup["entry"],
        "take_profit": setup.get("current_stop", setup["entry"]),
    }.get(kind, setup["entry"])


def _planned_premium_at_index(setup: dict[str, Any], index_price: Any) -> float:
    price = _num(index_price)
    if price is None:
        return setup["entry"]
    anchors = sorted(
        [
            (setup.get("index_stop"), setup.get("current_stop", setup["stop"])),
            (setup.get("index_entry"), setup.get("entry")),
            (setup.get("index_tp1"), setup.get("tp1")),
            (setup.get("index_tp2"), setup.get("tp2")),
        ],
        key=lambda item: item[0] if item[0] is not None else 0,
    )
    anchors = [(float(index), float(premium)) for index, premium in anchors if index is not None and premium is not None]
    if not anchors:
        return setup["entry"]
    if price <= anchors[0][0]:
        return anchors[0][1]
    for index in range(1, len(anchors)):
        prev_index, prev_premium = anchors[index - 1]
        next_index, next_premium = anchors[index]
        if price <= next_index:
            distance = next_index - prev_index or 1
            ratio = (price - prev_index) / distance
            return prev_premium + (next_premium - prev_premium) * ratio
    return anchors[-1][1]


def _trade_for_marker(setup: dict[str, Any], kind: str) -> dict[str, Any]:
    return {
        "status": _trade_label(kind),
        "entry": setup.get("entry"),
        "stop": setup.get("current_stop", setup.get("stop")),
        "tp1": setup.get("tp1"),
        "tp2": setup.get("tp2"),
        "contracts": setup.get("contracts", 1),
        "premium_basis": setup.get("premium_basis"),
        "requires_option_quote_validation": setup.get("requires_option_quote_validation", True),
    }


def _signal_kind(signal: dict[str, Any]) -> str:
    decision = signal.get("trade_decision")
    if decision == "entry":
        return "entry"
    if decision == "test":
        return "test"
    if decision == "take_profit":
        return "take_profit"
    if decision == "risk":
        return "risk"
    if decision == "stop":
        return "stop"
    return "watch"


def _event_type(kind: Any) -> str:
    if kind in {"entry", "tp1", "tp2"}:
        return "candidate"
    if kind in {"stop", "risk"}:
        return "sell"
    return "watch"


def _signal_label(kind: str) -> str:
    return {"test": "TEST", "take_profit": "TP CHECK", "risk": "RISK", "stop": "STOP", "watch": "WATCH"}.get(kind, _trade_label(kind))


def _signal_title(kind: str, signal: dict[str, Any], active: dict[str, Any] | None) -> str:
    if kind == "take_profit" and active:
        return f"#{active['id']} TP CHECK"
    if kind == "stop" and active:
        return f"#{active['id']} STOP CHECK"
    return signal.get("label") or signal.get("title") or _signal_label(kind)


def _signal_detail(kind: str, signal: dict[str, Any], setup: dict[str, Any], active: dict[str, Any] | None) -> str:
    if kind == "test":
        return f"테스트 관찰 · 계획프리 {setup['entry']:.2f} · {signal.get('message') or ''}"
    if kind == "take_profit":
        return (
            f"보유 플랜 청산 확인 · 1차 {setup['tp1']:.2f} · 2차 {setup['tp2']:.2f}"
            if active
            else f"청산 후보 · 보유 포지션 없음 · {signal.get('message') or ''}"
        )
    if kind in {"risk", "stop"}:
        return (
            f"위험 확인 · 계획손절 {setup.get('current_stop', setup['stop']):.2f}"
            if active
            else f"위험 신호 · 보유 포지션 없음 · {signal.get('message') or ''}"
        )
    return signal.get("message") or signal.get("alert") or "서버 계산 차트 이벤트"


def _trade_label(kind: str) -> str:
    return {
        "entry": "ENTRY",
        "stop": "STOP",
        "tp1": "TP1",
        "tp2": "TP2",
        "mixed": "MIX",
        "exit": "EXIT",
        "watch": "WATCH",
        "test": "TEST",
        "risk": "RISK",
        "take_profit": "TP CHECK",
    }.get(kind, "SIGNAL")


def _trade_title(kind: str, trade_id: int) -> str:
    prefix = f"#{trade_id}"
    return {
        "entry": f"{prefix} CALL ENTRY",
        "stop": f"{prefix} STOP",
        "tp1": f"{prefix} TP1",
        "tp2": f"{prefix} TP2 EXIT",
        "mixed": f"{prefix} MIXED 5M",
        "exit": f"{prefix} TIME EXIT",
        "watch": "WATCH",
        "test": f"{prefix} CALL TEST",
        "risk": "RISK",
        "take_profit": "TP CHECK",
    }.get(kind, f"{prefix} SIGNAL")


def _trade_detail(kind: str, setup: dict[str, Any], output: float) -> str:
    if kind in {"entry", "test"}:
        if setup.get("tp2_text"):
            runner = f" · {setup['runner_target_text']}" if setup.get("runner_target_text") else ""
            stop = setup.get("stop_text") or f"손절 {setup['stop']:.2f}"
            return f"{setup['contracts']}계약 · TP1 {setup['tp1']:.2f} · 잔량 {setup['tp2_text']}{runner} · {stop}"
        return f"{setup['contracts']}계약 · 계획손절 {setup['stop']:.2f} · TP1 · TP2 {setup['tp2']:.2f}"
    if kind == "tp1":
        return f"계획프리 {output:.2f} · 잔량 {setup.get('runner_target_text') or setup.get('tp2_text') or '본전스탑'}"
    if kind == "mixed":
        return "같은 5분봉에서 손절/목표가 함께 닿은 모호 구간"
    if kind == "watch":
        return "진입 전 관찰 구간"
    return f"계획프리 {output:.2f} · 진입 {setup['entry']:.2f}"


def _event_priority(kind: Any) -> int:
    return {"stop": 1, "tp1": 2, "tp2": 3, "mixed": 4, "entry": 5, "test": 6, "take_profit": 7, "risk": 8, "watch": 9, "exit": 10}.get(str(kind), 10)


def _target_above(entry: float, candidates: list[Any], fallback_distance: float) -> float:
    usable = sorted(value for value in (_num(candidate) for candidate in candidates) if value is not None and value > entry)
    return usable[0] if usable else entry + max(fallback_distance, 0.35)


def _level_span(levels: dict[str, Any], fallback: float) -> float:
    high = _num(levels.get("day_high"))
    low = _num(levels.get("day_low"))
    if high is not None and low is not None and high > low:
        return high - low
    return max((fallback or 100) * 0.01, 1)


def _clamp_index(value: Any, length: int) -> int:
    if length <= 0:
        return 0
    try:
        index = int(value)
    except (TypeError, ValueError):
        index = 0
    return max(0, min(length - 1, index))


def _num(value: Any) -> float | None:
    try:
        output = float(value)
    except (TypeError, ValueError):
        return None
    return output if math.isfinite(output) else None


def _minute_precheck_signal(
    minute_candles: list[dict[str, Any]],
    five_minute_session: list[dict[str, Any]],
    generated_at: datetime,
) -> dict[str, Any] | None:
    if len(minute_candles) < 2 or len(five_minute_session) < 30:
        return None

    latest_date = five_minute_session[-1].get("date")
    minute_session = [candle for candle in minute_candles if candle.get("date") == latest_date]
    if len(minute_session) < 2:
        return None

    levels = _intraday_levels(five_minute_session)
    span = max(float(levels.get("day_high") or 0) - float(levels.get("day_low") or 0), 0.0001)
    trend = _trend_context(five_minute_session)
    tenkan = _level(trend, "tenkan")
    kijun = _level(trend, "kijun")
    gma_30 = _level(trend, "gma_30")
    if tenkan is None or kijun is None or gma_30 is None:
        return None

    latest = minute_session[-1]
    previous = minute_session[-2]
    close = float(latest["close"])
    open_ = float(latest["open"])
    low = float(latest["low"])
    high = float(latest["high"])
    previous_close = float(previous["close"])
    tolerance = _trend_touch_tolerance(span)
    reclaims_tenkan = previous_close < tenkan - tolerance and close >= tenkan
    touches_tenkan = low <= tenkan + tolerance and high >= tenkan - tolerance and close >= tenkan
    holds_base = close >= kijun and close >= gma_30
    if not (reclaims_tenkan or touches_tenkan) or not holds_base:
        return None

    evidence = _recent_kijun_support_evidence(five_minute_session[:-1], span)
    if int(evidence["kijun_support_count"]) < 2:
        return None

    latest_time = _parse_iso(str(latest["datetime"]))
    age_minutes = max(0, int((generated_at - latest_time).total_seconds() // 60))
    candle_range = max(high - low, 0.0001)
    lower_wick_ratio = max(min(open_, close) - low, 0) / candle_range
    return {
        "type": "watch",
        "label": "1분예비",
        "title": "전환선 1분 예비 감지",
        "message": (
            f"네이버 1분 시세가 5분봉 확정 전에 전환선 {tenkan:.2f} 회복/재터치를 먼저 감지했습니다. "
            f"기준선 {kijun:.2f} 지지와 30이평 {gma_30:.2f} 위 흐름은 유지 중입니다. "
            "종목은 미리 준비하되, 실제 진입은 5분봉 확정 신호로 승격될 때 확인합니다."
        ),
        "alert_level": "normal",
        "rule": "TENKAN_PULLBACK_PRECHECK_1M",
        "time": latest["time"],
        "datetime": latest["datetime"],
        "date": latest["date"],
        "index_value": close,
        "candle": {
            "time": latest["time"],
            "datetime": latest["datetime"],
            "date": latest["date"],
            "open": latest["open"],
            "high": latest["high"],
            "low": latest["low"],
            "close": latest["close"],
        },
        "trade_decision": "watch",
        "metrics": _signal_metrics(
            close,
            lower_wick_ratio,
            age_minutes,
            trend,
            _call_entry_filter_pass(close, trend),
            {
                "precheck_interval": "1m",
                "confirmation_interval": "5m",
                "tenkan_entry": tenkan,
                "kijun_stop": kijun,
                "gma30_reference": gma_30,
                "kijun_support_count": evidence["kijun_support_count"],
                "option_strike_offset_points": 70,
                "option_premium_min": 2.0,
                "option_premium_max": 3.0,
                "option_entry_premium": 2.3,
                "precheck_only": True,
                "underlying_line_basis": "KOSPI200 futures confirm required",
            },
        ),
    }


def _prefer_minute_signal(signal: dict[str, Any]) -> bool:
    rule = signal.get("rule")
    return rule in (None, "", "WAIT", "NO_DATA") or signal.get("alert_level") == "silent"


def _signal_levels(levels: dict[str, Any]) -> dict[str, float]:
    keys = (
        "day_high",
        "day_low",
        "fib_382",
        "fib_50",
        "fib_618",
        "fib_100",
        "fib_105",
        "reset_fib_618",
        "reset_fib_100",
        "reset_mid_618_100",
    )
    return {key: float(levels[key]) for key in keys if levels.get(key) is not None}


def _intraday_levels(candles: list[dict[str, Any]]) -> dict[str, float]:
    if not candles:
        return {}

    latest_date = candles[-1]["date"]
    session = [candle for candle in candles if candle["date"] == latest_date] or candles
    high = max(float(candle["high"]) for candle in session)
    low = min(float(candle["low"]) for candle in session)
    span = max(high - low, 0.0001)
    closes = [float(candle["close"]) for candle in session]
    reset_fib_618 = low
    reset_fib_100 = high - (span / 0.618)
    reset_mid_618_100 = (reset_fib_618 + reset_fib_100) / 2
    return {
        "day_high": round(high, 4),
        "day_low": round(low, 4),
        "fib_382": round(high - span * 0.382, 4),
        "fib_50": round(high - span * 0.5, 4),
        "fib_618": round(high - span * 0.618, 4),
        "fib_809": round(high - span * 0.809, 4),
        "fib_100": round(low, 4),
        "fib_103": round(high - span * 1.03, 4),
        "fib_105": round(high - span * 1.05, 4),
        "reset_fib_618": round(reset_fib_618, 4),
        "reset_fib_100": round(reset_fib_100, 4),
        "reset_mid_618_100": round(reset_mid_618_100, 4),
        "gma_30": _geometric_average(closes[-30:]),
        "gma_50": _geometric_average(closes[-50:]),
    }


def _confirmed_levels(candles: list[dict[str, Any]]) -> dict[str, float]:
    if len(candles) > 1 and candles[-2].get("date") == candles[-1].get("date"):
        return _intraday_levels(candles[:-1])
    return _intraday_levels(candles)


def _evaluate_signal(candles: list[dict[str, Any]], levels: dict[str, float], generated_at: datetime) -> dict[str, Any]:
    if len(candles) < 8 or not levels:
        return _empty_signal("neutral", "분봉 대기", "신호를 계산할 만큼 5분봉이 아직 충분하지 않습니다.")

    latest = candles[-1]
    previous = candles[-2]
    close = float(latest["close"])
    open_ = float(latest["open"])
    low = float(latest["low"])
    high = float(latest["high"])
    candle_range = max(high - low, 0.0001)
    lower_wick = max(min(open_, close) - low, 0)
    lower_wick_ratio = lower_wick / candle_range
    span = max(float(levels["day_high"]) - float(levels["day_low"]), 0.0001)
    tolerance = max(span * 0.018, 0.2)
    fib_50 = float(levels["fib_50"])
    fib_618 = float(levels["fib_618"])
    fib_100 = float(levels["fib_100"])
    fib_105 = float(levels["fib_105"])
    trend = _trend_context(candles)
    call_filter_pass = _call_entry_filter_pass(close, trend)
    settings = _algorithm_settings()
    market_regime = _market_regime_for_candles(candles, trend)

    latest_time = _parse_iso(latest["datetime"])
    age_minutes = max(0, int((generated_at - latest_time).total_seconds() // 60))
    if _is_market_time(generated_at) and age_minutes > 20:
        return {
            "type": "warning",
            "label": "데이터 지연",
            "title": "분봉 갱신 지연",
            "message": f"최신 5분봉이 {age_minutes}분 전입니다. 매매폰에서 지수와 MTS 시세를 먼저 확인하세요.",
            "alert_level": "normal",
            "rule": "DATA_STALE_DURING_MARKET",
            "time": latest["time"],
            "metrics": {"age_minutes": age_minutes},
        }

    index_reset = _index_reset_signal(
        latest,
        levels,
        span,
        close,
        open_,
        low,
        lower_wick_ratio,
        age_minutes,
        trend,
        call_filter_pass,
        market_regime,
    )
    if index_reset:
        return index_reset

    if close <= fib_105:
        return {
            "type": "sell",
            "label": "강한 이탈",
            "title": "105% 손절/자리이동 감시",
            "message": f"KOSPI200 기준가가 105% 이탈선 {fib_105:.2f} 부근입니다. 보유 옵션이 있으면 MTS에서 손절/자리이동 기준을 확인하세요.",
            "alert_level": "strong",
            "rule": "FIB_105_BREAK",
            "time": latest["time"],
            "trade_decision": "stop",
            "metrics": _signal_metrics(close, lower_wick_ratio, age_minutes, trend, call_filter_pass),
        }

    kijun_runner_exit = _kijun_repeat_runner_exit_signal(
        candles,
        latest,
        span,
        close,
        open_,
        low,
        high,
        lower_wick_ratio,
        age_minutes,
        trend,
        call_filter_pass,
    )
    if kijun_runner_exit:
        return kijun_runner_exit

    late_session = _late_session_management_signal(
        candles,
        latest,
        span,
        close,
        low,
        high,
        lower_wick_ratio,
        age_minutes,
        trend,
        call_filter_pass,
    )
    if late_session:
        return late_session

    fib_618_wick_threshold = _regime_adjusted_threshold(
        settings,
        "fib_618_lower_wick_ratio",
        market_regime,
        "fib_618_lower_wick_ratio_delta",
    )
    if low <= fib_618 <= close and close >= open_ and lower_wick_ratio >= fib_618_wick_threshold:
        if not call_filter_pass:
            return {
                "type": "watch",
                "label": "CALL TEST",
                "title": "61.8% 테스트 관찰",
                "message": f"61.8% {fib_618:.2f} 밑꼬리 회복은 나왔지만 30이평/전환선 필터가 약합니다. 풀진입보다 테스트/관찰 후보입니다.",
                "alert_level": "normal",
                "rule": "FIB_618_TEST",
                "time": latest["time"],
                "trade_decision": "test",
                "metrics": _signal_metrics(
                    close,
                    lower_wick_ratio,
                    age_minutes,
                    trend,
                    call_filter_pass,
                    {
                        "lower_wick_ratio_threshold": fib_618_wick_threshold,
                        "market_regime": market_regime,
                    },
                ),
            }
        return {
            "type": "candidate",
            "label": "콜 후보",
            "title": "61.8% 밑꼬리 회복",
            "message": f"5분봉이 61.8% {fib_618:.2f}를 찌르고 회복했습니다. 콜 재시작 후보를 매매폰에서 확인하세요.",
            "alert_level": "strong",
            "rule": "FIB_618_LOWER_WICK_RECLAIM",
            "time": latest["time"],
            "trade_decision": "entry",
            "metrics": _signal_metrics(
                close,
                lower_wick_ratio,
                age_minutes,
                trend,
                call_filter_pass,
                {
                    "lower_wick_ratio_threshold": fib_618_wick_threshold,
                    "market_regime": market_regime,
                },
            ),
        }

    tenkan_pullback = _tenkan_pullback_continuation_signal(
        candles,
        latest,
        span,
        close,
        open_,
        low,
        high,
        lower_wick_ratio,
        age_minutes,
        trend,
        call_filter_pass,
    )
    if tenkan_pullback:
        return tenkan_pullback

    if abs(close - fib_618) <= tolerance:
        return {
            "type": "warning",
            "label": "관찰",
            "title": "61.8% 관찰 구간",
            "message": f"현재가 {close:.2f}가 61.8% {fib_618:.2f} 근처입니다. 다음 5분봉 밑꼬리/회복 여부를 봅니다.",
            "alert_level": "normal",
            "rule": "NEAR_FIB_618",
            "time": latest["time"],
            "trade_decision": "watch",
            "metrics": _signal_metrics(close, lower_wick_ratio, age_minutes, trend, call_filter_pass),
        }

    if float(previous["close"]) < fib_50 <= close:
        return {
            "type": "watch",
            "label": "청산 확인",
            "title": "50% 회복",
            "message": f"50% 라인 {fib_50:.2f}를 회복했습니다. 잔량 청산 또는 보수 운용 기준만 확인합니다.",
            "alert_level": "normal",
            "rule": "FIB_50_RECLAIM",
            "time": latest["time"],
            "trade_decision": "take_profit",
            "metrics": _signal_metrics(close, lower_wick_ratio, age_minutes, trend, call_filter_pass),
        }

    if close < fib_100:
        return {
            "type": "warning",
            "label": "하락 압력",
            "title": "100% 하단 감시",
            "message": f"현재가 {close:.2f}가 당일 100% 기준 {fib_100:.2f} 아래입니다. 풀진입보다 최소 물량 감시 모드입니다.",
            "alert_level": "normal",
            "rule": "BELOW_FIB_100",
            "time": latest["time"],
            "trade_decision": "risk",
            "metrics": _signal_metrics(close, lower_wick_ratio, age_minutes, trend, call_filter_pass),
        }

    return {
        "type": "neutral",
        "label": "대기",
        "title": "신호 대기",
        "message": f"현재가 {close:.2f}. 진입/청산 강한 조건은 아직 없습니다.",
        "alert_level": "silent",
        "rule": "WAIT",
        "time": latest["time"],
        "metrics": _signal_metrics(close, lower_wick_ratio, age_minutes),
    }


def _market_regime_for_candles(candles: list[dict[str, Any]], trend: dict[str, Any]) -> dict[str, Any]:
    session = _latest_session_candles(candles)
    closes = [_num(candle.get("close")) for candle in session[-18:]]
    closes = [value for value in closes if value is not None]
    ranges = []
    for candle in session[-18:]:
        high = _num(candle.get("high"))
        low = _num(candle.get("low"))
        if high is not None and low is not None:
            ranges.append(max(high - low, 0))
    recent_return = (closes[-1] / closes[0] - 1) if len(closes) >= 2 and closes[0] else 0.0
    recent_range = sum(ranges[-6:]) / len(ranges[-6:]) if ranges[-6:] else 0.0
    baseline_range = sum(ranges) / len(ranges) if ranges else recent_range
    range_ratio = recent_range / baseline_range if baseline_range else 1.0
    close = closes[-1] if closes else None
    gma_30 = _level(trend, "gma_30")
    tenkan = _level(trend, "tenkan")
    kijun = _level(trend, "kijun")

    if range_ratio >= 1.45 or abs(recent_return) >= 0.006:
        key = "volatile"
        label = "volatile"
    elif close is not None and gma_30 is not None and tenkan is not None and close >= gma_30 and close >= tenkan and recent_return >= 0:
        key = "trend_up"
        label = "trend up"
    elif close is not None and gma_30 is not None and kijun is not None and close < gma_30 and close < kijun and recent_return < 0:
        key = "trend_down"
        label = "trend down"
    else:
        key = "range"
        label = "range"

    settings = _algorithm_settings()
    config = (settings.get("market_regimes") or {}).get(key, {})
    return {
        "key": key,
        "label": label,
        "recent_return_pct": round(recent_return * 100, 3),
        "range_ratio": round(range_ratio, 3),
        "confidence_bonus": _settings_number(config.get("confidence_bonus") if isinstance(config, dict) else None, 0),
    }


def _regime_adjusted_threshold(
    settings: dict[str, Any],
    base_key: str,
    market_regime: dict[str, Any],
    delta_key: str,
) -> float:
    base = _settings_number(settings.get(base_key), 0)
    key = str(market_regime.get("key") or "range")
    config = (settings.get("market_regimes") or {}).get(key, {})
    delta = _settings_number(config.get(delta_key) if isinstance(config, dict) else None, 0)
    return round(max(0.0, base + delta), 4)


def _regime_adjusted_tolerance(settings: dict[str, Any], base_key: str, market_regime: dict[str, Any]) -> float:
    base = _settings_number(settings.get(base_key), 0)
    key = str(market_regime.get("key") or "range")
    config = (settings.get("market_regimes") or {}).get(key, {})
    multiplier = _settings_number(
        config.get("index_reset_near_tolerance_multiplier") if isinstance(config, dict) else None,
        1.0,
    )
    return round(max(0.0, base * multiplier), 4)


def _index_reset_signal(
    latest: dict[str, Any],
    levels: dict[str, float],
    span: float,
    close: float,
    open_: float,
    low: float,
    lower_wick_ratio: float,
    age_minutes: int,
    trend: dict[str, Any],
    call_filter_pass: bool,
    market_regime: dict[str, Any],
) -> dict[str, Any] | None:
    reset_mid = _level(levels, "reset_mid_618_100")
    reset_100 = _level(levels, "reset_fib_100")
    reset_618 = _level(levels, "reset_fib_618")
    fib_105 = _level(levels, "fib_105")
    if reset_mid is None or reset_100 is None or reset_618 is None or fib_105 is None:
        return None

    settings = _algorithm_settings()
    near_tolerance = _regime_adjusted_tolerance(settings, "index_reset_near_tolerance", market_regime)
    wick_threshold = _regime_adjusted_threshold(
        settings,
        "index_reset_lower_wick_ratio",
        market_regime,
        "index_reset_lower_wick_ratio_delta",
    )
    touched_reset_mid = low <= reset_mid + near_tolerance and close >= reset_mid - near_tolerance
    broke_core_zone = low <= fib_105 or close <= fib_105
    bullish_reclaim = close >= open_ and lower_wick_ratio >= wick_threshold
    if not broke_core_zone or not touched_reset_mid or not bullish_reclaim:
        return None

    return {
        "type": "candidate",
        "label": "지수R",
        "title": "지수R 중심라인 회복",
        "message": f"핵심 자리 이탈 뒤 리셋 중심선 {reset_mid:.2f}를 밑꼬리로 회복했습니다. 프리미엄 1.5~1.8 콜 2~3계약 재시작 후보입니다.",
        "alert_level": "strong",
        "rule": "INDEX_RESET_MID_RECLAIM",
        "time": latest["time"],
        "trade_decision": "entry",
        "metrics": _signal_metrics(
            close,
            lower_wick_ratio,
            age_minutes,
            trend,
            call_filter_pass,
            {
                "index_reset_mid": reset_mid,
                "index_reset_100": reset_100,
                "index_reset_active": True,
                "near_tolerance": near_tolerance,
                "lower_wick_ratio_threshold": wick_threshold,
                "market_regime": market_regime,
            },
        ),
    }


def _kijun_repeat_runner_exit_signal(
    candles: list[dict[str, Any]],
    latest: dict[str, Any],
    span: float,
    close: float,
    open_: float,
    low: float,
    high: float,
    lower_wick_ratio: float,
    age_minutes: int,
    trend: dict[str, Any],
    call_filter_pass: bool,
) -> dict[str, Any] | None:
    session = _latest_session_candles(candles)
    if len(session) < 30:
        return None

    kijun = _level(trend, "kijun")
    tenkan = _level(trend, "tenkan")
    gma_30 = _level(trend, "gma_30")
    if kijun is None:
        return None

    tolerance = _trend_touch_tolerance(span)
    touches_kijun = low <= kijun + tolerance and high >= kijun - tolerance
    rebounds_from_kijun = close >= kijun and high >= kijun + tolerance * 0.5
    if not touches_kijun or not rebounds_from_kijun:
        return None

    evidence = _recent_kijun_support_evidence(session[:-1], span)
    previous_touches = int(evidence["kijun_support_count"])
    touch_count = previous_touches + 1
    if previous_touches < 2:
        return None

    return {
        "type": "watch",
        "label": "잔량청산",
        "title": "기준선 3회차 터치",
        "message": (
            f"30분 안에 기준선 {kijun:.2f} 터치 후 재상승이 {touch_count}회째입니다. "
            "이 구간은 잔량을 더 끌기보다 홀딩 물량 청산을 확인하는 쪽이 안전합니다. "
            "2.3 부근 진입 후 남긴 1계약은 지수 상승 각도가 가파르지 않으면 프리미엄이 폭발하지 못하고 본청 근처로 돌아올 수 있습니다."
        ),
        "alert_level": "strong",
        "rule": "KIJUN_THIRD_TOUCH_RUNNER_EXIT",
        "time": latest["time"],
        "trade_decision": "take_profit",
        "metrics": _signal_metrics(
            close,
            lower_wick_ratio,
            age_minutes,
            trend,
            call_filter_pass,
            {
                "kijun_touch_count_30m": touch_count,
                "kijun_previous_touch_count_30m": previous_touches,
                "kijun_stop": kijun,
                "tenkan_entry": tenkan,
                "gma30_reference": gma_30,
                "option_entry_premium": 2.3,
                "option_runner_exit_premium": 2.3,
                "option_runner_exit_contracts": 1,
                "runner_exit_reason": "third kijun touch/rebound within 30 minutes; weak index angle can return option runner near breakeven",
                "underlying_line_basis": "KOSPI200 futures confirm required",
            },
        ),
    }


def _late_session_management_signal(
    candles: list[dict[str, Any]],
    latest: dict[str, Any],
    span: float,
    close: float,
    low: float,
    high: float,
    lower_wick_ratio: float,
    age_minutes: int,
    trend: dict[str, Any],
    call_filter_pass: bool,
) -> dict[str, Any] | None:
    latest_clock = _parse_iso(str(latest["datetime"])).time()
    if latest_clock < time(14, 30) or latest_clock > time(15, 32):
        return None

    session = _latest_session_candles(candles)
    if len(session) < 30:
        return None

    tenkan = _level(trend, "tenkan")
    kijun = _level(trend, "kijun")
    gma_30 = _level(trend, "gma_30")
    if tenkan is None or kijun is None:
        return None

    tolerance = _trend_touch_tolerance(span)
    holds_kijun = close >= kijun
    holds_tenkan = close >= tenkan
    reclaimed_kijun = low <= kijun + tolerance and close >= kijun
    final_window = latest_clock >= time(15, 30)
    acceleration = _late_session_acceleration_context(session, close, tenkan)
    runner_score = _runner_hold_score(close, tenkan, kijun, gma_30, reclaimed_kijun, acceleration)

    metrics = {
        "codex_experimental_tag": CODEX_EXPERIMENTAL_PROFIT_EXTENSION_TAG,
        "codex_experimental_is_expert_rule": False,
        "codex_experimental_isolation_hint": "Remove _late_session_management_signal experimental branches and JSON runner.codex_experimental_profit_extension to isolate.",
        "late_session_active": True,
        "late_session_start": "14:30",
        "final_exit_window": "15:30~15:32",
        "loss_prepare_threshold_pct": -10,
        "profit_hold_threshold_krw": 200000,
        "profit_hold_mode": "manual_pnl_tier_check",
        "kijun_stop": kijun,
        "tenkan_entry": tenkan,
        "gma30_reference": gma_30,
        "holds_kijun": holds_kijun,
        "holds_tenkan": holds_tenkan,
        "reclaimed_kijun": reclaimed_kijun,
        "requires_manual_pnl_check": True,
        "open_interest_close_window": True,
        "option_entry_premium": 2.3,
        "option_tp1_premium": 2.6,
        "option_runner_exit_contracts": 1,
        "option_aggressive_hold_trigger_premium": 3.3,
        "option_trailing_stop_after_3_3": 2.9,
        "option_trailing_stop_after_3_6": 3.2,
        "manual_option_premium_trailing": True,
        "runner_hold_score": runner_score["score"],
        "runner_hold_decision": runner_score["decision"],
        "runner_hold_reasons": runner_score["reasons"],
        **acceleration,
    }

    if final_window:
        return {
            "type": "watch",
            "label": "최종청산",
            "title": "15:30 전후 최종 청산 준비",
            "message": (
                "15:30~15:32는 미결 청산으로 막판 변동이 커질 수 있는 구간입니다. "
                "보유 잔량은 전환선/기준선 지지가 살아 있어도 MTS에서 최종 청산을 준비하세요."
            ),
            "alert_level": "strong",
            "rule": "FINAL_1530_EXIT_PREP",
            "time": latest["time"],
            "trade_decision": "take_profit",
            "metrics": _signal_metrics(close, lower_wick_ratio, age_minutes, trend, call_filter_pass, metrics),
        }

    if not holds_kijun:
        return {
            "type": "watch",
            "label": "장후반청산",
            "title": "14:30 이후 기준선 이탈",
            "message": (
                f"14:30 이후 KOSPI200이 기준선 {kijun:.2f}을 지키지 못하고 있습니다. "
                "보유 잔량이 있으면 -10% 이상 큰 손실만 아니라는 전제에서 정리 우선으로 봅니다."
            ),
            "alert_level": "normal",
            "rule": "LATE_SESSION_KIJUN_EXIT_PREP",
            "time": latest["time"],
            "trade_decision": "take_profit",
            "metrics": _signal_metrics(close, lower_wick_ratio, age_minutes, trend, call_filter_pass, metrics),
        }

    if not holds_tenkan:
        return {
            "type": "watch",
            "label": "전환이탈",
            "title": "14:30 이후 전환선 이탈",
            "message": (
                f"14:30 이후 기준선은 지키지만 전환선 {tenkan:.2f} 아래입니다. "
                "수익 잔량은 더 끌기보다 3.3 고점 이후 2.9 방어 또는 MTS 청산 확인을 우선합니다."
            ),
            "alert_level": "normal",
            "rule": "LATE_SESSION_TENKAN_EXIT_PREP",
            "time": latest["time"],
            "trade_decision": "take_profit",
            "metrics": _signal_metrics(close, lower_wick_ratio, age_minutes, trend, call_filter_pass, metrics),
        }

    if latest_clock >= time(15, 0) and runner_score["decision"] == "hold":
        # Codex experimental, not an expert rule. Remove this branch with the matching
        # JSON tag if later review says the aggressive runner idea is not useful.
        return {
            "type": "watch",
            "label": "공격홀딩",
            "title": "15:00 이후 잔량 공격 홀딩",
            "message": (
                f"15:00 이후 잔량 홀딩 점수 {runner_score['score']}점으로 전환선/기준선/30이평 또는 가속 조건이 살아 있습니다. "
                "확보 수익이 20만원 이상이면 15:30 전까지 잔량을 더 끌되, 옵션이 3.3 이상 찍힌 뒤에는 2.9~3.2 방어 스탑을 MTS에서 확인하세요."
            ),
            "alert_level": "normal",
            "rule": "LATE_SESSION_ACCELERATION_HOLD",
            "time": latest["time"],
            "trade_decision": "hold",
            "metrics": _signal_metrics(close, lower_wick_ratio, age_minutes, trend, call_filter_pass, metrics),
        }

    hold_note = (
        "기준선을 터치한 뒤 다시 말아올린 상태입니다. "
        if reclaimed_kijun
        else "기준선 위에서 장후반 추세가 유지되고 있습니다. "
    )
    runner_note = (
        f"잔량 홀딩 점수는 {runner_score['score']}점/{runner_score['decision']}입니다. 확보 수익이 20만원 이상이고 청산조건이 나오지 않으면 15:30 전까지 잔량 플레이가 가능합니다."
        if holds_tenkan
        else f"잔량 홀딩 점수는 {runner_score['score']}점/{runner_score['decision']}입니다. 전환선 아래에서는 잔량을 길게 끌기보다 청산 준비를 우선합니다."
    )
    return {
        "type": "watch",
        "label": "장후반관리",
        "title": "14:30 이후 잔량 시간관리",
        "message": hold_note + runner_note,
        "alert_level": "normal",
        "rule": "LATE_SESSION_RUNNER_MANAGEMENT",
        "time": latest["time"],
        "trade_decision": "watch",
        "metrics": _signal_metrics(close, lower_wick_ratio, age_minutes, trend, call_filter_pass, metrics),
    }


def _tenkan_pullback_continuation_signal(
    candles: list[dict[str, Any]],
    latest: dict[str, Any],
    span: float,
    close: float,
    open_: float,
    low: float,
    high: float,
    lower_wick_ratio: float,
    age_minutes: int,
    trend: dict[str, Any],
    call_filter_pass: bool,
) -> dict[str, Any] | None:
    session = _latest_session_candles(candles)
    if len(session) < 30:
        return None

    tenkan = _level(trend, "tenkan")
    kijun = _level(trend, "kijun")
    gma_30 = _level(trend, "gma_30")
    if tenkan is None or kijun is None or gma_30 is None:
        return None

    tolerance = _trend_touch_tolerance(span)
    touches_tenkan = low <= tenkan + tolerance and high >= tenkan - tolerance
    holds_trend = close >= tenkan and close >= kijun and close >= gma_30
    if not touches_tenkan or not holds_trend:
        return None

    evidence = _recent_kijun_support_evidence(session[:-1], span)
    if evidence["kijun_support_count"] < 2:
        return None
    if not evidence["tenkan_reclaim_seen"]:
        return None
    if evidence["above_gma30_count"] < 1:
        return None

    extension = _trend_extension_context(candles, close)
    runner_note = (
        f" 최근 트렌드고가 {extension['recent_trend_high']:.2f} 돌파 시 오늘 저가 기준 1.6배 파장 "
        f"{extension['extension_target']:.2f}까지 잔량 홀딩을 시도합니다."
        if extension.get("recent_trend_high") is not None and extension.get("extension_target") is not None
        else " 최근 며칠 트렌드고가 돌파 시 오늘 저가 기준 1.6배 파장까지 잔량 홀딩을 시도합니다."
    )
    return {
        "type": "candidate",
        "label": "전환선2",
        "title": "전환선 재터치 2계약 후보",
        "message": (
            f"30분 안에 기준선 {kijun:.2f} 지지가 {evidence['kijun_support_count']}번 반복됐고 "
            f"30이평 {gma_30:.2f} 위에서 전환선 {tenkan:.2f}을 재터치했습니다. "
            "피보나치 자리가 아니므로 현재가 대비 약 70p 위 위클리 콜 중 프리미엄 2.0~3.0, 기준 2.3 근처를 2계약 이하로 봅니다. "
            "D-1은 큰 변동성이 없으면 옵션이 급격히 오르지 않으므로 +0.30 안전마진인 2.6 부근에서 1계약을 먼저 줄입니다. "
            f"잔량은 선물 차트 전환선/기준선을 매매폰에서 재확인하며 트레일합니다.{runner_note}"
        ),
        "alert_level": "strong",
        "rule": "TENKAN_PULLBACK_CONTINUATION",
        "time": latest["time"],
        "trade_decision": "entry",
        "metrics": _signal_metrics(
            close,
            lower_wick_ratio,
            age_minutes,
            trend,
            call_filter_pass,
            {
                "tenkan_pullback_active": True,
                "tenkan_entry": tenkan,
                "kijun_stop": kijun,
                "kijun_support_count": evidence["kijun_support_count"],
                "above_gma30_count": evidence["above_gma30_count"],
                "tenkan_reclaim_time": evidence.get("tenkan_reclaim_time"),
                "contracts": 2,
                "option_strike_offset_points": 70,
                "option_premium_min": 2.0,
                "option_premium_max": 3.0,
                "option_entry_premium": 2.3,
                "option_tp1_premium": 2.6,
                "option_tp1_gain": 0.3,
                "option_tp1_contracts": 1,
                "option_tp1_reason": "D-1 limited volatility, tight safety margin",
                "option_runner_contracts": 1,
                "option_runner_mode": "trail_until_futures_tenkan_break_or_kijun_touch",
                "runner_extension_ratio": 1.6,
                "runner_recent_trend_high": extension.get("recent_trend_high"),
                "runner_today_low": extension.get("today_low"),
                "runner_extension_target": extension.get("extension_target"),
                "runner_trend_high_breakout": extension.get("trend_high_breakout"),
                "runner_hold_condition": "hold while futures kijun support is not broken; kijun touch and rebound keeps trend alive",
                "runner_cut_condition": "cut if futures fails to support kijun",
                "underlying_line_basis": "KOSPI200 futures confirm required",
                "entry_basis": "tenkan_pullback_after_kijun_support",
            },
        ),
    }


def _trend_extension_context(candles: list[dict[str, Any]], close: float) -> dict[str, Any]:
    if not candles:
        return {
            "today_low": None,
            "recent_trend_high": None,
            "extension_target": None,
            "trend_high_breakout": False,
        }
    latest_date = candles[-1].get("date")
    today = [candle for candle in candles if candle.get("date") == latest_date]
    previous = [candle for candle in candles if candle.get("date") != latest_date]
    if not today:
        return {
            "today_low": None,
            "recent_trend_high": None,
            "extension_target": None,
            "trend_high_breakout": False,
        }
    today_low = min(float(candle["low"]) for candle in today)
    recent_trend_high = max((float(candle["high"]) for candle in previous[-288:]), default=None)
    extension_target = None
    if recent_trend_high is not None and recent_trend_high > today_low:
        extension_target = today_low + (recent_trend_high - today_low) * 1.6
    return {
        "today_low": round(today_low, 4),
        "recent_trend_high": round(recent_trend_high, 4) if recent_trend_high is not None else None,
        "extension_target": round(extension_target, 4) if extension_target is not None else None,
        "trend_high_breakout": bool(recent_trend_high is not None and close > recent_trend_high),
    }


def _late_session_acceleration_context(session: list[dict[str, Any]], close: float, tenkan: float) -> dict[str, Any]:
    recent = session[-6:]
    previous = session[-18:-6]

    def average_volume(candles: list[dict[str, Any]]) -> float | None:
        values = [float(candle.get("volume") or 0) for candle in candles if float(candle.get("volume") or 0) > 0]
        return sum(values) / len(values) if values else None

    def average_range(candles: list[dict[str, Any]]) -> float | None:
        values = [max(float(candle["high"]) - float(candle["low"]), 0) for candle in candles]
        return sum(values) / len(values) if values else None

    recent_volume = average_volume(recent)
    previous_volume = average_volume(previous)
    recent_range = average_range(recent)
    previous_range = average_range(previous)
    volume_ratio = recent_volume / previous_volume if recent_volume is not None and previous_volume else None
    range_ratio = recent_range / previous_range if recent_range is not None and previous_range else None
    previous_high = max((float(candle["high"]) for candle in previous), default=None)
    high_breakout = previous_high is not None and close >= previous_high
    acceleration_active = close >= tenkan and (
        high_breakout
        or (volume_ratio is not None and volume_ratio >= 1.35)
        or (range_ratio is not None and range_ratio >= 1.25)
    )
    return {
        "late_acceleration_active": acceleration_active,
        "late_volume_ratio": round(volume_ratio, 3) if volume_ratio is not None else None,
        "late_range_ratio": round(range_ratio, 3) if range_ratio is not None else None,
        "late_high_breakout": high_breakout,
        "late_previous_high": round(previous_high, 4) if previous_high is not None else None,
    }


def _runner_hold_score(
    close: float,
    tenkan: float,
    kijun: float,
    gma_30: float | None,
    reclaimed_kijun: bool,
    acceleration: dict[str, Any],
) -> dict[str, Any]:
    score = 0
    reasons: list[str] = []
    if close >= kijun:
        score += 1
        reasons.append("기준선 위")
    if close >= tenkan:
        score += 1
        reasons.append("전환선 위")
    if gma_30 is not None and close >= gma_30:
        score += 1
        reasons.append("30이평 위")
    if reclaimed_kijun:
        score += 1
        reasons.append("기준선 터치 후 재회복")
    if acceleration.get("late_acceleration_active"):
        score += 1
        reasons.append("장후반 가속")
    if acceleration.get("late_high_breakout"):
        score += 1
        reasons.append("최근 고점 돌파")

    if score >= 4:
        decision = "hold"
    elif score <= 2:
        decision = "trim"
    else:
        decision = "watch"
    return {"score": score, "decision": decision, "reasons": reasons}


def _recent_kijun_support_evidence(session: list[dict[str, Any]], span: float) -> dict[str, Any]:
    evidence: dict[str, Any] = {
        "kijun_support_count": 0,
        "above_gma30_count": 0,
        "tenkan_reclaim_seen": False,
        "tenkan_reclaim_time": None,
    }
    if len(session) < 30:
        return evidence

    tolerance = _trend_touch_tolerance(span)
    support_start = max(1, len(session) - 6)
    reclaim_start = max(1, len(session) - 12)
    for index in range(reclaim_start, len(session)):
        partial = session[: index + 1]
        context = _trend_context(partial)
        tenkan = _level(context, "tenkan")
        kijun = _level(context, "kijun")
        gma_30 = _level(context, "gma_30")
        if tenkan is None:
            continue
        candle = partial[-1]
        previous = partial[-2]
        close = float(candle["close"])
        previous_close = float(previous["close"])
        if previous_close < tenkan - tolerance and close >= tenkan:
            evidence["tenkan_reclaim_seen"] = True
            evidence["tenkan_reclaim_time"] = candle.get("time")
        if index < support_start:
            continue
        if kijun is not None and float(candle["low"]) <= kijun + tolerance and close >= kijun:
            evidence["kijun_support_count"] += 1
        if gma_30 is not None and close >= gma_30:
            evidence["above_gma30_count"] += 1
    return evidence


def _trend_touch_tolerance(span: float) -> float:
    return max(span * 0.006, 0.18)


def _trend_context(candles: list[dict[str, Any]]) -> dict[str, Any]:
    latest_date = candles[-1]["date"] if candles else None
    session = [candle for candle in candles if candle.get("date") == latest_date] or candles
    closes = [float(candle["close"]) for candle in session]
    return {
        "gma_30": _geometric_average(closes[-30:]),
        "gma_50": _geometric_average(closes[-50:]),
        "tenkan": _ichimoku_mid(session, 9),
        "kijun": _ichimoku_mid(session, 26),
    }


def _call_entry_filter_pass(close: float, trend: dict[str, Any]) -> bool:
    required = [trend.get("gma_30"), trend.get("tenkan")]
    return all(value is None or close >= float(value) for value in required)


def _signal_metrics(
    close: float,
    lower_wick_ratio: float,
    age_minutes: int,
    trend: dict[str, Any] | None = None,
    filter_pass: bool | None = None,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    metrics = {
        "close": round(close, 4),
        "lower_wick_ratio": round(lower_wick_ratio, 3),
        "age_minutes": age_minutes,
    }
    if trend:
        metrics.update({key: value for key, value in trend.items() if value is not None})
    if filter_pass is not None:
        metrics["call_entry_filter_pass"] = filter_pass
    if extra:
        metrics.update(extra)
    return metrics


def _level(levels: dict[str, Any], key: str) -> float | None:
    try:
        value = float(levels[key])
    except (KeyError, TypeError, ValueError):
        return None
    return value if math.isfinite(value) else None


def _empty_signal(type_: str, title: str, message: str) -> dict[str, Any]:
    return {
        "type": type_,
        "label": title,
        "title": title,
        "message": message,
        "alert_level": "silent" if type_ == "neutral" else "normal",
        "rule": "NO_DATA",
        "time": "-",
        "metrics": {},
    }


def _finite_at(values: list[Any], index: int) -> float | None:
    if index >= len(values):
        return None
    try:
        value = float(values[index])
    except (TypeError, ValueError):
        return None
    return value if math.isfinite(value) else None


def _geometric_average(values: list[float]) -> float | None:
    sample = [value for value in values if value and value > 0]
    if not sample:
        return None
    return round(math.exp(sum(math.log(value) for value in sample) / len(sample)), 4)


def _ichimoku_mid(candles: list[dict[str, Any]], window: int) -> float | None:
    if len(candles) < window:
        return None
    sample = candles[-window:]
    high = max(float(candle["high"]) for candle in sample)
    low = min(float(candle["low"]) for candle in sample)
    return round((high + low) / 2, 4)


def _is_market_time(moment: datetime) -> bool:
    if moment.weekday() >= 5:
        return False
    return OPTIONS_SESSION_START <= moment.time() <= OPTIONS_SESSION_END


def _iso(moment: datetime) -> str:
    return moment.astimezone(KST).replace(microsecond=0).isoformat()


def _parse_iso(value: str) -> datetime:
    return datetime.fromisoformat(value).astimezone(KST)
