#!/usr/bin/env sh
set -eu

SCRIPT_DIR="${0%/*}"
if [ "$SCRIPT_DIR" = "$0" ]; then
  SCRIPT_DIR="."
fi
ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

PYTHON_BIN="${PYTHON_BIN:-}"
if [ -z "$PYTHON_BIN" ]; then
  if command -v python >/dev/null 2>&1; then
    PYTHON_BIN="$(command -v python)"
  elif command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="$(command -v python3)"
  else
    echo "Python was not found. In Termux, run: pkg install -y python"
    exit 1
  fi
fi

COMMAND_NAME="${1:-start}"
if [ "$COMMAND_NAME" = "doctor" ]; then
  echo "1MonthFinder phone backend doctor"
  echo "ROOT=$ROOT"
  echo "PORT=${PORT:-8000}"
  echo "PYTHON=$PYTHON_BIN"
  "$PYTHON_BIN" --version
  "$PYTHON_BIN" -m py_compile stock_finder/cli.py stock_finder/local_server.py stock_finder/options_monitor.py stock_finder/options_archive.py
  echo "OK: backend files compile."
  exit 0
fi
if [ "$COMMAND_NAME" = "start" ] && [ "$#" -gt 0 ]; then
  shift
fi

if command -v termux-wake-lock >/dev/null 2>&1; then
  termux-wake-lock || true
fi

"$PYTHON_BIN" -m stock_finder.cli serve --host 0.0.0.0 --port "${PORT:-8000}" --refresh-minutes "${REFRESH_MINUTES:-0}" "$@"
