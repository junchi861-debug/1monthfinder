from __future__ import annotations

import argparse
import functools
import logging
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from stock_finder.market_report import build_market_site_data


PROJECT_ROOT = Path(__file__).resolve().parents[1]
LOGGER = logging.getLogger("stock_finder.local_server")


def serve_local_app(args: argparse.Namespace) -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    if args.build_on_start:
        _refresh_data(args)

    if args.refresh_minutes > 0:
        thread = threading.Thread(target=_refresh_loop, args=(args,), daemon=True)
        thread.start()

    handler = functools.partial(SimpleHTTPRequestHandler, directory=str(PROJECT_ROOT))
    server = ThreadingHTTPServer((args.host, args.port), handler)
    LOGGER.info("serving 1MonthFinder at http://%s:%s/site/", args.host, args.port)
    LOGGER.info("same Wi-Fi phone URL is usually http://<computer-ip>:%s/site/", args.port)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        LOGGER.info("stopping local server")
    finally:
        server.server_close()


def _refresh_loop(args: argparse.Namespace) -> None:
    interval_seconds = max(60, int(args.refresh_minutes * 60))
    while True:
        time.sleep(interval_seconds)
        _refresh_data(args)


def _refresh_data(args: argparse.Namespace) -> None:
    try:
        LOGGER.info("refreshing market data")
        report = build_market_site_data(
            out_dir=PROJECT_ROOT / "site" / "data",
            domestic_limit=args.domestic_limit,
            years=args.years,
            transaction_cost=args.transaction_cost,
            strategy_config_path=args.strategy_config,
            chart_config_path=args.chart_config,
        )
        summary = report["domestic"]["universe_summary"]
        LOGGER.info(
            "market data refreshed: universe=%s history_ready=%s",
            summary["total_count"],
            summary["history_ready_count"],
        )
    except Exception:
        LOGGER.exception("market data refresh failed; serving the last available data")
