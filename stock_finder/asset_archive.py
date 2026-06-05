from __future__ import annotations

import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from stock_finder.options_archive import RETENTION_DAYS, SUMMARY_RETENTION_DAYS, build_options_replay_payload
from stock_finder.options_monitor import KST, fetch_symbol_candles


PROJECT_ROOT = Path(__file__).resolve().parents[1]
MARKET_REPORT_PATH = PROJECT_ROOT / "site" / "data" / "market_report.json"
CACHE_SECONDS = 10 * 60
INTRADAY_CACHE_SECONDS = 5 * 60
US_STOCK_CACHE_SECONDS = 15 * 60
MIN_INDEX_HISTORY_DAYS = 20
HISTORY_FETCH_WORKERS = 6
CRYPTO_INTRADAY_FETCH_WORKERS = 6
CRYPTO_INTRADAY_DAYS = 30
CRYPTO_INTRADAY_RANGE = "30d"
CRYPTO_INTRADAY_INTERVAL = "30m"
CRYPTO_SYMBOL_KEYS = ("btc", "eth", "xrp", "xlm")
CRYPTO_EXCEPTION_SYMBOL_KEYS = ("id", "pokt", "inj", "doge", "trx", "sol")
CRYPTO_CASH_SYMBOL_KEYS = ("usdt",)
CRYPTO_PROFILES = {
    "btc": {"name": "비트코인", "asset_type": "major", "type_label": "메이저", "portfolio_cap_pct": 70, "approved_scope": True},
    "eth": {"name": "이더리움", "asset_type": "major", "type_label": "메이저", "portfolio_cap_pct": 70, "approved_scope": True},
    "xrp": {"name": "엑스알피", "asset_type": "alt", "type_label": "알트", "portfolio_cap_pct": 30, "approved_scope": True},
    "xlm": {"name": "스텔라루멘", "asset_type": "alt", "type_label": "알트", "portfolio_cap_pct": 30, "approved_scope": True},
    "id": {
        "name": "스페이스아이디",
        "asset_type": "exception",
        "type_label": "예외",
        "portfolio_cap_pct": 2.5,
        "exception_pool_cap_pct": 5,
        "approved_scope": False,
    },
    "pokt": {
        "name": "포켓네트워크",
        "asset_type": "exception",
        "type_label": "예외",
        "portfolio_cap_pct": 2.5,
        "exception_pool_cap_pct": 5,
        "approved_scope": False,
    },
    "inj": {
        "name": "인젝티브",
        "asset_type": "exception",
        "type_label": "예외",
        "portfolio_cap_pct": 2.5,
        "exception_pool_cap_pct": 5,
        "approved_scope": False,
    },
    "doge": {
        "name": "도지코인",
        "asset_type": "exception",
        "type_label": "예외",
        "portfolio_cap_pct": 2.5,
        "exception_pool_cap_pct": 5,
        "approved_scope": False,
    },
    "trx": {
        "name": "트론",
        "asset_type": "exception",
        "type_label": "예외",
        "portfolio_cap_pct": 2.5,
        "exception_pool_cap_pct": 5,
        "approved_scope": False,
    },
    "sol": {
        "name": "솔라나",
        "asset_type": "exception",
        "type_label": "예외",
        "portfolio_cap_pct": 2.5,
        "exception_pool_cap_pct": 5,
        "approved_scope": False,
    },
    "usdt": {"name": "테더", "asset_type": "cash", "type_label": "현금성", "portfolio_cap_pct": None, "approved_scope": False},
}
HISTORY_SYMBOLS = {
    "kospi200": ("KOSPI200", "KOSPI200.KS"),
    "etf": ("KODEX200", "069500.KS"),
    "btc": ("BTC", "BTC-USD"),
    "eth": ("ETH", "ETH-USD"),
    "xrp": ("XRP", "XRP-USD"),
    "xlm": ("XLM", "XLM-USD"),
    "id": ("ID", "ID-USD"),
    "pokt": ("POKT", "POKT-USD"),
    "inj": ("INJ", "INJ-USD"),
    "doge": ("DOGE", "DOGE-USD"),
    "trx": ("TRX", "TRX-USD"),
    "sol": ("SOL", "SOL-USD"),
    "usdt": ("USDT", "USDT-USD"),
}
US_STOCK_SYMBOLS = [
    ("SPY", "SPDR S&P 500 ETF", "시장 ETF"),
    ("QQQ", "Invesco QQQ Trust", "시장 ETF"),
    ("IWM", "iShares Russell 2000 ETF", "시장 ETF"),
    ("SMH", "VanEck Semiconductor ETF", "섹터 ETF"),
    ("XLK", "Technology Select Sector SPDR", "섹터 ETF"),
    ("XLF", "Financial Select Sector SPDR", "섹터 ETF"),
    ("XLE", "Energy Select Sector SPDR", "섹터 ETF"),
    ("AAPL", "Apple Inc.", "Mega Cap"),
    ("MSFT", "Microsoft Corp.", "Mega Cap"),
    ("NVDA", "NVIDIA Corp.", "AI 반도체"),
    ("AMZN", "Amazon.com Inc.", "플랫폼"),
    ("GOOGL", "Alphabet Class A", "플랫폼"),
    ("META", "Meta Platforms", "플랫폼"),
    ("TSLA", "Tesla Inc.", "전기차"),
    ("AVGO", "Broadcom Inc.", "반도체"),
    ("AMD", "Advanced Micro Devices", "반도체"),
    ("TSM", "Taiwan Semiconductor", "반도체"),
    ("ASML", "ASML Holding", "반도체 장비"),
    ("PLTR", "Palantir Technologies", "AI 소프트웨어"),
    ("ORCL", "Oracle Corp.", "소프트웨어"),
    ("CRM", "Salesforce Inc.", "소프트웨어"),
    ("COIN", "Coinbase Global", "코인 관련"),
    ("JPM", "JPMorgan Chase", "금융"),
    ("LLY", "Eli Lilly", "헬스케어"),
    ("XOM", "Exxon Mobil", "에너지"),
]
_HISTORY_CACHE: dict[str, Any] = {"created_at": 0.0, "histories": {}}
_INTRADAY_CACHE: dict[str, Any] = {"created_at": 0.0, "histories": {}}
_US_STOCK_CACHE: dict[str, Any] = {"created_at": 0.0, "histories": {}}


