from __future__ import annotations

import unittest
from datetime import datetime, timedelta

from stock_finder.options_monitor import (
    KST,
    _aggregate_candles_to_minutes,
    _attach_signal_outcomes,
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
        self.assertAlmostEqual(outcome["horizons"]["15m"]["return_pct"], 3.0)
        self.assertAlmostEqual(outcome["horizons"]["15m"]["cost_adjusted_return_pct"], 2.85)
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
