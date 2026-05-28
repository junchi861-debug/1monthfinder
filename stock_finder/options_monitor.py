from __future__ import annotations

import json
import math
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, time, timedelta, timezone
from typing import Any


KST = timezone(timedelta(hours=9), "KST")
YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"


@dataclass(frozen=True)
class MonitorInstrument:
    role: str
    symbol: str
    label: str
    provider: str = "yahoo"


MAIN_INSTRUMENT = MonitorInstrument(
    role="main",
    symbol="KOSPI200.KS",
    label="KOSPI200 지수",
)
SECONDARY_INSTRUMENT = MonitorInstrument(
    role="secondary",
    symbol="069500.KS",
    label="KODEX200 보조",
)


def build_options_monitor_snapshot() -> dict[str, Any]:
    """Build a read-only intraday monitoring snapshot for the options screen."""

    generated_at = datetime.now(KST)
    main = _build_instrument_snapshot(MAIN_INSTRUMENT, generated_at)
    secondary = _build_instrument_snapshot(SECONDARY_INSTRUMENT, generated_at)
    return {
        "ok": bool(main.get("ok")),
        "mode": "monitor_only",
        "generated_at": _iso(generated_at),
        "poll_seconds": 60,
        "source": {
            "name": "Yahoo Finance Chart API",
            "key_required": False,
            "note": "키 없는 분봉 조회용입니다. 주문/계좌 기능은 사용하지 않습니다.",
        },
        "main": main,
        "secondary": secondary,
        "signal": main.get("signal", _empty_signal("neutral", "데이터 대기", "분봉 데이터를 기다리고 있습니다.")),
    }


def _build_instrument_snapshot(instrument: MonitorInstrument, generated_at: datetime) -> dict[str, Any]:
    try:
        candles = _fetch_yahoo_candles(instrument.symbol)
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
            "signal": _empty_signal(
                "warning" if instrument.role == "main" else "neutral",
                "데이터 조회 실패",
                f"{instrument.label} 분봉을 가져오지 못했습니다.",
            ),
        }

    levels = _intraday_levels(candles)
    latest = candles[-1] if candles else None
    signal = _evaluate_signal(candles, levels, generated_at)
    return {
        "ok": bool(candles),
        "role": instrument.role,
        "symbol": instrument.symbol,
        "label": instrument.label,
        "provider": instrument.provider,
        "interval": "5m",
        "candles": candles[-96:],
        "latest": latest,
        "levels": levels,
        "signal": signal,
    }


def _fetch_yahoo_candles(symbol: str) -> list[dict[str, Any]]:
    query = urllib.parse.urlencode(
        {
            "range": "5d",
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


def _intraday_levels(candles: list[dict[str, Any]]) -> dict[str, float]:
    if not candles:
        return {}

    latest_date = candles[-1]["date"]
    session = [candle for candle in candles if candle["date"] == latest_date] or candles
    high = max(float(candle["high"]) for candle in session)
    low = min(float(candle["low"]) for candle in session)
    span = max(high - low, 0.0001)
    closes = [float(candle["close"]) for candle in session]
    return {
        "day_high": round(high, 4),
        "day_low": round(low, 4),
        "fib_50": round(high - span * 0.5, 4),
        "fib_618": round(high - span * 0.618, 4),
        "fib_809": round(high - span * 0.809, 4),
        "fib_100": round(low, 4),
        "fib_103": round(high - span * 1.03, 4),
        "fib_105": round(high - span * 1.05, 4),
        "gma_30": _geometric_average(closes[-30:]),
        "gma_50": _geometric_average(closes[-50:]),
    }


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

    if close <= fib_105:
        return {
            "type": "sell",
            "label": "강한 이탈",
            "title": "105% 손절/자리이동 감시",
            "message": f"KOSPI200 기준가가 105% 이탈선 {fib_105:.2f} 부근입니다. 보유 옵션이 있으면 MTS에서 손절/자리이동 기준을 확인하세요.",
            "alert_level": "strong",
            "rule": "FIB_105_BREAK",
            "time": latest["time"],
            "metrics": _signal_metrics(close, lower_wick_ratio, age_minutes),
        }

    if low <= fib_618 <= close and close >= open_ and lower_wick_ratio >= 0.35:
        return {
            "type": "candidate",
            "label": "콜 후보",
            "title": "61.8% 밑꼬리 회복",
            "message": f"5분봉이 61.8% {fib_618:.2f}를 찌르고 회복했습니다. 콜 재시작 후보를 매매폰에서 확인하세요.",
            "alert_level": "strong",
            "rule": "FIB_618_LOWER_WICK_RECLAIM",
            "time": latest["time"],
            "metrics": _signal_metrics(close, lower_wick_ratio, age_minutes),
        }

    if abs(close - fib_618) <= tolerance:
        return {
            "type": "warning",
            "label": "관찰",
            "title": "61.8% 관찰 구간",
            "message": f"현재가 {close:.2f}가 61.8% {fib_618:.2f} 근처입니다. 다음 5분봉 밑꼬리/회복 여부를 봅니다.",
            "alert_level": "normal",
            "rule": "NEAR_FIB_618",
            "time": latest["time"],
            "metrics": _signal_metrics(close, lower_wick_ratio, age_minutes),
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
            "metrics": _signal_metrics(close, lower_wick_ratio, age_minutes),
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
            "metrics": _signal_metrics(close, lower_wick_ratio, age_minutes),
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


def _signal_metrics(close: float, lower_wick_ratio: float, age_minutes: int) -> dict[str, Any]:
    return {
        "close": round(close, 4),
        "lower_wick_ratio": round(lower_wick_ratio, 3),
        "age_minutes": age_minutes,
    }


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


def _is_market_time(moment: datetime) -> bool:
    if moment.weekday() >= 5:
        return False
    return time(9, 0) <= moment.time() <= time(15, 45)


def _iso(moment: datetime) -> str:
    return moment.astimezone(KST).replace(microsecond=0).isoformat()


def _parse_iso(value: str) -> datetime:
    return datetime.fromisoformat(value).astimezone(KST)
