from __future__ import annotations

import unittest

import pandas as pd

from stock_finder.backtest import walk_forward_scores
from stock_finder.market_report import _backtest_cost_model, _portfolio_equity_curve, _select_portfolio_trades


class WalkForwardBacktestTests(unittest.TestCase):
    def test_walk_forward_uses_fixed_lookback_and_separates_entry_date(self) -> None:
        index = pd.date_range("2026-01-01", periods=10, freq="D")
        history = pd.DataFrame(
            {
                "close": [float(value) for value in range(10, 20)],
                "volume": [1000] * 10,
            },
            index=index,
        )

        result = walk_forward_scores("TEST", history, lookback_days=3, holding_days=2, step_days=2)

        self.assertFalse(result.empty)
        first = result.iloc[0]
        self.assertEqual(first["as_of"], "2026-01-03")
        self.assertEqual(first["entry_date"], "2026-01-04")
        self.assertEqual(first["entry_close"], 13.0)
        self.assertEqual(first["embargo_days"], 0)

    def test_walk_forward_embargo_leaves_gap_before_entry(self) -> None:
        index = pd.date_range("2026-01-01", periods=12, freq="D")
        history = pd.DataFrame(
            {
                "close": [float(value) for value in range(10, 22)],
                "volume": [1000] * 12,
            },
            index=index,
        )

        result = walk_forward_scores("TEST", history, lookback_days=3, holding_days=2, step_days=2, embargo_days=1)

        first = result.iloc[0]
        self.assertEqual(first["as_of"], "2026-01-03")
        self.assertEqual(first["entry_date"], "2026-01-05")
        self.assertEqual(first["embargo_days"], 1)


class PortfolioBacktestTests(unittest.TestCase):
    def test_select_portfolio_trades_respects_open_position_slots(self) -> None:
        frame = pd.DataFrame(
            [
                {"date": "2026-01-01", "exit_date": "2026-01-03", "symbol": "A", "score": 90, "net_return": 0.10},
                {"date": "2026-01-01", "exit_date": "2026-01-03", "symbol": "B", "score": 80, "net_return": 0.05},
                {"date": "2026-01-01", "exit_date": "2026-01-03", "symbol": "C", "score": 70, "net_return": 0.04},
                {"date": "2026-01-02", "exit_date": "2026-01-04", "symbol": "D", "score": 95, "net_return": 0.03},
                {"date": "2026-01-03", "exit_date": "2026-01-05", "symbol": "E", "score": 88, "net_return": 0.02},
            ]
        )

        selected = _select_portfolio_trades(frame, max_positions=2)

        self.assertEqual([trade["symbol"] for trade in selected], ["A", "B", "E"])

    def test_select_portfolio_trades_applies_embargo_after_exit(self) -> None:
        frame = pd.DataFrame(
            [
                {"date": "2026-01-01", "exit_date": "2026-01-03", "symbol": "A", "score": 90, "net_return": 0.10},
                {"date": "2026-01-03", "exit_date": "2026-01-05", "symbol": "B", "score": 95, "net_return": 0.03},
                {"date": "2026-01-04", "exit_date": "2026-01-06", "symbol": "C", "score": 88, "net_return": 0.02},
            ]
        )

        selected = _select_portfolio_trades(frame, max_positions=1, embargo_days=1)

        self.assertEqual([trade["symbol"] for trade in selected], ["A", "C"])

    def test_portfolio_equity_curve_scales_returns_by_slots(self) -> None:
        trades = pd.DataFrame(
            [
                {"exit_date": "2026-01-03", "net_return": 0.10},
                {"exit_date": "2026-01-03", "net_return": -0.05},
            ]
        )

        curve = _portfolio_equity_curve(trades, max_positions=2)

        self.assertEqual(curve[0]["date"], "2026-01-03")
        self.assertAlmostEqual(curve[0]["equity"], 1.025)

    def test_backtest_cost_model_combines_configured_cost_components(self) -> None:
        costs = _backtest_cost_model(0.0015)

        self.assertEqual(costs["transaction_cost"], 0.0015)
        self.assertGreater(costs["total_cost"], costs["transaction_cost"])


if __name__ == "__main__":
    unittest.main()
