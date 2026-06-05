from __future__ import annotations

from datetime import datetime
import unittest

import pandas as pd

from stock_finder.backtest import walk_forward_scores
from stock_finder.market_report import (
    _aggregate_algorithm_performance,
    _apply_risk_and_regime_filters,
    _apply_correlation_diversification,
    _attach_cross_sectional_percentiles,
    _build_signal_snapshot,
    _backtest_cost_model,
    _exit_plan_for_row,
    _inverse_clip,
    _market_regime_filter_for_row,
    _outcomes_for_signal,
    _portfolio_equity_curve,
    _promote_target_candidates,
    _risk_gate_for_row,
    _select_portfolio_trades,
    _signal_quality_report,
    _strategy_validation,
)


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
    def test_inverse_clip_does_not_reward_missing_risk_value(self) -> None:
        self.assertEqual(_inverse_clip(float("nan"), 0.18, 0.75), 0.0)

    def test_short_term_target_candidates_are_validation_watch_items(self) -> None:
        rows = [
            {
                "symbol": "A",
                "score": 90,
                "liquidity_score": 1,
                "issue_score": 1,
                "risk_score": 1,
                "final_action": "candidate",
            }
        ]

        _promote_target_candidates(rows, "1d", "pulse", {"passed": True, "reasons": ["ok"]})

        self.assertEqual(rows[0]["final_action"], "watch")
        self.assertEqual(rows[0]["opportunity_action"], "top_issue_watch")
        self.assertTrue(rows[0]["opportunity_ranked"])

    def test_strategy_validation_reports_current_universe_warning(self) -> None:
        validation = _strategy_validation(
            {
                "metrics": {
                    "trade_count": 20,
                    "win_rate": 0.50,
                    "average_return": 0.01,
                    "max_drawdown": -0.10,
                    "validation_scope": "current_universe_history",
                }
            }
        )

        self.assertTrue(validation["passed"])
        self.assertIn("최신 유니버스", validation["warnings"][0])

    def test_cross_sectional_percentiles_rank_higher_scores_higher(self) -> None:
        rows = [
            {"score": 40, "momentum_score": 0.2, "risk_score": 0.3, "liquidity_score": 0.4},
            {"score": 80, "momentum_score": 0.8, "risk_score": 0.7, "liquidity_score": 0.9},
        ]

        _attach_cross_sectional_percentiles(rows)

        self.assertLess(rows[0]["score_percentile"], rows[1]["score_percentile"])
        self.assertLess(rows[0]["momentum_percentile"], rows[1]["momentum_percentile"])

    def test_risk_gate_blocks_low_liquidity_candidate(self) -> None:
        row = {
            "history_days": 100,
            "liquidity_score": 0.1,
            "risk_score": 0.8,
            "amount_20d": 100_000_000,
            "ret_1d": 0.01,
            "vol_21d": 0.3,
            "max_drawdown_63d": -0.08,
        }

        gate = _risk_gate_for_row(row, "1m")

        self.assertFalse(gate["passed"])
        self.assertEqual(gate["downgrade_action"], "avoid")
        self.assertIn("유동성", gate["summary"])

    def test_market_regime_filter_downgrades_weak_downtrend_candidate(self) -> None:
        row = {
            "market_regime": "trend_down",
            "momentum_score": 0.5,
            "risk_score": 0.6,
            "above_ma20": False,
        }

        gate = _market_regime_filter_for_row(row, "1m", "balanced")

        self.assertFalse(gate["passed"])
        self.assertEqual(gate["downgrade_action"], "watch")
        self.assertIn("trend_down", gate["summary"])

    def test_safety_filters_downgrade_candidate_and_record_blocker(self) -> None:
        row = {
            "final_action": "candidate",
            "reason": "점수 기준을 통과했습니다.",
            "history_days": 100,
            "liquidity_score": 0.1,
            "risk_score": 0.8,
            "amount_20d": 100_000_000,
            "ret_1d": 0.01,
            "vol_21d": 0.3,
            "max_drawdown_63d": -0.08,
            "market_regime": "range",
        }

        _apply_risk_and_regime_filters(row, "1m", "balanced")

        self.assertEqual(row["final_action"], "avoid")
        self.assertIn("risk_gate", row["candidate_blocked_by"])
        self.assertFalse(row["risk_gate"]["passed"])

    def test_signal_quality_report_counts_safety_downgrades(self) -> None:
        rows = [
            {
                "symbol": "A",
                "name": "Alpha",
                "action_before_safety_filters": "candidate",
                "final_action": "watch",
                "candidate_blocked_by": ["risk_gate"],
                "reason": "리스크 게이트 하향",
            },
            {
                "symbol": "B",
                "name": "Beta",
                "action_before_safety_filters": "candidate",
                "final_action": "candidate",
            },
        ]
        backtest = {
            "metrics": {
                "trade_count": 30,
                "win_rate": 0.55,
                "average_return": 0.01,
                "max_drawdown": -0.1,
            }
        }

        report = _signal_quality_report(rows, backtest, {"passed": True, "warnings": []}, "1m", "balanced")

        self.assertEqual(report["candidate_count"], 1)
        self.assertEqual(report["risk_gate_blocked_count"], 1)
        self.assertEqual(report["blocked_candidate_count"], 1)
        self.assertIn(report["signal"], {"candidate", "watch"})

    def test_exit_plan_uses_atr_rule_independent_from_score(self) -> None:
        plan = _exit_plan_for_row(
            {
                "last_close": 100.0,
                "atr_14_pct": 0.02,
                "vol_21d": 0.2,
                "final_action": "candidate",
                "momentum_score": 0.8,
            },
            "1m",
            "balanced",
        )

        self.assertEqual(plan["status"], "active")
        self.assertAlmostEqual(plan["stop_loss_pct"], 0.04)
        self.assertAlmostEqual(plan["take_profit_pct"], 0.08)
        self.assertEqual(plan["time_stop_days"], 21)

    def test_correlation_diversification_downgrades_third_similar_candidate(self) -> None:
        rows = [
            {"symbol": "A", "name": "Alpha", "score": 90, "final_action": "candidate", "reason": "점수 통과"},
            {"symbol": "B", "name": "Beta", "score": 80, "final_action": "candidate", "reason": "점수 통과"},
            {"symbol": "C", "name": "Gamma", "score": 70, "final_action": "candidate", "reason": "점수 통과"},
        ]
        index = pd.date_range("2026-01-01", periods=80, freq="D")
        close = [100.0 + day for day in range(80)]
        histories = {
            symbol: pd.DataFrame({"close": close}, index=index)
            for symbol in ["A", "B", "C"]
        }

        _apply_correlation_diversification(rows, histories, "1m", "balanced")

        self.assertEqual(rows[0]["final_action"], "candidate")
        self.assertEqual(rows[1]["final_action"], "candidate")
        self.assertEqual(rows[2]["final_action"], "watch")
        self.assertIn("correlation_diversification", rows[2]["candidate_blocked_by"])

    def test_signal_snapshot_keeps_candidate_context(self) -> None:
        snapshot = _build_signal_snapshot(
            {
                "1m": {
                    "algorithms": {
                        "balanced": {
                            "algorithm_label": "균형",
                            "holding_days": 21,
                            "rows": [
                                {
                                    "symbol": "A",
                                    "name": "Alpha",
                                    "as_of": "2026-01-01",
                                    "score": 80,
                                    "final_action": "candidate",
                                    "trade_signal": "buy",
                                    "last_close": 100,
                                    "exit_plan": {"status": "active"},
                                }
                            ],
                        }
                    }
                }
            },
            datetime(2026, 1, 1, 15, 30),
            {"track_actions": ["candidate"], "max_rows_per_period_algorithm": 10},
        )

        self.assertEqual(snapshot["as_of"], "2026-01-01")
        self.assertEqual(len(snapshot["signals"]), 1)
        self.assertEqual(snapshot["signals"][0]["tracking_key"], "1m:balanced:A:2026-01-01")

    def test_snapshot_outcomes_and_algorithm_performance_are_calculated(self) -> None:
        index = pd.date_range("2026-01-01", periods=5, freq="D")
        history = pd.DataFrame({"close": [100.0, 105.0, 95.0, 110.0, 120.0]}, index=index)
        outcomes = _outcomes_for_signal(
            {
                "symbol": "A",
                "name": "Alpha",
                "as_of": "2026-01-01",
                "entry_close": 100.0,
                "period": "1m",
                "algorithm": "balanced",
                "algorithm_label": "균형",
                "final_action": "candidate",
                "score": 80,
                "exit_plan": {"stop_loss_price": 90, "take_profit_price": 115, "time_stop_days": 20},
            },
            history,
            [1, 3],
            "2026-01-01",
        )
        performance = _aggregate_algorithm_performance(outcomes)

        self.assertEqual(len(outcomes), 2)
        self.assertEqual(outcomes[0]["return"], 0.05)
        horizon_three = [row for row in performance if row["horizon"] == 3][0]
        self.assertEqual(horizon_three["sample_count"], 1)
        self.assertEqual(horizon_three["average_return"], 0.1)

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