def build_asset_archive_payload(date: str | None = None) -> dict[str, Any]:
    selected_date = _normalize_date(date)
    histories = _cached_histories()
    crypto_intraday = _cached_crypto_intraday()
    us_stock_histories = _cached_us_stock_histories()
    options = build_options_replay_payload(date=selected_date, refresh=False)
    kospi200 = _instrument_payload("kospi200", selected_date, histories)
    etf = _instrument_payload("etf", selected_date, histories)
    crypto_assets = [_crypto_asset_payload(key, selected_date, histories, crypto_intraday) for key in CRYPTO_SYMBOL_KEYS]
    crypto_exception_assets = [_crypto_asset_payload(key, selected_date, histories, crypto_intraday) for key in CRYPTO_EXCEPTION_SYMBOL_KEYS]
    crypto_cash_assets = [_crypto_asset_payload(key, selected_date, histories, {}) for key in CRYPTO_CASH_SYMBOL_KEYS]
    crypto_universe = [*crypto_assets, *crypto_exception_assets]
    market_report = _read_market_report()
    index_proxy = _index_proxy(kospi200, etf)

    return {
        "ok": True,
        "generated_at": _iso_now(),
        "selected_date": selected_date,
        "policy": {
            "detail_days": RETENTION_DAYS,
            "summary_days": SUMMARY_RETENTION_DAYS,
            "detail_label": "최근 90일 상세 복기",
            "summary_label": "최근 1년 요약 아카이브",
        },
        "options": {
            "date_range": options.get("date_range") or {},
            "retention_days": options.get("retention_days", RETENTION_DAYS),
            "summary_retention_days": options.get("summary_retention_days", SUMMARY_RETENTION_DAYS),
            "sessions": options.get("sessions") or [],
        },
        "etf": {
            **etf,
            "index_filter": _index_filter(index_proxy),
            "allocation_model": {
                "first_tranche_pct": 30,
                "second_tranche_pct": 30,
                "third_tranche_pct": 20,
                "emergency_cash_pct": 20,
            },
        },
        "stocks": _stocks_payload(market_report, index_proxy),
        "us_stocks": _us_stocks_payload(selected_date, us_stock_histories),
        "crypto": {
            "assets": crypto_assets,
            "exception_assets": crypto_exception_assets,
            "cash_assets": crypto_cash_assets,
            "summary": _crypto_summary(crypto_assets),
            "candidate_universe": _crypto_candidate_universe(crypto_universe),
            "calculation": _crypto_calculation_summary(crypto_universe),
            "allocation_policy": {
                "approved_scope_symbols": [HISTORY_SYMBOLS[key][0] for key in CRYPTO_SYMBOL_KEYS],
                "major_cap_pct": 70,
                "alt_cap_pct": 30,
                "exception_pool_cap_pct": 5,
                "exception_symbol_cap_pct": 2.5,
                "exception_entry_slot_pct": 65,
                "exception_weekly_probe_pct": 1,
                "exception_weekly_stop_pct": 30,
                "exception_pool_approval_range_pct": [6, 7, 8, 9, 10],
                "exception_pool_absolute_max_pct": 15,
                "intraday_box_bars": 80,
                "forced_reduce_drawdown_pct": {"major": 15, "alt": 20, "exception": 25},
                "forced_reduce_hard_multiplier": 1.1,
                "reentry_bounce_pct": {"major": 5, "alt": 7, "exception": 10},
                "cash_like_symbols": ["USDT"],
                "scout_pct": 5,
                "reduced_pct": 15,
                "starter_pct": 30,
                "starter_plus_10_pct": 40,
                "starter_plus_20_pct": 50,
                "base_pct": 65,
                "base_plus_17_pct": 82,
                "full_pct": 100,
                "base_rebuild_market_slot_pct": 15,
                "base_rebuild_limit_discount_pct": [2, 7],
                "exception_pool_auto_step_pct": 1,
            },
            "archive_note": "코인은 BTC/ETH/XRP/XLM만 정상 운용 감시군으로 보고, 선발대 5%, 기초 30%, 기초+10/20, 기본 65%, 기본+17, 맥스 100% 단계로 표시합니다. 그 밖의 급변 코인은 예외 풀 5% 안에서 종목당 2.5% 한도로만 표시합니다. 주봉 상승초입이지만 진입이 늦은 예외 후보는 1% 탐색 진입과 30% 이상 넓은 손절을 별도 표시하며, 예외풀이 5%를 넘으면 6~10% 범위에서 사용자 승인을 요구하고 응답이 없으면 +1%만 임시 허용하되 절대 15%를 넘기지 않습니다. USDT는 현금성 자산으로 분류합니다.",
        },
        "market": {
            "kospi200": kospi200,
            "index_proxy": index_proxy,
        },
    }


