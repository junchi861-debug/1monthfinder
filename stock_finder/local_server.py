from __future__ import annotations

import argparse
import functools
import json
import logging
import threading
import time
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from stock_finder.options_archive import build_options_replay_payload
from stock_finder.options_monitor import KST, build_options_monitor_snapshot


PROJECT_ROOT = Path(__file__).resolve().parents[1]
LOGGER = logging.getLogger("stock_finder.local_server")


def serve_local_app(args: argparse.Namespace) -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    if args.build_on_start:
        _refresh_data(args)

    if args.refresh_minutes > 0:
        thread = threading.Thread(target=_refresh_loop, args=(args,), daemon=True)
        thread.start()

    handler = functools.partial(StockFinderRequestHandler, directory=str(PROJECT_ROOT))
    server = ThreadingHTTPServer((args.host, args.port), handler)
    LOGGER.info("serving 1MonthFinder at http://%s:%s/site/", args.host, args.port)
    LOGGER.info("same Wi-Fi phone URL is usually http://<computer-ip>:%s/site/", args.port)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        LOGGER.info("stopping local server")
    finally:
        server.server_close()


class StockFinderRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            self._send_health()
            return
        if parsed.path == "/api/options-monitor":
            self._send_options_monitor()
            return
        if parsed.path == "/api/options-replay":
            self._send_options_replay(parsed.query)
            return
        super().do_GET()

    def _send_json(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_health(self) -> None:
        self._send_json(
            {
                "ok": True,
                "service": "1MonthFinder options backend",
                "generated_at": datetime.now(KST).isoformat(),
                "host": self.headers.get("Host", ""),
                "endpoints": ["/api/options-monitor", "/api/options-replay"],
                "env_mode": "server",
            }
        )

    def _send_options_monitor(self) -> None:
        try:
            payload = build_options_monitor_snapshot()
            status = 200 if payload.get("ok") else 502
        except Exception as exc:
            LOGGER.exception("options monitor snapshot failed")
            status = 500
            payload = {
                "ok": False,
                "mode": "monitor_only",
                "error": str(exc),
                "signal": {
                    "type": "warning",
                    "label": "서버 오류",
                    "title": "서버 오류",
                    "message": "옵션 감시 데이터를 계산하지 못했습니다.",
                    "alert_level": "normal",
                    "rule": "SERVER_ERROR",
                    "time": "-",
                    "metrics": {},
                },
            }

        self._send_json(payload, status)

    def _send_options_replay(self, query: str) -> None:
        params = parse_qs(query)
        date = (params.get("date") or [None])[0]
        refresh = (params.get("refresh") or ["0"])[0] == "1"
        try:
            payload = build_options_replay_payload(date=date, refresh=refresh)
            status = 200 if payload.get("ok") else 404
        except Exception as exc:
            LOGGER.exception("options replay payload failed")
            status = 500
            payload = {
                "ok": False,
                "status": "error",
                "error": str(exc),
                "sessions": [],
                "active_session": None,
            }

        self._send_json(payload, status)


def _refresh_loop(args: argparse.Namespace) -> None:
    interval_seconds = max(60, int(args.refresh_minutes * 60))
    while True:
        time.sleep(interval_seconds)
        _refresh_data(args)


def _refresh_data(args: argparse.Namespace) -> None:
    try:
        from stock_finder.market_report import build_market_site_data

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
