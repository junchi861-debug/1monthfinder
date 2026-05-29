from __future__ import annotations

import json
import math
import re
import urllib.error
import urllib.parse
import urllib.request
from html import unescape
from dataclasses import dataclass
from datetime import datetime, time, timedelta, timezone
from typing import Any


KST = timezone(timedelta(hours=9), "KST")
YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
NAVER_INDEX_TIME_URL = "https://finance.naver.com/sise/sise_index_time.naver"
NAVER_ITEM_TIME_URL = "https://finance.naver.com/item/sise_time.nhn"
SNAPSHOT_CACHE_SECONDS = 45
NAVER_RECENT_PAGES = 14
NAVER_FULL_SESSION_PAGES = 80
_SNAPSHOT_CACHE: dict[str, Any] = {"created_at": 0.0, "payload": None}


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


def build_options_monitor_snapshot(use_cache: bool = True) -> dict[str, Any]:
    """Build a read-only intraday monitoring snapshot for the options screen."""

    now_ts = datetime.now(KST).timestamp()
    if use_cache and _SNAPSHOT_CACHE["payload"] and now_ts - float(_SNAPSHOT_CACHE["created_at"]) < SNAPSHOT_CACHE_SECONDS:
        return _SNAPSHOT_CACHE["payload"]

    generated_at = datetime.now(KST)
    main = _build_instrument_snapshot(MAIN_INSTRUMENT, generated_at)
    secondary = _build_instrument_snapshot(SECONDARY_INSTRUMENT, generated_at)
    payload = {
        "ok": bool(main.get("ok")),
        "mode": "monitor_only",
        "generated_at": _iso(generated_at),
        "poll_seconds": 60,
        "source": {
            "name": "Yahoo Finance + Naver Finance",
            "key_required": False,
            "note": "Yahoo 5분봉과 네이버 1분 장중 시세를 합쳐 1분 예비 감지와 5분 확정 신호를 나눕니다. 주문/계좌 기능은 사용하지 않습니다.",
        },
        "main": main,
        "secondary": secondary,
        "signal": main.get("signal", _empty_signal("neutral", "데이터 대기", "분봉 데이터를 기다리고 있습니다.")),
    }
    _SNAPSHOT_CACHE["created_at"] = now_ts
    _SNAPSHOT_CACHE["payload"] = payload
    return payload


def fetch_main_candles(range_value: str = "1mo") -> list[dict[str, Any]]:
    return _fetch_yahoo_candles(MAIN_INSTRUMENT.symbol, range_value=range_value)


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
    return time(8, 55) <= current_time <= time(15, 45)


def _fetch_yahoo_candles(symbol: str, range_value: str = "5d") -> list[dict[str, Any]]:
    query = urllib.parse.urlencode(
        {
            "range": range_value,
            "interval": "5m",
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
        raise RuntimeError("유효한 5분봉 없음")
    return candles


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
        if page_quotes[-1]["datetime"].time() <= time(9, 0):
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

    if low <= fib_618 <= close and close >= open_ and lower_wick_ratio >= 0.35:
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
                "metrics": _signal_metrics(close, lower_wick_ratio, age_minutes, trend, call_filter_pass),
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
            "metrics": _signal_metrics(close, lower_wick_ratio, age_minutes, trend, call_filter_pass),
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
) -> dict[str, Any] | None:
    reset_mid = _level(levels, "reset_mid_618_100")
    reset_100 = _level(levels, "reset_fib_100")
    reset_618 = _level(levels, "reset_fib_618")
    fib_105 = _level(levels, "fib_105")
    if reset_mid is None or reset_100 is None or reset_618 is None or fib_105 is None:
        return None

    touched_reset_mid = low <= reset_mid <= close
    broke_core_zone = low <= fib_105 or close <= fib_105
    bullish_reclaim = close >= open_ and lower_wick_ratio >= 0.30
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

    metrics = {
        "late_session_active": True,
        "late_session_start": "14:30",
        "final_exit_window": "15:30~15:32",
        "loss_prepare_threshold_pct": -10,
        "profit_hold_threshold_krw": 200000,
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

    hold_note = (
        "기준선을 터치한 뒤 다시 말아올린 상태입니다. "
        if reclaimed_kijun
        else "기준선 위에서 장후반 추세가 유지되고 있습니다. "
    )
    runner_note = (
        "확보 수익이 20만원 이상이고 청산조건이 나오지 않으면 15:30 전까지 잔량 플레이가 가능합니다."
        if holds_tenkan
        else "전환선 아래에서는 잔량을 길게 끌기보다 청산 준비를 우선합니다."
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
    return time(9, 0) <= moment.time() <= time(15, 45)


def _iso(moment: datetime) -> str:
    return moment.astimezone(KST).replace(microsecond=0).isoformat()


def _parse_iso(value: str) -> datetime:
    return datetime.fromisoformat(value).astimezone(KST)