def build_asset_archive_section_payload(date: str | None = None, sections: list[str] | tuple[str, ...] | set[str] | None = None) -> dict[str, Any]:
    selected_date = _normalize_date(date)
    requested_sections = _normalize_sections(sections)
    all_sections = {"options", "etf", "stocks", "us_stocks", "crypto", "market"}
    if requested_sections == all_sections:
        payload = build_asset_archive_payload(date=selected_date)
        payload["sections"] = sorted(requested_sections)
        return payload

    needs_histories = bool(requested_sections & {"etf", "stocks", "crypto", "market"})
    histories = _cached_histories() if needs_histories else {}
    kospi200 = _instrument_payload("kospi200", selected_date, histories) if needs_histories else {}
    etf = _instrument_payload("etf", selected_date, histories) if needs_histories else {}
    index_proxy = _index_proxy(kospi200, etf) if needs_histories else {}
    payload: dict[str, Any] = {
        "ok": True,
        "generated_at": _iso_now(),
        "selected_date": selected_date,
        "sections": sorted(requested_sections),
        "policy": {
            "detail_days": RETENTION_DAYS,
            "summary_days": SUMMARY_RETENTION_DAYS,
            "detail_label": "recent detail archive",
            "summary_label": "recent summary archive",
        },
    }

    if "options" in requested_sections:
        options = build_options_replay_payload(date=selected_date, refresh=False)
        payload["options"] = {
            "date_range": options.get("date_range") or {},
            "retention_days": options.get("retention_days", RETENTION_DAYS),
            "summary_retention_days": options.get("summary_retention_days", SUMMARY_RETENTION_DAYS),
            "sessions": options.get("sessions") or [],
        }

    if "etf" in requested_sections:
        payload["etf"] = {
            **etf,
            "index_filter": _index_filter(index_proxy),
            "allocation_model": {
                "first_tranche_pct": 30,
                "second_tranche_pct": 30,
                "third_tranche_pct": 20,
                "emergency_cash_pct": 20,
            },
        }

    if "stocks" in requested_sections:
        payload["stocks"] = _stocks_payload(_read_market_report(), index_proxy)

    if "us_stocks" in requested_sections:
        payload["us_stocks"] = _us_stocks_payload(selected_date, _cached_us_stock_histories())

    if "crypto" in requested_sections:
        crypto_intraday = _cached_crypto_intraday()
        crypto_assets = [_crypto_asset_payload(key, selected_date, histories, crypto_intraday) for key in CRYPTO_SYMBOL_KEYS]
        crypto_exception_assets = [_crypto_asset_payload(key, selected_date, histories, crypto_intraday) for key in CRYPTO_EXCEPTION_SYMBOL_KEYS]
        crypto_cash_assets = [_crypto_asset_payload(key, selected_date, histories, {}) for key in CRYPTO_CASH_SYMBOL_KEYS]
        crypto_universe = [*crypto_assets, *crypto_exception_assets]
        payload["crypto"] = {
            "assets": crypto_assets,
            "exception_assets": crypto_exception_assets,
            "cash_assets": crypto_cash_assets,
            "summary": _crypto_summary(crypto_assets),
            "candidate_universe": _crypto_candidate_universe(crypto_universe),
            "calculation": _crypto_calculation_summary(crypto_universe),
            "allocation_policy": {
                "approved_scope_symbols": [HISTORY_SYMBOLS[key][0] for key in CRYPTO_SYMBOL_KEYS],
                "major_cap_pct": 70,
                "alt_cap_pct": 30,
                "exception_pool_cap_pct": 5,
                "exception_symbol_cap_pct": 2.5,
                "exception_entry_slot_pct": 65,
                "exception_weekly_probe_pct": 1,
                "exception_weekly_stop_pct": 30,
                "exception_pool_approval_range_pct": [6, 7, 8, 9, 10],
                "exception_pool_absolute_max_pct": 15,
                "intraday_box_bars": 80,
                "forced_reduce_drawdown_pct": {"major": 15, "alt": 20, "exception": 25},
                "forced_reduce_hard_multiplier": 1.1,
                "reentry_bounce_pct": {"major": 5, "alt": 7, "exception": 10},
                "cash_like_symbols": ["USDT"],
                "scout_pct": 5,
                "reduced_pct": 15,
                "starter_pct": 30,
                "starter_plus_10_pct": 40,
                "starter_plus_20_pct": 50,
                "base_pct": 65,
                "base_plus_17_pct": 82,
                "full_pct": 100,
                "base_rebuild_market_slot_pct": 15,
                "base_rebuild_limit_discount_pct": [2, 7],
                "exception_pool_auto_step_pct": 1,
            },
            "archive_note": "Crypto payload is split by tab so the app can load the active view first.",
        }

    if "market" in requested_sections:
        payload["market"] = {
            "kospi200": kospi200,
            "index_proxy": index_proxy,
        }

    return payload


def _normalize_sections(sections: list[str] | tuple[str, ...] | set[str] | None) -> set[str]:
    allowed = {"options", "etf", "stocks", "us_stocks", "crypto", "market"}
    if sections is None:
        return set(allowed)
    normalized = {str(section or "").strip().lower().replace("-", "_") for section in sections}
    normalized.discard("")
    if not normalized or "all" in normalized:
        return set(allowed)
    return {section for section in normalized if section in allowed}


