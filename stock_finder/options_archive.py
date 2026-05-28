from __future__ import annotations

import json
import math
import tempfile
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from stock_finder.options_monitor import KST, evaluate_candle_signal, fetch_main_candles, intraday_levels


PROJECT_ROOT = Path(__file__).resolve().parents[1]
ARCHIVE_PATH = PROJECT_ROOT / "site" / "data" / "options_replay_archive.json"
ARCHIVE_VERSION = 1
RETENTION_DAYS = 31
REFRESH_SECONDS = 30 * 60


def build_options_replay_payload(date: str | None = None, refresh: bool = False) -> dict[str, Any]:
    archive = _refresh_archive_if_needed(refresh=refresh)
    sessions = _sessions_from_archive(archive)
    selected_date = date or (sessions[-1]["date"] if sessions else None)
    active_session = _session_for_date(archive, selected_date) if selected_date else None
    date_range = {
        "start": sessions[0]["date"] if sessions else None,
        "end": sessions[-1]["date"] if sessions else None,
    }
    return {
        "ok": bool(sessions),
        "status": "local_archive",
        "label": "최근 1개월 복기",
        "generated_at": _iso_now(),
        "retention_days": RETENTION_DAYS,
        "date_range": date_range,
        "selected_date": selected_date,
        "sessions": sessions,
        "active_session": active_session,
        "notice": "로컬에 저장된 KOSPI200 5분봉 기준 복기입니다. 데이터가 없는 날짜는 휴장일이거나 아직 저장되지 않은 날짜입니다.",
    }


def _refresh_archive_if_needed(refresh: bool = False) -> dict[str, Any]:
    archive = _read_archive()
    refreshed_at = _parse_ts(archive.get("refreshed_at"))
    is_stale = refreshed_at is None or (datetime.now(KST) - refreshed_at).total_seconds() > REFRESH_SECONDS
    if not refresh and not is_stale and archive.get("days"):
        return archive

    try:
        candles = fetch_main_candles("1mo")
    except Exception:
        try:
            candles = fetch_main_candles("5d")
        except Exception:
            return archive

    if candles:
        archive = _merge_candles(archive, candles)
        _write_archive(archive)
    return archive


def _read_archive() -> dict[str, Any]:
    if not ARCHIVE_PATH.exists():
        return _empty_archive()
    try:
        with ARCHIVE_PATH.open("r", encoding="utf-8") as file:
            data = json.load(file)
    except (OSError, json.JSONDecodeError):
        return _empty_archive()
    if data.get("schema_version") != ARCHIVE_VERSION:
        return _empty_archive()
    data.setdefault("days", {})
    return data


def _empty_archive() -> dict[str, Any]:
    return {
        "schema_version": ARCHIVE_VERSION,
        "retention_days": RETENTION_DAYS,
        "refreshed_at": None,
        "source": "Yahoo Finance KOSPI200.KS 5m",
        "days": {},
    }


def _merge_candles(archive: dict[str, Any], candles: list[dict[str, Any]]) -> dict[str, Any]:
    grouped: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)
    for day, saved in (archive.get("days") or {}).items():
        for candle in saved.get("candles", []):
            grouped[day][candle["datetime"]] = candle

    for candle in candles:
        day = candle.get("date")
        stamp = candle.get("datetime")
        if day and stamp:
            grouped[day][stamp] = candle

    cutoff = (datetime.now(KST).date() - timedelta(days=RETENTION_DAYS)).isoformat()
    days: dict[str, Any] = {}
    for day in sorted(grouped):
        if day < cutoff:
            continue
        day_candles = sorted(grouped[day].values(), key=lambda item: item["datetime"])
        if day_candles:
            days[day] = {"candles": day_candles}

    archive["days"] = days
    archive["refreshed_at"] = _iso_now()
    return archive


def _write_archive(archive: dict[str, Any]) -> None:
    ARCHIVE_PATH.parent.mkdir(parents=True, exist_ok=True)
    body = json.dumps(archive, ensure_ascii=False, separators=(",", ":"))
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False, dir=ARCHIVE_PATH.parent) as file:
        file.write(body)
        temp_name = file.name
    Path(temp_name).replace(ARCHIVE_PATH)


def _sessions_from_archive(archive: dict[str, Any]) -> list[dict[str, Any]]:
    sessions = []
    for day in sorted((archive.get("days") or {}).keys()):
        session = _session_for_date(archive, day, include_series=False)
        if session:
            sessions.append(session)
    return sessions


