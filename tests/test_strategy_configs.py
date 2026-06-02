from __future__ import annotations

import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from stock_finder.config_loader import (
    PROJECT_ROOT,
    load_dashboard_chart_config,
    load_market_strategy_config,
)


class StrategyConfigTests(unittest.TestCase):
    def test_default_market_and_chart_configs_load(self) -> None:
        market = load_market_strategy_config()
        chart = load_dashboard_chart_config()

        self.assertIn("periods", market)
        self.assertIn("algorithms", market)
        self.assertIn("palette", chart)

    def test_market_config_requires_core_keys(self) -> None:
        with TemporaryDirectory() as tmp_dir:
            path = Path(tmp_dir) / "broken.json"
            path.write_text(json.dumps({"periods": {}}), encoding="utf-8")

            with self.assertRaises(ValueError):
                load_market_strategy_config(path)

    def test_published_strategy_configs_do_not_ship_todo_strings(self) -> None:
        paths = [
            PROJECT_ROOT / "config" / "algorithms" / "index_trading.json",
            PROJECT_ROOT / "config" / "algorithms" / "weekly_options.json",
            PROJECT_ROOT / "site" / "data" / "index_trading.json",
            PROJECT_ROOT / "site" / "data" / "weekly_options.json",
        ]

        for path in paths:
            with self.subTest(path=path):
                data = path.read_text(encoding="utf-8")
                self.assertNotIn('"TODO"', data)
                json.loads(data)


if __name__ == "__main__":
    unittest.main()