def _cached_histories() -> dict[str, dict[str, Any]]:
    now = time.time()
    if _HISTORY_CACHE["histories"] and now - float(_HISTORY_CACHE["created_at"]) < CACHE_SECONDS:
        return _HISTORY_CACHE["histories"]

    histories: dict[str, dict[str, Any]] = {}

    def fetch(item: tuple[str, tuple[str, str]]) -> tuple[str, dict[str, Any]]:
        key, (label, symbol) = item
        try:
            candles = fetch_symbol_candles(symbol, range_value="1y", interval="1d")
            return key, {"ok": True, "label": label, "symbol": symbol, "candles": candles[-SUMMARY_RETENTION_DAYS:]}
        except Exception as exc:
            return key, {"ok": False, "label": label, "symbol": symbol, "error": str(exc), "candles": []}

    with ThreadPoolExecutor(max_workers=HISTORY_FETCH_WORKERS) as executor:
        futures = [executor.submit(fetch, item) for item in HISTORY_SYMBOLS.items()]
        for future in as_completed(futures):
            key, payload = future.result()
            histories[key] = payload

    _HISTORY_CACHE["created_at"] = now
    _HISTORY_CACHE["histories"] = histories
    return histories


def _cached_crypto_intraday() -> dict[str, dict[str, Any]]:
    now = time.time()
    if _INTRADAY_CACHE["histories"] and now - float(_INTRADAY_CACHE["created_at"]) < INTRADAY_CACHE_SECONDS:
        return _INTRADAY_CACHE["histories"]

    cutoff = (datetime.now(KST).date() - timedelta(days=CRYPTO_INTRADAY_DAYS)).isoformat()
    histories: dict[str, dict[str, Any]] = {}

    def fetch(key: str) -> tuple[str, dict[str, Any]]:
        label, symbol = HISTORY_SYMBOLS[key]
        try:
            candles = fetch_symbol_candles(symbol, range_value=CRYPTO_INTRADAY_RANGE, interval=CRYPTO_INTRADAY_INTERVAL)
            candles = [candle for candle in candles if str(candle.get("date") or "") >= cutoff]
            return key, {
                "ok": True,
                "label": label,
                "symbol": symbol,
                "interval": "30분",
                "source_interval": CRYPTO_INTRADAY_INTERVAL,
                "preferred_interval": "240분",
                "candles": candles,
            }
        except Exception as exc:
            return key, {
                "ok": False,
                "label": label,
                "symbol": symbol,
                "interval": "30분",
                "source_interval": CRYPTO_INTRADAY_INTERVAL,
                "preferred_interval": "240분",
                "error": str(exc),
                "candles": [],
            }

    with ThreadPoolExecutor(max_workers=CRYPTO_INTRADAY_FETCH_WORKERS) as executor:
        futures = [executor.submit(fetch, key) for key in (*CRYPTO_SYMBOL_KEYS, *CRYPTO_EXCEPTION_SYMBOL_KEYS)]
        for future in as_completed(futures):
            key, payload = future.result()
            histories[key] = payload

    _INTRADAY_CACHE["created_at"] = now
    _INTRADAY_CACHE["histories"] = histories
    return histories


def _cached_us_stock_histories() -> dict[str, dict[str, Any]]:
    now = time.time()
    if _US_STOCK_CACHE["histories"] and now - float(_US_STOCK_CACHE["created_at"]) < US_STOCK_CACHE_SECONDS:
        return _US_STOCK_CACHE["histories"]

    histories: dict[str, dict[str, Any]] = {}

    def fetch(meta: tuple[str, str, str]) -> tuple[str, dict[str, Any]]:
        symbol, name, group = meta
        try:
            candles = fetch_symbol_candles(symbol, range_value="1y", interval="1d")
            return symbol, {
                "ok": True,
                "label": name,
                "symbol": symbol,
                "group": group,
                "candles": candles[-SUMMARY_RETENTION_DAYS:],
            }
        except Exception as exc:
            return symbol, {
                "ok": False,
                "label": name,
                "symbol": symbol,
                "group": group,
                "error": str(exc),
                "candles": [],
            }

    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = [executor.submit(fetch, meta) for meta in US_STOCK_SYMBOLS]
        for future in as_completed(futures):
            symbol, payload = future.result()
            histories[symbol] = payload

    _US_STOCK_CACHE["created_at"] = now
    _US_STOCK_CACHE["histories"] = histories
    return histories


def _instrument_payload(key: str, selected_date: str | None, histories: dict[str, dict[str, Any]]) -> dict[str, Any]:
    source = histories.get(key) or {}
    candles = source.get("candles") or []
    rows = [_daily_row(candle) for candle in candles]
    rows = [row for row in rows if row]
    selected = _row_for_date(rows, selected_date) or (rows[-1] if rows else None)
    summary = _summary_for_rows(rows, selected)
    return {
        "ok": bool(source.get("ok")) and bool(rows),
        "label": source.get("label") or key,
        "symbol": source.get("symbol") or "",
        "error": source.get("error"),
        "selected": selected,
        "latest": rows[-1] if rows else None,
        "history": rows,
        "summary": summary,
    }