def _session_for_date(archive: dict[str, Any], date: str | None, include_series: bool = True) -> dict[str, Any] | None:
    if not date:
        return None
    candles = (archive.get("days") or {}).get(date, {}).get("candles") or []
    if not candles:
        return None

    levels = _confirmed_levels_for(candles)
    series = _series_for_candles(candles)
    signals = _signals_for_candles(candles)
    first = candles[0]
    last = candles[-1]
    day_open = float(first["open"])
    day_close = float(last["close"])
    change = day_close - day_open
    session = {
        "id": date,
        "date": date,
        "label": _date_label(date),
        "weekday_label": _weekday_label(date),
        "status": "archived",
        "profile": {"label": _weekday_profile(date)},
        "source": "local Yahoo KOSPI200.KS 5m archive",
        "day_open": round(day_open, 4),
        "day_close": round(day_close, 4),
        "day_change": round(change, 4),
        "day_change_pct": round(change / day_open * 100, 2) if day_open else 0,
        "signal_count": len(signals),
        "summary": f"{len(candles)}개 5분봉 · 신호 {len(signals)}개",
        "data_window": {
            "first_time": first["time"],
            "last_time": last["time"],
            "source": "Yahoo Finance KOSPI200.KS 5m",
            "official_options_session": "08:45~15:45, last trading day 08:45~15:20",
        },
        "levels": levels,
        "signals": signals,
    }
    if include_series:
        session["series"] = series
    return session


def _series_for_candles(candles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    series = []
    closes = []
    for candle in candles:
        closes.append(float(candle["close"]))
        series.append(
            {
                "time": candle["time"],
                "open": round(float(candle["open"]), 4),
                "high": round(float(candle["high"]), 4),
                "low": round(float(candle["low"]), 4),
                "close": round(float(candle["close"]), 4),
                "index": round(float(candle["close"]), 4),
                "gma30": _geometric_average(closes[-30:]),
                "gma50": _geometric_average(closes[-50:]),
                "tenkan": _ichimoku_mid(candles[: len(closes)], 9),
                "kijun": _ichimoku_mid(candles[: len(closes)], 26),
                "volume": candle.get("volume", 0),
            }
        )
    return series


def _signals_for_candles(candles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    signals = []
    last_rule = None
    for index in range(7, len(candles)):
        partial = candles[: index + 1]
        levels = _confirmed_levels_for(partial)
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
                "time": latest["time"],
                "type": signal.get("type", "watch"),
                "label": signal.get("title") or signal.get("label") or "신호",
                "message": signal.get("message") or "",
                "action": rule,
                "alert": signal.get("label", ""),
                "trade_decision": signal.get("trade_decision"),
                "filter_pass": (signal.get("metrics") or {}).get("call_entry_filter_pass"),
                "index_value": latest["close"],
                "levels": _signal_levels(levels),
                "candle": {
                    "open": latest.get("open"),
                    "high": latest.get("high"),
                    "low": latest.get("low"),
                    "close": latest.get("close"),
                },
            }
        )
    return signals[:24]


def _signal_levels(levels: dict[str, Any]) -> dict[str, float]:
    keys = ("day_high", "day_low", "fib_382", "fib_50", "fib_618", "fib_100", "fib_105")
    return {key: float(levels[key]) for key in keys if levels.get(key) is not None}


def _confirmed_levels_for(candles: list[dict[str, Any]]) -> dict[str, float]:
    if len(candles) > 1 and candles[-2].get("date") == candles[-1].get("date"):
        return intraday_levels(candles[:-1])
    return intraday_levels(candles)


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


def _date_label(date: str) -> str:
    return f"{date[5:7]}/{date[8:10]} {_weekday_label(date)}"


def _weekday_label(date: str) -> str:
    labels = ["월", "화", "수", "목", "금", "토", "일"]
    return labels[datetime.fromisoformat(date).weekday()]


def _weekday_profile(date: str) -> str:
    weekday = datetime.fromisoformat(date).weekday()
    if weekday == 3:
        return "목요일 만기"
    if weekday == 4:
        return "금요일"
    return "일반 복기"


def _iso_now() -> str:
    return datetime.now(KST).replace(microsecond=0).isoformat()


def _parse_ts(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value)).astimezone(KST)
    except ValueError:
        return None
