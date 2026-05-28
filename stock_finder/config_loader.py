from __future__ import annotations

import json
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_STRATEGY_CONFIG_PATH = PROJECT_ROOT / "config" / "algorithms" / "market_signals.json"
DEFAULT_CHART_CONFIG_PATH = PROJECT_ROOT / "config" / "charts" / "dashboard.json"


def load_market_strategy_config(path: str | Path | None = None) -> dict[str, Any]:
    config = _load_json(path or DEFAULT_STRATEGY_CONFIG_PATH)
    _require_keys(
        config,
        [
            "periods",
            "algorithms",
            "components",
            "thresholds",
            "default_algorithm_by_period",
            "signals",
        ],
        "market strategy config",
    )
    return config


def load_dashboard_chart_config(path: str | Path | None = None) -> dict[str, Any]:
    config = _load_json(path or DEFAULT_CHART_CONFIG_PATH)
    _require_keys(config, ["palette", "charts", "display"], "dashboard chart config")
    return config


def config_source_label(path: str | Path | None, default_path: Path) -> str:
    resolved = Path(path).resolve() if path else default_path.resolve()
    try:
        return resolved.relative_to(PROJECT_ROOT).as_posix()
    except ValueError:
        return resolved.as_posix()


def _load_json(path: str | Path) -> dict[str, Any]:
    config_path = Path(path)
    if not config_path.is_absolute():
        config_path = PROJECT_ROOT / config_path
    with config_path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, dict):
        raise ValueError(f"{config_path} must contain a JSON object")
    return data


def _require_keys(config: dict[str, Any], keys: list[str], name: str) -> None:
    missing = [key for key in keys if key not in config]
    if missing:
        raise ValueError(f"{name} is missing keys: {', '.join(missing)}")