def _crypto_asset_payload(
    key: str,
    selected_date: str | None,
    histories: dict[str, dict[str, Any]],
    intraday_histories: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    asset = _instrument_payload(key, selected_date, histories)
    asset["profile"] = {
        **(CRYPTO_PROFILES.get(key) or {"asset_type": "alt", "type_label": "알트", "portfolio_cap_pct": 30}),
        "key": key,
        "slot_pct_labels": {
            "reduced": "축소 15%",
            "scout": "선발대 5%",
            "starter": "기초물량 30%",
            "starter_plus_10": "기초+10 40%",
            "starter_plus_20": "기초+20 50%",
            "base": "기본물량 65%",
            "base_plus_17": "기본+17 82%",
            "full": "맥스 100%",
        },
    }
    asset["intraday"] = _instrument_intraday_payload(key, selected_date, intraday_histories)
    asset["signal_plan"] = _crypto_backend_signal_plan(asset)
    return asset


def _crypto_backend_signal_plan(asset: dict[str, Any]) -> dict[str, Any]:
    key = str((asset.get("profile") or {}).get("key") or asset.get("label") or asset.get("symbol") or "").lower()
    profile = asset.get("profile") or {}
    summary = asset.get("summary") or {}
    selected = asset.get("selected") or asset.get("latest") or {}
    intraday = asset.get("intraday") or {}
    signal_at = selected.get("datetime") or selected.get("date") or ""
    if not asset.get("ok") or not selected:
        return _crypto_error_signal_plan(key, "DATA_MISSING", "원천 일봉 데이터가 없어 후보 계산을 중단했습니다.", signal_at)
    if not intraday.get("ok") or not (intraday.get("history") or []):
        return _crypto_error_signal_plan(key, "INTRADAY_MISSING", "30분 데이터가 없어 후보 계산을 중단했습니다.", signal_at)

    raw_score = _float_or_none(summary.get("score"))
    if raw_score is None:
        return _crypto_error_signal_plan(key, "SUMMARY_SCORE_MISSING", "일봉 요약 점수가 없어 후보 계산을 중단했습니다.", signal_at)

    score = _bounded_score(raw_score, 0.0)
    ret_21 = _float_or_none(summary.get("ret_21d"))
    ret_63 = _float_or_none(summary.get("ret_63d"))
    intraday_selected = intraday.get("selected") or intraday.get("latest") or {}
    intraday_change = _float_or_none(intraday_selected.get("change_pct"))
    candidate_score = score
    if ret_21 is not None and ret_21 > 0:
        candidate_score += min(10.0, ret_21 * 100)
    if ret_63 is not None and ret_63 > 0:
        candidate_score += min(8.0, ret_63 * 60)
    if intraday_change is not None:
        candidate_score += max(-8.0, min(8.0, intraday_change * 0.7))
    if str(profile.get("asset_type") or "") == "exception":
        candidate_score -= 6.0
    candidate_score = _bounded_score(candidate_score, 50.0)

    if candidate_score >= 74:
        signal = "candidate"
        label = "매수 후보"
        sort_rank = 0
        action = "감시 추가 후 30분 지지와 리스크 기준을 확인합니다."
    elif candidate_score >= 55:
        signal = "watch"
        label = "관찰"
        sort_rank = 1
        action = "차트 조건이 더 붙을 때까지 관찰합니다."
    else:
        signal = "warning"
        label = "보수 관찰"
        sort_rank = 2
        action = "추세 회복 전까지 신규 감시 추가를 보류합니다."

    reason = summary.get("message") or "일봉/30분 데이터 기반 후보 점수입니다."
    return {
        "ok": True,
        "source": "backend",
        "fallback": False,
        "calculation_status": "complete",
        "key": key,
        "signal": signal,
        "className": signal,
        "label": label,
        "score": round(score, 1),
        "candidate_score": round(candidate_score, 1),
        "sort_rank": sort_rank,
        "reason": reason,
        "message": reason,
        "action": action,
        "signal_at": signal_at,
        "generated_at": _iso_now(),
    }


def _crypto_error_signal_plan(key: str, code: str, message: str, signal_at: str = "") -> dict[str, Any]:
    return {
        "ok": False,
        "source": "backend",
        "fallback": False,
        "calculation_status": "error",
        "error_code": code,
        "key": key,
        "signal": "warning",
        "className": "warning",
        "label": "계산 오류",
        "score": 0,
        "candidate_score": 0,
        "sort_rank": 3,
        "reason": message,
        "message": message,
        "action": "원천 데이터를 확인하기 전까지 후보 판단을 사용하지 않습니다.",
        "signal_at": signal_at,
        "generated_at": _iso_now(),
    }


def _crypto_candidate_universe(assets: list[dict[str, Any]]) -> list[dict[str, Any]]:
    def sort_rank(value: Any) -> int:
        try:
            return int(value)
        except (TypeError, ValueError):
            return 3

    candidates: list[dict[str, Any]] = []
    for asset in assets:
        plan = asset.get("signal_plan") or {}
        key = str(plan.get("key") or (asset.get("profile") or {}).get("key") or asset.get("label") or "").lower()
        if not key:
            continue
        candidates.append(
            {
                "key": key,
                "label": asset.get("label") or key.upper(),
                "name": (asset.get("profile") or {}).get("name") or asset.get("label") or key.upper(),
                "signal": plan.get("signal") or "warning",
                "className": plan.get("className") or plan.get("signal") or "warning",
                "candidate_score": plan.get("candidate_score") or 0,
                "sort_rank": plan.get("sort_rank", 3),
                "reason": plan.get("reason") or plan.get("message") or "",
                "action": plan.get("action") or "",
                "calculation_status": plan.get("calculation_status") or "error",
            }
        )
    return sorted(candidates, key=lambda item: (sort_rank(item.get("sort_rank")), -float(item.get("candidate_score") or 0), str(item.get("key") or "")))


def _crypto_calculation_summary(assets: list[dict[str, Any]]) -> dict[str, Any]:
    plans = [asset.get("signal_plan") or {} for asset in assets]
    error_count = len([plan for plan in plans if plan.get("calculation_status") != "complete"])
    return {
        "source": "backend",
        "fallback": False,
        "status": "error" if error_count else "complete",
        "total": len(plans),
        "complete_count": len(plans) - error_count,
        "error_count": error_count,
        "generated_at": _iso_now(),
    }


def _instrument_intraday_payload(key: str, selected_date: str | None, histories: dict[str, dict[str, Any]]) -> dict[str, Any]:
    source = histories.get(key) or {}
    candles = source.get("candles") or []
    rows = [_daily_row(candle) for candle in candles]
    rows = [row for row in rows if row]
    selected = _row_for_date(rows, selected_date) or (rows[-1] if rows else None)
    return {
        "ok": bool(source.get("ok")) and bool(rows),
        "label": source.get("label") or key,
        "symbol": source.get("symbol") or "",
            "interval": source.get("interval") or "30분",
            "source_interval": source.get("source_interval") or CRYPTO_INTRADAY_INTERVAL,
            "preferred_interval": source.get("preferred_interval") or "240분",
        "error": source.get("error"),
        "selected": selected,
        "latest": rows[-1] if rows else None,
        "history": rows,
    }


def _history_rows(source: dict[str, Any]) -> list[dict[str, Any]]:
    rows = [_daily_row(candle) for candle in (source.get("candles") or [])]
    return [row for row in rows if row]


def _us_stocks_payload(selected_date: str | None, histories: dict[str, dict[str, Any]]) -> dict[str, Any]:
    benchmark_rows = {
        symbol: _history_rows(histories.get(symbol) or {})
        for symbol in ("SPY", "QQQ")
    }
    assets = [
        _us_stock_payload(symbol, name, group, selected_date, histories.get(symbol) or {}, benchmark_rows)
        for symbol, name, group in US_STOCK_SYMBOLS
    ]
    usable = [asset for asset in assets if asset.get("ok")]
    candidates = sorted(
        usable,
        key=lambda asset: float((asset.get("summary") or {}).get("score") or 0),
        reverse=True,
    )
    benchmarks = [asset for asset in assets if asset.get("symbol") in {"SPY", "QQQ"}]
    summary = _us_market_summary(benchmarks, usable)
    return {
        "status": "tracked_universe",
        "generated_at": _iso_now(),
        "tracked_count": len(assets),
        "ready_count": len(usable),
        "candidate_count": len([asset for asset in usable if (asset.get("summary") or {}).get("signal") == "candidate"]),
        "summary": summary,
        "benchmarks": benchmarks,
        "top": candidates[:10],
        "assets": assets,
        "archive_note": "미장 종목은 핵심 추적군의 1년 일봉 기준 20/50/200일선, 21/63일 수익률, SPY/QQQ 상대강도로 신호를 계산합니다.",
    }


def _us_stock_payload(
    symbol: str,
    name: str,
    group: str,
    selected_date: str | None,
    source: dict[str, Any],
    benchmark_rows: dict[str, list[dict[str, Any]]],
) -> dict[str, Any]:
    rows = _history_rows(source)
    selected = _row_for_date(rows, selected_date) or (rows[-1] if rows else None)
    summary = _us_summary_for_rows(rows, selected, benchmark_rows)
    return {
        "ok": bool(source.get("ok")) and bool(rows),
        "label": name,
        "symbol": symbol,
        "market": "US",
        "group": group,
        "error": source.get("error"),
        "selected": selected,
        "latest": rows[-1] if rows else None,
        "history": rows,
        "summary": summary,
    }


def _index_proxy(kospi200: dict[str, Any], etf: dict[str, Any]) -> dict[str, Any]:
    if len(kospi200.get("history") or []) >= MIN_INDEX_HISTORY_DAYS:
        return {**kospi200, "proxy_for": None}
    return {**etf, "proxy_for": "KOSPI200"}


def _daily_row(candle: dict[str, Any]) -> dict[str, Any] | None:
    try:
        open_ = float(candle["open"])
        close = float(candle["close"])
        high = float(candle["high"])
        low = float(candle["low"])
    except (KeyError, TypeError, ValueError):
        return None
    change = close - open_
    row = {
        "date": str(candle.get("date") or ""),
        "open": round(open_, 4),
        "high": round(high, 4),
        "low": round(low, 4),
        "close": round(close, 4),
        "change": round(change, 4),
        "change_pct": round(change / open_ * 100, 2) if open_ else 0,
        "volume": int(float(candle.get("volume") or 0)),
    }
    if candle.get("time"):
        row["time"] = str(candle.get("time"))
    if candle.get("datetime"):
        row["datetime"] = str(candle.get("datetime"))
    return row


def _summary_for_rows(rows: list[dict[str, Any]], selected: dict[str, Any] | None) -> dict[str, Any]:
    if not rows or not selected:
        return {
            "signal": "neutral",
            "label": "자료 없음",
            "message": "1년 요약 데이터를 아직 가져오지 못했습니다.",
            "score": None,
        }
    index = rows.index(selected) if selected in rows else len(rows) - 1
    closes = [float(row["close"]) for row in rows[: index + 1]]
    close = closes[-1]
    ma20 = _average(closes[-20:])
    ma50 = _average(closes[-50:])
    ma60 = _average(closes[-60:])
    ma200 = _average(closes[-200:])
    ret_5 = _return(closes, 5)
    ret_21 = _return(closes, 21)
    ret_63 = _return(closes, 63)
    ret_126 = _return(closes, 126)
    ret_252 = _return(closes, 252)
    score = 50
    score += 16 if ma20 is not None and close >= ma20 else -8
    score += 14 if ma50 is not None and close >= ma50 else -8
    score += 10 if ma60 is not None and close >= ma60 else -5
    if ma200 is not None:
        score += 12 if close >= ma200 else -12
    score += 12 if ret_21 is not None and ret_21 >= 0 else -10
    score += 6 if ret_5 is not None and ret_5 >= 0 else -4
    if len(closes) < 200:
        score -= 4
    score = max(0, min(100, score))
    if score >= 70:
        signal = "candidate"
        label = "상승 우위"
        message = "20일/50일 추세와 최근 수익률이 우호적입니다."
    elif score >= 52:
        signal = "watch"
        label = "관찰"
        message = "방향은 중립권입니다. 주요선 회복 여부를 확인합니다."
    else:
        signal = "warning"
        label = "보수"
        message = "20일 또는 60일 추세가 약해 보수적으로 봅니다."
    return {
        "signal": signal,
        "label": label,
        "message": message,
        "score": round(score, 1),
        "data_points": len(closes),
        "score_basis": "daily_ma_return_state",
        "score_warning": "200일 미만 데이터는 장기추세 신뢰도를 낮춰 감점합니다." if len(closes) < 200 else None,
        "ma20": round(ma20, 4) if ma20 is not None else None,
        "ma50": round(ma50, 4) if ma50 is not None else None,
        "ma60": round(ma60, 4) if ma60 is not None else None,
        "ma200": round(ma200, 4) if ma200 is not None else None,
        "ret_5d": round(ret_5, 4) if ret_5 is not None else None,
        "ret_21d": round(ret_21, 4) if ret_21 is not None else None,
        "ret_63d": round(ret_63, 4) if ret_63 is not None else None,
        "ret_126d": round(ret_126, 4) if ret_126 is not None else None,
        "ret_252d": round(ret_252, 4) if ret_252 is not None else None,
    }


def _us_summary_for_rows(
    rows: list[dict[str, Any]],
    selected: dict[str, Any] | None,
    benchmark_rows: dict[str, list[dict[str, Any]]],
) -> dict[str, Any]:
    summary = _summary_for_rows(rows, selected)
    if not rows or not selected:
        return summary

    spy_summary = _summary_for_rows(benchmark_rows.get("SPY") or [], _row_for_date(benchmark_rows.get("SPY") or [], selected.get("date")) or None)
    qqq_summary = _summary_for_rows(benchmark_rows.get("QQQ") or [], _row_for_date(benchmark_rows.get("QQQ") or [], selected.get("date")) or None)
    ret_21 = summary.get("ret_21d")
    ret_63 = summary.get("ret_63d")
    spy_ret_63 = spy_summary.get("ret_63d")
    qqq_ret_63 = qqq_summary.get("ret_63d")
    benchmark_ret = max([value for value in (spy_ret_63, qqq_ret_63) if value is not None], default=None)
    relative_63 = ret_63 - benchmark_ret if ret_63 is not None and benchmark_ret is not None else None

    score = float(summary.get("score") or 0)
    if relative_63 is not None:
        if relative_63 >= 0.03:
            score += 10
        elif relative_63 < -0.03:
            score -= 10
    if summary.get("ma200") is not None and selected.get("close") is not None and float(selected["close"]) < float(summary["ma200"]):
        score -= 8
    score = max(0, min(100, score))

    if score >= 75:
        signal = "candidate"
        label = "상승 후보"
        message = "20/50/200일선과 SPY/QQQ 상대강도가 우호적입니다."
    elif score >= 55:
        signal = "watch"
        label = "관찰"
        message = "추세는 중립권입니다. 20/50일선 회복과 거래량을 확인합니다."
    else:
        signal = "warning"
        label = "보수"
        message = "200일선 또는 상대강도가 약해 보수적으로 관찰합니다."

    return {
        **summary,
        "signal": signal,
        "label": label,
        "message": message,
        "score": round(score, 1),
        "relative_63d": round(relative_63, 4) if relative_63 is not None else None,
        "spy_ret_63d": spy_ret_63,
        "qqq_ret_63d": qqq_ret_63,
        "ret_21d": ret_21,
    }


def _us_market_summary(benchmarks: list[dict[str, Any]], usable: list[dict[str, Any]]) -> dict[str, Any]:
    if not usable:
        return {
            "signal": "neutral",
            "label": "미장 자료 없음",
            "message": "미장 핵심 추적군 데이터를 아직 가져오지 못했습니다.",
            "score": None,
        }
    benchmark_scores = [
        float((asset.get("summary") or {}).get("score") or 0)
        for asset in benchmarks
        if asset.get("ok")
    ]
    score = sum(benchmark_scores) / len(benchmark_scores) if benchmark_scores else 50.0
    candidate_count = len([asset for asset in usable if (asset.get("summary") or {}).get("signal") == "candidate"])
    warning_count = len([asset for asset in usable if (asset.get("summary") or {}).get("signal") == "warning"])

    if score >= 70 and candidate_count >= 4:
        signal = "candidate"
        label = "미장 우호"
        message = "SPY/QQQ 기준 추세가 우호적이고 강한 추적군이 여러 개입니다."
    elif score < 50 or warning_count > candidate_count:
        signal = "warning"
        label = "미장 보수"
        message = "SPY/QQQ 또는 추적군 상대강도가 약해 보수적으로 봅니다."
    else:
        signal = "watch"
        label = "미장 관찰"
        message = "시장 기준은 중립권입니다. 관심종목별 20/50/200일선 확인이 필요합니다."

    return {
        "signal": signal,
        "label": label,
        "message": message,
        "score": round(score, 1),
        "candidate_count": candidate_count,
        "warning_count": warning_count,
    }


def _stocks_payload(market_report: dict[str, Any], kospi200: dict[str, Any]) -> dict[str, Any]:
    domestic = market_report.get("domestic") or {}
    periods = domestic.get("periods") or {}
    one_day = periods.get("1d") or {}
    one_month = periods.get("1m") or {}
    return {
        "status": "stock_only",
        "generated_at": market_report.get("generated_at"),
        "universe_summary": domestic.get("universe_summary") or {},
        "index_filter": _index_filter(kospi200),
        "short_term": _period_stock_summary(one_day),
        "swing": _period_stock_summary(one_month),
        "signal_tracking": domestic.get("signal_tracking") or {},
        "search_universe": _domestic_search_universe(domestic),
        "archive_note": "종목 탭은 주식 전용입니다. 90일 상세 종목 복기는 후보 스냅샷 저장이 쌓인 뒤 확장합니다.",
    }


def _domestic_search_universe(domestic: dict[str, Any]) -> list[dict[str, Any]]:
    rows = domestic.get("raw_universe") or []
    result: list[dict[str, Any]] = []
    for row in rows:
        symbol = str(row.get("symbol") or "").strip()
        name = str(row.get("name") or "").strip()
        if not symbol or not name:
            continue
        result.append(
            {
                "symbol": symbol,
                "name": name,
                "market": row.get("market") or "",
                "close": row.get("close"),
                "change_pct": row.get("change_pct"),
                "amount": row.get("amount"),
                "market_cap": row.get("market_cap"),
            }
        )
    return result[:3500]


def _period_stock_summary(period: dict[str, Any]) -> dict[str, Any]:
    candidates = period.get("final_candidates") or []
    watch = period.get("watch") or []
    backtest = period.get("backtest") or {}
    return {
        "label": period.get("label") or "-",
        "algorithm_label": period.get("algorithm_label") or period.get("algorithm") or "-",
        "candidate_count": len(candidates),
        "watch_count": len(watch),
        "top": candidates[:8],
        "watch": watch[:6],
        "backtest": backtest.get("metrics") or backtest,
        "quality_report": period.get("quality_report") or {},
    }


def _index_filter(kospi200: dict[str, Any]) -> dict[str, Any]:
    summary = (kospi200 or {}).get("summary") or {}
    selected = (kospi200 or {}).get("selected") or {}
    signal = summary.get("signal") or "neutral"
    source_label = (kospi200 or {}).get("label") or "KOSPI200"
    proxy_for = (kospi200 or {}).get("proxy_for")
    source_text = f"{source_label} 대체지표" if proxy_for else source_label
    if signal == "candidate":
        label = "지수 우호"
        message = f"{source_text} 흐름이 후보 종목 판단을 지지합니다."
        modifier = "allow"
    elif signal == "warning":
        label = "지수 약세"
        message = f"{source_text} 기준 지수 추종 리스크가 있어 주식 후보를 관찰로 낮춰 봅니다."
        modifier = "downgrade"
    else:
        label = "지수 중립"
        message = f"{source_text} 방향이 확정되기 전까지 강한 종목만 선별합니다."
        modifier = "neutral"
    return {
        "label": label,
        "message": message,
        "modifier": modifier,
        "signal": signal,
        "source": source_label,
        "proxy_for": proxy_for,
        "history_days": len((kospi200 or {}).get("history") or []),
        "close": selected.get("close"),
        "score": summary.get("score"),
    }


def _crypto_summary(assets: list[dict[str, Any]]) -> dict[str, Any]:
    usable = [asset for asset in assets if asset.get("ok")]
    if not usable:
        return {"label": "자료 없음", "message": "메이저 코인 데이터를 아직 가져오지 못했습니다.", "signal": "neutral"}
    strong = [asset for asset in usable if (asset.get("summary") or {}).get("signal") == "candidate"]
    weak = [asset for asset in usable if (asset.get("summary") or {}).get("signal") == "warning"]
    if strong and not weak:
        return {"label": "코인 강세", "message": "메이저 감시군 안에서 상승 우위 신호가 살아 있습니다.", "signal": "candidate"}
    if weak and len(weak) == len(usable):
        return {"label": "코인 보수", "message": "메이저 감시군 전반의 추세가 약해 관찰 우선입니다.", "signal": "warning"}
    return {"label": "코인 관찰", "message": "메이저 감시군 흐름이 엇갈리거나 중립권입니다.", "signal": "watch"}


def _row_for_date(rows: list[dict[str, Any]], selected_date: str | None) -> dict[str, Any] | None:
    if not selected_date:
        return None
    exact = [row for row in rows if row.get("date") == selected_date]
    if exact:
        return exact[-1]
    before = [row for row in rows if str(row.get("date") or "") <= selected_date]
    return before[-1] if before else None


def _read_market_report() -> dict[str, Any]:
    try:
        with MARKET_REPORT_PATH.open("r", encoding="utf-8") as file:
            return json.load(file)
    except (OSError, json.JSONDecodeError):
        return {}


def _average(values: list[float]) -> float | None:
    sample = [value for value in values if value is not None]
    return sum(sample) / len(sample) if sample else None


def _float_or_none(value: Any) -> float | None:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _bounded_score(value: Any, default: float = 0.0) -> float:
    parsed = _float_or_none(value)
    if parsed is None:
        parsed = default
    return max(0.0, min(100.0, parsed))


def _return(values: list[float], window: int) -> float | None:
    if len(values) <= window:
        return None
    base = values[-window - 1]
    return values[-1] / base - 1 if base else None


def _normalize_date(value: str | None) -> str | None:
    if not value:
        return None
    text = str(value).strip()
    try:
        return datetime.fromisoformat(text[:10]).date().isoformat()
    except ValueError:
        return None


def _iso_now() -> str:
    return datetime.now(KST).replace(microsecond=0).isoformat()
