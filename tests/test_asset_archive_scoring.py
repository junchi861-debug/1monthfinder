from __future__ import annotations

import unittest

from stock_finder.asset_archive import _crypto_backend_signal_plan, _summary_for_rows


class AssetArchiveScoringTests(unittest.TestCase):
    def test_crypto_plan_errors_when_daily_summary_score_is_missing(self) -> None:
        plan = _crypto_backend_signal_plan(
            {
                "ok": True,
                "profile": {"key": "btc"},
                "summary": {},
                "selected": {"date": "2026-06-02"},
                "intraday": {"ok": True, "history": [{"date": "2026-06-02", "close": 100}]},
            }
        )

        self.assertFalse(plan["ok"])
        self.assertEqual(plan["error_code"], "SUMMARY_SCORE_MISSING")
        self.assertEqual(plan["candidate_score"], 0)

    def test_summary_penalizes_short_history_quality(self) -> None:
        rows = [{"date": f"2026-01-{day:02d}", "close": float(day)} for day in range(1, 31)]
        summary = _summary_for_rows(rows, rows[-1])

        self.assertEqual(summary["data_points"], 30)
        self.assertIn("200일 미만", summary["score_warning"])


if __name__ == "__main__":
    unittest.main()
