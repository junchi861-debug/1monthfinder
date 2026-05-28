#!/usr/bin/env sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -d ".venv" ]; then
  python -m venv .venv
fi

. .venv/bin/activate
python -m pip install -r requirements.txt
python -m stock_finder.cli serve --host 0.0.0.0 --port "${PORT:-8000}" --refresh-minutes "${REFRESH_MINUTES:-0}" "$@"
