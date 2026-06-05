from __future__ import annotations

import unittest
from datetime import datetime, timedelta
from unittest.mock import patch

from stock_finder.options_monitor import (
    KST,
    _aggregate_candles_to_5m,
    _aggregate_candles_to_minutes,
    _attach_signal_outcomes,
    _fetch_naver_time_quotes,
    _is_market_time,
    _is_naver_live_window,
    _latest_session_candles,
    _signal_performance_summary,
)


def candle_at(moment: datetime, open_: float, high: float, low: float, close: float, volume: int = 10) -> dict[str, object]:
    return {
        "date": moment.date().isoformat(),
        "time": moment.strftime("%H:%M"),
        "datetime": moment.isoformat(),
        "open": open_,
        "high": high,
        "low": low,
        "close": close,
        "volume": volume,
    }


class OptionsMonitorHelperTests(unittest.TestCase):
    def test_aggregate_candles_to_minutes_preserves_ohlcv_order(self) -> None:
        start = datetime(2026, 6, 2, 9, 0, tzinfo=KST)
        candles = [
            candle_at(start + timedelta(minutes=0), 100, 102, 99, 101, 10),
            candle_at(start + timedelta(minutes=1), 101, 103, 100, 102, 20),
            candle_at(start + timedelta(minutes=4), 102, 104, 98, 99, 30),
            candle_at(start + timedelta(minutes=5), 99, 100, 95, 96, 40),
        ]

        result = _aggregate_candles_to_minutes(candles, 5)

        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["time"], "09:00")
        self.assertEqual(result[0]["open"], 100)
        self.assertEqual(result[0]["high"], 104)
        self.assertEqual(result[0]["low"], 98)
        self.assertEqual(result[0]["close"], 99)
        self.assertEqual(result[0]["volume"], 60)
        self.assertEqual(result[1]["time"], "09:05")

    def test_options_market_time_starts_at_0845(self) -> None:
        opening = datetime(2026, 6, 2, 8, 45, tzinfo=KST)

        self.assertTrue(_is_market_time(opening))
        self.assertTrue(_is_naver_live_window(opening))
        self.assertFalse(_is_market_time(opening - timedelta(minutes=1)))
        self.assertFalse(_is_naver_live_window(opening - timedelta(minutes=1)))

    def test_aggregate_naver_minutes_preserves_0845_bucket(self) -> None:
        start = datetime(2026, 6, 2, 8, 45, tzinfo=KST)
        candles = [
            candle_at(start, 100, 101, 99, 100.5, 10),
            candle_at(start + timedelta(minutes=1), 100.5, 102, 100, 101, 20),
            candle_at(start + timedelta(minutes=5), 101, 103, 101, 102, 30),
        ]

        result = _aggregate_candles_to_5m(candles)

        self.assertEqual(result[0]["time"], "08:45")
        self.assertEqual(result[0]["open"], 100)
        self.assertEqual(result[0]["high"], 102)
        self.assertEqual(result[0]["low"], 99)
        self.assertEqual(result[0]["close"], 101)
        self.assertEqual(result[0]["volume"], 30)
        self.assertEqual(result[1]["time"], "08:50")

    def test_fetch_naver_time_quotes_reads_back_to_0845(self) -> None:
        trade_date = datetime(2026, 6, 2, 9, 10, tzinfo=KST)

        def quote_at(hour: int, minute: int) -> dict[str, object]:
            return {"datetime": trade_date.replace(hour=hour, minute=minute), "close": 100}

        pages = {
            1: [quote_at(9, 10), quote_at(9, 5), quote_at(9, 0)],
            2: [quote_at(8, 55), quote_at(8, 50), quote_at(8, 45)],
            3: [quote_at(8, 40)],
        }

        with patch(
            "stock_finder.options_monitor._fetch_naver_time_page",
            side_effect=lambda *args: pages.get(args[2], []),
        ) as fetch_page:
            result = _fetch_naver_time_quotes("KPI200", "index", 3, trade_date)

        self.assertEqual(fetch_page.call_count, 2)
        self.assertEqual(result[0]["datetime"].strftime("%H:%M"), "08:45")
        self.assertEqual(result[-1]["datetime"].strftime("%H:%M"), "09:10")

    def test_latest_session_candles_returns_only_last_date(self) -> None:
        day_one = datetime(2026, 6, 1, 15, 30, tzinfo=KST)
        day_two = datetime(2026, 6, 2, 9, 0, tzinfo=KST)
        candles = [
            candle_at(day_one, 100, 101, 99, 100),
            candle_at(day_two, 101, 102, 100, 101),
            candle_at(day_two + timedelta(minutes=5), 101, 103, 101, 102),
        ]

        result = _latest_session_candles(candles)

        self.assertEqual(len(result), 2)
        self.assertTrue(all(candle["date"] == "2026-06-02" for candle in result))

    def test_attach_signal_outcomes_adds_horizon_returns(self) -> None:
        start = datetime(2026, 6, 2, 9, 0, tzinfo=KST)
        candles = [
            candle_at(start, 100, 101, 99, 100),
            candle_at(start + timedelta(minutes=5), 100, 102, 99, 101),
            candle_at(start + timedelta(minutes=10), 101, 103, 100, 102),
            candle_at(start + timedelta(minutes=15), 102, 104, 101, 103),
        ]
        entries = [
            {
                "key": "FIB_618_LOWER_WICK_RECLAIM:2026-06-02T09:00:00+09:00:100",
                "type": "candidate",
                "rule": "FIB_618_LOWER_WICK_RECLAIM",
                "trade_decision": "entry",
                "sourceAt": candles[0]["datetime"],
                "close": 100,
            }
        ]

        result = _attach_signal_outcomes(entries, candles, start + timedelta(minutes=15))

        outcome = result[0]["outcome"]
        self.assertEqual(outcome["status"], "ready")
        self.assertEqual(outcome["performance_basis"], "kospi200_index_proxy")
        self.assertFalse(outcome["is_real_option_fill"])
        self.assertAlmostEqual(outcome["horizons"]["15m"]["return_pct"], 3.0)
        self.assertAlmostEqual(outcome["horizons"]["15m"]["cost_adjusted_return_pct"], 2.85)
        self.assertEqual(outcome["horizons"]["15m"]["basis"], "kospi200_index_proxy")
        self.assertTrue(outcome["cost_model"]["requires_option_quote_validation"])
        self.assertTrue(outcome["success_15m"])

    def test_signal_performance_summary_uses_bayesian_confidence(self) -> None:
        start = datetime(2026, 6, 2, 9, 0, tzinfo=KST)
        entries = [
            {
                "key": "A",
                "rule": "FIB_618_LOWER_WICK_RECLAIM",
                "sourceAt": start.isoformat(),
                "outcome": {
                    "status": "ready",
                    "success_15m": True,
                    "max_favorable_points": 1.2,
                    "max_adverse_points": 0.2,
                    "horizons": {"15m": {"cost_adjusted_return_pct": 0.8}},
                },
            },
            {
                "key": "B",
                "rule": "FIB_618_LOWER_WICK_RECLAIM",
                "sourceAt": (start + timedelta(minutes=5)).isoformat(),
                "outcome": {
                    "status": "ready",
                    "success_15m": False,
                    "max_favorable_points": 0.3,
                    "max_adverse_points": 0.6,
                    "horizons": {"15m": {"cost_adjusted_return_pct": -0.2}},
                },
            },
        ]

        summary = _signal_performance_summary(entries)

        rule = summary["rules"][0]
        self.assertEqual(rule["ready_count"], 2)
        self.assertEqual(rule["success_15m_count"], 1)
        self.assertEqual(rule["success_15m_rate"], 0.5)
        self.assertIn("score", rule["confidence"])


if __name__ == "__main__":
    unittest.main()
