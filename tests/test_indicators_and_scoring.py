from __future__ import annotations

import math
import unittest

import numpy as np
import pandas as pd

from stock_finder.indicators import average_traded_value, max_drawdown, pct_return, rsi
from stock_finder.scoring import score_history


class IndicatorTests(unittest.TestCase):
    def test_pct_return_uses_window_start_to_latest_close(self) -> None:
        close = pd.Series([100.0, 105.0, 110.0, 121.0])

        self.assertAlmostEqual(pct_return(close, 2), 121.0 / 105.0 - 1)

    def test_pct_return_returns_nan_without_enough_history(self) -> None:
        close = pd.Series([100.0, 101.0])

        self.assertTrue(math.isnan(pct_return(close, 2)))

    def test_max_drawdown_reports_worst_peak_to_close_loss(self) -> None:
        close = pd.Series([100.0, 120.0, 90.0, 110.0])

        self.assertAlmostEqual(max_drawdown(close, 4), -0.25)

    def test_average_traded_value_uses_tail_window(self) -> None:
        close = pd.Series([10.0, 20.0, 30.0])
        volume = pd.Series([100.0, 200.0, 300.0])

        self.assertAlmostEqual(average_traded_value(close, volume, 2), (20.0 * 200.0 + 30.0 * 300.0) / 2)

    def test_rsi_returns_neutral_for_flat_series(self) -> None:
        close = pd.Series([100.0] * 20)

        self.assertEqual(rsi(close, 14), 50.0)


class ScoringTests(unittest.TestCase):
    def test_score_history_returns_bounded_score_and_expected_fields(self) -> None:
        close = pd.Series(np.linspace(100.0, 128.0, 90))
        volume = pd.Series([1_000_000] * 90)
        history = pd.DataFrame({"close": close, "volume": volume})

        result = score_history(history)

        self.assertGreaterEqual(result["score"], 0)
        self.assertLessEqual(result["score"], 100)
        self.assertIn(result["expected_action"], {"candidate", "watch", "avoid"})
        self.assertEqual(result["last_close"], 128.0)
        self.assertIn("liquidity_score", result)


if __name__ == "__main__":
    unittest.main()
